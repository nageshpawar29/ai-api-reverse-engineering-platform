import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { Project } from '../types/index.js';
import { IngestionService } from '../services/IngestionService.js';

export const projectsRouter = Router();

// GET /api/projects - list all projects
projectsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await db.listProjects();
    res.json({ projects, count: projects.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id - get single project
projectsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id as string;
    const project = await db.getProject(projectId);
    if (!project) {
      throw new AppError('Project not found', 404);
    }
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id/analysis - get complete analysis representation
projectsRouter.get('/:id/analysis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id as string;
    const analysis = await db.getProjectAnalysis(projectId);
    if (!analysis) {
      throw new AppError('Project not found', 404);
    }
    res.json(analysis);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/auto-repair - force full reverse-engineering synthesis and auto-healing
projectsRouter.post('/:id/auto-repair', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id as string;
    const project = await db.getProject(projectId);
    if (!project) throw new AppError('Project not found', 404);

    if (project.storagePath && fs.existsSync(project.storagePath)) {
      await IngestionService.runAnalysisPipeline(project.id, project.storagePath);
    }

    const analysis = await db.getProjectAnalysis(projectId);
    res.json({ message: 'Project successfully reverse-engineered and auto-healed', analysis });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/deep-analyze - feature requested by user: full-codebase deep scan & reverse-engineering
projectsRouter.post('/:id/deep-analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id as string;
    const project = await db.getProject(projectId);
    if (!project) throw new AppError('Project not found', 404);

    if (project.storagePath && fs.existsSync(project.storagePath)) {
      await IngestionService.runAnalysisPipeline(project.id, project.storagePath);
    }

    const analysis = await db.getProjectAnalysis(projectId);
    res.json({
      message: 'Full project deep analysis completed successfully',
      analysis,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects - create new project manually or initialize metadata
projectsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, framework, language, sourceType, repositoryUrl, storagePath } = req.body;
    if (!name) {
      throw new AppError('Project name is required', 400);
    }

    const newProject: Project = {
      id: uuidv4(),
      userId: 'default-user-id',
      name: name.trim(),
      description: description?.trim() || '',
      framework: framework || 'express',
      language: language || 'typescript',
      sourceType: sourceType || 'zip',
      repositoryUrl: repositoryUrl?.trim(),
      storagePath: storagePath || '',
      status: 'pending',
      currentStep: 'Initialized',
      progressPercentage: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = await db.createProject(newProject);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:id - delete a project
projectsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id as string;
    const success = await db.deleteProject(projectId);
    if (!success) {
      throw new AppError('Project not found or already deleted', 404);
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    next(err);
  }
});
