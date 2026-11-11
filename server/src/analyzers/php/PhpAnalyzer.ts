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

export class PhpAnalyzer implements FrameworkAnalyzer {
  public readonly name = 'PHP (Laravel / Symfony / Lumen)';

  public async detect(projectDir: string): Promise<boolean> {
    const hasComposer = fs.existsSync(path.join(projectDir, 'composer.json'));
    const hasArtisan = fs.existsSync(path.join(projectDir, 'artisan'));
    const hasRoutes = fs.existsSync(path.join(projectDir, 'routes'));
    return hasComposer || hasArtisan || hasRoutes || this.hasPhpFiles(projectDir);
  }

  public async analyze(projectDir: string, projectId: string): Promise<AnalysisEngineResult> {
    const endpoints: ApiEndpoint[] = [];
    const models: DatabaseModel[] = [];
    const dependencies: DependencyNode[] = [];
    const securityFindings: SecurityFinding[] = [];

    const phpFiles = this.getAllPhpFiles(projectDir);

    // 1. Scan route files (e.g. routes/api.php, routes/web.php)
    for (const filePath of phpFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(projectDir, filePath);

        if (
          relativePath.toLowerCase().includes('route') ||
          code.includes('Route::') ||
          code.includes('$router->')
        ) {
          const fileEndpoints = this.extractRoutesFromFile(code, filePath, relativePath, projectId);
          endpoints.push(...fileEndpoints);
        }

        // 2. Scan Eloquent Models
        if (
          relativePath.toLowerCase().includes('model') ||
          code.includes('extends Model') ||
          code.includes('extends Authenticatable')
        ) {
          const fileModels = this.extractEloquentModels(code, relativePath, projectId);
          models.push(...fileModels);
        }
      } catch (err) {
        console.warn(`PHP parsing error in ${filePath}:`, err);
      }
    }

    // 3. Dependency Graph
    this.buildDependencies(endpoints, models, dependencies, projectId);

    // 4. Security Audit
    this.detectSecurityVulnerabilities(endpoints, securityFindings, projectId);

    return {
      endpoints,
      models,
      dependencies,
      securityFindings,
      fileCount: phpFiles.length,
    };
  }

  private extractRoutesFromFile(
    code: string,
    filePath: string,
    relativePath: string,
    projectId: string
  ): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = code.split('\n');

    // Route::get('path', [Controller::class, 'method'])
    // Route::post('path', 'Controller@method')
    // $router->get('path', ...)
    const routeRegex = /(?:Route|\$router)::(get|post|put|patch|delete|options|any)\s*\(\s*['"]([^'"]+)['"]\s*,\s*([^)]+)\)/gi;
    let match;

    while ((match = routeRegex.exec(code)) !== null) {
      const verb = match[1].toUpperCase();
      const rawPath = match[2];
      const handlerDef = match[3];

      const cleanPath = '/' + rawPath.replace(/^\//, '');
      const methods: HttpMethod[] = verb === 'ANY' ? ['GET', 'POST', 'PUT', 'DELETE'] : [verb as HttpMethod];

      // Extract controller and action
      let controllerName = 'Closure';
      let handlerFunction = 'handler';

      const arrayMatch = handlerDef.match(/\[\s*([A-Za-z0-9_]+)::class\s*,\s*['"]([A-Za-z0-9_]+)['"]\s*\]/);
      const stringMatch = handlerDef.match(/['"]([A-Za-z0-9_]+)@([A-Za-z0-9_]+)['"]/);

      if (arrayMatch) {
        controllerName = arrayMatch[1];
        handlerFunction = arrayMatch[2];
      } else if (stringMatch) {
        controllerName = stringMatch[1];
        handlerFunction = stringMatch[2];
      }

      const authRequired =
        code.includes('auth:sanctum') ||
        code.includes('auth:api') ||
        code.includes("'auth'") ||
        handlerDef.includes('middleware');

      // Extract path variables ({id})
      const parameters: ApiParameter[] = [];
      const pathParams = cleanPath.match(/{([a-zA-Z0-9_]+)}/g) || [];
      for (const p of pathParams) {
        const paramName = p.replace(/[{}]/g, '');
        parameters.push({
          id: `param-${uuidv4().substring(0, 8)}`,
          endpointId: '',
          name: paramName,
          paramIn: 'path',
          dataType: 'string',
          required: true,
          description: `URL path parameter for ${paramName}`,
          detectionType: 'DETECTED',
        });
      }

      for (const method of methods) {
        const responses: ApiResponse[] = [
          {
            id: `res-${uuidv4().substring(0, 8)}`,
            endpointId: '',
            statusCode: method === 'POST' ? 201 : 200,
            description: 'Successful HTTP response',
            contentType: 'application/json',
            detectionType: 'DETECTED',
          },
        ];

        endpoints.push({
          id: `ep-php-${uuidv4().substring(0, 8)}`,
          projectId,
          method,
          path: cleanPath,
          summary: `${method} ${cleanPath}`,
          description: `PHP Route handled by ${controllerName}::${handlerFunction}`,
          controllerName,
          handlerFunction,
          sourceFile: relativePath,
          lineStart: 1,
          lineEnd: lines.length,
          authRequired,
          authType: authRequired ? 'bearer' : 'none',
          middleware: authRequired ? ['auth:sanctum'] : [],
          detectionType: 'DETECTED',
          confidenceScore: 0.95,
          parameters,
          responses,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Support for Route::apiResource('products', ProductController::class)
    const resourceRegex = /Route::apiResource\s*\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z0-9_]+)/g;
    let resMatch;
    while ((resMatch = resourceRegex.exec(code)) !== null) {
      const resource = resMatch[1];
      const ctrl = resMatch[2];
      const resourceOps: Array<{ method: HttpMethod; subpath: string; action: string }> = [
        { method: 'GET', subpath: `/${resource}`, action: 'index' },
        { method: 'POST', subpath: `/${resource}`, action: 'store' },
        { method: 'GET', subpath: `/${resource}/{id}`, action: 'show' },
        { method: 'PUT', subpath: `/${resource}/{id}`, action: 'update' },
        { method: 'DELETE', subpath: `/${resource}/{id}`, action: 'destroy' },
      ];

      for (const op of resourceOps) {
        const params: ApiParameter[] = op.subpath.includes('{id}')
          ? [
              {
                id: `param-${uuidv4().substring(0, 8)}`,
                endpointId: '',
                name: 'id',
                paramIn: 'path',
                dataType: 'string',
                required: true,
                description: 'Unique resource identifier',
                detectionType: 'DETECTED',
              },
            ]
          : [];

        endpoints.push({
          id: `ep-php-${uuidv4().substring(0, 8)}`,
          projectId,
          method: op.method,
          path: op.subpath,
          summary: `${op.method} ${op.subpath}`,
          description: `RESTful resource action ${ctrl}::${op.action}`,
          controllerName: ctrl,
          handlerFunction: op.action,
          sourceFile: relativePath,
          lineStart: 1,
          lineEnd: lines.length,
          authRequired: op.method !== 'GET',
          authType: op.method !== 'GET' ? 'bearer' : 'none',
          middleware: op.method !== 'GET' ? ['auth:api'] : [],
          detectionType: 'DETECTED',
          confidenceScore: 0.98,
          parameters: params,
          responses: [
            {
              id: `res-${uuidv4().substring(0, 8)}`,
              endpointId: '',
              statusCode: op.method === 'POST' ? 201 : 200,
              description: 'Resource execution result',
              contentType: 'application/json',
              detectionType: 'DETECTED',
            },
          ],
          createdAt: new Date().toISOString(),
        });
      }
    }

    return endpoints;
  }

  private extractEloquentModels(code: string, relativePath: string, projectId: string): DatabaseModel[] {
    const models: DatabaseModel[] = [];
    const classMatch = code.match(/class\s+([A-Za-z0-9_]+)\s+extends\s+(?:Model|Authenticatable)/);

    if (classMatch) {
      const modelName = classMatch[1];
      const fields: ModelField[] = [
        {
          id: `field-${uuidv4().substring(0, 8)}`,
          modelId: '',
          name: 'id',
          fieldType: 'bigint',
          isPrimaryKey: true,
          isNullable: false,
          isUnique: true,
          isIndexed: true,
        },
      ];

      // Extract $fillable attributes: protected $fillable = ['name', 'email', 'price'];
      const fillableMatch = code.match(/\$fillable\s*=\s*\[([^\]]+)\]/);
      if (fillableMatch) {
        const rawFields = fillableMatch[1].matchAll(/['"]([a-zA-Z0-9_]+)['"]/g);
        for (const f of rawFields) {
          const col = f[1];
          if (col !== 'id') {
            fields.push({
              id: `field-${uuidv4().substring(0, 8)}`,
              modelId: '',
              name: col,
              fieldType: col.endsWith('_id') ? 'bigint' : 'string',
              isPrimaryKey: false,
              isNullable: true,
              isUnique: col.includes('email'),
              foreignKeyTarget: col.endsWith('_id') ? col.replace(/_id$/, '') : undefined,
            });
          }
        }
      }

      // Add timestamps
      fields.push(
        {
          id: `field-${uuidv4().substring(0, 8)}`,
          modelId: '',
          name: 'created_at',
          fieldType: 'timestamp',
          isPrimaryKey: false,
          isNullable: true,
          isUnique: false,
        },
        {
          id: `field-${uuidv4().substring(0, 8)}`,
          modelId: '',
          name: 'updated_at',
          fieldType: 'timestamp',
          isPrimaryKey: false,
          isNullable: true,
          isUnique: false,
        }
      );

      models.push({
        id: `model-${uuidv4().substring(0, 8)}`,
        projectId,
        name: modelName,
        tableName: modelName.toLowerCase() + 's',
        ormType: 'eloquent',
        sourceFile: relativePath,
        description: `Laravel Eloquent Model: ${modelName}`,
        detectionType: 'DETECTED',
        domain: modelName.toLowerCase().includes('user') ? 'Identity & Security' : 'Commerce & Products',
        fields,
        createdAt: new Date().toISOString(),
      });
    }

    return models;
  }

  private buildDependencies(
    endpoints: ApiEndpoint[],
    models: DatabaseModel[],
    dependencies: DependencyNode[],
    projectId: string
  ): void {
    for (const ep of endpoints) {
      if (ep.controllerName) {
        dependencies.push({
          id: `dep-${uuidv4().substring(0, 8)}`,
          projectId,
          sourceType: 'route',
          sourceId: ep.id,
          sourceLabel: `${ep.method} ${ep.path}`,
          targetType: 'controller',
          targetId: ep.controllerName,
          targetLabel: ep.controllerName,
          relationType: 'calls',
        });
      }
    }
  }

  private detectSecurityVulnerabilities(
    endpoints: ApiEndpoint[],
    findings: SecurityFinding[],
    projectId: string
  ): void {
    for (const ep of endpoints) {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(ep.method) && !ep.authRequired) {
        findings.push({
          id: `sec-${uuidv4().substring(0, 8)}`,
          projectId,
          endpointId: ep.id,
          severity: 'high',
          category: 'Broken Authentication',
          title: `State-altering endpoint lacks authentication: ${ep.method} ${ep.path}`,
          description: `The route modifies database state without Sanctum or JWT authentication middleware.`,
          sourceFile: ep.sourceFile,
          lineNumber: ep.lineStart,
          recommendation: `Add middleware(['auth:sanctum']) to secure this route.`,
          detectionType: 'DETECTED',
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  private getAllPhpFiles(dir: string, maxFiles = 300): string[] {
    const results: string[] = [];
    const walk = (current: string) => {
      if (results.length >= maxFiles || !fs.existsSync(current)) return;
      try {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxFiles) return;
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) {
            if (!['vendor', '.git', 'storage', 'node_modules', 'tests'].includes(entry.name)) {
              walk(full);
            }
          } else if (entry.name.endsWith('.php')) {
            results.push(full);
          }
        }
      } catch (e) {}
    };
    walk(dir);
    return results;
  }

  private hasPhpFiles(dir: string): boolean {
    return this.getAllPhpFiles(dir, 1).length > 0;
  }
}
