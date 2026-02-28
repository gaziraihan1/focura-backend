import cron from 'node-cron';
import { prisma } from '../../index.js';
import { notifyUser } from '../../utils/notification.helpers.js';
import { NotificationMutation } from './notification.mutation.js';


const REMINDERS = [
  { label: '6h', ms: 6 * 60 * 60 * 1000 },
  { label: '3h', ms: 3 * 60 * 60 * 1000 },
  { label: '30m', ms: 30 * 60 * 1000 },
];

const OVERDUE = [
  { label: '1h', ms: 1 * 60 * 60 * 1000 },
  { label: '6h', ms: 6 * 60 * 60 * 1000 },
  { label: '24h', ms: 24 * 60 * 60 * 1000 },
];


const sentNotifications = new Map<string, Set<string>>();

function getNotificationKey(taskId: string, userId: string, type: string, label: string): string {
  return `${taskId}-${userId}-${type}-${label}`;
}

function wasNotificationSent(key: string): boolean {
  const today = new Date().toDateString();
  const todayNotifications = sentNotifications.get(today);
  return todayNotifications?.has(key) || false;
}

function markNotificationSent(key: string): void {
  const today = new Date().toDateString();
  if (!sentNotifications.has(today)) {
    sentNotifications.set(today, new Set());
  }
  sentNotifications.get(today)!.add(key);
}

function cleanupOldTracking(): void {
  const today = new Date().toDateString();
  const keysToDelete: string[] = [];

  sentNotifications.forEach((_, key) => {
    if (key !== today) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach((key) => sentNotifications.delete(key));
}

export function startTaskReminderCron() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('🔔 Running task reminder cron job...');

      const tasks = await prisma.task.findMany({
        where: {
          dueDate: { not: null },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        include: {
          assignees: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  notifications: true,
                },
              },
            },
          },
        },
      });

      const now = new Date().getTime();

      for (const task of tasks) {
        const due = new Date(task.dueDate!).getTime();

        if (!task.assignees || task.assignees.length === 0) continue;

        for (const r of REMINDERS) {
          const timeUntilDue = due - now;

          if (timeUntilDue < r.ms && timeUntilDue > r.ms - 5 * 60 * 1000) {
            for (const assignee of task.assignees) {
              if (!assignee.user.notifications) continue;

              const notifKey = getNotificationKey(task.id, assignee.userId, 'DUE_SOON', r.label);

              if (wasNotificationSent(notifKey)) continue;

              await notifyUser({
                userId: assignee.userId,
                type: 'TASK_DUE_SOON',
                title: 'Task Due Soon',
                message: `"${task.title}" is due in ${r.label}`,
                actionUrl: `/dashboard/tasks/${task.id}`,
              });

              markNotificationSent(notifKey);
              console.log(`  ✅ Sent due soon reminder (${r.label}) for task ${task.id} to user ${assignee.userId}`);
            }
          }
        }

        for (const o of OVERDUE) {
          const timeOverdue = now - due;

          if (timeOverdue > o.ms && timeOverdue < o.ms + 5 * 60 * 1000) {
            for (const assignee of task.assignees) {
              if (!assignee.user.notifications) continue;

              const notifKey = getNotificationKey(task.id, assignee.userId, 'OVERDUE', o.label);

              if (wasNotificationSent(notifKey)) continue;

              await notifyUser({
                userId: assignee.userId,
                type: 'TASK_OVERDUE',
                title: 'Task Overdue',
                message: `"${task.title}" is overdue by ${o.label}`,
                actionUrl: `/dashboard/tasks/${task.id}`,
              });

              markNotificationSent(notifKey);
              console.log(`  ✅ Sent overdue reminder (${o.label}) for task ${task.id} to user ${assignee.userId}`);
            }
          }
        }
      }

      console.log('✅ Task reminder cron job completed');
    } catch (error) {
      console.error('❌ Error in task reminder cron job:', error);
    }
  });

  console.log('✅ Task reminder cron job started (runs every 5 minutes)');
}

export function startNotificationCleanupCron() {
  cron.schedule('0 3 * * *', async () => {
    try {
      console.log('🧹 Running notification cleanup cron job...');

      const result = await NotificationMutation.deleteOldReadNotifications(30);

      console.log(`  ✅ Cleaned up ${result.count} old read notifications`);

      cleanupOldTracking();
      console.log('  ✅ Cleaned up old notification tracking data');
    } catch (error) {
      console.error('❌ Error in notification cleanup cron job:', error);
    }
  });

  console.log('✅ Notification cleanup cron job started (runs daily at 3 AM)');
}

export function initNotificationCrons() {
  startTaskReminderCron();
  startNotificationCleanupCron();
}