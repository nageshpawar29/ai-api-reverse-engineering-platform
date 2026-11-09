import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiEndpoint, SecurityFinding } from '../../types/index.js';

export class SecurityAnalyzer {
  public static async analyze(
    projectDir: string,
    projectId: string,
    endpoints: ApiEndpoint[],
    allFiles: string[]
  ): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // 1. Missing Authentication on Sensitive Routes
    const sensitivePathPatterns = [
      /users?(\/|$)/i,
      /admin(\/|$)/i,
      /orders?(\/|$)/i,
      /payments?(\/|$)/i,
      /accounts?(\/|$)/i,
      /settings?(\/|$)/i,
    ];

    for (const ep of endpoints) {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(ep.method)) {
        const isAuthRoute = ep.path.includes('/login') || ep.path.includes('/register') || ep.path.includes('/signup');
        if (!isAuthRoute && !ep.authRequired) {
          const isSensitive = sensitivePathPatterns.some((pattern) => pattern.test(ep.path));
          if (isSensitive) {
            findings.push({
              id: `sec-${uuidv4().substring(0, 8)}`,
              projectId,
              endpointId: ep.id,
              severity: 'high',
              category: 'Broken Authentication',
              title: `Unprotected Sensitive State-Modifying Endpoint: ${ep.method} ${ep.path}`,
              description: `The endpoint ${ep.method} ${ep.path} modifies application state or manages sensitive resources but does not enforce authentication middleware in its route chain.`,
              sourceFile: ep.sourceFile,
              lineNumber: ep.lineStart,
              recommendation:
                'Apply authentication middleware (e.g. requireAuth or JWT verification) before executing controller handlers for this route.',
              detectionType: 'DETECTED',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      // 2. Missing Input Validation on Endpoints with Request Bodies
      if (['POST', 'PUT', 'PATCH'].includes(ep.method)) {
        const hasValidationMiddleware = ep.middleware.some((m) =>
          ['validate', 'validation', 'check', 'validator', 'schema', 'zod', 'joi'].some((kw) =>
            m.toLowerCase().includes(kw)
          )
        );

        if (!hasValidationMiddleware && ep.parameters.some((p) => p.paramIn === 'body')) {
          findings.push({
            id: `sec-${uuidv4().substring(0, 8)}`,
            projectId,
            endpointId: ep.id,
            severity: 'medium',
            category: 'Input Validation',
            title: `Missing Schema Validation Middleware: ${ep.method} ${ep.path}`,
            description: `Route receives payload parameters but does not bind a recognizable validation schema middleware (e.g. Zod, Joi, express-validator).`,
            sourceFile: ep.sourceFile,
            lineNumber: ep.lineStart,
            recommendation:
              'Bind a strict schema validation middleware (such as Zod or Joi) to reject malformed payloads before invoking business logic.',
            detectionType: 'DETECTED',
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // 3. Scan Files for Hardcoded Secrets, Dangerous APIs, and SQL Injection Patterns
    for (const filePath of allFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const relPath = path.relative(projectDir, filePath);
        const lines = code.split('\n');

        lines.forEach((line, idx) => {
          const lineNum = idx + 1;

          // Hard-coded secrets pattern
          if (
            /(jwt_secret|api_key|secret_key|private_key|database_password|db_password)\s*[:=]\s*["'][a-zA-Z0-9_\-!@#$%^&*]{8,}["']/i.test(
              line
            ) &&
            !line.includes('process.env')
          ) {
            findings.push({
              id: `sec-${uuidv4().substring(0, 8)}`,
              projectId,
              severity: 'critical',
              category: 'Hardcoded Secrets',
              title: `Potential Hardcoded Credential in ${path.basename(filePath)}`,
              description: `Detected literal secret token assignment on line ${lineNum}. Committing secrets to source control leads to credential leakage.`,
              sourceFile: relPath,
              lineNumber: lineNum,
              recommendation:
                'Move credentials and secret keys to environment variables and load them via process.env.',
              detectionType: 'DETECTED',
              createdAt: new Date().toISOString(),
            });
          }

          // Dangerous eval or child_process pattern
          if (/\beval\s*\(/.test(line) || /child_process\.(exec|execSync)\s*\(/.test(line)) {
            findings.push({
              id: `sec-${uuidv4().substring(0, 8)}`,
              projectId,
              severity: 'high',
              category: 'Arbitrary Code Execution',
              title: `Dangerous Dynamic Execution in ${path.basename(filePath)}`,
              description: `Usage of eval() or child_process.exec() detected on line ${lineNum}. Passing untrusted input to dynamic execution can result in remote code execution (RCE).`,
              sourceFile: relPath,
              lineNumber: lineNum,
              recommendation:
                'Avoid dynamic code evaluation. Use structured parsers or parameterized child_process.execFile() with sanitized argument lists.',
              detectionType: 'DETECTED',
              createdAt: new Date().toISOString(),
            });
          }

          // SQL String Concatenation injection risk
          if (
            /(query|execute)\s*\(\s*["'`]SELECT.+FROM.+\+\s*[a-zA-Z0-9_]/i.test(line) ||
            /(query|execute)\s*\(\s*`SELECT.+FROM.+\$\{[^}]+\}/i.test(line)
          ) {
            findings.push({
              id: `sec-${uuidv4().substring(0, 8)}`,
              projectId,
              severity: 'high',
              category: 'SQL Injection',
              title: `Raw SQL Concatenation Detected in ${path.basename(filePath)}`,
              description: `SQL query constructed using string concatenation or unescaped template literals on line ${lineNum}.`,
              sourceFile: relPath,
              lineNumber: lineNum,
              recommendation:
                'Use parameterized queries (e.g. query("SELECT * FROM users WHERE id = $1", [id])) or an ORM.',
              detectionType: 'DETECTED',
              createdAt: new Date().toISOString(),
            });
          }
        });
      } catch (err) {}
    }

    return findings;
  }
}
