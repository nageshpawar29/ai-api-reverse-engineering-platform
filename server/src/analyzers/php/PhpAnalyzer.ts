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
  ModelRelationship,
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

    // 1. Scan Laravel Database Migrations (database/migrations/*.php)
    const migrationModels = this.extractModelsFromMigrations(phpFiles, projectDir, projectId);
    models.push(...migrationModels);

    // 2. Scan route files (routes/api.php, routes/web.php, etc.)
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

        // 3. Scan Eloquent Models (app/Models/*.php or app/*.php)
        if (
          relativePath.toLowerCase().includes('model') ||
          code.includes('extends Model') ||
          code.includes('extends Authenticatable')
        ) {
          const fileModels = this.extractEloquentModels(code, relativePath, projectId);
          for (const fm of fileModels) {
            const existing = models.find((m) => m.name.toLowerCase() === fm.name.toLowerCase());
            if (existing) {
              // Merge relationships and fillable fields
              if (fm.relationships && fm.relationships.length > 0) {
                existing.relationships = existing.relationships || [];
                existing.relationships.push(...fm.relationships);
              }
            } else {
              models.push(fm);
            }
          }
        }
      } catch (err) {
        console.warn(`PHP parsing error in ${filePath}:`, err);
      }
    }

    // 4. Build Call-Graph Dependencies (Route -> Controller -> Model)
    this.buildDependencies(endpoints, models, dependencies, projectId);

    // 5. Security Audit (Broken Authentication, CSRF)
    this.detectSecurityVulnerabilities(endpoints, securityFindings, projectId);

    return {
      endpoints,
      models,
      dependencies,
      securityFindings,
      fileCount: phpFiles.length,
    };
  }

  /**
   * Deep extraction of routes from Laravel routes/api.php or routes/web.php
   * Handles Route::prefix(), Route::middleware(), Route::group(), and Route::apiResource()
   */
  private extractRoutesFromFile(
    code: string,
    filePath: string,
    relativePath: string,
    projectId: string
  ): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = code.split('\n');

    // Automatic /api base prefix if located in routes/api.php
    const isApiRouteFile = relativePath.toLowerCase().includes('api.php') || relativePath.includes('routes/api');
    const defaultPrefix = isApiRouteFile ? '/api' : '';

    // Route Group Extraction: Route::prefix('v1')->group(function () { ... })
    // Route::group(['prefix' => 'v1', 'middleware' => 'auth:sanctum'], function () { ... })
    const groupRegex = /Route::(?:prefix\(['"]([^'"]+)['"]\)|group\(\s*\[([^\]]+)\])\s*(?:->[\s\S]*?)?->group\s*\(\s*function\s*\(\)\s*\{([\s\S]*?)\}\s*\);/g;
    let groupMatch;

    while ((groupMatch = groupRegex.exec(code)) !== null) {
      let groupPrefix = groupMatch[1] || '';
      const groupConfig = groupMatch[2] || '';
      const groupBody = groupMatch[3];

      if (!groupPrefix && groupConfig) {
        const pMatch = groupConfig.match(/['"]prefix['"]\s*=>\s*['"]([^'"]+)['"]/);
        if (pMatch) groupPrefix = pMatch[1];
      }

      const isGroupAuth =
        groupConfig.includes('auth') ||
        groupMatch[0].includes('middleware(\'auth') ||
        groupMatch[0].includes('middleware(["auth') ||
        groupMatch[0].includes('auth:sanctum');

      const combinedBase = this.joinPaths(defaultPrefix, groupPrefix);
      const subEndpoints = this.parseRouteStatements(groupBody, relativePath, combinedBase, isGroupAuth, projectId, lines.length);
      endpoints.push(...subEndpoints);
    }

    // Direct root route declarations outside matched groups
    const topEndpoints = this.parseRouteStatements(code, relativePath, defaultPrefix, false, projectId, lines.length);
    for (const ep of topEndpoints) {
      if (!endpoints.some((e) => e.method === ep.method && e.path === ep.path)) {
        endpoints.push(ep);
      }
    }

    return endpoints;
  }

  private parseRouteStatements(
    code: string,
    relativePath: string,
    basePrefix: string,
    inheritedAuth: boolean,
    projectId: string,
    totalLines: number
  ): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];

    // Route::get('path', [Controller::class, 'method'])
    // Route::post('path', 'Controller@method')
    // $router->get('path', ...)
    const routeRegex = /(?:Route|\$router)::(get|post|put|patch|delete|options|any)\s*\(\s*['"]([^'"]*)['"]\s*,\s*([^)]+)\)/gi;
    let match;

    while ((match = routeRegex.exec(code)) !== null) {
      const verb = match[1].toUpperCase();
      const rawPath = match[2];
      const handlerDef = match[3];

      const fullPath = this.joinPaths(basePrefix, rawPath);
      const methods: HttpMethod[] = verb === 'ANY' ? ['GET', 'POST', 'PUT', 'DELETE'] : [verb as HttpMethod];

      // Extract controller and action
      let controllerName = 'ClosureHandler';
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
        inheritedAuth ||
        code.includes('auth:sanctum') ||
        code.includes('auth:api') ||
        code.includes("'auth'") ||
        handlerDef.includes('middleware');

      // Extract path parameters ({id})
      const parameters: ApiParameter[] = [];
      const pathParams = fullPath.match(/{([a-zA-Z0-9_]+)}/g) || [];
      for (const p of pathParams) {
        const paramName = p.replace(/[{}]/g, '');
        parameters.push({
          id: `param-${uuidv4().substring(0, 8)}`,
          endpointId: '',
          name: paramName,
          paramIn: 'path',
          dataType: 'string',
          required: true,
          description: `URL path parameter ${paramName}`,
          detectionType: 'DETECTED',
        });
      }

      // Add request body parameter for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(methods[0])) {
        parameters.push({
          id: `param-${uuidv4().substring(0, 8)}`,
          endpointId: '',
          name: 'payload',
          paramIn: 'body',
          dataType: 'object',
          required: true,
          description: `JSON request payload for ${controllerName}::${handlerFunction}`,
          detectionType: 'DETECTED',
        });
      }

      for (const method of methods) {
        endpoints.push({
          id: `ep-php-${uuidv4().substring(0, 8)}`,
          projectId,
          method,
          path: fullPath,
          summary: `${method} ${fullPath}`,
          description: `Laravel route handled by ${controllerName}::${handlerFunction}`,
          controllerName,
          handlerFunction,
          sourceFile: relativePath,
          lineStart: 1,
          lineEnd: totalLines,
          authRequired,
          authType: authRequired ? 'bearer' : 'none',
          middleware: authRequired ? ['auth:sanctum'] : [],
          detectionType: 'DETECTED',
          confidenceScore: 0.95,
          parameters,
          responses: [
            {
              id: `res-${uuidv4().substring(0, 8)}`,
              endpointId: '',
              statusCode: method === 'POST' ? 201 : 200,
              description: 'Successful JSON response',
              contentType: 'application/json',
              detectionType: 'DETECTED',
            },
          ],
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
      const resourceBase = this.joinPaths(basePrefix, resource);

      const resourceOps: Array<{ method: HttpMethod; subpath: string; action: string }> = [
        { method: 'GET', subpath: resourceBase, action: 'index' },
        { method: 'POST', subpath: resourceBase, action: 'store' },
        { method: 'GET', subpath: `${resourceBase}/{id}`, action: 'show' },
        { method: 'PUT', subpath: `${resourceBase}/{id}`, action: 'update' },
        { method: 'DELETE', subpath: `${resourceBase}/{id}`, action: 'destroy' },
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

        if (['POST', 'PUT'].includes(op.method)) {
          params.push({
            id: `param-${uuidv4().substring(0, 8)}`,
            endpointId: '',
            name: `${resource.replace(/s$/, '')}_data`,
            paramIn: 'body',
            dataType: 'object',
            required: true,
            description: `Request payload for ${ctrl}::${op.action}`,
            detectionType: 'DETECTED',
          });
        }

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
          lineEnd: totalLines,
          authRequired: inheritedAuth || op.method !== 'GET',
          authType: inheritedAuth || op.method !== 'GET' ? 'bearer' : 'none',
          middleware: inheritedAuth || op.method !== 'GET' ? ['auth:sanctum'] : [],
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

  /**
   * Laravel Migration Parser: Reads database/migrations/*.php
   * Schema::create('tableName', function (Blueprint $table) { ... })
   */
  private extractModelsFromMigrations(
    phpFiles: string[],
    projectDir: string,
    projectId: string
  ): DatabaseModel[] {
    const models: DatabaseModel[] = [];
    const migrationFiles = phpFiles.filter((f) => f.includes('migrations'));

    for (const filePath of migrationFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(projectDir, filePath);

        const schemaCreateRegex = /Schema::create\s*\(\s*['"]([a-zA-Z0-9_]+)['"]\s*,\s*function\s*\(\s*Blueprint\s+\$([a-zA-Z0-9_]+)\s*\)\s*\{([\s\S]*?)\}\s*\);/g;
        let match;

        while ((match = schemaCreateRegex.exec(code)) !== null) {
          const tableName = match[1];
          const varName = match[2];
          const body = match[3];

          const fields: ModelField[] = [];
          const relationships: ModelRelationship[] = [];

          // Parse column lines: $table->id(); $table->string('email')->unique();
          const lines = body.split(';');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith(`$${varName}->`)) continue;

            const colMatch = trimmed.match(new RegExp(`\\$${varName}->([a-zA-Z0-9_]+)\\s*\\(([^)]*)\\)`));
            if (!colMatch) continue;

            const methodType = colMatch[1];
            const rawArgs = colMatch[2];
            const argMatch = rawArgs.match(/['"]([a-zA-Z0-9_]+)['"]/);
            let colName = argMatch ? argMatch[1] : methodType;

            let fieldType = 'string';
            let isPrimary = false;
            let isUnique = trimmed.includes('->unique()');
            let isNullable = trimmed.includes('->nullable()');
            let foreignKeyTarget: string | undefined = undefined;

            switch (methodType) {
              case 'id':
              case 'increments':
              case 'bigIncrements':
                colName = 'id';
                fieldType = 'bigint';
                isPrimary = true;
                break;
              case 'string':
              case 'char':
              case 'tinyText':
                fieldType = 'string';
                break;
              case 'text':
              case 'mediumText':
              case 'longText':
                fieldType = 'text';
                break;
              case 'integer':
              case 'unsignedInteger':
                fieldType = 'integer';
                break;
              case 'bigInteger':
              case 'unsignedBigInteger':
                fieldType = 'bigint';
                break;
              case 'boolean':
                fieldType = 'boolean';
                break;
              case 'decimal':
              case 'float':
              case 'double':
                fieldType = 'decimal';
                break;
              case 'date':
              case 'datetime':
              case 'timestamp':
                fieldType = 'timestamp';
                break;
              case 'json':
              case 'jsonb':
                fieldType = 'json';
                break;
              case 'foreignId':
                fieldType = 'bigint';
                foreignKeyTarget = colName.replace(/_id$/, '');
                relationships.push({
                  id: `rel-${tableName}-${foreignKeyTarget}`,
                  sourceModel: tableName,
                  sourceField: colName,
                  targetModel: foreignKeyTarget,
                  targetField: 'id',
                  cardinality: 'N:1',
                  label: `${tableName}.${colName} -> ${foreignKeyTarget}`,
                });
                break;
              case 'rememberToken':
                colName = 'remember_token';
                fieldType = 'string';
                isNullable = true;
                break;
              case 'timestamps':
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
                continue;
              default:
                fieldType = 'string';
            }

            fields.push({
              id: `field-${uuidv4().substring(0, 8)}`,
              modelId: '',
              name: colName,
              fieldType,
              isPrimaryKey: isPrimary,
              isNullable,
              isUnique: isUnique || isPrimary,
              isIndexed: isPrimary || isUnique || Boolean(foreignKeyTarget),
              foreignKeyTarget,
            });
          }

          if (fields.length > 0) {
            const singularName = this.singularize(tableName);
            const modelName = singularName.charAt(0).toUpperCase() + singularName.slice(1);

            models.push({
              id: `model-${uuidv4().substring(0, 8)}`,
              projectId,
              name: modelName,
              tableName,
              ormType: 'eloquent',
              sourceFile: relativePath,
              description: `Laravel Migration Schema: ${tableName}`,
              detectionType: 'DETECTED',
              domain: this.assignDomain(modelName),
              fields,
              relationships,
              createdAt: new Date().toISOString(),
            });
          }
        }
      } catch (err) {}
    }

    return models;
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

      // Extract Eloquent relationships: public function orders() { return $this->hasMany(Order::class); }
      const relationships: ModelRelationship[] = [];
      const relRegex = /public\s+function\s+([a-zA-Z0-9_]+)\s*\(\)\s*\{[\s\S]*?return\s+\$this->(hasMany|belongsTo|hasOne|belongsToMany)\s*\(\s*([A-Za-z0-9_]+)::class/g;
      let relMatch;

      while ((relMatch = relRegex.exec(code)) !== null) {
        const relName = relMatch[1];
        const relType = relMatch[2];
        const targetClass = relMatch[3];

        let cardinality: '1:1' | '1:N' | 'N:M' | 'N:1' = 'N:1';
        if (relType === 'hasMany') cardinality = '1:N';
        else if (relType === 'belongsTo') cardinality = 'N:1';
        else if (relType === 'hasOne') cardinality = '1:1';
        else if (relType === 'belongsToMany') cardinality = 'N:M';

        relationships.push({
          id: `rel-${modelName}-${targetClass}-${relName}`,
          sourceModel: modelName,
          sourceField: relName,
          targetModel: targetClass,
          targetField: 'id',
          cardinality,
          label: `${modelName}.${relName} -> ${targetClass} (${relType})`,
        });
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
        domain: this.assignDomain(modelName),
        fields,
        relationships,
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

      // Link to models referenced in path or controller name
      for (const m of models) {
        if (
          ep.path.toLowerCase().includes(m.name.toLowerCase()) ||
          (ep.controllerName && ep.controllerName.toLowerCase().includes(m.name.toLowerCase()))
        ) {
          dependencies.push({
            id: `dep-${uuidv4().substring(0, 8)}`,
            projectId,
            sourceType: 'controller',
            sourceId: ep.controllerName || ep.id,
            sourceLabel: ep.controllerName || 'Controller',
            targetType: 'model',
            targetId: m.id,
            targetLabel: m.name,
            relationType: 'queries',
          });
        }
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

  private joinPaths(base: string, sub: string): string {
    const cleanBase = base.replace(/\/+$/, '');
    const cleanSub = sub.replace(/^\/+/, '');
    const result = `${cleanBase}/${cleanSub}`.replace(/\/+/g, '/').replace(/\/$/, '');
    return result.startsWith('/') ? result : `/${result}`;
  }

  private singularize(word: string): string {
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('ses')) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
  }

  private assignDomain(
    name: string
  ): 'Identity & Security' | 'Commerce & Products' | 'Orders & Fulfillment' | 'Financial & Ledger' | 'Audit & Compliance' | 'AI & Vector Search' | 'General' {
    const lower = name.toLowerCase();
    if (lower.includes('user') || lower.includes('auth') || lower.includes('session') || lower.includes('role') || lower.includes('token')) {
      return 'Identity & Security';
    }
    if (lower.includes('product') || lower.includes('item') || lower.includes('catalog') || lower.includes('category')) {
      return 'Commerce & Products';
    }
    if (lower.includes('order') || lower.includes('cart') || lower.includes('shipping')) {
      return 'Orders & Fulfillment';
    }
    if (lower.includes('payment') || lower.includes('invoice') || lower.includes('billing') || lower.includes('transaction')) {
      return 'Financial & Ledger';
    }
    return 'General';
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
