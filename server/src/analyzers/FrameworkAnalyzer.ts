import { ApiEndpoint, DatabaseModel, DependencyNode, SecurityFinding } from '../types/index.js';

export interface AnalysisEngineResult {
  endpoints: ApiEndpoint[];
  models: DatabaseModel[];
  dependencies: DependencyNode[];
  securityFindings: SecurityFinding[];
  fileCount: number;
}

export interface FrameworkAnalyzer {
  readonly name: string;
  detect(projectDir: string): Promise<boolean>;
  analyze(projectDir: string, projectId: string): Promise<AnalysisEngineResult>;
}
