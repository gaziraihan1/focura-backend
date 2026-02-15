import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import helmet from 'helmet';

import { initNotificationCrons } from "./cron/notification.cron.js";

import projectRoutes from './routes/project.routes.js';
import taskRoutes from './routes/task.routes.js';
import dailyTaskRoutes from './routes/dailyTask.routes.js'; // NEW
import fileRoutes from './routes/file.routes.js';
import activityRoutes from './routes/activity.routes.js';
import userRoutes from './routes/user.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import labelRoutes from './routes/label.routes.js';
import notificationRoutes from './routes/notification.route.js';
import workspaceRoutes from './routes/workspace.routes.js';
import calendarRoutes from './routes/calendar.routes.js';
import focusSessionRoutes from './routes/focusSession.routes.js'

import { errorHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/auth.js';
import { initDailyTaskCrons } from './cron/dailyTask.cron.js';

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
initDailyTaskCrons(); // NEW: Start daily task cleanup cron

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

app.use('/api/notifications', notificationRoutes);
app.use('/api/workspaces', authenticate, workspaceRoutes);
app.use('/api/projects', authenticate, projectRoutes);
app.use('/api/tasks', authenticate, taskRoutes);  
app.use('/api/daily-tasks', authenticate, dailyTaskRoutes); // NEW: Daily task prioritization
app.use('/api/files', authenticate, fileRoutes);
app.use('/api/activities', authenticate, activityRoutes);
app.use('/api/user', authenticate, userRoutes);
app.use('/api/upload', authenticate, uploadRoutes);
app.use('/api/labels', authenticate, labelRoutes);
app.use('/api/calendar', authenticate, calendarRoutes);
app.use('/api/focus-sessions',authenticate, focusSessionRoutes)

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
  console.log(`📡 SSE: /api/notifications/stream/:userId (query token auth)`);
  console.log(`📅 Daily Tasks: /api/daily-tasks (PRIMARY/SECONDARY prioritization)`); // NEW
  console.log(`⏰ Cron Jobs: Notifications + Daily Task Cleanup`); // NEW
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