import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import {
  Project,
  ApiEndpoint,
  DatabaseModel,
  DependencyNode,
  SecurityFinding,
  GeneratedArtifact,
  ChatMessage,
  ProjectAnalysis,
} from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DatabaseStore {
  users: Array<{ id: string; name: string; email: string; createdAt: string; updatedAt: string }>;
  projects: Project[];
  endpoints: ApiEndpoint[];
  models: DatabaseModel[];
  dependencies: DependencyNode[];
  securityFindings: SecurityFinding[];
  artifacts: GeneratedArtifact[];
  chatMessages: ChatMessage[];
}

export class DatabaseManager {
  private pgPool: Pool | null = null;
  private isPostgresConnected = false;
  private localStorePath: string;
  private localStore: DatabaseStore;

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.localStorePath = path.join(dataDir, 'platform_store.json');
    this.localStore = this.loadLocalStore();
  }

  private loadLocalStore(): DatabaseStore {
    if (fs.existsSync(this.localStorePath)) {
      try {
        const raw = fs.readFileSync(this.localStorePath, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.warn('Failed to parse local store file, initializing fresh store:', err);
      }
    }
    return {
      users: [
        {
          id: 'default-user-id',
          name: 'Lead Developer',
          email: 'developer@reverse-api.local',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      projects: [],
      endpoints: [],
      models: [],
      dependencies: [],
      securityFindings: [],
      artifacts: [],
      chatMessages: [],
    };
  }

  private saveLocalStore(): void {
    try {
      fs.writeFileSync(this.localStorePath, JSON.stringify(this.localStore, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write local store file:', err);
    }
  }

  private mapProjectRow(row: any): Project {
    return {
      id: row.id,
      userId: row.user_id || 'default-user-id',
      name: row.name,
      description: row.description || '',
      framework: row.framework || 'express',
      language: row.language || 'typescript',
      sourceType: row.source_type || 'zip',
      repositoryUrl: row.repository_url || undefined,
      storagePath: row.storage_path || '',
      status: row.status || 'pending',
      currentStep: row.current_step || '',
      progressPercentage: row.progress_percentage !== null ? Number(row.progress_percentage) : 0,
      errorMessage: row.error_message || undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  private mapArtifactRow(row: any): GeneratedArtifact {
    return {
      id: row.id,
      projectId: row.project_id,
      artifactType: row.artifact_type,
      content: row.content,
      fileName: row.file_name,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }

  public async initialize(): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && process.env.DB_TYPE !== 'sqlite') {
      try {
        const isRemote =
          dbUrl.includes('.render.com') ||
          dbUrl.includes('.neon.tech') ||
          dbUrl.includes('.supabase.co') ||
          dbUrl.includes('pooler.supabase.com') ||
          dbUrl.includes('.aivencloud.com') ||
          dbUrl.includes('sslmode=') ||
          process.env.NODE_ENV === 'production';

        this.pgPool = new Pool({
          connectionString: dbUrl,
          connectionTimeoutMillis: 10000,
          ssl: isRemote ? { rejectUnauthorized: false } : undefined,
        });
        const client = await this.pgPool.connect();
        this.isPostgresConnected = true;
        console.log('✅ PostgreSQL connected successfully.');

        // Run migrations
        const migrationPath = path.resolve(__dirname, 'migrations', '001_initial_schema.sql');
        if (fs.existsSync(migrationPath)) {
          const sql = fs.readFileSync(migrationPath, 'utf-8');
          await client.query(sql);
          console.log('✅ PostgreSQL schema migrations verified.');
        }
        client.release();

        // Sync existing projects from PostgreSQL into local memory
        try {
          const res = await this.pgPool.query('SELECT * FROM projects ORDER BY created_at DESC');
          if (res.rows.length > 0) {
            this.localStore.projects = res.rows.map((r) => this.mapProjectRow(r));
            console.log(`📦 Synced ${this.localStore.projects.length} project(s) from PostgreSQL into active cache.`);
          }
        } catch (syncErr: any) {
          console.warn('PostgreSQL initial sync notice:', syncErr.message);
        }
      } catch (err: any) {
        console.warn(
          `⚠️ PostgreSQL connection failed (${err.message}). Gracefully operating in local persistent store mode.`
        );
        this.isPostgresConnected = false;
        if (this.pgPool) {
          await this.pgPool.end().catch(() => {});
          this.pgPool = null;
        }
      }
    } else {
      console.log('ℹ️ Running in persistent local store mode (data/platform_store.json).');
    }
  }

  public getStatus(): { mode: 'postgresql' | 'local_store'; isHealthy: boolean } {
    return {
      mode: this.isPostgresConnected ? 'postgresql' : 'local_store',
      isHealthy: true,
    };
  }

  // --- Project Methods ---
  public async createProject(project: Project): Promise<Project> {
    // 1. In-memory update
    const existingIdx = this.localStore.projects.findIndex((p) => p.id === project.id);
    if (existingIdx !== -1) {
      this.localStore.projects[existingIdx] = project;
    } else {
      this.localStore.projects.push(project);
    }
    this.saveLocalStore();

    // 2. PostgreSQL persistence
    if (this.isPostgresConnected && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO projects (
            id, user_id, name, description, framework, language, source_type,
            repository_url, storage_path, status, current_step, progress_percentage,
            error_message, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            framework = EXCLUDED.framework,
            language = EXCLUDED.language,
            status = EXCLUDED.status,
            current_step = EXCLUDED.current_step,
            progress_percentage = EXCLUDED.progress_percentage,
            error_message = EXCLUDED.error_message,
            updated_at = EXCLUDED.updated_at`,
          [
            project.id,
            project.userId || 'default-user-id',
            project.name,
            project.description || '',
            project.framework || 'express',
            project.language || 'typescript',
            project.sourceType || 'zip',
            project.repositoryUrl || null,
            project.storagePath || '',
            project.status || 'pending',
            project.currentStep || '',
            project.progressPercentage || 0,
            project.errorMessage || null,
            project.createdAt || new Date().toISOString(),
            project.updatedAt || new Date().toISOString(),
          ]
        );
      } catch (err: any) {
        console.error('Failed to persist project to PostgreSQL:', err.message);
      }
    }

    return project;
  }

  public async getProject(id: string): Promise<Project | null> {
    if (this.isPostgresConnected && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT * FROM projects WHERE id = $1', [id]);
        if (res.rows.length > 0) {
          return this.mapProjectRow(res.rows[0]);
        }
      } catch (err: any) {
        console.warn('PostgreSQL getProject query failed, using fallback cache:', err.message);
      }
    }
    const project = this.localStore.projects.find((p) => p.id === id);
    return project || null;
  }

  public async listProjects(): Promise<Project[]> {
    if (this.isPostgresConnected && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT * FROM projects ORDER BY created_at DESC');
        if (res.rows.length > 0) {
          const projects = res.rows.map((r) => this.mapProjectRow(r));
          this.localStore.projects = projects;
          return projects;
        }
      } catch (err: any) {
        console.warn('PostgreSQL listProjects query failed, using fallback cache:', err.message);
      }
    }
    return [...this.localStore.projects].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public async updateProjectStatus(
    id: string,
    updates: Partial<Project>
  ): Promise<Project | null> {
    const index = this.localStore.projects.findIndex((p) => p.id === id);
    if (index !== -1) {
      this.localStore.projects[index] = {
        ...this.localStore.projects[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.saveLocalStore();
    }

    if (this.isPostgresConnected && this.pgPool) {
      try {
        const project = await this.getProject(id);
        if (project) {
          const merged = { ...project, ...updates, updatedAt: new Date().toISOString() };
          await this.pgPool.query(
            `UPDATE projects SET
              status = $1,
              current_step = $2,
              progress_percentage = $3,
              error_message = $4,
              framework = $5,
              language = $6,
              updated_at = $7
            WHERE id = $8`,
            [
              merged.status,
              merged.currentStep,
              merged.progressPercentage || 0,
              merged.errorMessage || null,
              merged.framework,
              merged.language,
              merged.updatedAt,
              id,
            ]
          );
          return merged;
        }
      } catch (err: any) {
        console.error('Failed to update project status in PostgreSQL:', err.message);
      }
    }

    return index !== -1 ? this.localStore.projects[index] : null;
  }

  public async deleteProject(id: string): Promise<boolean> {
    const initialLen = this.localStore.projects.length;
    this.localStore.projects = this.localStore.projects.filter((p) => p.id !== id);
    this.localStore.endpoints = this.localStore.endpoints.filter((e) => e.projectId !== id);
    this.localStore.models = this.localStore.models.filter((m) => m.projectId !== id);
    this.localStore.dependencies = this.localStore.dependencies.filter((d) => d.projectId !== id);
    this.localStore.securityFindings = this.localStore.securityFindings.filter((s) => s.projectId !== id);
    this.localStore.artifacts = this.localStore.artifacts.filter((a) => a.projectId !== id);
    this.localStore.chatMessages = this.localStore.chatMessages.filter((c) => c.projectId !== id);
    this.saveLocalStore();

    if (this.isPostgresConnected && this.pgPool) {
      try {
        await this.pgPool.query('DELETE FROM projects WHERE id = $1', [id]);
        return true;
      } catch (err: any) {
        console.error('Failed to delete project from PostgreSQL:', err.message);
      }
    }

    return this.localStore.projects.length < initialLen;
  }

  // --- Endpoints ---
  public async saveEndpoints(projectId: string, endpoints: ApiEndpoint[]): Promise<void> {
    this.localStore.endpoints = this.localStore.endpoints.filter((e) => e.projectId !== projectId);
    this.localStore.endpoints.push(...endpoints);
    this.saveLocalStore();

    if (this.isPostgresConnected && this.pgPool) {
      try {
        await this.pgPool.query('DELETE FROM api_endpoints WHERE project_id = $1', [projectId]);
        for (const ep of endpoints) {
          await this.pgPool.query(
            `INSERT INTO api_endpoints (
              id, project_id, method, path, summary, description, purpose,
              controller_name, handler_function, source_file, line_start, line_end,
              auth_required, auth_type, detection_type, confidence_score, created_at, raw_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
            [
              ep.id,
              projectId,
              ep.method,
              ep.path,
              ep.summary || '',
              ep.description || '',
              ep.purpose || '',
              ep.controllerName || '',
              ep.handlerFunction || '',
              ep.sourceFile || '',
              ep.lineStart || null,
              ep.lineEnd || null,
              ep.authRequired || false,
              ep.authType || 'none',
              ep.detectionType || 'DETECTED',
              ep.confidenceScore || 1.0,
              ep.createdAt || new Date().toISOString(),
              JSON.stringify(ep),
            ]
          );
        }
      } catch (err: any) {
        console.error('Failed to persist endpoints to PostgreSQL:', err.message);
      }
    }
  }

  public async getEndpoints(projectId: string): Promise<ApiEndpoint[]> {
    if (this.isPostgresConnected && this.pgPool) {
      try {
        const res = await this.pgPool.query(
          'SELECT raw_data FROM api_endpoints WHERE project_id = $1 ORDER BY created_at ASC',
          [projectId]
        );
        if (res.rows.length > 0) {
          return res.rows.map((r) => r.raw_data);
        }
      } catch (err: any) {
        console.warn('PostgreSQL getEndpoints failed, using local store:', err.message);
      }
    }
    return this.localStore.endpoints.filter((e) => e.projectId === projectId);
  }

  // --- Models ---
  public async saveModels(projectId: string, models: DatabaseModel[]): Promise<void> {
    this.localStore.models = this.localStore.models.filter((m) => m.projectId !== projectId);
    this.localStore.models.push(...models);
    this.saveLocalStore();

    if (this.isPostgresConnected && this.pgPool) {
      try {
        await this.pgPool.query('DELETE FROM models WHERE project_id = $1', [projectId]);
        for (const m of models) {
          await this.pgPool.query(
            `INSERT INTO models (id, project_id, name, table_name, orm_type, source_file, description, detection_type, created_at, raw_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              m.id,
              projectId,
              m.name,
              m.tableName || m.name.toLowerCase(),
              m.ormType || 'prisma',
              m.sourceFile || '',
              m.description || '',
              m.detectionType || 'DETECTED',
              new Date().toISOString(),
              JSON.stringify(m),
            ]
          );
        }
      } catch (err: any) {
        console.error('Failed to persist models to PostgreSQL:', err.message);
      }
    }
  }

  public async getModels(projectId: string): Promise<DatabaseModel[]> {
    if (this.isPostgresConnected && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT raw_data FROM models WHERE project_id = $1', [projectId]);
        if (res.rows.length > 0) {
          return res.rows.map((r) => r.raw_data);
        }
      } catch (err: any) {
        console.warn('PostgreSQL getModels failed, using local store:', err.message);
      }
    }
    return this.localStore.models.filter((m) => m.projectId === projectId);
  }

  // --- Dependencies ---
  public async saveDependencies(projectId: string, deps: DependencyNode[]): Promise<void> {
    this.localStore.dependencies = this.localStore.dependencies.filter((d) => d.projectId !== projectId);
    this.localStore.dependencies.push(...deps);
    this.saveLocalStore();

    if (this.isPostgresConnected && this.pgPool) {
      try {
        await this.pgPool.query('DELETE FROM dependencies WHERE project_id = $1', [projectId]);
        for (const d of deps) {
          await this.pgPool.query(
            `INSERT INTO dependencies (id, project_id, source_type, source_id, target_type, target_id, relation_type, details, raw_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              d.id,
              projectId,
              d.sourceType || 'route',
              d.sourceId || d.id,
              d.targetType || 'controller',
              d.targetId || '',
              d.relationType || 'calls',
              d.details || '',
              JSON.stringify(d),
            ]
          );
        }
      } catch (err: any) {
        console.error('Failed to persist dependencies to PostgreSQL:', err.message);
      }
    }
  }

  public async getDependencies(projectId: string): Promise<DependencyNode[]> {
    if (this.isPostgresConnected && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT raw_data FROM dependencies WHERE project_id = $1', [projectId]);
        if (res.rows.length > 0) {
          return res.rows.map((r) => r.raw_data);
        }
      } catch (err: any) {
        console.warn('PostgreSQL getDependencies failed, using local store:', err.message);
      }
    }
    return this.localStore.dependencies.filter((d) => d.projectId === projectId);
  }

  // --- Security Findings ---
  public async saveSecurityFindings(projectId: string, findings: SecurityFinding[]): Promise<void> {
    this.localStore.securityFindings = this.localStore.securityFindings.filter((s) => s.projectId !== projectId);
    this.localStore.securityFindings.push(...findings);
    this.saveLocalStore();

    if (this.isPostgresConnected && this.pgPool) {
      try {
        await this.pgPool.query('DELETE FROM security_findings WHERE project_id = $1', [projectId]);
        for (const f of findings) {
          await this.pgPool.query(
            `INSERT INTO security_findings (
              id, project_id, severity, category, title, description, source_file, line_number, recommendation, detection_type, created_at, raw_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              f.id,
              projectId,
              f.severity,
              f.category || 'general',
              f.title,
              f.description,
              f.sourceFile || '',
              f.lineNumber || null,
              f.recommendation || '',
              f.detectionType || 'DETECTED',
              new Date().toISOString(),
              JSON.stringify(f),
            ]
          );
        }
      } catch (err: any) {
        console.error('Failed to persist security findings to PostgreSQL:', err.message);
      }
    }
  }

  public async getSecurityFindings(projectId: string): Promise<SecurityFinding[]> {
    if (this.isPostgresConnected && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT raw_data FROM security_findings WHERE project_id = $1', [projectId]);
        if (res.rows.length > 0) {
          return res.rows.map((r) => r.raw_data);
        }
      } catch (err: any) {
        console.warn('PostgreSQL getSecurityFindings failed, using local store:', err.message);
      }
    }
    return this.localStore.securityFindings.filter((s) => s.projectId === projectId);
  }

  // --- Artifacts ---
  public async saveArtifact(artifact: GeneratedArtifact): Promise<void> {
    const existingIdx = this.localStore.artifacts.findIndex(
      (a) => a.projectId === artifact.projectId && a.artifactType === artifact.artifactType
    );
    if (existingIdx !== -1) {
      this.localStore.artifacts[existingIdx] = artifact;
    } else {
      this.localStore.artifacts.push(artifact);
    }
    this.saveLocalStore();

    if (this.isPostgresConnected && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO generated_artifacts (id, project_id, artifact_type, content, file_name, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, file_name = EXCLUDED.file_name`,
          [
            artifact.id,
            artifact.projectId,
            artifact.artifactType,
            artifact.content,
            artifact.fileName,
            artifact.createdAt || new Date().toISOString(),
          ]
        );
      } catch (err: any) {
        console.error('Failed to persist artifact to PostgreSQL:', err.message);
      }
    }
  }

  public async getArtifacts(projectId: string): Promise<GeneratedArtifact[]> {
    if (this.isPostgresConnected && this.pgPool) {
      try {
        const res = await this.pgPool.query(
          'SELECT * FROM generated_artifacts WHERE project_id = $1 ORDER BY created_at ASC',
          [projectId]
        );
        if (res.rows.length > 0) {
          return res.rows.map((r) => this.mapArtifactRow(r));
        }
      } catch (err: any) {
        console.warn('PostgreSQL getArtifacts failed, using local store:', err.message);
      }
    }
    return this.localStore.artifacts.filter((a) => a.projectId === projectId);
  }

  public async getArtifact(projectId: string, type: GeneratedArtifact['artifactType']): Promise<GeneratedArtifact | null> {
    if (this.isPostgresConnected && this.pgPool) {
      try {
        const res = await this.pgPool.query(
          'SELECT * FROM generated_artifacts WHERE project_id = $1 AND artifact_type = $2 LIMIT 1',
          [projectId, type]
        );
        if (res.rows.length > 0) {
          return this.mapArtifactRow(res.rows[0]);
        }
      } catch (err: any) {
        console.warn('PostgreSQL getArtifact failed, using local store:', err.message);
      }
    }
    const art = this.localStore.artifacts.find(
      (a) => a.projectId === projectId && a.artifactType === type
    );
    return art || null;
  }

  // --- Chat Messages ---
  public async addChatMessage(msg: ChatMessage): Promise<ChatMessage> {
    this.localStore.chatMessages.push(msg);
    this.saveLocalStore();

    if (this.isPostgresConnected && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO chat_messages (id, project_id, role, content, citations, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            msg.id,
            msg.projectId,
            msg.role,
            msg.content,
            JSON.stringify(msg.citations || []),
            msg.createdAt || new Date().toISOString(),
          ]
        );
      } catch (err: any) {
        console.error('Failed to persist chat message to PostgreSQL:', err.message);
      }
    }

    return msg;
  }

  public async getChatHistory(projectId: string): Promise<ChatMessage[]> {
    if (this.isPostgresConnected && this.pgPool) {
      try {
        const res = await this.pgPool.query(
          'SELECT * FROM chat_messages WHERE project_id = $1 ORDER BY created_at ASC',
          [projectId]
        );
        if (res.rows.length > 0) {
          return res.rows.map((r) => ({
            id: r.id,
            projectId: r.project_id,
            role: r.role,
            content: r.content,
            citations: r.citations || [],
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          }));
        }
      } catch (err: any) {
        console.warn('PostgreSQL getChatHistory failed, using local store:', err.message);
      }
    }
    return this.localStore.chatMessages.filter((c) => c.projectId === projectId);
  }

  // --- Full Project Analysis Aggregator ---
  public async getProjectAnalysis(projectId: string): Promise<ProjectAnalysis | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;

    const endpoints = await this.getEndpoints(projectId);
    const models = await this.getModels(projectId);
    const dependencies = await this.getDependencies(projectId);
    const securityFindings = await this.getSecurityFindings(projectId);
    const artifacts = await this.getArtifacts(projectId);

    const methodsCount: Record<string, number> = {
      GET: 0,
      POST: 0,
      PUT: 0,
      PATCH: 0,
      DELETE: 0,
    };

    let authProtectedCount = 0;
    for (const ep of endpoints) {
      methodsCount[ep.method] = (methodsCount[ep.method] || 0) + 1;
      if (ep.authRequired) authProtectedCount++;
    }

    return {
      project,
      endpoints,
      models,
      dependencies,
      securityFindings,
      artifacts,
      stats: {
        totalEndpoints: endpoints.length,
        methodsCount,
        totalModels: models.length,
        securityFindingsCount: securityFindings.length,
        authProtectedCount,
      },
    };
  }
}

export const db = new DatabaseManager();
