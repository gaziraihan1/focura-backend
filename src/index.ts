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

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3001',
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

initNotificationCrons();

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api/debug/cookies', (req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === "production";
  const cookieName = isProd ? "__Secure-focura.backend" : "focura.backend";
  
  res.json({
    environment: process.env.NODE_ENV,
    expectedCookieName: cookieName,
    parsedCookies: req.cookies,
    rawCookieHeader: req.headers.cookie,
    cookieFound: !!req.cookies[cookieName],
  });
});

app.use('/api/auth', authRoutes);

app.use('/api/workspaces', authenticate, workspaceRoutes);
app.use('/api/projects', authenticate, projectRoutes);
app.use('/api/tasks', authenticate, taskRoutes);  
app.use('/api/files', authenticate, fileRoutes);
app.use('/api/activities', authenticate, activityRoutes);
app.use('/api/user', authenticate, userRoutes);
app.use('/api/upload', authenticate, uploadRoutes);
app.use('/api/labels', authenticate, labelRoutes);
app.use('/api/notifications', notificationRoutes);


app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Client URL: ${process.env.CLIENT_URL}`);
});

const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default app;