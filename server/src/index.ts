import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from './db/index.js';
import { healthRouter } from './routes/health.js';
import { projectsRouter } from './routes/projects.js';
import { analysisRouter } from './routes/analysis.js';
import { artifactsRouter } from './routes/artifacts.js';
import { chatRouter } from './routes/chat.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 5001;

// CORS setup: Permissive origin policy so frontend assets and API endpoints
// can be requested seamlessly from any host (e.g. Render, custom domains, or localhost)
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static route for uploaded/extracted project files if needed
const storageDir = path.resolve(process.cwd(), process.env.STORAGE_DIR || './storage/uploads');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}
app.use('/storage', express.static(storageDir));

// Route registrations
app.use('/api/health', healthRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/artifacts', artifactsRouter);
app.use('/api/chat', chatRouter);

// Serve frontend client build in production or when client/dist exists
const clientDistCandidates = [
  path.resolve(process.cwd(), 'client', 'dist'),
  path.resolve(process.cwd(), '..', 'client', 'dist'),
  path.resolve(__dirname, '..', '..', 'client', 'dist'),
  path.resolve(__dirname, '..', 'client', 'dist'),
];
const clientDist = clientDistCandidates.find((dir) => fs.existsSync(dir));

if (clientDist) {
  console.log(`📦 Serving static client build from: ${clientDist}`);
  app.use(express.static(clientDist));

  // Catch-all route to support client-side routing (React Router)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/storage')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  // Fallback API greeting when client is not built yet
  app.get('/', (req, res) => {
    res.json({
      name: 'AI API Reverse-Engineering Platform Backend',
      version: '1.0.0',
      documentation: '/api/health',
      status: 'online',
    });
  });
}

// Centralized error handling
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await db.initialize();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`🚀 Reverse API Engine Server listening on 0.0.0.0:${PORT}`);
      console.log(`   Health check: http://0.0.0.0:${PORT}/api/health`);
      console.log(`=======================================================`);
    });

    const shutdown = () => {
      console.log('Shutting down server gracefully...');
      server.close(() => {
        console.log('Server stopped.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

export default app;
