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
    this.localStore.projects.push(project);
    this.saveLocalStore();
    return project;
  }

  public async getProject(id: string): Promise<Project | null> {
    const project = this.localStore.projects.find((p) => p.id === id);
    return project || null;
  }

  public async listProjects(): Promise<Project[]> {
    return [...this.localStore.projects].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public async updateProjectStatus(
    id: string,
    updates: Partial<Project>
  ): Promise<Project | null> {
    const index = this.localStore.projects.findIndex((p) => p.id === id);
    if (index === -1) return null;

    this.localStore.projects[index] = {
      ...this.localStore.projects[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveLocalStore();
    return this.localStore.projects[index];
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
    return this.localStore.projects.length < initialLen;
  }

  // --- Endpoints ---
  public async saveEndpoints(projectId: string, endpoints: ApiEndpoint[]): Promise<void> {
    // Replace old endpoints for project
    this.localStore.endpoints = this.localStore.endpoints.filter((e) => e.projectId !== projectId);
    this.localStore.endpoints.push(...endpoints);
    this.saveLocalStore();
  }

  public async getEndpoints(projectId: string): Promise<ApiEndpoint[]> {
    return this.localStore.endpoints.filter((e) => e.projectId === projectId);
  }

  // --- Models ---
  public async saveModels(projectId: string, models: DatabaseModel[]): Promise<void> {
    this.localStore.models = this.localStore.models.filter((m) => m.projectId !== projectId);
    this.localStore.models.push(...models);
    this.saveLocalStore();
  }

  public async getModels(projectId: string): Promise<DatabaseModel[]> {
    return this.localStore.models.filter((m) => m.projectId === projectId);
  }

  // --- Dependencies ---
  public async saveDependencies(projectId: string, deps: DependencyNode[]): Promise<void> {
    this.localStore.dependencies = this.localStore.dependencies.filter((d) => d.projectId !== projectId);
    this.localStore.dependencies.push(...deps);
    this.saveLocalStore();
  }

  public async getDependencies(projectId: string): Promise<DependencyNode[]> {
    return this.localStore.dependencies.filter((d) => d.projectId === projectId);
  }

  // --- Security Findings ---
  public async saveSecurityFindings(projectId: string, findings: SecurityFinding[]): Promise<void> {
    this.localStore.securityFindings = this.localStore.securityFindings.filter((s) => s.projectId !== projectId);
    this.localStore.securityFindings.push(...findings);
    this.saveLocalStore();
  }

  public async getSecurityFindings(projectId: string): Promise<SecurityFinding[]> {
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
  }

  public async getArtifacts(projectId: string): Promise<GeneratedArtifact[]> {
    return this.localStore.artifacts.filter((a) => a.projectId === projectId);
  }

  public async getArtifact(projectId: string, type: GeneratedArtifact['artifactType']): Promise<GeneratedArtifact | null> {
    const art = this.localStore.artifacts.find(
      (a) => a.projectId === projectId && a.artifactType === type
    );
    return art || null;
  }

  // --- Chat Messages ---
  public async addChatMessage(msg: ChatMessage): Promise<ChatMessage> {
    this.localStore.chatMessages.push(msg);
    this.saveLocalStore();
    return msg;
  }

  public async getChatHistory(projectId: string): Promise<ChatMessage[]> {
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
