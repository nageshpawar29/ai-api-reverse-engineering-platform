import YAML from 'yaml';
import { ApiEndpoint, Project } from '../types/index.js';

export class OpenApiGenerator {
  public static generateSpec(project: Project, endpoints: ApiEndpoint[]): { json: any; yaml: string } {
    const paths: Record<string, any> = {};

    let hasAuth = false;

    endpoints.forEach((ep) => {
      // Normalize path for OpenAPI: /users/:id -> /users/{id}
      const openApiPath = ep.path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');

      if (!paths[openApiPath]) {
        paths[openApiPath] = {};
      }

      const methodKey = ep.method.toLowerCase();
      const operationId = `${methodKey}_${openApiPath.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Parameters
      const parameters: any[] = [];
      const bodyParams: any[] = [];

      ep.parameters.forEach((param) => {
        if (param.paramIn === 'body') {
          bodyParams.push(param);
        } else {
          parameters.push({
            name: param.name,
            in: param.paramIn,
            required: param.required || param.paramIn === 'path',
            description: param.description || `${param.paramIn} parameter: ${param.name}`,
            schema: {
              type: param.dataType === 'number' ? 'integer' : 'string',
            },
          });
        }
      });

      // Request Body
      let requestBody: any = undefined;
      if (['post', 'put', 'patch'].includes(methodKey) && bodyParams.length > 0) {
        const properties: Record<string, any> = {};
        const required: string[] = [];

        bodyParams.forEach((bp) => {
          properties[bp.name] = {
            type: bp.dataType === 'number' ? 'integer' : 'string',
            description: bp.description || bp.name,
          };
          if (bp.required) required.push(bp.name);
        });

        requestBody = {
          description: `Payload for ${ep.method} ${ep.path}`,
          required: required.length > 0,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties,
                required: required.length > 0 ? required : undefined,
              },
            },
          },
        };
      }

      // Responses
      const responses: Record<string, any> = {};
      if (ep.responses && ep.responses.length > 0) {
        ep.responses.forEach((res) => {
          responses[res.statusCode.toString()] = {
            description: res.description || `HTTP ${res.statusCode} response`,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'object' },
                  },
                },
              },
            },
          };
        });
      } else {
        responses['200'] = {
          description: 'Successful operation',
          content: {
            'application/json': {
              schema: {
                type: 'object',
              },
            },
          },
        };
      }

      if (ep.authRequired) {
        hasAuth = true;
      }

      // Format tag cleanly
      let rawTag = ep.controllerName || ep.path.split('/')[2] || 'General';
      rawTag = rawTag.replace(/controller$/i, '').trim();
      const tagName = rawTag ? rawTag.charAt(0).toUpperCase() + rawTag.slice(1) : 'General';

      // Operation
      paths[openApiPath][methodKey] = {
        operationId,
        summary: ep.summary || `${ep.method} ${ep.path}`,
        description: ep.purpose || ep.description || `Handled by ${ep.controllerName || ep.handlerFunction}`,
        parameters: parameters.length > 0 ? parameters : undefined,
        requestBody,
        responses,
        security: ep.authRequired ? [{ BearerAuth: [] }] : undefined,
        tags: [tagName],
      };
    });

    // Collect unique tags
    const allTags = new Set<string>();
    Object.values(paths).forEach((methods: any) => {
      Object.values(methods).forEach((op: any) => {
        if (op.tags && Array.isArray(op.tags)) {
          op.tags.forEach((t: string) => allTags.add(t));
        }
      });
    });

    const tagsList = Array.from(allTags).sort().map((name) => ({
      name,
      description: `Endpoints and controller operations for ${name} management`,
    }));

    const spec: any = {
      openapi: '3.0.3',
      info: {
        title: `${project.name} API Specification`,
        version: '1.0.0',
        description: `### Enterprise Reverse-Engineered OpenAPI 3.0.3 Specification\n\nAutomatically extracted from static AST route analysis and AI-grounded inference for **${project.name}**.\n\n- **Total Routes Identified**: ${endpoints.length}\n- **Analysis Engine**: Deterministic AST Static Analysis + AI Grounded Reasoning\n- **Security Gates**: ${endpoints.filter(e => e.authRequired).length} Authenticated Endpoints`,
        contact: {
          name: 'AI API Reverse-Engineering Platform',
        },
      },
      servers: [
        {
          url: 'http://localhost:5001',
          description: 'Local Platform API Server (Port 5001)',
        },
        {
          url: 'http://localhost:3000',
          description: 'Target Application Server (Port 3000)',
        },
        {
          url: 'http://localhost:8080',
          description: 'Alternative Port / Microservice Gateway (Port 8080)',
        },
      ],
      tags: tagsList,
      paths,
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Provide your JWT bearer token in the Authorization header: `Bearer <token>`',
          },
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'x-api-key',
            description: 'API Key authentication passed via `x-api-key` header.',
          },
        },
        schemas: {
          SuccessResponse: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: { type: 'object', description: 'Payload returned by the service' },
              message: { type: 'string', example: 'Operation completed successfully' },
            },
          },
          ErrorResponse: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: { type: 'string', example: 'Resource not found or validation failed' },
              statusCode: { type: 'integer', example: 400 },
              timestamp: { type: 'string', format: 'date-time', example: '2026-10-13T10:00:00Z' },
            },
          },
        },
      },
    };

    return {
      json: spec,
      yaml: YAML.stringify(spec),
    };
  }
}
