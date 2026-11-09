import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { IngestionService } from '../services/IngestionService.js';
import { db } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';

export const analysisRouter = Router();

// Multer storage for ZIP uploads
const uploadsDir = path.resolve(process.cwd(), 'storage', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files are allowed'));
    }
  },
});

// POST /api/analysis/upload-zip
analysisRouter.post(
  '/upload-zip',
  upload.single('archive'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('No ZIP archive uploaded', 400);
      }
      const projectName = req.body.name || req.file.originalname.replace(/\.zip$/i, '');
      const project = await IngestionService.ingestZipArchive(req.file.path, projectName);

      res.status(202).json({
        message: 'ZIP archive uploaded and analysis queued',
        projectId: project.id,
        status: project.status,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/analysis/clone-git
analysisRouter.post('/clone-git', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { repositoryUrl, branch, name } = req.body;
    if (!repositoryUrl) {
      throw new AppError('Repository URL is required', 400);
    }

    const project = await IngestionService.ingestGitRepository(
      repositoryUrl,
      branch || 'main',
      name
    );

    res.status(202).json({
      message: 'Git repository ingestion queued',
      projectId: project.id,
      status: project.status,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/analysis/load-demo
analysisRouter.post('/load-demo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await IngestionService.ingestDemoBackend(req.body.name);

    res.status(202).json({
      message: 'Demo backend loaded and analysis queued',
      projectId: project.id,
      status: project.status,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/analysis/:id/reanalyze
analysisRouter.post('/:id/reanalyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id as string;
    const project = await db.getProject(projectId);
    if (!project) throw new AppError('Project not found', 404);

    setImmediate(() => {
      IngestionService.runAnalysisPipeline(project.id, project.storagePath).catch(console.error);
    });

    res.json({ message: 'Re-analysis queued successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/analysis/proxy-test (Interactive API Playground Proxy with SSRF Defense)
analysisRouter.post('/proxy-test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { method, url, headers, body } = req.body;
    if (!url) throw new AppError('Target URL is required', 400);

    // SSRF Guard: Prevent access to AWS/GCP/cloud metadata IPs (169.254.169.254)
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname;

    if (
      host === '169.254.169.254' ||
      host === 'metadata.google.internal' ||
      host === 'instance-data'
    ) {
      throw new AppError('SSRF Protection: Access to cloud metadata IP is blocked.', 403);
    }

    const clientHeaders = { ...(headers || {}) };
    delete clientHeaders['host'];

    const targetResponse = await axios({
      method: method || 'GET',
      url,
      headers: clientHeaders,
      data: body,
      timeout: 10000,
      validateStatus: () => true, // Don't throw on 4xx/5xx
    });

    res.status(targetResponse.status).json({
      status: targetResponse.status,
      headers: targetResponse.headers,
      data: targetResponse.data,
    });
  } catch (err: any) {
    res.status(502).json({
      status: 502,
      error: `Proxy request failed: ${err.message}`,
    });
  }
});
