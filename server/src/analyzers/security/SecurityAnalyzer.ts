import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiEndpoint, SecurityFinding } from '../../types/index.js';

export class SecurityAnalyzer {
  public static async analyze(
    projectDir: string,
    projectId: string,
    endpoints: ApiEndpoint[],
    allFiles: string[] = []
  ): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // 1. Missing Authentication on State-Modifying or Sensitive Routes
    const sensitivePathPatterns = [
      /users?(\/|$)/i,
      /admin(\/|$)/i,
      /orders?(\/|$)/i,
      /payments?(\/|$)/i,
      /accounts?(\/|$)/i,
      /settings?(\/|$)/i,
      /profile(\/|$)/i,
      /dashboard(\/|$)/i,
    ];

    for (const ep of endpoints) {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(ep.method)) {
        const isPublicAuthAction =
          ep.path.endsWith('/login') ||
          ep.path.endsWith('/register') ||
          ep.path.endsWith('/signup') ||
          ep.path.endsWith('/health');

        if (!isPublicAuthAction && !ep.authRequired) {
          findings.push({
            id: `sec-${uuidv4().substring(0, 8)}`,
            projectId,
            endpointId: ep.id,
            severity: 'high',
            category: 'Broken Authentication',
            title: `State-Modifying Operation Lacks Authentication: ${ep.method} ${ep.path}`,
            description: `The endpoint ${ep.method} ${ep.path} modifies application data without enforcing an authentication guard (JWT/Bearer/Session) in its route middleware chain.`,
            sourceFile: ep.sourceFile,
            lineNumber: ep.lineStart || 1,
            recommendation:
              'Apply authentication middleware (e.g. requireAuth, verifyToken, or JWT guard) before executing the route handler.',
            detectionType: 'DETECTED',
            createdAt: new Date().toISOString(),
          });
        }
      }

      // 2. Missing Input Validation on Endpoints with Request Payloads
      if (['POST', 'PUT', 'PATCH'].includes(ep.method)) {
        const hasValidationMiddleware = (ep.middleware || []).some((m) =>
          ['validate', 'validation', 'check', 'validator', 'schema', 'zod', 'joi'].some((kw) =>
            m.toLowerCase().includes(kw)
          )
        );

        if (!hasValidationMiddleware) {
          findings.push({
            id: `sec-${uuidv4().substring(0, 8)}`,
            projectId,
            endpointId: ep.id,
            severity: 'medium',
            category: 'Input Validation',
            title: `Missing Schema Validation Guard: ${ep.method} ${ep.path}`,
            description: `Endpoint receives client request data but does not bind a strict schema validation middleware (e.g. Zod, Joi, express-validator).`,
            sourceFile: ep.sourceFile,
            lineNumber: ep.lineStart || 1,
            recommendation:
              'Bind a request body validation schema (such as Zod or Joi) to validate and sanitize parameters prior to business logic execution.',
            detectionType: 'DETECTED',
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // 3. Global Architecture Security Audits (Helmet, CORS, Rate Limiting)
    let hasHelmet = false;
    let hasRateLimit = false;
    let hasCors = false;
    let hasWildcardCors = false;

    for (const filePath of allFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const lower = code.toLowerCase();

        if (lower.includes('helmet')) hasHelmet = true;
        if (lower.includes('rate-limit') || lower.includes('ratelimit')) hasRateLimit = true;
        if (lower.includes('cors(') || lower.includes('cors:')) {
          hasCors = true;
          if (code.includes("origin: '*'") || code.includes('origin: "*"') || code.includes("origin: true")) {
            hasWildcardCors = true;
          }
        }
      } catch (e) {}
    }

    // Missing Helmet
    if (!hasHelmet) {
      findings.push({
        id: `sec-helmet-${uuidv4().substring(0, 8)}`,
        projectId,
        severity: 'medium',
        category: 'Security Headers',
        title: 'Missing HTTP Security Headers (Helmet)',
        description: 'The application does not appear to register Helmet middleware to set essential HTTP security headers (X-Content-Type-Options, Strict-Transport-Security, X-Frame-Options).',
        sourceFile: 'server/app',
        lineNumber: 1,
        recommendation: 'Install and mount helmet middleware: `app.use(helmet())` at the top of your Express entry point.',
        detectionType: 'DETECTED',
        createdAt: new Date().toISOString(),
      });
    }

    // Missing Rate Limiting
    if (!hasRateLimit) {
      findings.push({
        id: `sec-ratelimit-${uuidv4().substring(0, 8)}`,
        projectId,
        severity: 'medium',
        category: 'Rate Limiting',
        title: 'Missing Global API Rate Limiting Guard',
        description: 'No global request rate limiting middleware was detected. Public API endpoints are susceptible to brute-force attacks and denial-of-service (DoS) bursts.',
        sourceFile: 'server/app',
        lineNumber: 1,
        recommendation: 'Mount express-rate-limit middleware to restrict excessive automated requests per IP address.',
        detectionType: 'DETECTED',
        createdAt: new Date().toISOString(),
      });
    }

    // Wildcard CORS
    if (hasWildcardCors) {
      findings.push({
        id: `sec-cors-${uuidv4().substring(0, 8)}`,
        projectId,
        severity: 'low',
        category: 'CORS Configuration',
        title: 'Overly Permissive Cross-Origin Resource Sharing (CORS)',
        description: 'CORS configuration allows requests from wildcard origin (*). In production, cross-origin access should be restricted to trusted domains.',
        sourceFile: 'server/cors',
        lineNumber: 1,
        recommendation: 'Configure CORS with an explicit whitelist array of allowed client origins.',
        detectionType: 'DETECTED',
        createdAt: new Date().toISOString(),
      });
    }

    // 4. Code Pattern Scans: Hardcoded Secrets, Dangerous APIs, SQL Injection
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
