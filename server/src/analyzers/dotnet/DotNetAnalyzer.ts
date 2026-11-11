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

export class DotNetAnalyzer implements FrameworkAnalyzer {
  public readonly name = 'C# / .NET (ASP.NET Core / WebAPI)';

  public async detect(projectDir: string): Promise<boolean> {
    const hasCsproj = this.hasFilesWithExtension(projectDir, ['.csproj', '.sln']);
    const hasCs = this.hasFilesWithExtension(projectDir, ['.cs']);
    return hasCsproj || hasCs;
  }

  public async analyze(projectDir: string, projectId: string): Promise<AnalysisEngineResult> {
    const endpoints: ApiEndpoint[] = [];
    const models: DatabaseModel[] = [];
    const dependencies: DependencyNode[] = [];
    const securityFindings: SecurityFinding[] = [];

    const csFiles = this.getAllCsFiles(projectDir);

    for (const filePath of csFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(projectDir, filePath);

        // 1. Controller-based routes ([ApiController])
        if (code.includes('[ApiController]') || code.includes(': ControllerBase') || code.includes(': Controller')) {
          const controllerEndpoints = this.extractControllerRoutes(code, relativePath, projectId);
          endpoints.push(...controllerEndpoints);
        }

        // 2. Minimal APIs (app.MapGet, app.MapPost)
        if (code.includes('app.MapGet(') || code.includes('app.MapPost(') || code.includes('app.MapPut(')) {
          const minimalEndpoints = this.extractMinimalApiRoutes(code, relativePath, projectId);
          endpoints.push(...minimalEndpoints);
        }

        // 3. Entity Framework Core Models
        if (
          relativePath.toLowerCase().includes('model') ||
          relativePath.toLowerCase().includes('entit') ||
          code.includes('{ get; set; }')
        ) {
          const fileModels = this.extractEfModels(code, relativePath, projectId);
          models.push(...fileModels);
        }
      } catch (err) {
        console.warn(`C# parsing error in ${filePath}:`, err);
      }
    }

    this.buildDependencies(endpoints, models, dependencies, projectId);
    this.detectSecurityVulnerabilities(endpoints, securityFindings, projectId);

    return {
      endpoints,
      models,
      dependencies,
      securityFindings,
      fileCount: csFiles.length,
    };
  }

  private extractControllerRoutes(code: string, relativePath: string, projectId: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const classMatch = code.match(/class\s+([A-Za-z0-9_]+)\s*:\s*(?:ControllerBase|Controller)/);
    const controllerName = classMatch ? classMatch[1] : path.basename(relativePath, '.cs');
    const controllerBaseName = controllerName.replace(/Controller$/, '');

    // Class-level [Route("api/[controller]")] or [Route("api/users")]
    let basePrefix = '/api/' + controllerBaseName.toLowerCase();
    const routeAttrMatch = code.match(/\[Route\(\s*["']([^"']+)["']\s*\)\]/);
    if (routeAttrMatch) {
      basePrefix = '/' + routeAttrMatch[1].replace('[controller]', controllerBaseName.toLowerCase()).replace(/^\//, '');
    }

    const isClassAuthorized = code.includes('[Authorize]');

    // Method attributes: [HttpGet], [HttpPost("{id}")], [HttpPut], [HttpDelete]
    const methodRegex = /\[(Http[A-Za-z]+)(?:\(\s*["']?([^"'\)]*)["']?\s*\))?\][\s\S]*?(?:public\s+[async\s]*[A-Za-z0-9_<>\s]+\s+([A-Za-z0-9_]+)\s*\(([^)]*)\))/g;
    let match;

    while ((match = methodRegex.exec(code)) !== null) {
      const httpAttr = match[1]; // HttpGet, HttpPost, HttpPut, HttpDelete
      const subRoute = match[2] ? match[2].trim() : '';
      const methodName = match[3];
      const paramsSignature = match[4] || '';

      const method = httpAttr.replace('Http', '').toUpperCase() as HttpMethod;
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(method)) continue;

      let fullPath = basePrefix;
      if (subRoute) {
        const cleanSub = subRoute.replace(/^\//, '');
        fullPath = `${basePrefix}/${cleanSub}`.replace(/\/+/g, '/');
      }

      // Convert .NET route param {id:int} to {id}
      fullPath = fullPath.replace(/{([a-zA-Z0-9_]+):[^}]+}/g, '{$1}');

      // Path parameters
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
          description: `Path parameter ${paramName}`,
          detectionType: 'DETECTED',
        });
      }

      // Query & Body parameters from signature
      if (paramsSignature) {
        const parts = paramsSignature.split(',');
        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          if (trimmed.includes('[FromBody]')) {
            const bodyType = trimmed.replace('[FromBody]', '').trim().split(' ')[0];
            parameters.push({
              id: `param-${uuidv4().substring(0, 8)}`,
              endpointId: '',
              name: 'body',
              paramIn: 'body',
              dataType: bodyType || 'object',
              required: true,
              description: `Request payload body (${bodyType})`,
              detectionType: 'DETECTED',
            });
          }
        }
      }

      const authRequired = isClassAuthorized || match[0].includes('[Authorize]');

      endpoints.push({
        id: `ep-cs-${uuidv4().substring(0, 8)}`,
        projectId,
        method,
        path: fullPath,
        summary: `${method} ${fullPath}`,
        description: `ASP.NET Core controller action ${controllerName}.${methodName}`,
        controllerName,
        handlerFunction: methodName,
        sourceFile: relativePath,
        lineStart: 1,
        lineEnd: code.split('\n').length,
        authRequired,
        authType: authRequired ? 'bearer' : 'none',
        middleware: authRequired ? ['[Authorize]'] : [],
        detectionType: 'DETECTED',
        confidenceScore: 0.96,
        parameters,
        responses: [
          {
            id: `res-${uuidv4().substring(0, 8)}`,
            endpointId: '',
            statusCode: method === 'POST' ? 201 : 200,
            description: 'Success HTTP 200 / 201',
            contentType: 'application/json',
            detectionType: 'DETECTED',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    }

    return endpoints;
  }

  private extractMinimalApiRoutes(code: string, relativePath: string, projectId: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const minRegex = /app\.Map(Get|Post|Put|Delete|Patch)\s*\(\s*["']([^"']+)["']/g;
    let match;

    while ((match = minRegex.exec(code)) !== null) {
      const method = match[1].toUpperCase() as HttpMethod;
      const rawPath = match[2];
      const cleanPath = '/' + rawPath.replace(/^\//, '');

      endpoints.push({
        id: `ep-cs-min-${uuidv4().substring(0, 8)}`,
        projectId,
        method,
        path: cleanPath,
        summary: `${method} ${cleanPath}`,
        description: `ASP.NET Minimal API Endpoint`,
        controllerName: 'MinimalProgram',
        handlerFunction: `Map${match[1]}`,
        sourceFile: relativePath,
        lineStart: 1,
        lineEnd: code.split('\n').length,
        authRequired: code.includes('.RequireAuthorization()'),
        authType: code.includes('.RequireAuthorization()') ? 'bearer' : 'none',
        middleware: code.includes('.RequireAuthorization()') ? ['.RequireAuthorization()'] : [],
        detectionType: 'DETECTED',
        confidenceScore: 0.95,
        parameters: [],
        responses: [
          {
            id: `res-${uuidv4().substring(0, 8)}`,
            endpointId: '',
            statusCode: method === 'POST' ? 201 : 200,
            description: 'Result payload',
            contentType: 'application/json',
            detectionType: 'DETECTED',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    }

    return endpoints;
  }

  private extractEfModels(code: string, relativePath: string, projectId: string): DatabaseModel[] {
    const models: DatabaseModel[] = [];
    const classMatches = code.matchAll(/public\s+class\s+([A-Za-z0-9_]+)/g);

    for (const cm of classMatches) {
      const modelName = cm[1];
      if (modelName.endsWith('Controller') || modelName.endsWith('Service') || modelName.endsWith('Repository')) {
        continue;
      }

      const fields: ModelField[] = [];
      const propMatches = code.matchAll(/public\s+([A-Za-z0-9_?<>]+)\s+([A-Za-z0-9_]+)\s*\{\s*get;\s*set;\s*\}/g);

      for (const pm of propMatches) {
        const propType = pm[1];
        const propName = pm[2];

        // Skip collection navigation properties
        if (propType.includes('ICollection') || propType.includes('List<')) continue;

        const isPrimary = propName.toLowerCase() === 'id' || propName.toLowerCase() === `${modelName.toLowerCase()}id`;

        fields.push({
          id: `field-${uuidv4().substring(0, 8)}`,
          modelId: '',
          name: propName,
          fieldType: propType.replace('?', ''),
          isPrimaryKey: isPrimary,
          isNullable: propType.includes('?'),
          isUnique: isPrimary,
          isIndexed: isPrimary || propName.endsWith('Id'),
          foreignKeyTarget: propName.endsWith('Id') && !isPrimary ? propName.replace(/Id$/, '') : undefined,
        });
      }

      if (fields.length > 1) {
        models.push({
          id: `model-${uuidv4().substring(0, 8)}`,
          projectId,
          name: modelName,
          tableName: modelName + 's',
          ormType: 'efcore',
          sourceFile: relativePath,
          description: `Entity Framework Core Entity: ${modelName}`,
          detectionType: 'DETECTED',
          domain: modelName.toLowerCase().includes('user') ? 'Identity & Security' : 'Commerce & Products',
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
          category: 'Missing Authorization',
          title: `Endpoint missing [Authorize] attribute: ${ep.method} ${ep.path}`,
          description: `State modification action is accessible without authentication token.`,
          sourceFile: ep.sourceFile,
          lineNumber: ep.lineStart,
          recommendation: `Decorate the method or controller with [Authorize].`,
          detectionType: 'DETECTED',
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  private getAllCsFiles(dir: string, maxFiles = 300): string[] {
    const results: string[] = [];
    const walk = (current: string) => {
      if (results.length >= maxFiles || !fs.existsSync(current)) return;
      try {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxFiles) return;
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) {
            if (!['bin', 'obj', '.git', '.vs', 'node_modules'].includes(entry.name)) {
              walk(full);
            }
          } else if (entry.name.endsWith('.cs')) {
            results.push(full);
          }
        }
      } catch (e) {}
    };
    walk(dir);
    return results;
  }

  private hasFilesWithExtension(dir: string, extensions: string[]): boolean {
    return this.getAllCsFiles(dir, 1).length > 0;
  }
}
