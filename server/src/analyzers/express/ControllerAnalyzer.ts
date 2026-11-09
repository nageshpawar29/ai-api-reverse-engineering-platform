import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { ApiParameter, ApiResponse } from '../../types/index.js';

const traverse = (traverseModule as any).default || traverseModule;

export interface ControllerAnalysisResult {
  parameters: ApiParameter[];
  responses: ApiResponse[];
  serviceCalls: string[];
  databaseOperations: string[];
  externalCalls: string[];
  summary?: string;
}

export class ControllerAnalyzer {
  public static analyzeHandler(
    controllerFilePath: string,
    handlerName?: string,
    controllerName?: string
  ): ControllerAnalysisResult {
    const result: ControllerAnalysisResult = {
      parameters: [],
      responses: [],
      serviceCalls: [],
      databaseOperations: [],
      externalCalls: [],
    };

    if (!fs.existsSync(controllerFilePath)) {
      return result;
    }

    try {
      const code = fs.readFileSync(controllerFilePath, 'utf-8');
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy'],
      });

      const paramsMap = new Map<string, ApiParameter>();
      const responseStatusSet = new Set<number>();

      let targetFunctionFound = false;

      traverse(ast, {
        // Class methods (e.g. static async register(req, res))
        ClassMethod(pathNode: any) {
          const methodName = pathNode.node.key?.name;
          if (!handlerName || methodName === handlerName) {
            targetFunctionFound = true;
            ControllerAnalyzer.inspectFunctionBody(
              pathNode,
              paramsMap,
              responseStatusSet,
              result.serviceCalls,
              result.databaseOperations,
              result.externalCalls
            );
          }
        },

        // Function declarations (e.g. export async function register(req, res))
        FunctionDeclaration(pathNode: any) {
          const fnName = pathNode.node.id?.name;
          if (!handlerName || fnName === handlerName) {
            targetFunctionFound = true;
            ControllerAnalyzer.inspectFunctionBody(
              pathNode,
              paramsMap,
              responseStatusSet,
              result.serviceCalls,
              result.databaseOperations,
              result.externalCalls
            );
          }
        },

        // Arrow function variable declarations (e.g. export const register = async (req, res) => ...)
        VariableDeclarator(pathNode: any) {
          const varName = pathNode.node.id?.name;
          if (
            (!handlerName || varName === handlerName) &&
            (pathNode.node.init?.type === 'ArrowFunctionExpression' ||
              pathNode.node.init?.type === 'FunctionExpression')
          ) {
            targetFunctionFound = true;
            ControllerAnalyzer.inspectFunctionBody(
              pathNode,
              paramsMap,
              responseStatusSet,
              result.serviceCalls,
              result.databaseOperations,
              result.externalCalls
            );
          }
        },
      });

      // If handler was not found by exact name, scan entire file for patterns
      if (!targetFunctionFound) {
        traverse(ast, {
          VariableDeclarator(pathNode: any) {
            ControllerAnalyzer.inspectVariableForParams(pathNode, paramsMap);
          },
          CallExpression(pathNode: any) {
            ControllerAnalyzer.inspectCallForResponsesAndServices(
              pathNode,
              responseStatusSet,
              result.serviceCalls,
              result.databaseOperations,
              result.externalCalls
            );
          },
        });
      }

      // Convert params map to array
      result.parameters = Array.from(paramsMap.values());

      // If responses were detected, construct structured objects
      if (responseStatusSet.size > 0) {
        responseStatusSet.forEach((status) => {
          result.responses.push({
            id: `res-${status}-${Math.random().toString(36).substring(2, 7)}`,
            endpointId: '',
            statusCode: status,
            description: ControllerAnalyzer.getStatusDescription(status),
            contentType: 'application/json',
            detectionType: 'DETECTED',
          });
        });
      } else {
        // Inferred 200 default
        result.responses.push({
          id: `res-200-default`,
          endpointId: '',
          statusCode: 200,
          description: 'Success response',
          contentType: 'application/json',
          detectionType: 'INFERRED',
        });
      }
    } catch (err) {
      console.warn(`Controller AST parse error on ${controllerFilePath}:`, err);
    }

    return result;
  }

  private static inspectFunctionBody(
    pathNode: any,
    paramsMap: Map<string, ApiParameter>,
    responseStatusSet: Set<number>,
    serviceCalls: string[],
    databaseOperations: string[],
    externalCalls: string[]
  ): void {
    pathNode.traverse({
      VariableDeclarator(varPath: any) {
        ControllerAnalyzer.inspectVariableForParams(varPath, paramsMap);
      },
      CallExpression(callPath: any) {
        ControllerAnalyzer.inspectCallForResponsesAndServices(
          callPath,
          responseStatusSet,
          serviceCalls,
          databaseOperations,
          externalCalls
        );
      },
      MemberExpression(memPath: any) {
        ControllerAnalyzer.inspectMemberForParams(memPath, paramsMap);
      },
    });
  }

  private static inspectVariableForParams(
    varPath: any,
    paramsMap: Map<string, ApiParameter>
  ): void {
    const node = varPath.node;
    if (!node.init || !node.id) return;

    // Pattern: const { a, b, c } = req.body | req.params | req.query
    if (node.id.type === 'ObjectPattern') {
      let paramIn: 'body' | 'path' | 'query' | null = null;

      if (node.init.type === 'MemberExpression') {
        const objName = node.init.object?.name;
        const propName = node.init.property?.name;

        if (objName === 'req' || objName === 'request') {
          if (propName === 'body') paramIn = 'body';
          else if (propName === 'params') paramIn = 'path';
          else if (propName === 'query') paramIn = 'query';
        }
      }

      if (paramIn) {
        for (const prop of node.id.properties) {
          if (prop.type === 'ObjectProperty' && prop.key?.name) {
            const fieldName = prop.key.name;
            const paramKey = `${paramIn}:${fieldName}`;
            if (!paramsMap.has(paramKey)) {
              paramsMap.set(paramKey, {
                id: `param-${Math.random().toString(36).substring(2, 7)}`,
                endpointId: '',
                name: fieldName,
                paramIn,
                dataType: fieldName.includes('id') || fieldName.includes('Id') ? 'string' : 'string',
                required: paramIn === 'path' || paramIn === 'body',
                detectionType: 'DETECTED',
              });
            }
          }
        }
      }
    }
  }

  private static inspectMemberForParams(
    memPath: any,
    paramsMap: Map<string, ApiParameter>
  ): void {
    const node = memPath.node;
    // Pattern: req.params.id or req.query.page or req.body.title
    if (
      node.object?.type === 'MemberExpression' &&
      node.object.object?.name === 'req' &&
      node.property?.name
    ) {
      const mid = node.object.property?.name;
      const fieldName = node.property.name;

      if (mid === 'params' || mid === 'query' || mid === 'body') {
        const paramIn = mid === 'params' ? 'path' : mid === 'query' ? 'query' : 'body';
        const key = `${paramIn}:${fieldName}`;
        if (!paramsMap.has(key)) {
          paramsMap.set(key, {
            id: `param-${Math.random().toString(36).substring(2, 7)}`,
            endpointId: '',
            name: fieldName,
            paramIn,
            dataType: 'string',
            required: paramIn === 'path',
            detectionType: 'DETECTED',
          });
        }
      }
    }
  }

  private static inspectCallForResponsesAndServices(
    callPath: any,
    responseStatusSet: Set<number>,
    serviceCalls: string[],
    databaseOperations: string[],
    externalCalls: string[]
  ): void {
    const node = callPath.node;
    const callee = node.callee;

    // Pattern: res.status(200).json(...) or res.status(404).send(...)
    if (callee?.type === 'MemberExpression') {
      const obj = callee.object;
      const method = callee.property?.name;

      if (method === 'status' && node.arguments?.[0]?.type === 'NumericLiteral') {
        responseStatusSet.add(node.arguments[0].value);
      }

      if (obj?.type === 'CallExpression' && obj.callee?.property?.name === 'status') {
        const statusArg = obj.arguments?.[0];
        if (statusArg?.type === 'NumericLiteral') {
          responseStatusSet.add(statusArg.value);
        }
      }

      // Pattern: res.json(...) or res.send(...)
      if ((method === 'json' || method === 'send') && obj?.name === 'res') {
        if (!responseStatusSet.has(200) && !responseStatusSet.has(201)) {
          responseStatusSet.add(200);
        }
      }

      // Pattern: Service and DB calls: UserService.findByEmail(...) or prisma.user.findMany(...)
      if (obj?.name && method) {
        if (obj.name.endsWith('Service') || obj.name.endsWith('Repository') || obj.name.endsWith('Manager')) {
          const callSig = `${obj.name}.${method}`;
          if (!serviceCalls.includes(callSig)) serviceCalls.push(callSig);
        } else if (['prisma', 'db', 'knex', 'sequelize'].includes(obj.name.toLowerCase())) {
          const dbOp = `${obj.name}.${method}`;
          if (!databaseOperations.includes(dbOp)) databaseOperations.push(dbOp);
        } else if (
          /^[A-Z][a-zA-Z0-9]+$/.test(obj.name) &&
          !['Response', 'Request', 'Next', 'Error', 'Promise', 'Math', 'JSON', 'Object', 'Array'].includes(obj.name) &&
          ['find', 'findOne', 'findById', 'create', 'insert', 'update', 'updateOne', 'updateMany', 'delete', 'deleteOne', 'deleteMany', 'save', 'count', 'aggregate', 'where', 'query'].includes(method)
        ) {
          const dbOp = `${obj.name}.${method}`;
          if (!databaseOperations.includes(dbOp)) databaseOperations.push(dbOp);
        } else if (['axios', 'fetch', 'stripe', 'sgMail', 's3', 'openai', 'twilio'].includes(obj.name.toLowerCase())) {
          const extOp = `${obj.name}.${method}`;
          if (!externalCalls.includes(extOp)) externalCalls.push(extOp);
        }
      }

      // Pattern: Prisma nested calls: prisma.user.findMany(...) or prisma.product.create(...)
      if (obj?.type === 'MemberExpression' && method) {
        const rootObj = obj.object;
        const subProp = obj.property?.name;
        if (rootObj?.name === 'prisma' && subProp) {
          const capitalizedModel = subProp.charAt(0).toUpperCase() + subProp.slice(1);
          const dbOp = `Prisma.${capitalizedModel}.${method}`;
          if (!databaseOperations.includes(dbOp)) databaseOperations.push(dbOp);
        } else if (rootObj?.name && ['stripe', 'openai', 'aws'].includes(rootObj.name.toLowerCase())) {
          const extOp = `${rootObj.name}.${subProp}.${method}`;
          if (!externalCalls.includes(extOp)) externalCalls.push(extOp);
        }
      }
    } else if (callee?.type === 'Identifier') {
      if (callee.name === 'fetch') {
        if (!externalCalls.includes('fetch')) externalCalls.push('fetch');
      }
    }
  }

  private static getStatusDescription(status: number): string {
    switch (status) {
      case 200:
        return 'OK - Successful response';
      case 201:
        return 'Created - Resource created successfully';
      case 204:
        return 'No Content - Request processed successfully';
      case 400:
        return 'Bad Request - Validation or parameter failure';
      case 401:
        return 'Unauthorized - Missing or invalid bearer token';
      case 403:
        return 'Forbidden - Insufficient permissions';
      case 404:
        return 'Not Found - Resource does not exist';
      case 409:
        return 'Conflict - Resource conflict or duplicate record';
      case 500:
        return 'Internal Server Error';
      default:
        return `HTTP ${status} response`;
    }
  }
}
