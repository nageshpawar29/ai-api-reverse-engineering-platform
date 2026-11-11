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

export class RustAnalyzer implements FrameworkAnalyzer {
  public readonly name = 'Rust (Axum / Actix-web / Rocket)';

  public async detect(projectDir: string): Promise<boolean> {
    const hasCargo = fs.existsSync(path.join(projectDir, 'Cargo.toml'));
    const hasRs = this.hasRustFiles(projectDir);
    return hasCargo || hasRs;
  }

  public async analyze(projectDir: string, projectId: string): Promise<AnalysisEngineResult> {
    const endpoints: ApiEndpoint[] = [];
    const models: DatabaseModel[] = [];
    const dependencies: DependencyNode[] = [];
    const securityFindings: SecurityFinding[] = [];

    const rsFiles = this.getAllRustFiles(projectDir);

    for (const filePath of rsFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(projectDir, filePath);

        // 1. Actix-web routes: #[get("/path")]
        if (code.includes('#[get(') || code.includes('#[post(') || code.includes('#[put(') || code.includes('#[delete(')) {
          const actixEndpoints = this.extractActixRoutes(code, relativePath, projectId);
          endpoints.push(...actixEndpoints);
        }

        // 2. Axum routes: Router::new().route("/path", get(handler))
        if (code.includes('.route(') || code.includes('Router::new()')) {
          const axumEndpoints = this.extractAxumRoutes(code, relativePath, projectId);
          for (const aep of axumEndpoints) {
            if (!endpoints.some((e) => e.method === aep.method && e.path === aep.path)) {
              endpoints.push(aep);
            }
          }
        }

        // 3. Rocket routes: #[get("/<id>")]
        if (code.includes('#[rocket::') || (code.includes('#[get(') && code.includes('rocket'))) {
          const rocketEndpoints = this.extractRocketRoutes(code, relativePath, projectId);
          for (const rep of rocketEndpoints) {
            if (!endpoints.some((e) => e.method === rep.method && e.path === rep.path)) {
              endpoints.push(rep);
            }
          }
        }

        // 4. Struct Entity Models: pub struct User { pub id: i64, ... }
        if (code.includes('struct ') && (code.includes('Serialize') || code.includes('Deserialize') || code.includes('Queryable'))) {
          const structModels = this.extractStructModels(code, relativePath, projectId);
          models.push(...structModels);
        }
      } catch (err) {
        console.warn(`Rust parsing error in ${filePath}:`, err);
      }
    }

    // 5. Build Dependencies
    this.buildDependencies(endpoints, models, dependencies, projectId);

    // 6. Security Audit
    this.detectSecurityVulnerabilities(endpoints, securityFindings, projectId);

    return {
      endpoints,
      models,
      dependencies,
      securityFindings,
      fileCount: rsFiles.length,
    };
  }

  private extractActixRoutes(code: string, relativePath: string, projectId: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = code.split('\n');

    // #[get("/api/v1/users")] or #[post("/login")]
    const regex = /#\[(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']\s*\)\][\s\S]*?(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g;
    let match;

    while ((match = regex.exec(code)) !== null) {
      const method = match[1].toUpperCase() as HttpMethod;
      const rawPath = match[2];
      const fnName = match[3];
      const fnArgs = match[4] || '';

      const cleanPath = '/' + rawPath.replace(/^\//, '');

      // Path parameters: {id}
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
          description: `Path parameter ${paramName}`,
          detectionType: 'DETECTED',
        });
      }

      const hasAuth = fnArgs.includes('Auth') || fnArgs.includes('Claims') || fnArgs.includes('Token') || code.includes('HttpAuthentication');

      endpoints.push({
        id: `ep-actix-${uuidv4().substring(0, 8)}`,
        projectId,
        method,
        path: cleanPath,
        summary: `${method} ${cleanPath}`,
        description: `Actix-web handler fn ${fnName}() in ${relativePath}`,
        controllerName: path.basename(relativePath, '.rs'),
        handlerFunction: fnName,
        sourceFile: relativePath,
        lineStart: 1,
        lineEnd: lines.length,
        authRequired: hasAuth,
        authType: hasAuth ? 'bearer' : 'none',
        middleware: hasAuth ? ['HttpAuthentication'] : [],
        detectionType: 'DETECTED',
        confidenceScore: 0.98,
        parameters,
        responses: [
          {
            id: `res-${uuidv4().substring(0, 8)}`,
            endpointId: '',
            statusCode: method === 'POST' ? 201 : 200,
            description: 'HttpResponse JSON payload',
            contentType: 'application/json',
            detectionType: 'DETECTED',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    }

    return endpoints;
  }

  private extractAxumRoutes(code: string, relativePath: string, projectId: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    // .route("/path", get(handler).post(handler))
    const regex = /\.route\s*\(\s*["']([^"']+)["']\s*,\s*([a-zA-Z0-9_():\s]+)\)/g;
    let match;

    while ((match = regex.exec(code)) !== null) {
      const rawPath = match[1];
      const handlerChain = match[2];
      const cleanPath = '/' + rawPath.replace(/^\//, '');

      // Parse verbs inside handlerChain: get(h1).post(h2)
      const verbMatches = handlerChain.matchAll(/(get|post|put|patch|delete)\s*\(\s*([a-zA-Z0-9_:]+)\s*\)/g);
      for (const vm of verbMatches) {
        const method = vm[1].toUpperCase() as HttpMethod;
        const handlerName = vm[2].replace(/^.*::/, '');

        endpoints.push({
          id: `ep-axum-${uuidv4().substring(0, 8)}`,
          projectId,
          method,
          path: cleanPath,
          summary: `${method} ${cleanPath}`,
          description: `Axum route handled by ${handlerName}`,
          controllerName: path.basename(relativePath, '.rs'),
          handlerFunction: handlerName,
          sourceFile: relativePath,
          lineStart: 1,
          lineEnd: 20,
          authRequired: code.includes('Extension<Claims>') || code.includes('TypedHeader'),
          authType: 'bearer',
          middleware: [],
          detectionType: 'DETECTED',
          confidenceScore: 0.95,
          parameters: [],
          responses: [
            {
              id: `res-${uuidv4().substring(0, 8)}`,
              endpointId: '',
              statusCode: method === 'POST' ? 201 : 200,
              description: 'Axum Response (Json<T>)',
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

  private extractRocketRoutes(code: string, relativePath: string, projectId: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const regex = /#\[(get|post|put|delete)\s*\(\s*["']([^"']+)["'](?:.*?format\s*=\s*["']([^"']+)["'])?\s*\)\][\s\S]*?fn\s+([a-zA-Z0-9_]+)/g;
    let match;

    while ((match = regex.exec(code)) !== null) {
      const method = match[1].toUpperCase() as HttpMethod;
      const rawPath = match[2];
      const fnName = match[4];
      const cleanPath = '/' + rawPath.replace(/^\//, '');

      endpoints.push({
        id: `ep-rkt-${uuidv4().substring(0, 8)}`,
        projectId,
        method,
        path: cleanPath,
        summary: `${method} ${cleanPath}`,
        description: `Rocket route fn ${fnName}()`,
        controllerName: path.basename(relativePath, '.rs'),
        handlerFunction: fnName,
        sourceFile: relativePath,
        lineStart: 1,
        lineEnd: 20,
        authRequired: false,
        authType: 'none',
        middleware: [],
        detectionType: 'DETECTED',
        confidenceScore: 0.92,
        parameters: [],
        responses: [
          {
            id: `res-${uuidv4().substring(0, 8)}`,
            endpointId: '',
            statusCode: method === 'POST' ? 201 : 200,
            description: 'Rocket result (Json<T>)',
            contentType: 'application/json',
            detectionType: 'DETECTED',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    }

    return endpoints;
  }

  private extractStructModels(code: string, relativePath: string, projectId: string): DatabaseModel[] {
    const models: DatabaseModel[] = [];
    // pub struct User { pub id: i64, pub name: String, ... }
    const structRegex = /(?:pub\s+)?struct\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}/g;
    let match;

    while ((match = structRegex.exec(code)) !== null) {
      const structName = match[1];
      const body = match[2];

      if (structName.endsWith('Request') || structName.endsWith('Response') || structName.endsWith('Config') || structName.endsWith('Params')) {
        continue;
      }

      const fields: ModelField[] = [];
      const fieldMatches = body.matchAll(/(?:pub\s+)?([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_<>]+)/g);

      for (const fm of fieldMatches) {
        const fName = fm[1];
        const fType = fm[2];

        const isPrimary = fName.toLowerCase() === 'id';
        const isFk = fName.endsWith('_id');
        const isNullable = fType.startsWith('Option<');

        fields.push({
          id: `field-${uuidv4().substring(0, 8)}`,
          modelId: '',
          name: fName,
          fieldType: fType.replace('Option<', '').replace('>', ''),
          isPrimaryKey: isPrimary,
          isNullable,
          isUnique: isPrimary,
          isIndexed: isPrimary || isFk,
          foreignKeyTarget: isFk ? fName.replace(/_id$/, '') : undefined,
        });
      }

      if (fields.length > 1) {
        models.push({
          id: `model-${uuidv4().substring(0, 8)}`,
          projectId,
          name: structName,
          tableName: structName.toLowerCase() + 's',
          ormType: 'diesel',
          sourceFile: relativePath,
          description: `Rust Data Struct Entity: ${structName}`,
          detectionType: 'DETECTED',
          domain: structName.toLowerCase().includes('user') ? 'Identity & Security' : 'Commerce & Products',
          fields,
          createdAt: new Date().toISOString(),
        });
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
      if (['POST', 'PUT', 'DELETE'].includes(ep.method) && !ep.authRequired) {
        findings.push({
          id: `sec-${uuidv4().substring(0, 8)}`,
          projectId,
          endpointId: ep.id,
          severity: 'high',
          category: 'Missing Authentication',
          title: `Rust mutating route lacks auth extractor: ${ep.method} ${ep.path}`,
          description: `Handler ${ep.handlerFunction} modifies system state without authentication claims extractor.`,
          sourceFile: ep.sourceFile,
          lineNumber: ep.lineStart,
          recommendation: `Add claims extractor or authentication middleware.`,
          detectionType: 'DETECTED',
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  private getAllRustFiles(dir: string, maxFiles = 300): string[] {
    const results: string[] = [];
    const walk = (current: string) => {
      if (results.length >= maxFiles || !fs.existsSync(current)) return;
      try {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxFiles) return;
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) {
            if (!['target', '.git', 'node_modules'].includes(entry.name)) {
              walk(full);
            }
          } else if (entry.name.endsWith('.rs')) {
            results.push(full);
          }
        }
      } catch (e) {}
    };
    walk(dir);
    return results;
  }

  private hasRustFiles(dir: string): boolean {
    return this.getAllRustFiles(dir, 1).length > 0;
  }
}
