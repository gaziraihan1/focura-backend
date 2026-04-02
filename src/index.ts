import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import helmet from 'helmet';

import {projectRouter} from '../src/modules/project/index.js';
import {taskRouter} from '../src/modules/task/index.js';
import {dailyTaskRouter, initDailyTaskCrons} from '../src/modules/dailyTask/index.js';
import {activityRouter} from '../src/modules/activity/index.js';
import userRoutes from './routes/user.routes.js';
import uploadRoutes from '../src/modules/upload/upload.routes.js';
import {labelRouter} from '../src/modules/label/index.js';
import {initNotificationCrons, notificationRouter} from '../src/modules/notification/index.js';
import {workspaceRouter} from '../src/modules/workspace/index.js';
import {calendarRouter} from '../src/modules/calendar/index.js';
import {focusSessionRouter} from '../src/modules/focusSession/index.js';
import {storageRouter} from '../src/modules/storage/index.js';
import {analyticsRouter} from '../src/modules/analytics/index.js';
import {fileManagementRouter} from '../src/modules/file/index.js';
import logoutRoutes from './routes/auth.routes.js';
import {workspaceUsageRouter} from '../src/modules/workspaceUsage/index.js';
import { announcementRouter } from './modules/announcement/index.js';
import { meetingRoutes } from './modules/meeting/index.js';
import webhookRouter from './payment/webhook.router.js';
import { billingRouter } from '../src/modules/billing/index.js';
import { featureRouter } from './modules/feature/index.js';

import { errorHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/auth.js';
import { projectAnnouncementRouter, workspaceAnnouncementRouter } from './modules/announcement/index.js';
import { adminRouter } from './admin/admin.routes.js';

dotenv.config();

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

const app: Application = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-show-error-toast',
    'x-show-success-toast'
  ],
}));

app.use(webhookRouter)

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(helmet({
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...(allowedOrigins as string[])],
    },
  } : false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use((req: Request, res: Response, next) => {
  if (process.env.NODE_ENV === 'development') {
    if (!req.path.includes('/stream')) {
      console.log(`${req.method} ${req.path}`, {
        origin: req.headers.origin,
        hasAuth: !!req.headers.authorization,
        authType: req.headers.authorization?.split(' ')[0] || 'none',
      });
    }
  }
  next();
});

initNotificationCrons();
initDailyTaskCrons();

app.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      database: 'connected',
      authMethod: 'Authorization Header',
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      database: 'disconnected',
      error: (error as Error).message,
    });
  }
});

app.get('/api/debug/auth', (req: Request, res: Response) => {
  if (isProd) {
    return res.status(403).json({ error: 'Debug endpoint disabled in production' });
  }

  const authHeader = req.headers.authorization;
  const hasBearer = authHeader?.startsWith('Bearer ');

  res.json({
    environment: process.env.NODE_ENV,
    hasAuthHeader: !!authHeader,
    authType: authHeader?.split(' ')[0] || 'none',
    tokenLength: hasBearer ? authHeader?.substring(7).length : 0,
    origin: req.headers.origin,
    method: req.method,
  });
});

app.use('/api/notifications', notificationRouter);
app.use('/api/workspaces/:workspaceId/projects/:projectId/announcements', authenticate, projectAnnouncementRouter);
app.use('/api/workspaces/:workspaceId/announcements', authenticate, workspaceAnnouncementRouter)
app.use('/api/workspaces', authenticate, workspaceRouter);
app.use('/api/workspaces/:workspaceId/billing', authenticate, billingRouter);
app.use('/api/announcements', authenticate, announcementRouter)
app.use('/api/projects', authenticate, projectRouter);
app.use('/api/tasks', authenticate, taskRouter);
app.use('/api/daily-tasks', authenticate, dailyTaskRouter);
app.use('/api/activities', authenticate, activityRouter);
app.use('/api/user', authenticate, userRoutes);
app.use('/api/upload', authenticate, uploadRoutes);
app.use('/api/labels', authenticate, labelRouter);
app.use('/api/calendar', authenticate, calendarRouter);
app.use('/api/focus-sessions',authenticate, focusSessionRouter);
app.use('/api/storage', authenticate, storageRouter);
app.use('/api/analytics', authenticate, analyticsRouter);
app.use('/api/file-management', authenticate, fileManagementRouter);
app.use('/api/auth', logoutRoutes)
app.use('/api/workspace-usage', authenticate, workspaceUsageRouter)
app.use('/api/meetings', authenticate, meetingRoutes)
app.use('/api/features', authenticate, featureRouter)
app.use('/api/admin', authenticate, adminRouter)

app.use((req: Request, res: Response) => {
  console.warn(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Allowed Origins:`, allowedOrigins);
  console.log(`🔒 HTTPS Required: ${isProd}`);
  console.log(`🔑 Auth Method: Authorization Header (Bearer Token)`);
  console.log(`📡 SSE: /api/notifications/stream/:userId?token=`);
  console.log(`📅 Daily Tasks: /api/daily-tasks (PRIMARY/SECONDARY prioritization)`);
  console.log(`⏰ Cron Jobs: Notifications + Daily Task Cleanup`);
  console.log('='.repeat(60));
}).on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  server.close(async () => {
    console.log('✅ HTTP server closed');

    try {
      await prisma.$disconnect();
      console.log('✅ Database disconnected');
      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('⚠️  Forcing shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

export default app;