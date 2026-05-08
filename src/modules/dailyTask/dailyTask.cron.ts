import cron from 'node-cron';
import { DailyTaskMutation } from './dailyTask.mutation.js';

export function initDailyTaskCrons() {
  cron.schedule(
    '1 0 * * *', // Every day at 00:01 UTC
    async () => {
      console.log('🕐 Running daily task cleanup cron job...');

      try {
        const result = await DailyTaskMutation.clearExpiredDailyTasks();
        console.log(`✅ Cleaned up ${result.deletedCount} expired daily tasks`);
      } catch (error) {
        console.error('❌ Failed to clean up expired daily tasks:', error);
      }
    },
    {
      timezone: process.env.TIMEZONE || 'UTC',
    }
  );

  console.log('✅ Daily task cleanup cron job scheduled (runs at 00:01 UTC)');
}