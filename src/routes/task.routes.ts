// routes/task.routes.ts
import { Router } from 'express';
// import { AuthRequest } from '../middleware/auth.js';
import {
  getTasks,
  getTaskStats,
  createTask,
  getTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
} from '../controllers/task.controller.js';
import commentRoutes from './comment.routes.js';

const router = Router();

// All routes here are already protected by authenticate middleware
// applied in index.ts: app.use('/api/tasks', authenticate, taskRoutes)

// Get task statistics (must come before /:id route)
router.get('/stats', getTaskStats);

// Test notification endpoint
// router.post('/test-notification', testNotification);

// Get all tasks
router.get('/', getTasks);

// Create a new task
router.post('/', createTask);

// Get a specific task
router.get('/:id', getTask);

// Update a task
router.put('/:id', updateTask);

// Update task status (partial update)
router.patch('/:id/status', updateTaskStatus);

// Delete a task
router.delete('/:id', deleteTask);

// Mount comment routes (nested)
router.use('/:taskId/comments', commentRoutes);

export default router;