import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';

export const artifactsRouter = Router();

// GET /api/artifacts/:id/openapi.json
artifactsRouter.get('/:id/openapi.json', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id as string;
    const artifact = await db.getArtifact(projectId, 'openapi_json');
    if (!artifact) throw new AppError('OpenAPI JSON artifact not found', 404);

    res.setHeader('Content-Type', 'application/json');
    res.send(artifact.content);
  } catch (err) {
    next(err);
  }
});

// GET /api/artifacts/:id/openapi.yaml
artifactsRouter.get('/:id/openapi.yaml', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id as string;
    const artifact = await db.getArtifact(projectId, 'openapi_yaml');
    if (!artifact) throw new AppError('OpenAPI YAML artifact not found', 404);

    res.setHeader('Content-Type', 'text/yaml');
    res.send(artifact.content);
  } catch (err) {
    next(err);
  }
});

// GET /api/artifacts/:id/postman.json
artifactsRouter.get('/:id/postman.json', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id as string;
    const artifact = await db.getArtifact(projectId, 'postman_json');
    if (!artifact) throw new AppError('Postman collection artifact not found', 404);

    res.setHeader('Content-Type', 'application/json');
    res.send(artifact.content);
  } catch (err) {
    next(err);
  }
});

// GET /api/artifacts/:id/jest_tests
artifactsRouter.get('/:id/jest_tests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id as string;
    const artifact = await db.getArtifact(projectId, 'jest_tests');
    if (!artifact) throw new AppError('Jest tests artifact not found', 404);

    res.setHeader('Content-Type', 'text/plain');
    res.send(artifact.content);
  } catch (err) {
    next(err);
  }
});
