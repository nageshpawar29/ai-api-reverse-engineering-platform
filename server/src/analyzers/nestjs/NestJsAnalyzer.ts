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
  SecurityFinding,
} from '../../types/index.js';
import { FrameworkAnalyzer, AnalysisEngineResult } from '../FrameworkAnalyzer.js';
import { DatabaseAnalyzer } from '../database/DatabaseAnalyzer.js';

export class NestJsAnalyzer implements FrameworkAnalyzer {
  public readonly name = 'NestJS (TypeScript Enterprise API)';

  public async detect(projectDir: string): Promise<boolean> {
    const pkgPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (all['@nestjs/core'] || all['@nestjs/common']) return true;
      } catch (e) {}
    }
    return this.hasNestDecorators(projectDir);
  }

  public async analyze(projectDir: string, projectId: string): Promise<AnalysisEngineResult> {
    const endpoints: ApiEndpoint[] = [];
    const dependencies: DependencyNode[] = [];
    const securityFindings: SecurityFinding[] = [];

    const tsFiles = this.getAllTsFiles(projectDir);

    // 1. Scan for NestJS Controllers (*.controller.ts)
    for (const filePath of tsFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(projectDir, filePath);

        if (code.includes('@Controller(') || code.includes('@Controller()')) {
          const ctrlEndpoints = this.extractControllerRoutes(code, relativePath, projectId);
          endpoints.push(...ctrlEndpoints);

          // Extract service injections from constructor
          this.extractServiceDependencies(code, relativePath, dependencies, projectId);
        }
      } catch (err) {
        console.warn(`NestJS parsing error in ${filePath}:`, err);
      }
    }

    // 2. Database Models extraction (TypeORM / Prisma / Mongoose)
    const models = await DatabaseAnalyzer.extractModels(projectDir, projectId, tsFiles);

    // 3. Security Audit (Guards, unauthenticated POST/PUT)
    this.detectSecurityVulnerabilities(endpoints, securityFindings, projectId);

    return {
      endpoints,
      models,
      dependencies,
      securityFindings,
      fileCount: tsFiles.length,
    };
  }

  private extractControllerRoutes(code: string, relativePath: string, projectId: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = code.split('\n');

    // Extract @Controller('prefix')
    const ctrlMatch = code.match(/@Controller\(\s*(?:['"`]([^'"`]*)['"`]|(?:\{\s*path:\s*['"`]([^'"`]*)['"`]))?\s*\)/);
    let basePrefix = '';
    if (ctrlMatch) {
      basePrefix = ctrlMatch[1] || ctrlMatch[2] || '';
    }

    // Check class-level Guard: @UseGuards(JwtAuthGuard)
    const isClassGuarded = code.includes('@UseGuards(');

    // Class name
    const classMatch = code.match(/class\s+([A-Za-z0-9_]+)/);
    const controllerName = classMatch ? classMatch[1] : path.basename(relativePath, '.ts');

    // Method match: @Get('path'), @Post('path'), @Put(':id'), etc.
    const methodRegex = /@(Get|Post|Put|Delete|Patch|Options|Head)\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)[\s\S]*?(?:public\s+[async\s]*|async\s+)?([A-Za-z0-9_]+)\s*\(([^)]*)\)/g;
    let match;

    while ((match = methodRegex.exec(code)) !== null) {
      const httpVerb = match[1].toUpperCase() as HttpMethod;
      const subRoute = match[2] || '';
      const methodName = match[3];
      const paramsSignature = match[4] || '';

      const fullPath = this.joinPaths(basePrefix, subRoute);
      const isMethodGuarded = isClassGuarded || match[0].includes('@UseGuards(');

      const parameters: ApiParameter[] = [];

      // Parse method params: @Param('id') id: string, @Query('page') page: number, @Body() dto: CreateDto
      if (paramsSignature) {
        const paramMatches = paramsSignature.matchAll(/@(Param|Query|Body|Headers)\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)\s*([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_<>]+)/g);
        for (const pm of paramMatches) {
          const decType = pm[1];
          const decName = pm[2] || pm[3];
          const argName = pm[3];
          const argType = pm[4];

          let paramIn: 'path' | 'query' | 'header' | 'body' = 'query';
          if (decType === 'Param') paramIn = 'path';
          else if (decType === 'Body') paramIn = 'body';
          else if (decType === 'Headers') paramIn = 'header';

          parameters.push({
            id: `param-${uuidv4().substring(0, 8)}`,
            endpointId: '',
            name: decName || argName,
            paramIn,
            dataType: argType.toLowerCase().includes('number') ? 'number' : (argType.toLowerCase().includes('bool') ? 'boolean' : 'string'),
            required: paramIn === 'path' || paramIn === 'body',
            description: `NestJS ${decType} parameter: ${argName}`,
            detectionType: 'DETECTED',
          });
        }
      }

      endpoints.push({
        id: `ep-nest-${uuidv4().substring(0, 8)}`,
        projectId,
        method: httpVerb,
        path: fullPath,
        summary: `${httpVerb} ${fullPath}`,
        description: `NestJS endpoint routed to ${controllerName}.${methodName}`,
        controllerName,
        handlerFunction: methodName,
        sourceFile: relativePath,
        lineStart: 1,
        lineEnd: lines.length,
        authRequired: isMethodGuarded,
        authType: isMethodGuarded ? 'bearer' : 'none',
        middleware: isMethodGuarded ? ['@UseGuards(AuthGuard)'] : [],
        detectionType: 'DETECTED',
        confidenceScore: 0.98,
        parameters,
        responses: [
          {
            id: `res-${uuidv4().substring(0, 8)}`,
            endpointId: '',
            statusCode: httpVerb === 'POST' ? 201 : 200,
            description: 'Successful execution',
            contentType: 'application/json',
            detectionType: 'DETECTED',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    }

    return endpoints;
  }

  private extractServiceDependencies(
    code: string,
    relativePath: string,
    dependencies: DependencyNode[],
    projectId: string
  ): void {
    const classMatch = code.match(/class\s+([A-Za-z0-9_]+)/);
    if (!classMatch) return;
    const ctrlName = classMatch[1];

    // constructor(private readonly usersService: UsersService)
    const ctorMatch = code.match(/constructor\s*\(([^)]*)\)/);
    if (ctorMatch) {
      const args = ctorMatch[1].split(',');
      for (const arg of args) {
        const typeMatch = arg.match(/:\s*([A-Za-z0-9_]+)/);
        if (typeMatch) {
          const serviceName = typeMatch[1];
          if (serviceName.endsWith('Service') || serviceName.endsWith('Repository')) {
            dependencies.push({
              id: `dep-${uuidv4().substring(0, 8)}`,
              projectId,
              sourceType: 'controller',
              sourceId: ctrlName,
              sourceLabel: ctrlName,
              targetType: 'service',
              targetId: serviceName,
              targetLabel: serviceName,
              relationType: 'calls',
              details: `Dependency injected: ${serviceName}`,
            });
          }
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
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(ep.method) && !ep.authRequired) {
        findings.push({
          id: `sec-${uuidv4().substring(0, 8)}`,
          projectId,
          endpointId: ep.id,
          severity: 'high',
          category: 'Missing Guard',
          title: `Mutating NestJS route lacks @UseGuards: ${ep.method} ${ep.path}`,
          description: `Action ${ep.controllerName}.${ep.handlerFunction} modifies system state without authentication guard.`,
          sourceFile: ep.sourceFile,
          lineNumber: ep.lineStart,
          recommendation: `Decorate the endpoint or controller with @UseGuards(JwtAuthGuard).`,
          detectionType: 'DETECTED',
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  private joinPaths(base: string, sub: string): string {
    const cleanBase = base.replace(/\/+$/, '');
    const cleanSub = sub.replace(/^\/+/, '');
    const result = `/${cleanBase}/${cleanSub}`.replace(/\/+/g, '/').replace(/\/$/, '');
    return result || '/';
  }

  private getAllTsFiles(dir: string, maxFiles = 300): string[] {
    const results: string[] = [];
    const walk = (current: string) => {
      if (results.length >= maxFiles || !fs.existsSync(current)) return;
      try {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxFiles) return;
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', 'dist'].includes(entry.name)) {
              walk(full);
            }
          } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
            results.push(full);
          }
        }
      } catch (e) {}
    };
    walk(dir);
    return results;
  }

  private hasNestDecorators(dir: string): boolean {
    const files = this.getAllTsFiles(dir, 15);
    for (const f of files) {
      try {
        const content = fs.readFileSync(f, 'utf-8');
        if (content.includes('@Controller') || content.includes('@Injectable')) return true;
      } catch (e) {}
    }
    return false;
  }
}
