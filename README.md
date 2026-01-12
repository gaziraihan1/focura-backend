# ⚙️ Focura Backend

Focura Backend is the **core API and business logic layer** powering the Focura productivity SaaS.  
It is responsible for authentication, workspaces, projects, tasks, comments, notifications, analytics, and security.

Built with scalability, clarity, and security in mind.

---

## 🚀 Tech Stack

- **Node.js**
- **Express.js**
- **TypeScript**
- **PostgreSQL**
- **Prisma ORM**
- **JWT Authentication**
- **NextAuth-compatible backend tokens**
- **Rate Limiting**
- **Role-Based Access Control (RBAC)**

---

## 🧠 Core Responsibilities

- User authentication & authorization
- Workspace isolation & access control
- Task, project, and team management
- Task analytics & stats
- Comments & notifications
- Secure API communication
- Business rule enforcement

---

## 📁 Folder Structure
```txt
src/
├── controllers/       # HTTP request handlers
├── services/          # Business logic
├── routes/            # Express routes
├── middleware/        # Auth, rate limiting, error handling
├── prisma/            # Prisma schema & migrations
├── utils/             # Helpers & utilities
├── config/            # App & environment config
├── types/             # Shared TypeScript types
└── index.ts           # App entry point
```

---

## 🔐 Authentication & Security

- JWT-based authentication
- Workspace-level authorization
- Role-based access (Owner, Admin, Member)
- Token expiration handling
- Rate limiting on sensitive routes
- Input validation on all endpoints
- Secure error responses (no data leakage)

---

## 📊 Task & Workspace Logic

- Personal vs Workspace tasks
- Assigned, collaborative, and owned tasks
- Task priorities, status, intent, focus mode
- Due date intelligence (overdue, due today)
- Workspace-level analytics & stats
- Strict workspace data isolation

---

## 🛠 Environment Variables

Create a `.env` file based on `.env.example`
```env
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/focura
JWT_SECRET=your_jwt_secret
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

---

## 🧪 Local Development

### 1. Install dependencies
```bash
npm install
```

### 2. Setup database
```bash
npx prisma migrate dev
```

### 3. Generate Prisma client
```bash
npx prisma generate
```

### 4. Run the server
```bash
npm run dev
```

Server will run on:
```
http://localhost:5000
```

---

## 📡 API Overview

**Base URL:**
```
/api
```

### Example Routes
```
POST   /api/auth/login
GET    /api/workspaces
POST   /api/projects
GET    /api/tasks
GET    /api/tasks/stats
PATCH  /api/tasks/:id/status
POST   /api/tasks/:id/comments
```

All routes are protected unless explicitly public.

---

## 🧩 Prisma & Database

- PostgreSQL is the primary datastore
- Prisma ORM for type-safe queries
- Strict relational integrity
- Workspace-based foreign keys
- Optimized indexes for task queries

---

## 📈 Performance Considerations

- Efficient Prisma queries
- Minimal over-fetching
- Cached stats where applicable
- Scoped queries by workspace & user
- Pagination-ready endpoints

---

## 🧱 Architecture Principles

- Controllers are thin
- Services hold business logic
- Routes only map endpoints
- Middleware handles cross-cutting concerns
- Clear separation of concerns

---

## 🚫 What This Backend Does NOT Do

- UI rendering
- Client-side state management
- SEO or static generation
- Third-party UI integrations

---

## 🧠 Philosophy

Focura Backend is designed to be:

- Predictable
- Secure
- Scalable
- Intentional
- Easy to reason about

No unnecessary abstraction. No hidden magic.

---

## 👤 Maintainer

**Mohammad Raihan Gazi**  
Creator & Maintainer of Focura

---

## 📄 License

This project is currently private / source-available.  
License details will be added in the future.
