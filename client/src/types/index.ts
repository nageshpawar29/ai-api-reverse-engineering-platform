export type DetectionType = 'DETECTED' | 'INFERRED' | 'UNKNOWN';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'USE';

export type ProjectStatus = 'pending' | 'analyzing' | 'completed' | 'failed';

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  framework: string;
  language: string;
  sourceType: 'zip' | 'github';
  repositoryUrl?: string;
  storagePath: string;
  status: ProjectStatus;
  currentStep?: string;
  progressPercentage: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiParameter {
  id: string;
  endpointId: string;
  name: string;
  paramIn: 'path' | 'query' | 'header' | 'body';
  dataType: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
  schemaDefinition?: any;
  detectionType: DetectionType;
}

export interface ApiResponse {
  id: string;
  endpointId: string;
  statusCode: number;
  description?: string;
  contentType: string;
  schemaDefinition?: any;
  examplePayload?: any;
  detectionType: DetectionType;
}

export interface ApiEndpoint {
  id: string;
  projectId: string;
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  purpose?: string;
  controllerName?: string;
  handlerFunction?: string;
  sourceFile: string;
  lineStart?: number;
  lineEnd?: number;
  authRequired: boolean;
  authType?: string;
  detectionType: DetectionType;
  confidenceScore: number;
  parameters: ApiParameter[];
  responses: ApiResponse[];
  middleware: string[];
  createdAt: string;
}

export interface ModelIndex {
  name?: string;
  fields: string[];
  isUnique: boolean;
  type?: string;
}

export interface ModelRelationship {
  id: string;
  sourceModel: string;
  sourceField: string;
  targetModel: string;
  targetField: string;
  cardinality: '1:1' | '1:N' | 'N:M' | 'N:1';
  onDelete?: string;
  onUpdate?: string;
  label?: string;
}

export interface ModelField {
  id: string;
  modelId: string;
  name: string;
  fieldType: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  isIndexed?: boolean;
  defaultValue?: string;
  foreignKeyTarget?: string;
  foreignKeyField?: string;
  description?: string;
  constraints?: string[];
}

export interface DatabaseModel {
  id: string;
  projectId: string;
  name: string;
  tableName?: string;
  ormType?: string;
  sourceFile?: string;
  description?: string;
  detectionType: DetectionType;
  domain?: 'Identity & Security' | 'Commerce & Products' | 'Orders & Fulfillment' | 'Financial & Ledger' | 'Audit & Compliance' | 'AI & Vector Search' | 'General';
  fields: ModelField[];
  indexes?: ModelIndex[];
  relationships?: ModelRelationship[];
  recordCountEstimate?: number;
  tags?: string[];
  createdAt: string;
}

export interface DependencyNode {
  id: string;
  projectId: string;
  sourceType: 'route' | 'controller' | 'service' | 'model' | 'middleware';
  sourceId: string;
  sourceLabel?: string;
  targetType: 'controller' | 'service' | 'model' | 'external' | 'middleware';
  targetId: string;
  targetLabel?: string;
  relationType: 'calls' | 'uses' | 'queries' | 'imports' | 'intercepts' | 'persists';
  details?: string;
}

export interface SecurityFinding {
  id: string;
  projectId: string;
  endpointId?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  sourceFile: string;
  lineNumber?: number;
  recommendation: string;
  detectionType: DetectionType;
  createdAt: string;
}

export interface GeneratedArtifact {
  id: string;
  projectId: string;
  artifactType: 'openapi_json' | 'openapi_yaml' | 'postman_json' | 'jest_tests';
  content: string;
  fileName: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  projectId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Array<{ file: string; line?: number; description?: string }>;
  createdAt: string;
}

export interface ProjectAnalysis {
  project: Project;
  endpoints: ApiEndpoint[];
  models: DatabaseModel[];
  dependencies: DependencyNode[];
  securityFindings: SecurityFinding[];
  artifacts: GeneratedArtifact[];
  stats: {
    totalEndpoints: number;
    methodsCount: Record<string, number>;
    totalModels: number;
    securityFindingsCount: number;
    authProtectedCount: number;
  };
}
