// src/app.ts

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { projectRouter } from './modules/project/index.js';
import { taskRouter } from './modules/task/index.js';
import { dailyTaskRouter } from './modules/dailyTask/index.js';
import { activityRouter } from './modules/activity/index.js';
import userRoutes from './routes/user.routes.js';
import uploadRoutes from './modules/upload/upload.routes.js';
import { labelRouter } from './modules/label/index.js';
import { notificationRouter } from './modules/notification/index.js';
import { workspaceRouter } from './modules/workspace/index.js';
import { calendarRouter } from './modules/calendar/index.js';
import { focusSessionRouter } from './modules/focusSession/index.js';
import { storageRouter } from './modules/storage/index.js';
import { analyticsRouter } from './modules/analytics/index.js';
import { fileManagementRouter } from './modules/file/index.js';
import logoutRoutes from './routes/auth.routes.js';
import { workspaceUsageRouter } from './modules/workspaceUsage/index.js';
import { announcementRouter } from './modules/announcement/index.js';
import { meetingRoutes } from './modules/meeting/index.js';
import webhookRouter from './payment/webhook.router.js';
import { billingRouter } from './modules/billing/index.js';
import { featureRouter } from './modules/feature/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { contactRouter } from './modules/contact/index.js';
import { jobRouter } from './modules/job/index.js';

import { authenticate } from './middleware/auth.js';
import {
  projectAnnouncementRouter,
  workspaceAnnouncementRouter,
} from './modules/announcement/index.js';
import { adminRouter } from './admin/admin.routes.js';
import { templatesRouter } from './modules/templates/index.js';

const isProd = process.env.NODE_ENV === 'production';

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

const app: Application = express();

// ── Stripe webhook (RAW body required) ───────────────────────────────────────
app.use(webhookRouter);

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Security ─────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", ...allowedOrigins],
          },
        }
      : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ── Dev logger ───────────────────────────────────────────────────────────────
app.use((req: Request, _res: Response, next) => {
  if (process.env.NODE_ENV === 'development') {
    if (!req.path.includes('/stream')) {
      console.log(`${req.method} ${req.path}`);
    }
  }
  next();
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/notifications', notificationRouter);

app.use(
  '/api/workspaces/:workspaceId/projects/:projectId/announcements',
  authenticate,
  projectAnnouncementRouter
);

app.use(
  '/api/workspaces/:workspaceId/announcements',
  authenticate,
  workspaceAnnouncementRouter
);

app.use('/api/workspaces', workspaceRouter);
app.use('/api/workspaces/:workspaceId/billing', authenticate, billingRouter);

app.use('/api/announcements', authenticate, announcementRouter);
app.use('/api/projects', authenticate, projectRouter);
app.use('/api/tasks', authenticate, taskRouter);
app.use('/api/daily-tasks', authenticate, dailyTaskRouter);
app.use('/api/activities', authenticate, activityRouter);
app.use('/api/user', authenticate, userRoutes);
app.use('/api/upload', authenticate, uploadRoutes);
app.use('/api/labels', authenticate, labelRouter);
app.use('/api/calendar', authenticate, calendarRouter);
app.use('/api/focus-sessions', authenticate, focusSessionRouter);
app.use('/api/storage', authenticate, storageRouter);
app.use('/api/analytics', authenticate, analyticsRouter);
app.use('/api/file-management', authenticate, fileManagementRouter);
app.use('/api/auth', logoutRoutes);
app.use('/api/workspace-usage', authenticate, workspaceUsageRouter);
app.use('/api/meetings', authenticate, meetingRoutes);
app.use('/api/features', authenticate, featureRouter);
app.use('/api/admin', authenticate, adminRouter);
app.use('/api/contact', contactRouter);
app.use('/api/jobs', jobRouter);
app.use('/api/templates', templatesRouter);


// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

// ── ✅ SINGLE GLOBAL ERROR HANDLER (CRITICAL) ─────────────────────────────────
app.use(errorHandler);

export default app;