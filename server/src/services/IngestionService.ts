import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import AdmZip from 'adm-zip';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { Project } from '../types/index.js';
import { FrameworkDetector } from '../analyzers/FrameworkDetector.js';
import { AnalyzerFactory } from '../analyzers/AnalyzerFactory.js';
import { DatabaseAnalyzer } from '../analyzers/database/DatabaseAnalyzer.js';
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
   * Automatically unwraps single-folder archive wrappers (e.g. GitHub repo-main/)
   * so project files sit directly at the root of targetDir.
   */
  public static normalizeExtractedDirectory(targetDir: string): string {
    if (!fs.existsSync(targetDir)) return targetDir;

    let depth = 0;
    while (depth < 3) {
      try {
        const entries = fs.readdirSync(targetDir, { withFileTypes: true });
        const validEntries = entries.filter(
          (e) => e.name !== '.DS_Store' && e.name !== '__MACOSX' && !e.name.startsWith('._')
        );

        if (validEntries.length === 1 && validEntries[0].isDirectory()) {
          const nestedDir = path.join(targetDir, validEntries[0].name);
          const nestedEntries = fs.readdirSync(nestedDir);

          for (const entry of nestedEntries) {
            const src = path.join(nestedDir, entry);
            const dest = path.join(targetDir, entry);
            if (fs.existsSync(dest)) {
              fs.rmSync(dest, { recursive: true, force: true });
            }
            fs.renameSync(src, dest);
          }

          try {
            fs.rmdirSync(nestedDir);
          } catch (e) {}

          depth++;
        } else {
          break;
        }
      } catch (err) {
        console.warn(`Directory normalization warning for ${targetDir}:`, err);
        break;
      }
    }

    return targetDir;
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

    // Automatically unwrap single-directory wrapper
    this.normalizeExtractedDirectory(targetDir);
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
   * Ingest Git repository via direct clone with archive download fallback
   */
  public static async ingestGitRepository(
    repoUrl: string,
    branch = 'main',
    projectName?: string
  ): Promise<Project> {
    const { extractDir } = this.getStorageDirs();
    const projectId = `proj-${uuidv4().substring(0, 8)}`;
    const targetPath = path.join(extractDir, projectId);

    // Clean and validate URL
    let cleanUrl = repoUrl.trim();
    if (cleanUrl.startsWith('git@github.com:')) {
      cleanUrl = cleanUrl.replace('git@github.com:', 'https://github.com/');
    } else if (cleanUrl.startsWith('github.com/')) {
      cleanUrl = 'https://' + cleanUrl;
    } else if (cleanUrl.startsWith('http://')) {
      cleanUrl = cleanUrl.replace('http://', 'https://');
    }

    cleanUrl = cleanUrl.replace(/\.git$/i, '').replace(/\/$/, '');
    let resolvedBranch = (branch || 'main').trim();

    // Check if user pasted a specific branch in URL like /tree/develop or /blob/...
    const treeMatch = cleanUrl.match(/^(https:\/\/github\.com\/[^\/]+\/[^\/]+)\/(?:tree|blob)\/([^\/]+)/);
    if (treeMatch) {
      cleanUrl = treeMatch[1];
      resolvedBranch = treeMatch[2];
    }

    const urlPattern = /^https:\/\/github\.com\/[a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.]+$/;
    if (!urlPattern.test(cleanUrl)) {
      throw new Error(`Invalid GitHub repository URL: "${repoUrl}". Please provide a valid public URL such as https://github.com/owner/repository`);
    }

    const repoName = cleanUrl.split('/').pop() || 'git-repo';
    let downloaded = false;

    // 1. Fast, resilient shallow git clone (bypasses GitHub archive rate limits, works across any branch)
    try {
      const cloneArgs = ['clone', '--depth', '1'];
      if (resolvedBranch && resolvedBranch !== 'main' && resolvedBranch !== 'HEAD') {
        cloneArgs.push('--branch', resolvedBranch);
      }
      cloneArgs.push(`${cleanUrl}.git`, targetPath);

      const cloneRes = spawnSync('git', cloneArgs, {
        encoding: 'utf-8',
        timeout: 60000,
      });

      if (cloneRes.status === 0 && fs.existsSync(targetPath)) {
        downloaded = true;
        // Remove internal .git to save storage
        const gitDir = path.join(targetPath, '.git');
        if (fs.existsSync(gitDir)) {
          try { fs.rmSync(gitDir, { recursive: true, force: true }); } catch (e) {}
        }
      }
    } catch (gitErr) {
      console.warn(`Direct git clone failed, falling back to HTTP zip archives:`, gitErr);
    }

    // 2. HTTP Archive fallback if direct git clone failed
    if (!downloaded) {
      const tempZipPath = path.join(extractDir, `${projectId}.zip`);
      const candidateUrls: string[] = [];
      if (resolvedBranch && resolvedBranch !== 'main' && resolvedBranch !== 'HEAD') {
        candidateUrls.push(`${cleanUrl}/archive/refs/heads/${resolvedBranch}.zip`);
      }
      candidateUrls.push(
        `${cleanUrl}/archive/HEAD.zip`,
        `${cleanUrl}/archive/refs/heads/main.zip`,
        `${cleanUrl}/archive/refs/heads/master.zip`,
        `${cleanUrl}/archive/refs/heads/development.zip`,
        `${cleanUrl}/archive/refs/heads/dev.zip`
      );

      let lastError: any = null;
      for (const archiveUrl of candidateUrls) {
        try {
          const response = await axios.get(archiveUrl, {
            responseType: 'arraybuffer',
            timeout: 45000,
            maxRedirects: 5,
            headers: {
              'User-Agent': 'AI-Reverse-Engineering-Platform/1.0',
              'Accept': 'application/zip, application/octet-stream, */*',
            },
          });

          if (response.data && response.data.byteLength > 100) {
            fs.writeFileSync(tempZipPath, response.data);
            downloaded = true;
            break;
          }
        } catch (err: any) {
          lastError = err;
        }
      }

      if (!downloaded || !fs.existsSync(tempZipPath)) {
        throw new Error(
          `Failed to access or clone GitHub repository ${cleanUrl}. Verify the repository is public and accessible. Details: ${lastError?.message || 'Download failed'}`
        );
      }

      try {
        await this.extractZipSafely(tempZipPath, targetPath);
      } finally {
        if (fs.existsSync(tempZipPath)) {
          try { fs.unlinkSync(tempZipPath); } catch (e) {}
        }
      }
    }

    // Normalize and unwrap root folders
    this.normalizeExtractedDirectory(targetPath);

    const project: Project = {
      id: projectId,
      userId: 'default-user-id',
      name: projectName || repoName,
      description: `Cloned from GitHub: ${cleanUrl} (${resolvedBranch})`,
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
      // 0. Ensure target directory is properly normalized and unwrapped
      this.normalizeExtractedDirectory(projectDir);

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

      // Polyglot & Universal Aggregation: Always merge cross-language routes, client-side HTTP calls (fetch, axios), and universal routes
      const polyglotResult = await AnalyzerFactory.analyzePolyglot(projectDir, projectId);
      for (const ep of polyglotResult.endpoints) {
        if (!rawResult.endpoints.some((e) => e.method === ep.method && e.path === ep.path)) {
          rawResult.endpoints.push(ep);
        }
      }

      for (const m of polyglotResult.models) {
        if (!rawResult.models.some((em) => em.name.toLowerCase() === m.name.toLowerCase())) {
          rawResult.models.push(m);
        }
      }

      rawResult.dependencies.push(...polyglotResult.dependencies);
      rawResult.securityFindings.push(...polyglotResult.securityFindings);

      // Guarantee models are never 0 across any project
      if (rawResult.models.length === 0) {
        const fallbackModels = await DatabaseAnalyzer.extractModels(projectDir, projectId, [], rawResult.endpoints);
        for (const fm of fallbackModels) {
          if (!rawResult.models.some((m) => m.name.toLowerCase() === fm.name.toLowerCase())) {
            rawResult.models.push(fm);
          }
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
