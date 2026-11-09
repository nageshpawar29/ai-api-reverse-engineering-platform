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

export class JavaAnalyzer implements FrameworkAnalyzer {
  public readonly name = 'Java / Kotlin (Spring Boot)';

  public async detect(projectDir: string): Promise<boolean> {
    return fs.existsSync(path.join(projectDir, 'pom.xml')) ||
      fs.existsSync(path.join(projectDir, 'build.gradle')) ||
      fs.existsSync(path.join(projectDir, 'build.gradle.kts'));
  }

  public async analyze(projectDir: string, projectId: string): Promise<AnalysisEngineResult> {
    const endpoints: ApiEndpoint[] = [];
    const models: DatabaseModel[] = [];
    const dependencies: DependencyNode[] = [];
    const securityFindings: SecurityFinding[] = [];

    const javaFiles = this.getAllJavaFiles(projectDir);

    for (const filePath of javaFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(projectDir, filePath);

        // Extract Spring Boot Controllers & Routes
        if (code.includes('@RestController') || code.includes('@Controller') || code.includes('@RequestMapping')) {
          const fileEndpoints = this.extractRoutesFromController(code, relativePath, projectId);
          endpoints.push(...fileEndpoints);
        }

        // Extract JPA / Hibernate Entities
        if (code.includes('@Entity') || code.includes('@Table')) {
          const fileModels = this.extractJpaEntities(code, relativePath, projectId);
          models.push(...fileModels);
        }
      } catch (err) {
        console.warn(`Java parsing error in ${filePath}:`, err);
      }
    }

    this.buildDependencies(endpoints, models, dependencies, projectId);
    this.detectSecurityVulnerabilities(endpoints, securityFindings, projectId);

    return {
      endpoints,
      models,
      dependencies,
      securityFindings,
      fileCount: javaFiles.length,
    };
  }

  private extractRoutesFromController(code: string, relativePath: string, projectId: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = code.split('\n');

    // 1. Detect Class-level RequestMapping prefix
    let classPrefix = '';
    const classMappingMatch = code.match(/@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/);
    if (classMappingMatch) {
      classPrefix = classMappingMatch[1];
    }

    // Class name
    const classNameMatch = code.match(/(?:public\s+)?(?:class|interface)\s+([a-zA-Z0-9_]+)/);
    const controllerName = classNameMatch ? classNameMatch[1] : path.basename(relativePath, '.java');

    // Class-level security check
    const hasClassAuth = code.includes('@Secured') || code.includes('@PreAuthorize') || code.includes('@RolesAllowed');

    // 2. Scan methods
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const mappingRegex = /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*(?:\(\s*(?:value\s*=\s*)?["']?([^"')\s]*)?["']?.*?\))?/i;
      const match = line.match(mappingRegex);

      if (match) {
        const annotation = match[1];
        let subPath = match[2] || '';
        if (subPath && !subPath.startsWith('/')) subPath = `/${subPath}`;

        let method: HttpMethod = 'GET';
        if (annotation === 'PostMapping') method = 'POST';
        else if (annotation === 'PutMapping') method = 'PUT';
        else if (annotation === 'DeleteMapping') method = 'DELETE';
        else if (annotation === 'PatchMapping') method = 'PATCH';
        else if (annotation === 'RequestMapping') {
          const methodMatch = line.match(/method\s*=\s*RequestMethod\.([A-Z]+)/);
          if (methodMatch) method = methodMatch[1] as HttpMethod;
        }

        const fullPath = this.normalizePath(classPrefix + (subPath || ''));

        // Scan method signature for parameters
        const { methodName, params } = this.extractMethodSignature(lines, i + 1);

        // Security check
        const methodChunk = lines.slice(Math.max(0, i - 3), i + 1).join(' ');
        const hasAuth = hasClassAuth ||
          methodChunk.includes('@PreAuthorize') ||
          methodChunk.includes('@Secured') ||
          methodChunk.includes('@RolesAllowed') ||
          methodChunk.includes('@AuthenticationPrincipal');

        endpoints.push({
          id: `ep-${uuidv4().substring(0, 8)}`,
          projectId,
          method,
          path: fullPath,
          summary: `${method} ${fullPath} (${controllerName})`,
          description: `Spring Boot endpoint handled by ${controllerName}.${methodName}() in ${relativePath}`,
          purpose: `Executes Spring MVC action ${methodName}`,
          controllerName,
          handlerFunction: methodName,
          sourceFile: relativePath,
          lineStart: i + 1,
          lineEnd: i + 1,
          authRequired: hasAuth,
          authType: hasAuth ? 'Spring Security (JWT / OAuth2)' : undefined,
          detectionType: 'DETECTED',
          confidenceScore: 0.95,
          parameters: params,
          responses: [
            {
              id: `res-${uuidv4().substring(0, 8)}`,
              endpointId: '',
              statusCode: method === 'POST' ? 201 : 200,
              description: 'Spring ResponseEntity / JSON Response',
              contentType: 'application/json',
              detectionType: 'DETECTED',
            },
          ],
          middleware: hasAuth ? ['@PreAuthorize'] : [],
          createdAt: new Date().toISOString(),
        });
      }
    }

    return endpoints;
  }

  private extractMethodSignature(lines: string[], startIndex: number): { methodName: string; params: ApiParameter[] } {
    let methodName = 'actionHandler';
    const params: ApiParameter[] = [];

    for (let j = startIndex; j < Math.min(lines.length, startIndex + 5); j++) {
      const line = lines[j].trim();
      const defMatch = line.match(/(?:public|private|protected)?\s+(?:ResponseEntity<.*?>|[a-zA-Z0-9_<>,]+)\s+([a-zA-Z0-9_]+)\s*\((.*?)\)/);
      if (defMatch) {
        methodName = defMatch[1];
        const rawArgs = defMatch[2];

        // Parse Spring annotations: @PathVariable("id") Long id, @RequestParam String q, @RequestBody UserDto user
        const pathVarRegex = /@PathVariable\s*(?:\(\s*["']?([a-zA-Z0-9_]+)?["']?\s*\))?\s+([a-zA-Z0-9_<>]+)\s+([a-zA-Z0-9_]+)/g;
        let pMatch;
        while ((pMatch = pathVarRegex.exec(rawArgs)) !== null) {
          const pName = pMatch[1] || pMatch[3];
          params.push({
            id: `param-${uuidv4().substring(0, 8)}`,
            endpointId: '',
            name: pName,
            paramIn: 'path',
            dataType: (pMatch[2] || '').toLowerCase().includes('long') || (pMatch[2] || '').toLowerCase().includes('int') ? 'number' : 'string',
            required: true,
            description: `@PathVariable ${pName}`,
            detectionType: 'DETECTED',
          });
        }

        const reqParamRegex = /@RequestParam\s*(?:\(\s*(?:name\s*=\s*)?["']?([a-zA-Z0-9_]+)?["']?.*?\))?\s+([a-zA-Z0-9_<>]+)\s+([a-zA-Z0-9_]+)/g;
        while ((pMatch = reqParamRegex.exec(rawArgs)) !== null) {
          const qName = pMatch[1] || pMatch[3];
          params.push({
            id: `param-${uuidv4().substring(0, 8)}`,
            endpointId: '',
            name: qName,
            paramIn: 'query',
            dataType: 'string',
            required: !rawArgs.includes('required = false'),
            description: `@RequestParam ${qName}`,
            detectionType: 'DETECTED',
          });
        }

        if (rawArgs.includes('@RequestBody')) {
          params.push({
            id: `param-${uuidv4().substring(0, 8)}`,
            endpointId: '',
            name: 'requestBody',
            paramIn: 'body',
            dataType: 'object',
            required: true,
            description: 'JSON Payload @RequestBody',
            detectionType: 'DETECTED',
          });
        }

        break;
      }
    }

    return { methodName, params };
  }

  private extractJpaEntities(code: string, relativePath: string, projectId: string): DatabaseModel[] {
    const models: DatabaseModel[] = [];

    const classMatch = code.match(/(?:public\s+)?class\s+([a-zA-Z0-9_]+)/);
    if (!classMatch) return models;

    const entityName = classMatch[1];
    let tableName = entityName.toLowerCase() + 's';

    const tableMatch = code.match(/@Table\s*\(\s*name\s*=\s*["']([^"']+)["']/);
    if (tableMatch) {
      tableName = tableMatch[1];
    }

    const fields: ModelField[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Detect field declaration: private Long id; or @Column private String email;
      const fieldMatch = line.match(/(?:private|protected|public)\s+([a-zA-Z0-9_<>,]+)\s+([a-zA-Z0-9_]+)\s*;/);
      if (fieldMatch) {
        const fType = fieldMatch[1];
        const fName = fieldMatch[2];

        const isId = i > 0 && lines[i - 1].includes('@Id');

        fields.push({
          id: `field-${uuidv4().substring(0, 8)}`,
          modelId: '',
          name: fName,
          fieldType: fType.toLowerCase().includes('long') || fType.toLowerCase().includes('int') ? 'integer' : (fType.toLowerCase().includes('boolean') ? 'boolean' : 'string'),
          isPrimaryKey: isId || fName.toLowerCase() === 'id',
          isNullable: !line.includes('nullable = false'),
          isUnique: line.includes('unique = true'),
        });
      }
    }

    if (fields.length > 0) {
      models.push({
        id: `model-${uuidv4().substring(0, 8)}`,
        projectId,
        name: entityName,
        tableName,
        sourceFile: relativePath,
        ormType: 'jpa-hibernate',
        detectionType: 'DETECTED',
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
    endpoints.forEach((ep) => {
      const ctrlName = ep.controllerName || 'SpringController';

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
        details: `Dispatches to Spring handler ${ep.handlerFunction || 'method'}`,
      });

      // Link to JPA models
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
            details: `Persists/queries JPA entity ${m.tableName || m.name}`,
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
        const isAuthRoute = ep.path.includes('/login') || ep.path.includes('/register') || ep.path.includes('/authenticate');
        if (!isAuthRoute) {
          findings.push({
            id: `sec-${uuidv4().substring(0, 8)}`,
            projectId,
            endpointId: ep.id,
            severity: 'high',
            category: 'Broken Authentication',
            title: `Unauthenticated Mutation: ${ep.method} ${ep.path}`,
            description: `State-modifying Spring Boot route ${ep.method} ${ep.path} lacks @PreAuthorize or @Secured access controls.`,
            recommendation: `Secure this endpoint by adding @PreAuthorize("isAuthenticated()") or configure HttpSecurity in SecurityFilterChain.`,
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

  private getAllJavaFiles(dir: string): string[] {
    const results: string[] = [];
    const walk = (current: string) => {
      if (!fs.existsSync(current)) return;
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(current, e.name);
        if (e.isDirectory()) {
          if (!['target', '.git', 'build', '.gradle', 'node_modules', '.idea'].includes(e.name)) {
            walk(full);
          }
        } else if (e.name.endsWith('.java') || e.name.endsWith('.kt')) {
          results.push(full);
        }
      }
    };
    walk(dir);
    return results;
  }
}
