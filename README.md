# ⚙️ Focura Backend

Focura Backend is the **core API and business logic layer** powering the Focura productivity SaaS.
It is responsible for authentication, workspaces, projects, tasks, comments, notifications, analytics, and real-time communication.

Built with a **modular monolith architecture** — each domain is fully self-contained with its own routes, controllers, queries, mutations, types, and selects, while sharing a single Express server and Prisma instance.

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | NextAuth-compatible RS256 JWT |
| Real-time | Server-Sent Events (SSE) |
| Caching / Revocation | Upstash Redis |
| Rate Limiting | Sliding-window (Redis + in-memory fallback) |
| Job Scheduling | node-cron |

---

## 🧠 Core Responsibilities

- User authentication, token issuance, and session management
- RS256 JWT signing — private key lives only in this backend
- Workspace isolation and role-based access control
- Task, project, label, and team management
- Daily tasks and focus session tracking
- Calendar and scheduling logic
- File, attachment, and storage management
- Activity feed and audit trail
- Real-time notifications via SSE
- Task analytics and statistics
- Comment threads and @mention notifications
- Audit logging for all security-relevant events
- Business rule enforcement and input validation

---

## 📁 Folder Structure

```txt
src/
├── index.ts                    # App entry point, Express setup, Prisma instance
│
├── middleware/
│   ├── auth.ts                 # authenticate, authorize, rateLimitByUser
│   └── ...
│
├── modules/                    # Self-contained domain modules
│   │
│   ├── activity/
│   │   ├── activity.access.ts
│   │   ├── activity.analytics.ts
│   │   ├── activity.controller.ts
│   │   ├── activity.mutation.ts
│   │   ├── activity.query.ts
│   │   ├── activity.routes.ts
│   │   ├── activity.selects.ts
│   │   ├── activity.types.ts
│   │   └── index.ts
│   │
│   ├── analytics/
│   │   ├── analytics.access.ts
│   │   ├── analytics.controller.ts
│   │   ├── analytics.query.ts
│   │   ├── analytics.routes.ts
│   │   ├── analytics.types.ts
│   │   ├── analytics.utils.ts
│   │   └── index.ts
│   │
│   ├── attachment/
│   │   ├── attachment.access.ts
│   │   ├── attachment.controller.ts
│   │   ├── attachment.mutation.ts
│   │   ├── attachment.query.ts
│   │   ├── attachment.types.ts
│   │   ├── attachment.utils.ts
│   │   ├── attachment.validation.ts
│   │   └── index.ts
│   │
│   ├── calendar/
│   │   ├── calendar.aggregation.ts
│   │   ├── calendar.controller.ts
│   │   ├── calendar.insights.ts
│   │   ├── calendar.mutation.ts
│   │   ├── calendar.query.ts
│   │   ├── calendar.routes.ts
│   │   ├── calendar.types.ts
│   │   ├── calendar.utils.ts
│   │   ├── calendar.validators.ts
│   │   └── index.ts
│   │
│   ├── comment/
│   │   ├── comment.access.ts
│   │   ├── comment.activity.ts
│   │   ├── comment.controller.ts
│   │   ├── comment.mutation.ts
│   │   ├── comment.query.ts
│   │   ├── comment.routes.ts
│   │   ├── comment.selects.ts
│   │   ├── comment.types.ts
│   │   ├── comment.validators.ts
│   │   └── index.ts
│   │
│   ├── dailyTask/
│   │   ├── dailyTask.access.ts
│   │   ├── dailyTask.activity.ts
│   │   ├── dailyTask.controller.ts
│   │   ├── dailyTask.cron.ts
│   │   ├── dailyTask.mutation.ts
│   │   ├── dailyTask.query.ts
│   │   ├── dailyTask.routes.ts
│   │   ├── dailyTask.selects.ts
│   │   ├── dailyTask.types.ts
│   │   ├── dailyTask.validators.ts
│   │   └── index.ts
│   │
│   ├── fileManagement/
│   │   ├── fileManagement.access.ts
│   │   ├── fileManagement.controller.ts
│   │   ├── fileManagement.filters.ts
│   │   ├── fileManagement.mutation.ts
│   │   ├── fileManagement.query.ts
│   │   ├── fileManagement.routes.ts
│   │   ├── fileManagement.types.ts
│   │   ├── fileManagement.utils.ts
│   │   └── index.ts
│   │
│   ├── focusSession/
│   │   ├── focusSession.analytics.ts
│   │   ├── focusSession.controller.ts
│   │   ├── focusSession.mutation.ts
│   │   ├── focusSession.query.ts
│   │   ├── focusSession.routes.ts
│   │   ├── focusSession.selects.ts
│   │   ├── focusSession.types.ts
│   │   ├── focusSession.validators.ts
│   │   └── index.ts
│   │
│   ├── label/
│   │   ├── label.access.ts
│   │   ├── label.controller.ts
│   │   ├── label.mutation.ts
│   │   ├── label.query.ts
│   │   ├── label.routes.ts
│   │   ├── label.selects.ts
│   │   ├── label.types.ts
│   │   ├── label.validators.ts
│   │   └── index.ts
│   │
│   ├── notification/
│   │   ├── notification.controller.ts
│   │   ├── notification.mutation.ts
│   │   ├── notification.query.ts
│   │   ├── notification.routes.ts
│   │   ├── notification.selects.ts
│   │   ├── notification.types.ts
│   │   └── index.ts
│   │
│   ├── project/
│   │   ├── project.access.ts
│   │   ├── project.controller.ts
│   │   ├── project.mutation.ts
│   │   ├── project.query.ts
│   │   ├── project.routes.ts
│   │   ├── project.selects.ts
│   │   ├── project.stats.ts
│   │   ├── project.types.ts
│   │   ├── project.validators.ts
│   │   └── index.ts
│   │
│   ├── storage/
│   │   ├── storage.access.ts
│   │   ├── storage.controller.ts
│   │   ├── storage.mutation.ts
│   │   ├── storage.query.ts
│   │   ├── storage.routes.ts
│   │   ├── storage.types.ts
│   │   ├── storage.utils.ts
│   │   ├── storage.validators.ts
│   │   └── index.ts
│   │
│   ├── task/
│   │   ├── task.access.ts
│   │   ├── task.activity.ts
│   │   ├── task.controller.ts
│   │   ├── task.filters.ts
│   │   ├── task.mutation.ts
│   │   ├── task.notifications.ts
│   │   ├── task.query.ts
│   │   ├── task.routes.ts
│   │   ├── task.selects.ts
│   │   ├── task.types.ts
│   │   ├── task.utils.ts
│   │   ├── task.validators.ts
│   │   └── index.ts
│   │
│   ├── upload/
│   │   ├── upload.controller.ts
│   │   └── upload.routes.ts
│   │
│   └── workspace/
│       ├── workspace.access.ts
│       ├── workspace.activity.ts
│       ├── workspace.controller.ts
│       ├── workspace.mutation.ts
│       ├── workspace.notifications.ts
│       ├── workspace.query.ts
│       ├── workspace.routes.ts
│       ├── workspace.selects.ts
│       ├── workspace.types.ts
│       ├── workspace.utils.ts
│       ├── workspace.validators.ts
│       └── index.ts
│    │
│
├── sockets/
│   └── notification.stream.ts  # SSE connection manager
│
├── utils/
│   └── notification.helpers.ts # notifyUser, notifyTaskAssignees, etc.
│
├── lib/
│   └── auth/
│       ├── backendToken.ts     # RS256 signing, verification, token creation
│       ├── tokenRevocation.ts  # Redis JTI revocation
│       └── auditLog.ts         # Structured security event logging
│
├── crons/
│   └── notification.cron.ts    # Task reminders, cleanup jobs
│
├── keys/
│   ├── private.pem             # RSA private key — NEVER commit
│   └── public.pem              # RSA public key
│
└── scripts/
    └── generate-keys.js        # One-time RSA key pair generator
```

---

## 🏗️ Modular Monolith Pattern

Each domain module is fully self-contained. The general pattern is:

```
modules/<domain>/
├── <domain>.routes.ts       # Route registration only
├── <domain>.controller.ts   # Request/response handling, thin layer
├── <domain>.query.ts        # All read operations (Prisma SELECT)
├── <domain>.mutation.ts     # All write operations (Prisma CREATE/UPDATE/DELETE)
├── <domain>.selects.ts      # Reusable Prisma select/include objects
├── <domain>.types.ts        # TypeScript types and interfaces
└── index.ts                 # Module barrel export
```

Some modules include additional files based on their responsibilities:

| Extra File | Purpose | Modules |
|---|---|---|
| `<domain>.access.ts` | Permission/access checks | activity, analytics, attachment, comment, dailyTask, fileManagement, label, project, storage, task, workspace |
| `<domain>.activity.ts` | Activity feed logging | comment, dailyTask, task, workspace |
| `<domain>.validators.ts` | Input validation | attachment, calendar, comment, dailyTask, focusSession, label, project, storage, task, workspace |
| `<domain>.utils.ts` | Internal utilities | analytics, attachment, fileManagement, storage, task, workspace |
| `<domain>.filters.ts` | Query filtering logic | fileManagement, task |
| `<domain>.notifications.ts` | Notification dispatch | task, workspace |
| `<domain>.analytics.ts` | Analytics/stats logic | activity, focusSession |
| `<domain>.selects.ts` | Prisma select objects | activity, comment, dailyTask, focusSession, label, notification, project, task, workspace |
| `<domain>.cron.ts` | Scheduled jobs | dailyTask |

**Rules:**
- Controllers are thin — they call queries/mutations, never write Prisma directly
- Queries and mutations never import from other modules' internals — use helpers or shared utils
- Cross-module communication goes through `utils/` helpers (e.g. `notification.helpers.ts`)
- All modules share one Prisma instance exported from `index.ts`

---

## 🔐 Authentication & Security

See [AUTHENTICATION.md](./AUTHENTICATION.md) for the full architecture.

**Summary:**
- RS256 asymmetric JWT — private key never leaves this server
- NextAuth exchanges a HMAC-signed proof for an RS256 token pair via `POST /api/auth/exchange`
- Access tokens: 15 min, refresh tokens: 7 days with rotation
- Refresh token JTIs tracked in Redis — replay attacks detected and logged
- Token version field allows global invalidation by incrementing `CURRENT_TOKEN_VERSION`
- All security events emitted as structured JSON audit logs
- Login rate limiting: 5 attempts/min per IP+email
- API rate limiting: per-user tier (free: 60/min, pro: 300/min, enterprise: 1000/min)

---

## 📡 Real-Time Notifications (SSE)

Notifications are pushed in real-time via Server-Sent Events:

```
Client → GET /api/notifications/stream?token=<accessToken>
Backend → verifyToken() → extract userId → stream events
```

- Token is verified on connection — userId always comes from the JWT, never from the URL
- Uses `notification.helpers.ts` for all notification dispatch:

```ts
// Single user
await notifyUser({ userId, type, title, message, actionUrl });

// All task assignees
await notifyTaskAssignees({ taskId, senderId, type, title, message, excludeUserId });

// All workspace members
await notifyWorkspaceMembers({ workspaceId, senderId, type, title, message, actionUrl });

// @mentions in text
await notifyMentions({ text, workspaceId, senderId, senderName, context, actionUrl });
```

---

## 🔄 Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| Task reminder | Every 5 minutes | Notifies assignees 6h, 3h, 30m before due date |
| Overdue alerts | Every 5 minutes | Notifies assignees 1h, 6h, 24h after due date |
| Notification cleanup | Daily at 3 AM | Deletes read notifications older than 30 days |
| Daily task reset | Scheduled | Handled via `dailyTask.cron.ts` |

---

## 🛡️ Role-Based Access Control

| Role | Scope |
|------|-------|
| `OWNER` | Full workspace control, billing, deletion |
| `ADMIN` | Member management, project creation |
| `MEMBER` | Task and project access within workspace |

```ts
router.delete("/workspace/:id", authenticate, authorize("OWNER"), handler);
```

---

## 🛠️ Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Server
NODE_ENV=development
PORT=5000
ALLOWED_ORIGIN=http://localhost:3000

# Database
DATABASE_URL=

# Auth — private key lives ONLY here, never in the frontend
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
# Production (base64 encoded):
# JWT_PRIVATE_KEY=
# JWT_PUBLIC_KEY=

# Must match frontend NEXTAUTH_SECRET — used to verify HMAC exchange proof
NEXTAUTH_SECRET=

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## 🧪 Local Development

### 1. Generate RSA keys (first time only)

```bash
node scripts/generate-keys.js
```

This creates `keys/private.pem` and `keys/public.pem`. The private key is gitignored automatically.

### 2. Install dependencies

```bash
npm install
```

### 3. Setup database

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Run the server

```bash
npm run dev
```

Server runs on `http://localhost:5000`

---

## 📡 API Overview

**Base URL:** `/api`

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/auth/exchange` | Issue RS256 tokens after NextAuth login |
| `POST` | `/api/auth/refresh` | Rotate refresh token, issue new pair |
| `POST` | `/api/auth/logout` | Revoke tokens, destroy session |
| `GET` | `/api/notifications/stream` | SSE stream (token auth via query param) |
| `GET` | `/api/notifications` | Paginated notifications |
| `GET` | `/api/workspaces` | List user workspaces |
| `POST` | `/api/projects` | Create project |
| `GET` | `/api/tasks` | List tasks |
| `GET` | `/api/tasks/stats` | Task analytics |
| `PATCH` | `/api/tasks/:id/status` | Update task status |
| `POST` | `/api/tasks/:id/comments` | Add comment |
| `GET` | `/api/daily-tasks` | Daily task list |
| `GET` | `/api/focus-sessions` | Focus session history |
| `GET` | `/api/calendar` | Calendar events |
| `GET` | `/api/labels` | Workspace labels |
| `GET` | `/api/analytics` | Workspace analytics |
| `POST` | `/api/upload` | File upload |
| `GET` | `/api/activity` | Activity feed |
| `GET` | `/api/storage` | Storage usage |
| `GET` | `/api/file-management` | File management |

All routes are protected by `authenticate` middleware unless explicitly noted.

---

## 🧩 Database

- PostgreSQL via Prisma ORM
- Workspace-based data isolation — every query is scoped to a workspace
- Optimized indexes for task queries
- Pagination via cursor-based approach (not offset)
- Relational integrity enforced at the DB level

---

## 🧱 Architecture Principles

- **Modular monolith** — domain modules are self-contained, deployed as one unit
- **Thin controllers** — request parsing and response shaping only
- **Query/mutation split** — reads and writes are always separated
- **Shared utils** — cross-module logic lives in `utils/`, never in module internals
- **No hidden magic** — explicit imports, explicit middleware, explicit error handling

---

## 🚫 What This Backend Does NOT Do

- UI rendering or SSR
- Client-side state management
- JWT signing on the frontend (private key never leaves this server)
- SEO or static generation

---

## 👤 Maintainer

**Mohammad Raihan Gazi**
Creator & Maintainer of Focura

---

## 📄 License

This project is currently private / source-available.
License details will be added in the future.