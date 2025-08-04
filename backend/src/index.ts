// Load environment variables first
import './config/env';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs/promises';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import fitnessRoutes from './routes/fitness';
import uploadsRoutes from './routes/uploads';
import matchingRoutes from './routes/matchingRoutes';
import { webhookRoutes } from './routes/webhookRoutes';
import { syncRoutes } from './routes/syncRoutes';
import { schedulerService } from './services/schedulerService';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure upload directory exists
async function ensureUploadDirectory() {
  const uploadDir = process.env.UPLOAD_DIR || 'uploads/photos';
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
    console.log(`Created upload directory: ${uploadDir}`);
  }
}

// Initialize upload directory
ensureUploadDirectory().catch(console.error);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/fitness', fitnessRoutes);
app.use('/uploads', uploadsRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/sync', syncRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize scheduler service
schedulerService.init();

// Start scheduled jobs in production
if (process.env.NODE_ENV === 'production') {
  schedulerService.start();
  logger.info('Scheduled jobs started in production mode');
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  schedulerService.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  schedulerService.shutdown();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

export default app;