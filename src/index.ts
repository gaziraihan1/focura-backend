import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { initNotificationCrons } from "./cron/notification.cron.js";

import projectRoutes from './routes/project.routes.js';
import taskRoutes from './routes/task.routes.js';
import fileRoutes from './routes/file.routes.js';
import activityRoutes from './routes/activity.routes.js';
import userRoutes from './routes/user.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import labelRoutes from './routes/label.routes.js';
import notificationRoutes from './routes/notification.route.js';
import workspaceRoutes from './routes/workspace.routes.js';
import authRoutes from './routes/auth.routes.js';

import { errorHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/auth.js';

dotenv.config();

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

const app: Application = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

// 🔥 IMPROVED: Better CORS configuration with multiple origins
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL, // Add your Vercel URL here
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
}));

// 🔥 IMPROVED: Handle preflight requests explicitly
app.options('*', cors());

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🔥 IMPROVED: Better helmet configuration for production
app.use(helmet({
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...(allowedOrigins as string[])],
    },
  } : false, // Disable CSP in development
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// 🔥 IMPROVED: Request logging middleware
app.use((req: Request, res: Response, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`${req.method} ${req.path}`, {
      origin: req.headers.origin,
      cookies: Object.keys(req.cookies),
      hasAuth: !!req.headers.authorization,
    });
  }
  next();
});

initNotificationCrons();

// 🔥 IMPROVED: Better health check with database connection
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      database: 'connected',
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

// 🔥 IMPROVED: Better debug endpoint with security
app.get('/api/debug/cookies', (req: Request, res: Response) => {
  // Only allow in development
  if (isProd) {
    return res.status(403).json({ error: 'Debug endpoint disabled in production' });
  }
  
  const cookieName = isProd ? "__Secure-focura.backend" : "focura.backend";
  
  res.json({
    environment: process.env.NODE_ENV,
    expectedCookieName: cookieName,
    parsedCookies: req.cookies,
    rawCookieHeader: req.headers.cookie,
    cookieFound: !!req.cookies[cookieName],
    origin: req.headers.origin,
    referer: req.headers.referer,
  });
});

// 🔥 IMPROVED: Auth routes without authentication
app.use('/api/auth', authRoutes);

// 🔥 IMPROVED: Protected routes with authentication
app.use('/api/workspaces', authenticate, workspaceRoutes);
app.use('/api/projects', authenticate, projectRoutes);
app.use('/api/tasks', authenticate, taskRoutes);  
app.use('/api/files', authenticate, fileRoutes);
app.use('/api/activities', authenticate, activityRoutes);
app.use('/api/user', authenticate, userRoutes);
app.use('/api/upload', authenticate, uploadRoutes);
app.use('/api/labels', authenticate, labelRoutes);
app.use('/api/notifications', authenticate, notificationRoutes); // 🔥 Added auth

// 🔥 IMPROVED: Better 404 handler
app.use((req: Request, res: Response) => {
  console.warn(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

// 🔥 IMPROVED: Error handler must be last
app.use(errorHandler);

// 🔥 IMPROVED: Better server startup with error handling
const server = app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Allowed Origins:`, allowedOrigins);
  console.log(`🔒 HTTPS Required: ${isProd}`);
  console.log(`🍪 Cookie Name: ${isProd ? "__Secure-focura.backend" : "focura.backend"}`);
  console.log('='.repeat(50));
}).on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

// 🔥 IMPROVED: Better graceful shutdown with timeout
const gracefulShutdown = async (signal: string) => {
  console.log(`
${signal} received, shutting down gracefully...`);
  
  // Stop accepting new connections
  server.close(async () => {
    console.log('✅ HTTP server closed');
    
    try {
      // Disconnect Prisma
      await prisma.$disconnect();
      console.log('✅ Database disconnected');
      
      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('⚠️  Forcing shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 🔥 IMPROVED: Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

export default app;