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

export class RubyAnalyzer implements FrameworkAnalyzer {
  public readonly name = 'Ruby on Rails / Sinatra';

  public async detect(projectDir: string): Promise<boolean> {
    const hasRoutes = fs.existsSync(path.join(projectDir, 'config', 'routes.rb'));
    const hasGemfile = fs.existsSync(path.join(projectDir, 'Gemfile'));
    const hasRb = this.hasRubyFiles(projectDir);
    return hasRoutes || hasGemfile || hasRb;
  }

  public async analyze(projectDir: string, projectId: string): Promise<AnalysisEngineResult> {
    const endpoints: ApiEndpoint[] = [];
    const models: DatabaseModel[] = [];
    const dependencies: DependencyNode[] = [];
    const securityFindings: SecurityFinding[] = [];

    const rbFiles = this.getAllRubyFiles(projectDir);

    // 1. Scan db/schema.rb or db/migrate/*.rb for ActiveRecord Schema
    const schemaFile = path.join(projectDir, 'db', 'schema.rb');
    if (fs.existsSync(schemaFile)) {
      try {
        const schemaCode = fs.readFileSync(schemaFile, 'utf-8');
        const schemaModels = this.parseRailsSchema(schemaCode, 'db/schema.rb', projectId);
        models.push(...schemaModels);
      } catch (e) {}
    }

    // 2. Scan config/routes.rb
    const routesFile = path.join(projectDir, 'config', 'routes.rb');
    if (fs.existsSync(routesFile)) {
      try {
        const routesCode = fs.readFileSync(routesFile, 'utf-8');
        const parsedEndpoints = this.parseRailsRoutes(routesCode, 'config/routes.rb', projectId);
        endpoints.push(...parsedEndpoints);
      } catch (e) {}
    }

    // 3. Scan app/models/*.rb for ActiveRecord associations
    for (const filePath of rbFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(projectDir, filePath);

        if (relativePath.includes('app/models/') || code.includes('< ApplicationRecord') || code.includes('< ActiveRecord::Base')) {
          const model = this.parseActiveRecordModel(code, relativePath, projectId);
          if (model) {
            const existing = models.find((m) => m.name.toLowerCase() === model.name.toLowerCase());
            if (existing) {
              existing.relationships = existing.relationships || [];
              existing.relationships.push(...(model.relationships || []));
            } else {
              models.push(model);
            }
          }
        }
      } catch (e) {}
    }

    // 4. Fallback Sinatra routes: get '/path' do ... end
    for (const filePath of rbFiles) {
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(projectDir, filePath);
        if (code.includes("require 'sinatra'") || code.includes('class App < Sinatra::Base')) {
          const sinatraEndpoints = this.parseSinatraRoutes(code, relativePath, projectId);
          for (const se of sinatraEndpoints) {
            if (!endpoints.some((e) => e.method === se.method && e.path === se.path)) {
              endpoints.push(se);
            }
          }
        }
      } catch (e) {}
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
      fileCount: rbFiles.length,
    };
  }

  private parseRailsRoutes(code: string, relativePath: string, projectId: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const lines = code.split('\n');

    // Extract namespaces: namespace :api do namespace :v1 do ...
    let currentPrefix = '';
    const namespaceMatch = code.match(/namespace\s+:([a-zA-Z0-9_]+)\s+do/g);
    if (namespaceMatch) {
      const parts = namespaceMatch.map((m) => m.replace(/namespace\s+:/, '').replace(/\s+do/, ''));
      currentPrefix = '/' + parts.join('/');
    }

    // 1. resources :users, :posts, :orders
    const resourceRegex = /resources\s+:([a-zA-Z0-9_]+)(?:\s*,\s*only:\s*\[([^\]]+)\])?/g;
    let match;

    while ((match = resourceRegex.exec(code)) !== null) {
      const resource = match[1];
      const onlyActions = match[2] ? match[2].replace(/[:\s]/g, '').split(',') : ['index', 'show', 'create', 'update', 'destroy'];

      const basePath = this.joinPaths(currentPrefix, resource);
      const ctrlName = `${resource.charAt(0).toUpperCase() + resource.slice(1)}Controller`;

      const actionsMap: Array<{ method: HttpMethod; path: string; action: string }> = [
        { method: 'GET', path: basePath, action: 'index' },
        { method: 'POST', path: basePath, action: 'create' },
        { method: 'GET', path: `${basePath}/:id`, action: 'show' },
        { method: 'PUT', path: `${basePath}/:id`, action: 'update' },
        { method: 'PATCH', path: `${basePath}/:id`, action: 'update' },
        { method: 'DELETE', path: `${basePath}/:id`, action: 'destroy' },
      ];

      for (const item of actionsMap) {
        if (onlyActions.includes(item.action)) {
          const params: ApiParameter[] = item.path.includes(':id')
            ? [
                {
                  id: `param-${uuidv4().substring(0, 8)}`,
                  endpointId: '',
                  name: 'id',
                  paramIn: 'path',
                  dataType: 'string',
                  required: true,
                  description: 'Resource unique identifier',
                  detectionType: 'DETECTED',
                },
              ]
            : [];

          if (['POST', 'PUT', 'PATCH'].includes(item.method)) {
            params.push({
              id: `param-${uuidv4().substring(0, 8)}`,
              endpointId: '',
              name: 'payload',
              paramIn: 'body',
              dataType: 'object',
              required: true,
              description: `Request payload for ${item.action}`,
              detectionType: 'DETECTED',
            });
          }

          endpoints.push({
            id: `ep-rb-${uuidv4().substring(0, 8)}`,
            projectId,
            method: item.method,
            path: item.path,
            summary: `${item.method} ${item.path}`,
            description: `Rails REST action ${ctrlName}#${item.action}`,
            controllerName: ctrlName,
            handlerFunction: item.action,
            sourceFile: relativePath,
            lineStart: 1,
            lineEnd: lines.length,
            authRequired: item.method !== 'GET',
            authType: item.method !== 'GET' ? 'bearer' : 'none',
            middleware: item.method !== 'GET' ? ['authenticate_user!'] : [],
            detectionType: 'DETECTED',
            confidenceScore: 0.96,
            parameters: params,
            responses: [
              {
                id: `res-${uuidv4().substring(0, 8)}`,
                endpointId: '',
                statusCode: item.method === 'POST' ? 201 : 200,
                description: 'Successful HTTP response',
                contentType: 'application/json',
                detectionType: 'DETECTED',
              },
            ],
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // 2. Custom direct routes: get '/path', to: 'controller#action'
    const directRouteRegex = /(get|post|put|patch|delete)\s+['"]([^'"]+)['"]\s*,\s*to:\s*['"]([a-zA-Z0-9_]+)#([a-zA-Z0-9_]+)['"]/gi;
    let dMatch;

    while ((dMatch = directRouteRegex.exec(code)) !== null) {
      const method = dMatch[1].toUpperCase() as HttpMethod;
      const rawPath = dMatch[2];
      const controller = `${dMatch[3].charAt(0).toUpperCase() + dMatch[3].slice(1)}Controller`;
      const action = dMatch[4];

      const fullPath = this.joinPaths(currentPrefix, rawPath);

      endpoints.push({
        id: `ep-rb-${uuidv4().substring(0, 8)}`,
        projectId,
        method,
        path: fullPath,
        summary: `${method} ${fullPath}`,
        description: `Rails route handled by ${controller}#${action}`,
        controllerName: controller,
        handlerFunction: action,
        sourceFile: relativePath,
        lineStart: 1,
        lineEnd: lines.length,
        authRequired: method !== 'GET',
        authType: method !== 'GET' ? 'bearer' : 'none',
        middleware: method !== 'GET' ? ['authenticate_user!'] : [],
        detectionType: 'DETECTED',
        confidenceScore: 0.95,
        parameters: [],
        responses: [
          {
            id: `res-${uuidv4().substring(0, 8)}`,
            endpointId: '',
            statusCode: method === 'POST' ? 201 : 200,
            description: 'JSON response',
            contentType: 'application/json',
            detectionType: 'DETECTED',
          },
        ],
        createdAt: new Date().toISOString(),
      });
    }

    return endpoints;
  }

  private parseSinatraRoutes(code: string, relativePath: string, projectId: string): ApiEndpoint[] {
    const endpoints: ApiEndpoint[] = [];
    const regex = /(get|post|put|patch|delete)\s+['"]([^'"]+)['"]\s+do/gi;
    let match;

    while ((match = regex.exec(code)) !== null) {
      const method = match[1].toUpperCase() as HttpMethod;
      const rawPath = match[2];
      const cleanPath = '/' + rawPath.replace(/^\//, '');

      endpoints.push({
        id: `ep-sin-${uuidv4().substring(0, 8)}`,
        projectId,
        method,
        path: cleanPath,
        summary: `${method} ${cleanPath}`,
        description: `Sinatra HTTP route in ${relativePath}`,
        controllerName: path.basename(relativePath, '.rb'),
        handlerFunction: method.toLowerCase(),
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

  private parseRailsSchema(code: string, relativePath: string, projectId: string): DatabaseModel[] {
    const models: DatabaseModel[] = [];
    // create_table "users", force: :cascade do |t| ... end
    const tableRegex = /create_table\s+["']([a-zA-Z0-9_]+)["'][\s\S]*?do\s+\|([a-zA-Z0-9_]+)\|([\s\S]*?)end/g;
    let match;

    while ((match = tableRegex.exec(code)) !== null) {
      const tableName = match[1];
      const varName = match[2];
      const body = match[3];

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

      // Parse t.string "email", null: false
      const colMatches = body.matchAll(new RegExp(`\\b${varName}\\.([a-zA-Z0-9_]+)\\s+["']([a-zA-Z0-9_]+)["']([^\\n]*)`, 'g'));
      for (const cm of colMatches) {
        const colType = cm[1];
        const colName = cm[2];
        const colOpts = cm[3] || '';

        if (colName === 'id') continue;

        const isUnique = colOpts.includes('unique: true');
        const isNullable = !colOpts.includes('null: false');
        const isFk = colName.endsWith('_id') || colType === 'references';

        fields.push({
          id: `field-${uuidv4().substring(0, 8)}`,
          modelId: '',
          name: colName,
          fieldType: colType === 'datetime' ? 'timestamp' : colType,
          isPrimaryKey: false,
          isNullable,
          isUnique,
          isIndexed: isUnique || isFk,
          foreignKeyTarget: isFk ? colName.replace(/_id$/, '') : undefined,
        });
      }

      const singularName = tableName.replace(/s$/, '');
      const modelName = singularName.charAt(0).toUpperCase() + singularName.slice(1);

      models.push({
        id: `model-${uuidv4().substring(0, 8)}`,
        projectId,
        name: modelName,
        tableName,
        ormType: 'activerecord',
        sourceFile: relativePath,
        description: `ActiveRecord Schema: ${tableName}`,
        detectionType: 'DETECTED',
        domain: modelName.toLowerCase().includes('user') ? 'Identity & Security' : 'Commerce & Products',
        fields,
        createdAt: new Date().toISOString(),
      });
    }

    return models;
  }

  private parseActiveRecordModel(code: string, relativePath: string, projectId: string): DatabaseModel | null {
    const classMatch = code.match(/class\s+([A-Za-z0-9_]+)\s*<\s*(?:ApplicationRecord|ActiveRecord::Base)/);
    if (!classMatch) return null;

    const modelName = classMatch[1];
    const relationships: ModelRelationship[] = [];

    // has_many :orders
    const hasManyMatches = code.matchAll(/has_many\s+:([a-zA-Z0-9_]+)/g);
    for (const hm of hasManyMatches) {
      const target = hm[1].replace(/s$/, '');
      const targetClass = target.charAt(0).toUpperCase() + target.slice(1);
      relationships.push({
        id: `rel-${modelName}-${targetClass}`,
        sourceModel: modelName,
        sourceField: hm[1],
        targetModel: targetClass,
        targetField: 'id',
        cardinality: '1:N',
        label: `${modelName} has_many ${targetClass}`,
      });
    }

    // belongs_to :company
    const belongsToMatches = code.matchAll(/belongs_to\s+:([a-zA-Z0-9_]+)/g);
    for (const bt of belongsToMatches) {
      const targetClass = bt[1].charAt(0).toUpperCase() + bt[1].slice(1);
      relationships.push({
        id: `rel-${modelName}-${targetClass}`,
        sourceModel: modelName,
        sourceField: `${bt[1]}_id`,
        targetModel: targetClass,
        targetField: 'id',
        cardinality: 'N:1',
        label: `${modelName} belongs_to ${targetClass}`,
      });
    }

    return {
      id: `model-${uuidv4().substring(0, 8)}`,
      projectId,
      name: modelName,
      tableName: modelName.toLowerCase() + 's',
      ormType: 'activerecord',
      sourceFile: relativePath,
      description: `ActiveRecord Entity: ${modelName}`,
      detectionType: 'DETECTED',
      domain: modelName.toLowerCase().includes('user') ? 'Identity & Security' : 'General',
      fields: [],
      relationships,
      createdAt: new Date().toISOString(),
    };
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
          title: `Rails state-altering action lacks authentication: ${ep.method} ${ep.path}`,
          description: `Mutating action ${ep.controllerName}#${ep.handlerFunction} is accessible without authenticate_user! filter.`,
          sourceFile: ep.sourceFile,
          lineNumber: ep.lineStart,
          recommendation: `Add before_action :authenticate_user! to ${ep.controllerName}.`,
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

  private getAllRubyFiles(dir: string, maxFiles = 300): string[] {
    const results: string[] = [];
    const walk = (current: string) => {
      if (results.length >= maxFiles || !fs.existsSync(current)) return;
      try {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxFiles) return;
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) {
            if (!['vendor', '.git', 'log', 'tmp', 'node_modules'].includes(entry.name)) {
              walk(full);
            }
          } else if (entry.name.endsWith('.rb')) {
            results.push(full);
          }
        }
      } catch (e) {}
    };
    walk(dir);
    return results;
  }

  private hasRubyFiles(dir: string): boolean {
    return this.getAllRubyFiles(dir, 1).length > 0;
  }
}
