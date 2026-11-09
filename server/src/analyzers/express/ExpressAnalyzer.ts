import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { ApiEndpoint, ApiParameter, DependencyNode, HttpMethod } from '../../types/index.js';
import { FrameworkAnalyzer, AnalysisEngineResult } from '../FrameworkAnalyzer.js';
import { ControllerAnalyzer } from './ControllerAnalyzer.js';
import { DatabaseAnalyzer } from '../database/DatabaseAnalyzer.js';
import { SecurityAnalyzer } from '../security/SecurityAnalyzer.js';

const traverse = (traverseModule as any).default || traverseModule;

export class ExpressAnalyzer implements FrameworkAnalyzer {
  public readonly name = 'Express';

  public async detect(projectDir: string): Promise<boolean> {
    const pkgPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.dependencies?.express || pkg.devDependencies?.express) {
          return true;
        }
      } catch (e) {}
    }
    return true; // Default fallback
  }

  public async analyze(projectDir: string, projectId: string): Promise<AnalysisEngineResult> {
    const endpoints: ApiEndpoint[] = [];
    const dependencies: DependencyNode[] = [];
    const allFiles = this.getAllSourceFiles(projectDir);

    // Step 1: Detect router mounts from entry files
    const routerMountMap = this.detectRouterMounts(projectDir, allFiles);

    // Step 2: Extract endpoints from each file
    for (const filePath of allFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        if (!code.includes('router.') && !code.includes('app.') && !code.includes('Router()')) {
          continue;
        }

        const relativeFilePath = path.relative(projectDir, filePath);
        const mountPrefix = routerMountMap.get(filePath) || routerMountMap.get(relativeFilePath) || '';

        const fileEndpoints = this.extractRoutesFromFile(
          code,
          filePath,
          relativeFilePath,
          mountPrefix,
          projectDir,
          projectId,
          dependencies
        );

        endpoints.push(...fileEndpoints);
      } catch (err) {
        console.warn(`AST Parse error on ${filePath}:`, err);
      }
    }

    // Step 3: Run Database Models extraction
    const models = await DatabaseAnalyzer.extractModels(projectDir, projectId, allFiles);

    // Step 3.5: Scan services and link to Models
    this.linkServicesToModels(projectDir, allFiles, projectId, models, dependencies);

    // Step 4: Run Static Security analysis
    const securityFindings = await SecurityAnalyzer.analyze(projectDir, projectId, endpoints, allFiles);

    return {
      endpoints,
      models,
      dependencies,
      securityFindings,
      fileCount: allFiles.length,
    };
  }

  private detectRouterMounts(projectDir: string, allFiles: string[]): Map<string, string> {
    const mountMap = new Map<string, string>(); // absoluteFilePath -> prefix

    for (const filePath of allFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        if (!code.includes('.use(')) continue;

        const ast = parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx', 'decorators-legacy'],
        });

        // Collect imports in this file: identifier -> imported path
        const importsMap = new Map<string, string>();

        traverse(ast, {
          ImportDeclaration(p: any) {
            const source = p.node.source?.value;
            p.node.specifiers?.forEach((spec: any) => {
              if (spec.local?.name) {
                importsMap.set(spec.local.name, source);
              }
            });
          },
          VariableDeclarator(p: any) {
            // Pattern: const authRoutes = require('./routes/authRoutes')
            if (
              p.node.init?.type === 'CallExpression' &&
              p.node.init.callee?.name === 'require' &&
              p.node.init.arguments?.[0]?.value &&
              p.node.id?.name
            ) {
              importsMap.set(p.node.id.name, p.node.init.arguments[0].value);
            }
          },
          CallExpression(p: any) {
            const callee = p.node.callee;
            // Pattern: app.use('/api/v1/users', userRoutes)
            if (
              callee?.type === 'MemberExpression' &&
              callee.property?.name === 'use' &&
              p.node.arguments?.length >= 2
            ) {
              const prefixArg = p.node.arguments[0];
              const routerArg = p.node.arguments[1];

              if (prefixArg.type === 'StringLiteral' && routerArg.type === 'Identifier') {
                const prefix = prefixArg.value;
                const routerIdent = routerArg.name;
                const importSource = importsMap.get(routerIdent);

                if (importSource) {
                  const resolvedPath = ExpressAnalyzer.resolveRelativePath(
                    path.dirname(filePath),
                    importSource
                  );
                  if (resolvedPath) {
                    mountMap.set(resolvedPath, prefix);
                  }
                }
              }
            }
          },
        });
      } catch (err) {
        // Skip unparseable files
      }
    }

    return mountMap;
  }

  private extractRoutesFromFile(
    code: string,
    filePath: string,
    relativeFilePath: string,
    mountPrefix: string,
    projectDir: string,
    projectId: string,
    dependencies: DependencyNode[]
  ): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
    });

    const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete']);

    // Find imports to resolve controller files
    const importsMap = new Map<string, string>();
    traverse(ast, {
      ImportDeclaration(p: any) {
        const src = p.node.source?.value;
        p.node.specifiers?.forEach((spec: any) => {
          if (spec.local?.name) {
            importsMap.set(spec.local.name, src);
          }
        });
      },
    });

    traverse(ast, {
      CallExpression(p: any) {
        const callee = p.node.callee;
        if (callee?.type !== 'MemberExpression') return;

        const methodName = callee.property?.name?.toLowerCase();
        if (!httpMethods.has(methodName)) return;

        const obj = callee.object;
        const objName = obj.name || (obj.callee?.property?.name === 'route' ? 'router' : '');

        // Must be app.get or router.get
        if (!['router', 'app', 'api'].includes(objName?.toLowerCase()) && !obj.callee) {
          return;
        }

        const args = p.node.arguments;
        if (!args || args.length < 2) return;

        // Path argument
        let routePath = '/';
        const pathArg = args[0];
        if (pathArg.type === 'StringLiteral') {
          routePath = pathArg.value;
        }

        // Full route path
        const fullPath = ExpressAnalyzer.combinePaths(mountPrefix, routePath);

        // Middleware and handler
        const middlewareNames: string[] = [];
        let handlerName = 'handler';
        let controllerName: string | undefined = undefined;

        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          const isLast = i === args.length - 1;

          if (arg.type === 'Identifier') {
            if (isLast) {
              handlerName = arg.name;
            } else {
              middlewareNames.push(arg.name);
            }
          } else if (arg.type === 'MemberExpression') {
            const parent = arg.object?.name;
            const func = arg.property?.name;
            if (isLast) {
              controllerName = parent;
              handlerName = func;
            } else {
              middlewareNames.push(`${parent}.${func}`);
            }
          } else if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
            if (isLast) {
              handlerName = 'inlineHandler';
            }
          }
        }

        // Check authentication
        const authKeywords = ['auth', 'jwt', 'token', 'passport', 'admin', 'protect', 'verify', 'session'];
        const authRequired = middlewareNames.some((m) =>
          authKeywords.some((kw) => m.toLowerCase().includes(kw))
        );

        const endpointId = `ep-${uuidv4().substring(0, 8)}`;
        const lineStart = p.node.loc?.start?.line;
        const lineEnd = p.node.loc?.end?.line;

        // Analyze controller if external
        let controllerAnalysis: {
          parameters: ApiParameter[];
          responses: any[];
          serviceCalls: string[];
          databaseOperations: string[];
          externalCalls: string[];
        } = {
          parameters: [],
          responses: [],
          serviceCalls: [],
          databaseOperations: [],
          externalCalls: [],
        };

        if (controllerName && importsMap.has(controllerName)) {
          const relImport = importsMap.get(controllerName)!;
          const controllerPath = ExpressAnalyzer.resolveRelativePath(
            path.dirname(filePath),
            relImport
          );
          if (controllerPath) {
            controllerAnalysis = ControllerAnalyzer.analyzeHandler(
              controllerPath,
              handlerName,
              controllerName
            );
          }
        }

        // Path parameters extraction from route string: /users/:id/:subId
        const pathParamRegex = /:([a-zA-Z0-9_]+)/g;
        let match;
        const existingPathParams = new Set(
          controllerAnalysis.parameters.filter((p: any) => p.paramIn === 'path').map((p: any) => p.name)
        );

        while ((match = pathParamRegex.exec(fullPath)) !== null) {
          const paramName = match[1];
          if (!existingPathParams.has(paramName)) {
            controllerAnalysis.parameters.push({
              id: `param-${Math.random().toString(36).substring(2, 7)}`,
              endpointId,
              name: paramName,
              paramIn: 'path',
              dataType: 'string',
              required: true,
              detectionType: 'DETECTED',
            });
          }
        }

        // Link parameters and responses to endpoint
        controllerAnalysis.parameters.forEach((param: any) => {
          param.endpointId = endpointId;
        });
        controllerAnalysis.responses.forEach((resp: any) => {
          resp.endpointId = endpointId;
        });

        // Dependencies extraction: Multi-Tier Architecture Pipeline
        const routeLabel = `${methodName.toUpperCase()} ${fullPath}`;
        const ctrlId = controllerName || handlerName;

        // 1. Route -> Middlewares & Middlewares -> Controller
        if (middlewareNames.length > 0) {
          middlewareNames.forEach((mw) => {
            const isAuth =
              mw.toLowerCase().includes('auth') ||
              mw.toLowerCase().includes('protect') ||
              mw.toLowerCase().includes('jwt');
            dependencies.push({
              id: `dep-${uuidv4().substring(0, 8)}`,
              projectId,
              sourceType: 'route',
              sourceId: routeLabel,
              sourceLabel: routeLabel,
              targetType: 'middleware',
              targetId: mw,
              targetLabel: mw,
              relationType: 'intercepts',
              details: isAuth
                ? 'Authentication & Access Security Guard'
                : 'Request Validation & Sanitization Interceptor',
            });

            dependencies.push({
              id: `dep-${uuidv4().substring(0, 8)}`,
              projectId,
              sourceType: 'middleware',
              sourceId: mw,
              sourceLabel: mw,
              targetType: 'controller',
              targetId: ctrlId,
              targetLabel: ctrlId,
              relationType: 'calls',
              details: 'Dispatches validated request context to handler',
            });
          });
        }

        // 2. Direct Route -> Controller link
        dependencies.push({
          id: `dep-${uuidv4().substring(0, 8)}`,
          projectId,
          sourceType: 'route',
          sourceId: routeLabel,
          sourceLabel: routeLabel,
          targetType: 'controller',
          targetId: ctrlId,
          targetLabel: ctrlId,
          relationType: 'calls',
          details: `Direct execution handler: ${ctrlId}`,
        });

        // 3. Controller -> Services
        controllerAnalysis.serviceCalls.forEach((svc) => {
          const serviceClass = svc.split('.')[0] || svc;
          dependencies.push({
            id: `dep-${uuidv4().substring(0, 8)}`,
            projectId,
            sourceType: 'controller',
            sourceId: ctrlId,
            sourceLabel: ctrlId,
            targetType: 'service',
            targetId: serviceClass,
            targetLabel: svc,
            relationType: 'uses',
            details: `Invokes business service method: ${svc}`,
          });
        });

        // 4. Controller -> Database Models
        controllerAnalysis.databaseOperations.forEach((dbOp) => {
          const parts = dbOp.split('.');
          let modelName = parts[parts.length - 2] || parts[0];
          if (parts[0] === 'Prisma' && parts[1]) {
            modelName = parts[1];
          }
          const hasService = controllerAnalysis.serviceCalls.length > 0;
          const originType = hasService ? 'service' : 'controller';
          const originId = hasService
            ? controllerAnalysis.serviceCalls[0].split('.')[0]
            : ctrlId;

          dependencies.push({
            id: `dep-${uuidv4().substring(0, 8)}`,
            projectId,
            sourceType: originType,
            sourceId: originId,
            sourceLabel: originId,
            targetType: 'model',
            targetId: modelName,
            targetLabel: modelName,
            relationType:
              dbOp.toLowerCase().includes('create') ||
              dbOp.toLowerCase().includes('update') ||
              dbOp.toLowerCase().includes('delete')
                ? 'persists'
                : 'queries',
            details: dbOp,
          });
        });

        // 5. Controller -> External 3rd-Party APIs
        controllerAnalysis.externalCalls.forEach((ext) => {
          const extName = ext.split('.')[0] || ext;
          dependencies.push({
            id: `dep-${uuidv4().substring(0, 8)}`,
            projectId,
            sourceType: 'controller',
            sourceId: ctrlId,
            sourceLabel: ctrlId,
            targetType: 'external',
            targetId: extName,
            targetLabel: ext,
            relationType: 'uses',
            details: `External integration call: ${ext}`,
          });
        });

        endpoints.push({
          id: endpointId,
          projectId,
          method: methodName.toUpperCase() as HttpMethod,
          path: fullPath,
          summary: `${methodName.toUpperCase()} ${fullPath}`,
          description: `Discovered endpoint handled by ${controllerName ? `${controllerName}.${handlerName}` : handlerName}`,
          controllerName,
          handlerFunction: handlerName,
          sourceFile: relativeFilePath,
          lineStart,
          lineEnd,
          authRequired,
          authType: authRequired ? 'bearer' : undefined,
          detectionType: 'DETECTED',
          confidenceScore: 1.0,
          parameters: controllerAnalysis.parameters,
          responses: controllerAnalysis.responses,
          middleware: middlewareNames,
          createdAt: new Date().toISOString(),
        });
      },
    });

    return endpoints;
  }

  private static combinePaths(prefix: string, route: string): string {
    let cleanPrefix = prefix.trim();
    let cleanRoute = route.trim();

    if (!cleanPrefix.startsWith('/')) cleanPrefix = '/' + cleanPrefix;
    if (cleanPrefix.endsWith('/')) cleanPrefix = cleanPrefix.slice(0, -1);
    if (!cleanRoute.startsWith('/')) cleanRoute = '/' + cleanRoute;

    const full = cleanPrefix + cleanRoute;
    return full.replace(/\/+/g, '/') || '/';
  }

  private static resolveRelativePath(baseDir: string, importPath: string): string | null {
    const extensions = ['.ts', '.js', '.tsx', '.jsx', '/index.ts', '/index.js'];
    const resolvedBase = path.resolve(baseDir, importPath);

    if (fs.existsSync(resolvedBase) && fs.statSync(resolvedBase).isFile()) {
      return resolvedBase;
    }

    for (const ext of extensions) {
      const candidate = resolvedBase + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }

    return null;
  }

  private getAllSourceFiles(dir: string): string[] {
    const files: string[] = [];
    const walk = (current: string) => {
      if (!fs.existsSync(current)) return;
      const entries = fs.readdirSync(current, { withFileTypes: true });

      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
            walk(full);
          }
        } else if (/\.(ts|js|mjs|cjs)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
          files.push(full);
        }
      }
    };

    walk(dir);
    return files;
  }

  private linkServicesToModels(
    projectDir: string,
    allFiles: string[],
    projectId: string,
    models: any[],
    dependencies: DependencyNode[]
  ): void {
    const serviceFiles = allFiles.filter(
      (f) =>
        f.toLowerCase().includes('service') ||
        f.toLowerCase().includes('repository') ||
        f.toLowerCase().includes('dao')
    );

    for (const sFile of serviceFiles) {
      try {
        const content = fs.readFileSync(sFile, 'utf-8');
        const baseName = path.basename(sFile, path.extname(sFile));
        const serviceName = baseName.charAt(0).toUpperCase() + baseName.slice(1);

        for (const model of models) {
          const mName = model.name;
          const mLower = mName.toLowerCase();
          const sLower = serviceName.toLowerCase();

          if (
            sLower.includes(mLower) ||
            content.includes(`prisma.${mLower}`) ||
            content.includes(`prisma.${mName}`) ||
            content.includes(`${mName}.find`) ||
            content.includes(`${mName}.create`) ||
            content.includes(`${mName}.update`) ||
            content.includes(`${mName}.delete`)
          ) {
            const edgeExists = dependencies.some(
              (d) =>
                d.sourceType === 'service' &&
                d.sourceId === serviceName &&
                d.targetType === 'model' &&
                d.targetId === mName
            );
            if (!edgeExists) {
              dependencies.push({
                id: `dep-${uuidv4().substring(0, 8)}`,
                projectId,
                sourceType: 'service',
                sourceId: serviceName,
                sourceLabel: serviceName,
                targetType: 'model',
                targetId: mName,
                targetLabel: mName,
                relationType: 'queries',
                details: `Data persistence & retrieval operations on ${mName} entity`,
              });
            }
          }
        }
      } catch (err) {
        // continue
      }
    }
  }
}
