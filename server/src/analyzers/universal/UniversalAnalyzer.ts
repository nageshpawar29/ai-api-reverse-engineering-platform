import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ApiEndpoint,
  ApiParameter,
  ApiResponse,
  DatabaseModel,
  DependencyNode,
  HttpMethod,
  ModelField,
  SecurityFinding,
} from '../../types/index.js';
import { FrameworkAnalyzer, AnalysisEngineResult } from '../FrameworkAnalyzer.js';

export class UniversalAnalyzer implements FrameworkAnalyzer {
  public readonly name = 'Universal Polyglot & Heuristic AST Engine';

  public async detect(projectDir: string): Promise<boolean> {
    return true; // Universal fallback can handle any directory
  }

  public async analyze(projectDir: string, projectId: string): Promise<AnalysisEngineResult> {
    const endpoints: ApiEndpoint[] = [];
    const models: DatabaseModel[] = [];
    const dependencies: DependencyNode[] = [];
    const securityFindings: SecurityFinding[] = [];

    const allSourceFiles = this.getAllCodeFiles(projectDir);

    for (const filePath of allSourceFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(projectDir, filePath);
        const ext = path.extname(filePath).toLowerCase();

        // 1. Next.js / Nuxt / Remix File-Based API Routes
        if (
          relativePath.includes('pages/api/') ||
          relativePath.includes('pages/api\\') ||
          (relativePath.includes('app/api/') && relativePath.endsWith('route.ts')) ||
          (relativePath.includes('app/api/') && relativePath.endsWith('route.js'))
        ) {
          const fileEndpoints = this.extractNextJsRoutes(filePath, relativePath, code, projectId);
          endpoints.push(...fileEndpoints);
        }

        // 2. Universal Method Invocation Routes: router.get('/path', ...), app.post('/path', ...)
        const routerEndpoints = this.extractRouterInvocations(code, relativePath, projectId);
        for (const rep of routerEndpoints) {
          if (!endpoints.some((e) => e.method === rep.method && e.path === rep.path)) {
            endpoints.push(rep);
          }
        }

        // 3. Universal Decorator Routes: @app.get('/path'), @router.post('/path'), @GetMapping('/path')
        const decoratorEndpoints = this.extractDecoratorRoutes(code, relativePath, projectId);
        for (const dep of decoratorEndpoints) {
          if (!endpoints.some((e) => e.method === dep.method && e.path === dep.path)) {
            endpoints.push(dep);
          }
        }

        // 4. SQL DDL Table Extraction (CREATE TABLE ...)
        if (ext === '.sql' || code.includes('CREATE TABLE')) {
          const sqlModels = this.extractSqlTables(code, relativePath, projectId);
          for (const sm of sqlModels) {
            if (!models.some((m) => m.name.toLowerCase() === sm.name.toLowerCase())) {
              models.push(sm);
            }
          }
        }
      } catch (err) {
        // Continue parsing next files
      }
    }

    return {
      endpoints,
      models,
      dependencies,
      securityFindings,
      fileCount: allSourceFiles.length,
    };
  }

  private extractNextJsRoutes(
    filePath: string,
    relativePath: string,
    code: string,
    projectId: string
  ): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    let routePath = '';

    if (relativePath.includes('pages/api/')) {
      const sub = relativePath.split('pages/api/')[1];
      routePath = '/api/' + sub.replace(/\.[a-zA-Z0-9]+$/, '').replace(/index$/, '');
    } else if (relativePath.includes('app/api/')) {
      const sub = relativePath.split('app/api/')[1];
      routePath = '/api/' + sub.replace(/\/route\.[a-zA-Z0-9]+$/, '');
    }

    // Convert Next.js [id] to :id
    routePath = routePath.replace(/\[([a-zA-Z0-9_]+)\]/g, ':$1').replace(/\/$/, '') || '/api';

    // Detect exported HTTP methods: export async function GET(req), export async function POST(req)
    const exportMatches = code.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD)\s*\(/g);
    const methods: HttpMethod[] = [];
    for (const em of exportMatches) {
      methods.push(em[1] as HttpMethod);
    }

    if (methods.length === 0) {
      // Default handler
      methods.push('GET', 'POST');
    }

    for (const method of methods) {
      endpoints.push({
        id: `ep-next-${uuidv4().substring(0, 8)}`,
        projectId,
        method,
        path: routePath,
        summary: `${method} ${routePath}`,
        description: `Next.js API route handler in ${relativePath}`,
        controllerName: path.basename(relativePath),
        handlerFunction: method,
        sourceFile: relativePath,
        lineStart: 1,
        lineEnd: 10,
        authRequired: code.includes('auth') || code.includes('session') || code.includes('getServerSession'),
        authType: 'bearer',
        middleware: [],
        detectionType: 'DETECTED',
        confidenceScore: 0.94,
        parameters: [],
        responses: [
          {
            id: `res-${uuidv4().substring(0, 8)}`,
            endpointId: '',
            statusCode: method === 'POST' ? 201 : 200,
            description: 'API Route Response',
            contentType: 'application/json',
            detectionType: 'DETECTED',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    }

    return endpoints;
  }

  private extractRouterInvocations(code: string, relativePath: string, projectId: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    // e.g. router.get('/users', ...), app.post('/api/v1/auth', ...)
    const regex = /(?:router|app|server|api|r|v1|v2|route|group)\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([\/a-zA-Z0-9_\-:{}\$]+)['"`]/gi;
    let match;

    while ((match = regex.exec(code)) !== null) {
      const method = match[1].toUpperCase() as HttpMethod;
      const rawPath = match[2];
      const cleanPath = '/' + rawPath.replace(/^\//, '');

      // Avoid matching template expressions like /${var}
      if (cleanPath.includes('$')) continue;

      const authRequired =
        code.includes('auth') ||
        code.includes('jwt') ||
        code.includes('bearer') ||
        code.includes('protect') ||
        code.includes('guard');

      endpoints.push({
        id: `ep-uni-${uuidv4().substring(0, 8)}`,
        projectId,
        method,
        path: cleanPath,
        summary: `${method} ${cleanPath}`,
        description: `Discovered endpoint in ${relativePath}`,
        controllerName: path.basename(relativePath),
        handlerFunction: method.toLowerCase(),
        sourceFile: relativePath,
        lineStart: 1,
        lineEnd: 20,
        authRequired,
        authType: authRequired ? 'bearer' : 'none',
        middleware: authRequired ? ['authGuard'] : [],
        detectionType: 'DETECTED',
        confidenceScore: 0.92,
        parameters: [],
        responses: [
          {
            id: `res-${uuidv4().substring(0, 8)}`,
            endpointId: '',
            statusCode: method === 'POST' ? 201 : 200,
            description: 'HTTP JSON response',
            contentType: 'application/json',
            detectionType: 'DETECTED',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    }

    return endpoints;
  }

  private extractDecoratorRoutes(code: string, relativePath: string, projectId: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    // e.g. @app.get('/path'), @router.post('/path'), @Get('/path'), @PostMapping('/path')
    const regex = /@(?:[a-zA-Z0-9_]+\.)?(get|post|put|patch|delete|route|GetMapping|PostMapping|PutMapping|DeleteMapping)\s*(?:\(\s*(?:['"]|value\s*=\s*['"])([\/a-zA-Z0-9_\-:{}\$]+)['"]\s*\))?/gi;
    let match;

    while ((match = regex.exec(code)) !== null) {
      let verb = match[1].toUpperCase();
      if (verb.includes('MAPPING')) verb = verb.replace('MAPPING', '');
      const rawPath = match[2] || '/';
      const cleanPath = '/' + rawPath.replace(/^\//, '');

      const method = (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(verb) ? verb : 'GET') as HttpMethod;

      endpoints.push({
        id: `ep-dec-${uuidv4().substring(0, 8)}`,
        projectId,
        method,
        path: cleanPath,
        summary: `${method} ${cleanPath}`,
        description: `Decorated API route in ${relativePath}`,
        controllerName: path.basename(relativePath),
        handlerFunction: 'handler',
        sourceFile: relativePath,
        lineStart: 1,
        lineEnd: 15,
        authRequired: false,
        authType: 'none',
        middleware: [],
        detectionType: 'DETECTED',
        confidenceScore: 0.9,
        parameters: [],
        responses: [
          {
            id: `res-${uuidv4().substring(0, 8)}`,
            endpointId: '',
            statusCode: method === 'POST' ? 201 : 200,
            description: 'Response payload',
            contentType: 'application/json',
            detectionType: 'DETECTED',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    }

    return endpoints;
  }

  private extractSqlTables(sql: string, relativePath: string, projectId: string): DatabaseModel[] {
    const models: DatabaseModel[] = [];
    // CREATE TABLE [IF NOT EXISTS] table_name ( ... )
    const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-zA-Z0-9_]+)["`]?\s*\(([\s\S]*?)\);/gi;
    let match;

    while ((match = tableRegex.exec(sql)) !== null) {
      const tableName = match[1];
      const body = match[2];
      const fields: ModelField[] = [];

      const colLines = body.split(',\n');
      for (const line of colLines) {
        const trimmed = line.trim();
        if (
          !trimmed ||
          trimmed.startsWith('PRIMARY KEY') ||
          trimmed.startsWith('FOREIGN KEY') ||
          trimmed.startsWith('CONSTRAINT') ||
          trimmed.startsWith('INDEX') ||
          trimmed.startsWith('UNIQUE')
        ) {
          continue;
        }

        const colMatch = trimmed.match(/^["`]?([a-zA-Z0-9_]+)["`]?\s+([A-Za-z0-9_()]+)/);
        if (colMatch) {
          const colName = colMatch[1];
          const colType = colMatch[2];
          const isPrimary = trimmed.toUpperCase().includes('PRIMARY KEY') || colName.toLowerCase() === 'id';
          const isUnique = trimmed.toUpperCase().includes('UNIQUE') || isPrimary;
          const isNullable = !trimmed.toUpperCase().includes('NOT NULL');

          fields.push({
            id: `field-${uuidv4().substring(0, 8)}`,
            modelId: '',
            name: colName,
            fieldType: colType.toLowerCase(),
            isPrimaryKey: isPrimary,
            isNullable,
            isUnique,
            isIndexed: isPrimary || isUnique || colName.endsWith('_id'),
            foreignKeyTarget: colName.endsWith('_id') ? colName.replace(/_id$/, '') : undefined,
          });
        }
      }

      if (fields.length > 0) {
        models.push({
          id: `model-${uuidv4().substring(0, 8)}`,
          projectId,
          name: tableName,
          tableName,
          ormType: 'sql',
          sourceFile: relativePath,
          description: `Relational SQL Table: ${tableName}`,
          detectionType: 'DETECTED',
          domain: tableName.toLowerCase().includes('user') ? 'Identity & Security' : 'General',
          fields,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return models;
  }

  private getAllCodeFiles(dir: string, maxFiles = 400): string[] {
    const results: string[] = [];
    const validExts = [
      '.js', '.ts', '.mjs', '.jsx', '.tsx',
      '.py',
      '.go',
      '.java', '.kt',
      '.php',
      '.cs',
      '.rb',
      '.rs',
      '.sql',
      '.prisma',
    ];

    const walk = (current: string) => {
      if (results.length >= maxFiles || !fs.existsSync(current)) return;
      try {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxFiles) return;
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', 'vendor', 'bin', 'obj', 'venv', '__pycache__', '.next'].includes(entry.name)) {
              walk(full);
            }
          } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (validExts.includes(ext)) {
              results.push(full);
            }
          }
        }
      } catch (e) {}
    };

    walk(dir);
    return results;
  }
}
