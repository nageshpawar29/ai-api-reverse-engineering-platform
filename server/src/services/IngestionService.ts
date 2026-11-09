import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { Project } from '../types/index.js';
import { FrameworkDetector } from '../analyzers/FrameworkDetector.js';
import { AnalyzerFactory } from '../analyzers/AnalyzerFactory.js';
import { getLLMProvider } from '../ai/LLMProvider.js';
import { OpenApiGenerator } from '../generators/OpenApiGenerator.js';
import { PostmanGenerator } from '../generators/PostmanGenerator.js';
import { TestGenerator } from '../generators/TestGenerator.js';

export class IngestionService {
  private static getStorageDirs() {
    const root = process.cwd();
    const uploadsDir = path.resolve(root, 'storage', 'uploads');
    const extractDir = path.resolve(root, 'storage', 'extracted');

    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir, { recursive: true });

    return { uploadsDir, extractDir };
  }

  /**
   * Safe ZIP extraction preventing Zip Slip vulnerabilities
   */
  public static async extractZipSafely(zipFilePath: string, targetDir: string): Promise<void> {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();

    for (const entry of zipEntries) {
      const entryName = entry.entryName;
      // Prevent directory traversal attacks
      const normalizedPath = path.normalize(entryName).replace(/^(\.\.[\/\\])+/, '');
      const destinationPath = path.join(targetDir, normalizedPath);

      if (!destinationPath.startsWith(path.resolve(targetDir))) {
        throw new Error(`Security Exception: Path traversal attempt detected in ZIP entry: ${entryName}`);
      }

      if (entry.isDirectory) {
        if (!fs.existsSync(destinationPath)) {
          fs.mkdirSync(destinationPath, { recursive: true });
        }
      } else {
        const parentDir = path.dirname(destinationPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(destinationPath, entry.getData());
      }
    }
  }

  /**
   * Ingest and copy the built-in Demo API
   */
  public static async ingestDemoBackend(projectName?: string): Promise<Project> {
    const { extractDir } = this.getStorageDirs();
    const projectId = `proj-${uuidv4().substring(0, 8)}`;
    const targetPath = path.join(extractDir, projectId);

    const candidates = [
      path.resolve(process.cwd(), 'examples', 'demo-api'),
      path.resolve(process.cwd(), '..', 'examples', 'demo-api'),
    ];
    const demoSourceDir = candidates.find((c) => fs.existsSync(c));

    if (!demoSourceDir) {
      throw new Error(`Demo API source directory not found. Checked: ${candidates.join(', ')}`);
    }

    // Copy demo directory recursively
    this.copyDirectoryRecursive(demoSourceDir, targetPath);

    const project: Project = {
      id: projectId,
      userId: 'default-user-id',
      name: projectName || 'Demo E-Commerce & Auth Backend',
      description: 'Pre-packaged multi-tiered Express API with authentication, controllers, and Prisma schemas.',
      framework: 'express',
      language: 'typescript',
      sourceType: 'zip',
      storagePath: targetPath,
      status: 'pending',
      currentStep: 'Imported',
      progressPercentage: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createProject(project);

    // Trigger analysis asynchronously
    setImmediate(() => {
      this.runAnalysisPipeline(projectId, targetPath).catch((err) => {
        console.error(`Pipeline failed for project ${projectId}:`, err);
      });
    });

    return project;
  }

  /**
   * Ingest uploaded ZIP archive
   */
  public static async ingestZipArchive(zipFilePath: string, projectName: string): Promise<Project> {
    const { extractDir } = this.getStorageDirs();
    const projectId = `proj-${uuidv4().substring(0, 8)}`;
    const targetPath = path.join(extractDir, projectId);

    await this.extractZipSafely(zipFilePath, targetPath);

    const project: Project = {
      id: projectId,
      userId: 'default-user-id',
      name: projectName,
      description: 'Reverse-engineered backend uploaded via ZIP archive.',
      framework: 'express',
      language: 'typescript',
      sourceType: 'zip',
      storagePath: targetPath,
      status: 'pending',
      currentStep: 'Extracted',
      progressPercentage: 15,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createProject(project);

    // Trigger pipeline asynchronously
    setImmediate(() => {
      this.runAnalysisPipeline(projectId, targetPath).catch((err) => {
        console.error(`Pipeline failed for project ${projectId}:`, err);
      });
    });

    return project;
  }

  /**
   * Ingest Git repository via tarball or clone
   */
  public static async ingestGitRepository(
    repoUrl: string,
    branch = 'main',
    projectName?: string
  ): Promise<Project> {
    const { extractDir } = this.getStorageDirs();
    const projectId = `proj-${uuidv4().substring(0, 8)}`;
    const targetPath = path.join(extractDir, projectId);

    // Security validation on Git URL
    const urlPattern = /^https:\/\/github\.com\/[a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.]+$/;
    const cleanUrl = repoUrl.replace(/\.git$/i, '');
    if (!urlPattern.test(cleanUrl)) {
      throw new Error('Only valid public https://github.com/owner/repo URLs are accepted.');
    }

    const repoName = cleanUrl.split('/').pop() || 'git-repo';

    // Download GitHub archive tarball/zip
    const archiveUrl = `${cleanUrl}/archive/refs/heads/${branch}.zip`;
    const tempZipPath = path.join(extractDir, `${projectId}.zip`);

    try {
      const response = await axios.get(archiveUrl, { responseType: 'arraybuffer', timeout: 30000 });
      fs.writeFileSync(tempZipPath, response.data);
      await this.extractZipSafely(tempZipPath, targetPath);
      if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
    } catch (downloadErr: any) {
      // Fallback: If master branch or download failed, record helpful error
      throw new Error(
        `Failed to download GitHub archive for ${cleanUrl} (branch: ${branch}). Verify the repository and branch name.`
      );
    }

    const project: Project = {
      id: projectId,
      userId: 'default-user-id',
      name: projectName || repoName,
      description: `Cloned from GitHub: ${cleanUrl} (${branch})`,
      framework: 'express',
      language: 'typescript',
      sourceType: 'github',
      repositoryUrl: cleanUrl,
      storagePath: targetPath,
      status: 'pending',
      currentStep: 'Cloned',
      progressPercentage: 15,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createProject(project);

    setImmediate(() => {
      this.runAnalysisPipeline(projectId, targetPath).catch((err) => {
        console.error(`Pipeline failed for project ${projectId}:`, err);
      });
    });

    return project;
  }

  /**
   * The Complete Reverse-Engineering Pipeline Orchestrator
   */
  public static async runAnalysisPipeline(projectId: string, projectDir: string): Promise<void> {
    try {
      await db.updateProjectStatus(projectId, {
        status: 'analyzing',
        currentStep: 'Detecting framework & language architecture',
        progressPercentage: 25,
      });

      // 1. Framework Detection
      const detection = await FrameworkDetector.detect(projectDir);
      await db.updateProjectStatus(projectId, {
        framework: detection.framework,
        language: detection.language,
        currentStep: 'Running AST static parser on routes & handlers',
        progressPercentage: 45,
      });

      // 2. Multi-Language AST Static Analysis
      const analyzer = AnalyzerFactory.getAnalyzer(detection.language, detection.framework);
      let rawResult = await analyzer.analyze(projectDir, projectId);

      // Polyglot fallback: if specialized analyzer found 0 routes, scan other language engines
      if (rawResult.endpoints.length === 0) {
        const polyglotResult = await AnalyzerFactory.analyzePolyglot(projectDir, projectId);
        if (polyglotResult.endpoints.length > 0) {
          rawResult = polyglotResult;
        }
      }

      await db.updateProjectStatus(projectId, {
        currentStep: 'Enriching with AI reasoning layer',
        progressPercentage: 75,
      });

      // 3. AI Reasoning Layer
      const project = (await db.getProject(projectId))!;
      const llm = getLLMProvider();
      const enrichedEndpoints = await llm.enrichEndpoints(rawResult.endpoints, {
        projectName: project.name,
        framework: project.framework,
      });

      // 4. Save metadata to database store
      await db.saveEndpoints(projectId, enrichedEndpoints);
      await db.saveModels(projectId, rawResult.models);
      await db.saveDependencies(projectId, rawResult.dependencies);
      await db.saveSecurityFindings(projectId, rawResult.securityFindings);

      await db.updateProjectStatus(projectId, {
        currentStep: 'Generating OpenAPI specs, Postman collections & test suites',
        progressPercentage: 90,
      });

      // 5. Generate Artifacts
      const openApiSpec = OpenApiGenerator.generateSpec(project, enrichedEndpoints);
      await db.saveArtifact({
        id: `art-openapi-json-${projectId}`,
        projectId,
        artifactType: 'openapi_json',
        content: JSON.stringify(openApiSpec.json, null, 2),
        fileName: 'openapi.json',
        createdAt: new Date().toISOString(),
      });
      await db.saveArtifact({
        id: `art-openapi-yaml-${projectId}`,
        projectId,
        artifactType: 'openapi_yaml',
        content: openApiSpec.yaml,
        fileName: 'openapi.yaml',
        createdAt: new Date().toISOString(),
      });

      const postmanColl = PostmanGenerator.generateCollection(project, enrichedEndpoints);
      await db.saveArtifact({
        id: `art-postman-${projectId}`,
        projectId,
        artifactType: 'postman_json',
        content: JSON.stringify(postmanColl, null, 2),
        fileName: 'postman_collection.json',
        createdAt: new Date().toISOString(),
      });

      const jestTests = TestGenerator.generateTestSuite(project, enrichedEndpoints);
      await db.saveArtifact({
        id: `art-jest-${projectId}`,
        projectId,
        artifactType: 'jest_tests',
        content: jestTests,
        fileName: 'api.test.ts',
        createdAt: new Date().toISOString(),
      });

      // 6. Complete
      await db.updateProjectStatus(projectId, {
        status: 'completed',
        currentStep: 'Analysis Complete',
        progressPercentage: 100,
      });

      console.log(`✅ Pipeline successfully completed for project: ${project.name} (${projectId})`);
    } catch (err: any) {
      console.error(`Pipeline failure on project ${projectId}:`, err);
      await db.updateProjectStatus(projectId, {
        status: 'failed',
        currentStep: 'Failed',
        errorMessage: err.message || 'Analysis error',
      });
    }
  }

  private static copyDirectoryRecursive(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'dist'].includes(entry.name)) {
          this.copyDirectoryRecursive(srcPath, destPath);
        }
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
