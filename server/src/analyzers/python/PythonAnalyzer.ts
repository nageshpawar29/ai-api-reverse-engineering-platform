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

export class PythonAnalyzer implements FrameworkAnalyzer {
  public readonly name = 'Python (FastAPI / Flask / Django)';

  public async detect(projectDir: string): Promise<boolean> {
    const hasPy = fs.existsSync(path.join(projectDir, 'requirements.txt')) ||
      fs.existsSync(path.join(projectDir, 'pyproject.toml')) ||
      fs.existsSync(path.join(projectDir, 'manage.py'));
    return hasPy;
  }

  public async analyze(projectDir: string, projectId: string): Promise<AnalysisEngineResult> {
    const endpoints: ApiEndpoint[] = [];
    const models: DatabaseModel[] = [];
    const dependencies: DependencyNode[] = [];
    const securityFindings: SecurityFinding[] = [];

    const pyFiles = this.getAllPythonFiles(projectDir);

    // 1. Detect Router / Blueprint Mount Prefixes
    const mountMap = this.detectMountPrefixes(pyFiles, projectDir);

    // 2. Extract Endpoints from Python Source Files
    for (const filePath of pyFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(projectDir, filePath);
        const mountPrefix = mountMap.get(filePath) || mountMap.get(relativePath) || '';

        const fileEndpoints = this.extractRoutesFromFile(
          code,
          filePath,
          relativePath,
          mountPrefix,
          projectId
        );

        endpoints.push(...fileEndpoints);

        // Extract Pydantic / SQLAlchemy / Django Models
        const fileModels = this.extractModelsFromFile(code, filePath, relativePath, projectId);
        models.push(...fileModels);
      } catch (err) {
        console.warn(`Python parsing error in ${filePath}:`, err);
      }
    }

    // 3. Build Dependency Call-Graph (Route -> Controller -> Service -> Model)
    this.buildDependencies(endpoints, models, dependencies, projectId);

    // 4. Static Security Scanning for Python Endpoints
    this.detectSecurityVulnerabilities(endpoints, securityFindings, projectId);

    return {
      endpoints,
      models,
      dependencies,
      securityFindings,
      fileCount: pyFiles.length,
    };
  }

  private detectMountPrefixes(pyFiles: string[], projectDir: string): Map<string, string> {
    const mountMap = new Map<string, string>();

    for (const file of pyFiles) {
      try {
        const text = fs.readFileSync(file, 'utf-8');

        // FastAPI: app.include_router(auth_router, prefix="/api/v1/auth")
        const fastapiIncludeRegex = /(?:app|router)\.include_router\s*\(\s*([a-zA-Z0-9_.]+)(?:.*?prefix\s*=\s*["']([^"']+)["'])?/g;
        let match;
        while ((match = fastapiIncludeRegex.exec(text)) !== null) {
          const routerVar = match[1];
          const prefix = match[2] || '';
          if (prefix) {
            // Find where routerVar is imported from
            const importedPath = this.resolveImport(text, routerVar, file, projectDir);
            if (importedPath) {
              mountMap.set(importedPath, prefix);
            }
          }
        }

        // Flask: app.register_blueprint(auth_bp, url_prefix='/api/v1/auth')
        const flaskBpRegex = /app\.register_blueprint\s*\(\s*([a-zA-Z0-9_.]+)(?:.*?url_prefix\s*=\s*["']([^"']+)["'])?/g;
        while ((match = flaskBpRegex.exec(text)) !== null) {
          const bpVar = match[1];
          const prefix = match[2] || '';
          if (prefix) {
            const importedPath = this.resolveImport(text, bpVar, file, projectDir);
            if (importedPath) {
              mountMap.set(importedPath, prefix);
            }
          }
        }

        // Direct APIRouter prefix: router = APIRouter(prefix="/users")
        const routerPrefixRegex = /([a-zA-Z0-9_]+)\s*=\s*APIRouter\s*\([^)]*?prefix\s*=\s*["']([^"']+)["']/g;
        while ((match = routerPrefixRegex.exec(text)) !== null) {
          const prefix = match[2];
          if (prefix && !mountMap.has(file)) {
            mountMap.set(file, prefix);
          }
        }
      } catch (e) {}
    }

    return mountMap;
  }

  private resolveImport(content: string, identifier: string, currentFile: string, projectDir: string): string | null {
    // from routers.auth import auth_router
    const fromImportRegex = new RegExp(`from\\s+([a-zA-Z0-9_.]+)\\s+import\\s+.*\\b${identifier}\\b`, 'g');
    const m = fromImportRegex.exec(content);
    if (m) {
      const modulePath = m[1].replace(/\./g, '/');
      const candidate1 = path.join(path.dirname(currentFile), `${modulePath}.py`);
      const candidate2 = path.join(projectDir, `${modulePath}.py`);
      const candidate3 = path.join(projectDir, modulePath, '__init__.py');
      if (fs.existsSync(candidate1)) return candidate1;
      if (fs.existsSync(candidate2)) return candidate2;
      if (fs.existsSync(candidate3)) return candidate3;
    }
    return null;
  }

  private extractRoutesFromFile(
    code: string,
    filePath: string,
    relativePath: string,
    mountPrefix: string,
    projectId: string
  ): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1. FastAPI decorator: @(app|router|api_router).get("/path", ...)
      const fastapiRegex = /@([a-zA-Z0-9_]+)\.(get|post|put|delete|patch|options|head)\s*\(\s*(["'])(.*?)\3/i;
      const fastapiMatch = line.match(fastapiRegex);

      if (fastapiMatch) {
        const method = fastapiMatch[2].toUpperCase() as HttpMethod;
        let routePath = fastapiMatch[4];
        if (!routePath.startsWith('/')) routePath = `/${routePath}`;
        const fullPath = this.normalizePath(mountPrefix + routePath);

        // Find associated function definition below decorator
        const { handlerName, params, docstring, lineEnd } = this.extractPythonFunction(lines, i + 1);

        // Check authentication dependencies
        const contextChunk = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 12)).join(' ');
        const hasAuth = /Depends\s*\(\s*(?:get_current_user|oauth2|verify_token|require_auth|auth)/i.test(contextChunk) ||
          /Security\s*\(/i.test(contextChunk);

        // Status code
        const statusMatch = line.match(/status_code\s*=\s*(?:status\.HTTP_)?(\d{3})/i);
        const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : (method === 'POST' ? 201 : 200);

        const ep: ApiEndpoint = {
          id: `ep-${uuidv4().substring(0, 8)}`,
          projectId,
          method,
          path: fullPath,
          summary: docstring || `${method} ${fullPath}`,
          description: `FastAPI route handled by ${handlerName}() in ${relativePath}`,
          purpose: `Processes ${method} requests for ${fullPath}`,
          controllerName: this.deriveControllerName(relativePath, handlerName),
          handlerFunction: handlerName,
          sourceFile: relativePath,
          lineStart: i + 1,
          lineEnd,
          authRequired: hasAuth,
          authType: hasAuth ? 'Bearer (JWT / OAuth2)' : undefined,
          detectionType: 'DETECTED',
          confidenceScore: 0.95,
          parameters: params,
          responses: [
            {
              id: `res-${uuidv4().substring(0, 8)}`,
              endpointId: '',
              statusCode,
              description: `HTTP ${statusCode} Standard Response`,
              contentType: 'application/json',
              detectionType: 'DETECTED',
            },
          ],
          middleware: hasAuth ? ['Depends(get_current_user)'] : [],
          createdAt: new Date().toISOString(),
        };

        endpoints.push(ep);
        continue;
      }

      // 2. Flask decorator: @(app|bp).route("/path", methods=['GET', 'POST'])
      const flaskRegex = /@([a-zA-Z0-9_]+)\.route\s*\(\s*(["'])(.*?)\2/i;
      const flaskMatch = line.match(flaskRegex);

      if (flaskMatch) {
        let routePath = flaskMatch[3];
        if (!routePath.startsWith('/')) routePath = `/${routePath}`;
        const fullPath = this.normalizePath(mountPrefix + routePath);

        // Check methods
        const methodsMatch = line.match(/methods\s*=\s*\[(.*?)\]/i);
        const methods: HttpMethod[] = methodsMatch
          ? (methodsMatch[1].replace(/["'\s]/g, '').split(',').map(m => m.toUpperCase()) as HttpMethod[])
          : ['GET'];

        const { handlerName, params, docstring, lineEnd } = this.extractPythonFunction(lines, i + 1);

        // Auth in Flask
        const contextChunk = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 6)).join(' ');
        const hasAuth = /@(?:login_required|jwt_required|token_required|auth\.login_required)/i.test(contextChunk);

        for (const m of methods) {
          endpoints.push({
            id: `ep-${uuidv4().substring(0, 8)}`,
            projectId,
            method: m,
            path: fullPath,
            summary: docstring || `${m} ${fullPath}`,
            description: `Flask route handled by ${handlerName}() in ${relativePath}`,
            purpose: `Handles ${m} execution for ${fullPath}`,
            controllerName: this.deriveControllerName(relativePath, handlerName),
            handlerFunction: handlerName,
            sourceFile: relativePath,
            lineStart: i + 1,
            lineEnd,
            authRequired: hasAuth,
            authType: hasAuth ? 'Session / JWT Auth' : undefined,
            detectionType: 'DETECTED',
            confidenceScore: 0.92,
            parameters: params,
            responses: [
              {
                id: `res-${uuidv4().substring(0, 8)}`,
                endpointId: '',
                statusCode: m === 'POST' ? 201 : 200,
                description: 'HTTP Response',
                contentType: 'application/json',
                detectionType: 'DETECTED',
              },
            ],
            middleware: hasAuth ? ['@login_required'] : [],
            createdAt: new Date().toISOString(),
          });
        }
      }

      // 3. Django URL route: path('api/v1/items/', views.item_list)
      const djangoRegex = /path\s*\(\s*(["'])(.*?)\1\s*,\s*([a-zA-Z0-9_.]+)/i;
      const djangoMatch = line.match(djangoRegex);
      if (djangoMatch) {
        let routePath = djangoMatch[2];
        if (!routePath.startsWith('/')) routePath = `/${routePath}`;
        const fullPath = this.normalizePath(mountPrefix + routePath);
        const handlerName = djangoMatch[3].replace(/\.as_view\(\)/, '');

        endpoints.push({
          id: `ep-${uuidv4().substring(0, 8)}`,
          projectId,
          method: 'GET',
          path: fullPath,
          summary: `Django View: ${handlerName}`,
          description: `Django REST endpoint routed to ${handlerName} in ${relativePath}`,
          purpose: `Dispatches request to ${handlerName}`,
          controllerName: this.deriveControllerName(relativePath, handlerName),
          handlerFunction: handlerName,
          sourceFile: relativePath,
          lineStart: i + 1,
          lineEnd: i + 1,
          authRequired: false,
          detectionType: 'DETECTED',
          confidenceScore: 0.9,
          parameters: [],
          responses: [
            {
              id: `res-${uuidv4().substring(0, 8)}`,
              endpointId: '',
              statusCode: 200,
              description: 'OK',
              contentType: 'application/json',
              detectionType: 'DETECTED',
            },
          ],
          middleware: [],
          createdAt: new Date().toISOString(),
        });
      }
    }

    return endpoints;
  }

  private extractPythonFunction(
    lines: string[],
    startIndex: number
  ): { handlerName: string; params: ApiParameter[]; docstring: string; lineEnd: number } {
    let handlerName = 'anonymous_handler';
    const params: ApiParameter[] = [];
    let docstring = '';
    let lineEnd = startIndex;

    for (let j = startIndex; j < Math.min(lines.length, startIndex + 6); j++) {
      const match = lines[j].match(/def\s+([a-zA-Z0-9_]+)\s*\((.*?)\)/);
      if (match) {
        handlerName = match[1];
        lineEnd = j + 1;
        const rawParams = match[2];

        // Parse function arguments
        if (rawParams.trim()) {
          const args = rawParams.split(',');
          for (const arg of args) {
            const clean = arg.trim();
            if (!clean || clean === 'self' || clean === 'cls' || clean.includes('Depends(')) continue;

            const [nameType, defaultVal] = clean.split('=');
            const [paramName, paramType] = (nameType || '').split(':').map(s => s.trim());

            if (paramName) {
              const isPath = paramName.toLowerCase().includes('id') || paramName.toLowerCase().includes('uuid');
              const isBody = (paramType || '').toLowerCase().includes('schema') || (paramType || '').toLowerCase().includes('request');

              params.push({
                id: `param-${uuidv4().substring(0, 8)}`,
                endpointId: '',
                name: paramName,
                paramIn: isBody ? 'body' : (isPath ? 'path' : 'query'),
                dataType: (paramType || 'string').toLowerCase().includes('int') ? 'number' : 'string',
                required: !defaultVal,
                defaultValue: defaultVal?.trim().replace(/['"]/g, ''),
                description: `${paramName} argument (${paramType || 'any'})`,
                detectionType: 'DETECTED',
              });
            }
          }
        }

        // Check docstring right after def
        if (j + 1 < lines.length) {
          const docLine = lines[j + 1].trim();
          if (docLine.startsWith('"""') || docLine.startsWith("'''")) {
            docstring = docLine.replace(/['"]{3}/g, '').trim();
          }
        }
        break;
      }
    }

    return { handlerName, params, docstring, lineEnd };
  }

  private extractModelsFromFile(code: string, filePath: string, relativePath: string, projectId: string): DatabaseModel[] {
    const models: DatabaseModel[] = [];
    const lines = code.split('\n');

    // Detect class User(BaseModel): or class User(Base): or class User(models.Model):
    const classRegex = /class\s+([a-zA-Z0-9_]+)\s*\(\s*([a-zA-Z0-9_.]+)\s*\)\s*:/;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(classRegex);
      if (match) {
        const modelName = match[1];
        const baseClass = match[2];

        if (
          baseClass.includes('BaseModel') ||
          baseClass.includes('Base') ||
          baseClass.includes('Model') ||
          baseClass.includes('Schema')
        ) {
          const fields: ModelField[] = [];
          let tableName = modelName.toLowerCase() + 's';

          // Scan class body for attributes
          for (let k = i + 1; k < Math.min(lines.length, i + 30); k++) {
            const line = lines[k];
            if (line.trim().startsWith('def ') || (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t'))) {
              break; // End of class attributes
            }

            // SQLAlchemy __tablename__
            const tableMatch = line.match(/__tablename__\s*=\s*["']([^"']+)["']/);
            if (tableMatch) {
              tableName = tableMatch[1];
            }

            // Pydantic / SQLAlchemy / Django field: id: int, name: str = "", Column(...)
            const fieldMatch = line.trim().match(/^([a-zA-Z0-9_]+)\s*(?::\s*([a-zA-Z0-9_\[\]]+))?(?:\s*=\s*(.*))?$/);
            if (fieldMatch && !fieldMatch[1].startsWith('_') && !fieldMatch[1].startsWith('class ')) {
              const fname = fieldMatch[1];
              const ftype = fieldMatch[2] || (fieldMatch[3]?.includes('Integer') ? 'integer' : 'string');

              fields.push({
                id: `field-${uuidv4().substring(0, 8)}`,
                modelId: '',
                name: fname,
                fieldType: ftype.toLowerCase().includes('int') ? 'integer' : (ftype.toLowerCase().includes('bool') ? 'boolean' : 'string'),
                isPrimaryKey: fname.toLowerCase() === 'id' || fname.toLowerCase().endsWith('_id'),
                isNullable: Boolean(ftype.includes('Optional') || (fieldMatch[3] && fieldMatch[3].includes('None'))),
                isUnique: Boolean(fieldMatch[3]?.includes('unique=True')),
                defaultValue: fieldMatch[3] && !fieldMatch[3].includes('Column') ? fieldMatch[3].trim() : undefined,
              });
            }
          }

          if (fields.length > 0) {
            models.push({
              id: `model-${uuidv4().substring(0, 8)}`,
              projectId,
              name: modelName,
              tableName,
              sourceFile: relativePath,
              ormType: baseClass.includes('BaseModel') ? 'pydantic' : (baseClass.includes('models.Model') ? 'django' : 'sqlalchemy'),
              detectionType: 'DETECTED',
              fields,
              createdAt: new Date().toISOString(),
            });
          }
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
      const ctrlName = ep.controllerName || ep.handlerFunction || 'PythonHandler';

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

      // Link to matching models if referenced
      models.forEach((m) => {
        if (ep.path.toLowerCase().includes(m.name.toLowerCase()) || (ep.handlerFunction && ep.handlerFunction.toLowerCase().includes(m.name.toLowerCase()))) {
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
            details: `Reads/modifies ${m.tableName || m.name}`,
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
      // Flag state-modifying endpoints without auth
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(ep.method) && !ep.authRequired) {
        const isAuthRoute = ep.path.includes('/login') || ep.path.includes('/register') || ep.path.includes('/signup');
        if (!isAuthRoute) {
          findings.push({
            id: `sec-${uuidv4().substring(0, 8)}`,
            projectId,
            endpointId: ep.id,
            severity: 'high',
            category: 'Broken Authentication',
            title: `Unauthenticated Mutation: ${ep.method} ${ep.path}`,
            description: `State-modifying Python route ${ep.method} ${ep.path} lacks an authentication dependency or security decorator.`,
            recommendation: `Inject security dependency using Depends(get_current_user) in FastAPI or @login_required in Flask.`,
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
    if (base.toLowerCase().includes('router') || base.toLowerCase().includes('route') || base.toLowerCase().includes('controller')) {
      const clean = base.replace(/router|route|controller/gi, '').trim();
      return (clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : base) + 'Controller';
    }
    return handler ? handler.charAt(0).toUpperCase() + handler.slice(1) + 'Handler' : 'MainController';
  }

  private getAllPythonFiles(dir: string): string[] {
    const results: string[] = [];
    const walk = (current: string) => {
      if (!fs.existsSync(current)) return;
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(current, e.name);
        if (e.isDirectory()) {
          if (!['venv', '.venv', '__pycache__', '.git', 'node_modules', 'dist', 'build', '.pytest_cache'].includes(e.name)) {
            walk(full);
          }
        } else if (e.name.endsWith('.py')) {
          results.push(full);
        }
      }
    };
    walk(dir);
    return results;
  }
}
