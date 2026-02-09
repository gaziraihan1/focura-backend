import { Router } from 'express';
import {
  getDailyTasks,
  addDailyTask,
  removeDailyTask,
  clearExpiredDailyTasks,
  getDailyTaskStats,
} from '../controllers/dailyTask.controller.js';

const router = Router();


router.get('/stats', getDailyTaskStats);

router.post('/clear-expired', clearExpiredDailyTasks);

router.get('/', getDailyTasks);

router.post('/', addDailyTask);

router.delete('/:taskId', removeDailyTask);

export default router;