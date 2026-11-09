import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ApiEndpoint,
  ApiParameter,
  DatabaseModel,
  DependencyNode,
  HttpMethod,
  ModelField,
  SecurityFinding,
} from '../../types/index.js';
import { FrameworkAnalyzer, AnalysisEngineResult } from '../FrameworkAnalyzer.js';

export class GoAnalyzer implements FrameworkAnalyzer {
  public readonly name = 'Go (Gin / Fiber / Chi / Echo)';

  public async detect(projectDir: string): Promise<boolean> {
    return fs.existsSync(path.join(projectDir, 'go.mod'));
  }

  public async analyze(projectDir: string, projectId: string): Promise<AnalysisEngineResult> {
    const endpoints: ApiEndpoint[] = [];
    const models: DatabaseModel[] = [];
    const dependencies: DependencyNode[] = [];
    const securityFindings: SecurityFinding[] = [];

    const goFiles = this.getAllGoFiles(projectDir);

    // 1. Detect Router Groups (e.g. v1 := r.Group("/api/v1"))
    const groupMap = this.detectRouteGroups(goFiles);

    // 2. Extract Routes from Go files
    for (const filePath of goFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(projectDir, filePath);

        const fileEndpoints = this.extractRoutesFromFile(
          code,
          filePath,
          relativePath,
          groupMap,
          projectId
        );
        endpoints.push(...fileEndpoints);

        // Extract GORM / Go Struct Models
        const fileModels = this.extractStructModels(code, relativePath, projectId);
        models.push(...fileModels);
      } catch (err) {
        console.warn(`Go parsing error in ${filePath}:`, err);
      }
    }

    // 3. Dependency Call-Graph (Route -> Handler -> Struct Model)
    this.buildDependencies(endpoints, models, dependencies, projectId);

    // 4. Security Audit
    this.detectSecurityVulnerabilities(endpoints, securityFindings, projectId);

    return {
      endpoints,
      models,
      dependencies,
      securityFindings,
      fileCount: goFiles.length,
    };
  }

  private detectRouteGroups(goFiles: string[]): Map<string, string> {
    const groupMap = new Map<string, string>(); // identifier -> prefix

    for (const file of goFiles) {
      try {
        const text = fs.readFileSync(file, 'utf-8');
        // v1 := r.Group("/api/v1") or api := app.Group("/api")
        const groupRegex = /([a-zA-Z0-9_]+)\s*:=\s*([a-zA-Z0-9_]+)\.Group\s*\(\s*["']([^"']+)["']/g;
        let match;
        while ((match = groupRegex.exec(text)) !== null) {
          const varName = match[1];
          const parentVar = match[2];
          const prefix = match[3];

          const parentPrefix = groupMap.get(parentVar) || '';
          groupMap.set(varName, this.normalizePath(parentPrefix + prefix));
        }
      } catch (e) {}
    }

    return groupMap;
  }

  private extractRoutesFromFile(
    code: string,
    filePath: string,
    relativePath: string,
    groupMap: Map<string, string>,
    projectId: string
  ): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = code.split('\n');

    // Matches:
    // r.GET("/users", handler)
    // api.POST("/auth/login", middleware.Auth(), controllers.Login)
    // app.Get("/products/:id", handler)
    const routeRegex = /([a-zA-Z0-9_]+)\.(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|Get|Post|Put|Delete|Patch)\s*\(\s*["']([^"']+)["']\s*(?:,\s*(.*?))?\)/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(routeRegex);

      if (match) {
        const routerVar = match[1];
        const method = match[2].toUpperCase() as HttpMethod;
        let routePath = match[3];
        const handlersChunk = match[4] || '';

        const prefix = groupMap.get(routerVar) || '';
        const fullPath = this.normalizePath(prefix + routePath);

        // Extract handlers and middlewares
        const handlersList = handlersChunk.split(',').map((s) => s.trim()).filter(Boolean);
        const mainHandler = handlersList[handlersList.length - 1] || 'Handler';
        const middlewares = handlersList.slice(0, handlersList.length - 1);

        // Auth detection
        const hasAuth = /auth|jwt|token|require|protect/i.test(handlersChunk) ||
          /auth|jwt|token|require/i.test(line);

        // Parameters extraction from path (e.g. /users/:id or /items/*action)
        const params: ApiParameter[] = [];
        const pathMatches = fullPath.match(/:([a-zA-Z0-9_]+)/g);
        if (pathMatches) {
          pathMatches.forEach((pm) => {
            const pName = pm.replace(':', '');
            params.push({
              id: `param-${uuidv4().substring(0, 8)}`,
              endpointId: '',
              name: pName,
              paramIn: 'path',
              dataType: 'string',
              required: true,
              description: `Path variable: ${pName}`,
              detectionType: 'DETECTED',
            });
          });
        }

        endpoints.push({
          id: `ep-${uuidv4().substring(0, 8)}`,
          projectId,
          method,
          path: fullPath,
          summary: `${method} ${fullPath}`,
          description: `Go ${routerVar} route dispatched to ${mainHandler} in ${relativePath}`,
          purpose: `Executes ${method} handler ${mainHandler}`,
          controllerName: this.deriveControllerName(relativePath, mainHandler),
          handlerFunction: mainHandler,
          sourceFile: relativePath,
          lineStart: i + 1,
          lineEnd: i + 1,
          authRequired: hasAuth,
          authType: hasAuth ? 'Bearer (JWT / Go Middleware)' : undefined,
          detectionType: 'DETECTED',
          confidenceScore: 0.94,
          parameters: params,
          responses: [
            {
              id: `res-${uuidv4().substring(0, 8)}`,
              endpointId: '',
              statusCode: method === 'POST' ? 201 : 200,
              description: 'Success',
              contentType: 'application/json',
              detectionType: 'DETECTED',
            },
          ],
          middleware: middlewares,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return endpoints;
  }

  private extractStructModels(code: string, relativePath: string, projectId: string): DatabaseModel[] {
    const models: DatabaseModel[] = [];
    const lines = code.split('\n');

    // Detect type User struct { ... }
    const structRegex = /type\s+([a-zA-Z0-9_]+)\s+struct\s+\{/;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(structRegex);
      if (match) {
        const modelName = match[1];

        // Skip non-domain struct names
        if (modelName.endsWith('Request') || modelName.endsWith('Response') || modelName.endsWith('Config')) {
          continue;
        }

        const fields: ModelField[] = [];
        let isGorm = false;

        for (let j = i + 1; j < Math.min(lines.length, i + 35); j++) {
          const fieldLine = lines[j].trim();
          if (fieldLine === '}') break;

          // e.g. ID uint `gorm:"primaryKey"` or Name string `json:"name"`
          const fieldMatch = fieldLine.match(/^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_\[\]*]+)(?:\s+`([^`]+)`)?/);
          if (fieldMatch) {
            const fName = fieldMatch[1];
            const fType = fieldMatch[2];
            const tags = fieldMatch[3] || '';

            if (tags.includes('gorm')) isGorm = true;

            fields.push({
              id: `field-${uuidv4().substring(0, 8)}`,
              modelId: '',
              name: fName,
              fieldType: fType.includes('int') || fType.includes('uint') ? 'integer' : (fType.includes('bool') ? 'boolean' : 'string'),
              isPrimaryKey: fName.toLowerCase() === 'id' || tags.includes('primaryKey'),
              isNullable: fType.startsWith('*'),
              isUnique: tags.includes('unique'),
            });
          }
        }

        if (fields.length > 0 && (isGorm || fields.some((f) => f.name.toLowerCase() === 'id'))) {
          models.push({
            id: `model-${uuidv4().substring(0, 8)}`,
            projectId,
            name: modelName,
            tableName: modelName.toLowerCase() + 's',
            sourceFile: relativePath,
            ormType: isGorm ? 'gorm' : 'go-struct',
            detectionType: 'DETECTED',
            fields,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    return models;
  }

  private buildDependencies(
    endpoints: ApiEndpoint[],
    models: DatabaseModel[],
    dependencies: DependencyNode[],
    projectId: string
  ): void {
    endpoints.forEach((ep) => {
      const ctrlName = ep.controllerName || ep.handlerFunction || 'GoHandler';

      // Route -> Controller
      dependencies.push({
        id: `dep-${uuidv4().substring(0, 8)}`,
        projectId,
        sourceType: 'route',
        sourceId: ep.id,
        sourceLabel: `${ep.method} ${ep.path}`,
        targetType: 'controller',
        targetId: `ctrl-${ep.id}`,
        targetLabel: ctrlName,
        relationType: 'calls',
        details: `Dispatches request to ${ep.handlerFunction || 'handler'}`,
      });

      // Link to matching models
      models.forEach((m) => {
        if (ep.path.toLowerCase().includes(m.name.toLowerCase())) {
          dependencies.push({
            id: `dep-${uuidv4().substring(0, 8)}`,
            projectId,
            sourceType: 'controller',
            sourceId: `ctrl-${ep.id}`,
            sourceLabel: ctrlName,
            targetType: 'model',
            targetId: m.id,
            targetLabel: m.name,
            relationType: 'queries',
            details: `Operates on ${m.tableName || m.name}`,
          });
        }
      });
    });
  }

  private detectSecurityVulnerabilities(
    endpoints: ApiEndpoint[],
    findings: SecurityFinding[],
    projectId: string
  ): void {
    endpoints.forEach((ep) => {
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(ep.method) && !ep.authRequired) {
        const isAuthRoute = ep.path.includes('/login') || ep.path.includes('/register');
        if (!isAuthRoute) {
          findings.push({
            id: `sec-${uuidv4().substring(0, 8)}`,
            projectId,
            endpointId: ep.id,
            severity: 'high',
            category: 'Broken Authentication',
            title: `Unauthenticated Mutation: ${ep.method} ${ep.path}`,
            description: `State-modifying Go endpoint ${ep.method} ${ep.path} lacks authorization middleware in its handler chain.`,
            recommendation: `Attach an authentication middleware (e.g. AuthMiddleware()) before the endpoint handler.`,
            detectionType: 'DETECTED',
            sourceFile: ep.sourceFile,
            lineNumber: ep.lineStart,
            createdAt: new Date().toISOString(),
          });
        }
      }
    });
  }

  private normalizePath(p: string): string {
    return p.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }

  private deriveControllerName(filePath: string, handler: string): string {
    const base = path.basename(filePath, path.extname(filePath));
    if (base.toLowerCase().includes('controller') || base.toLowerCase().includes('handler') || base.toLowerCase().includes('route')) {
      const clean = base.replace(/controller|handler|route/gi, '').trim();
      return (clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : base) + 'Controller';
    }
    return handler ? handler.charAt(0).toUpperCase() + handler.slice(1) : 'MainController';
  }

  private getAllGoFiles(dir: string): string[] {
    const results: string[] = [];
    const walk = (current: string) => {
      if (!fs.existsSync(current)) return;
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(current, e.name);
        if (e.isDirectory()) {
          if (!['vendor', '.git', 'bin', 'pkg', 'node_modules'].includes(e.name)) {
            walk(full);
          }
        } else if (e.name.endsWith('.go') && !e.name.endsWith('_test.go')) {
          results.push(full);
        }
      }
    };
    walk(dir);
    return results;
  }
}
