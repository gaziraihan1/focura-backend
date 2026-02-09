import cron from 'node-cron';
import { DailyTaskService } from '../services/dailyTask.service.js';

export function initDailyTaskCrons() {
  cron.schedule('1 0 * * *', async () => {
    console.log('🕐 Running daily task cleanup cron job...');
    
    try {
      const result = await DailyTaskService.clearExpiredDailyTasks();
      console.log(`✅ Cleaned up ${result.deletedCount} expired daily tasks`);
    } catch (error) {
      console.error('❌ Failed to clean up expired daily tasks:', error);
    }
  }, {
    timezone: 'UTC', // Change to your timezone or process.env.TIMEZONE
  });

  console.log('✅ Daily task cleanup cron job scheduled (runs at 00:01 UTC)');
}