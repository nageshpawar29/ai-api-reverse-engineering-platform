import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';

export const healthRouter = Router();

healthRouter.get('/', (req: Request, res: Response) => {
  const dbStatus = db.getStatus();
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus,
    platform: {
      node: process.version,
      arch: process.arch,
      platform: process.platform,
    },
  });
});
