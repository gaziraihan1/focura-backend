// Notification configuration
export const NOTIFICATION_CONFIG = {
    TASK_DUE_REMINDERS: [
        { label: "6h", ms: 6 * 60 * 60 * 1000 },
        { label: "3h", ms: 3 * 60 * 60 * 1000 },
        { label: "30m", ms: 30 * 60 * 1000 },
    ],
    TASK_OVERDUE_REMINDERS: [
        { label: "1h", ms: 1 * 60 * 60 * 1000 },
        { label: "6h", ms: 6 * 60 * 60 * 1000 },
        { label: "24h", ms: 24 * 60 * 60 * 1000 },
    ],
    PAGINATION: {
        DEFAULT_LIMIT: 20,
        MAX_LIMIT: 100,
    },
};
// Notification templates
export const NOTIFICATION_TEMPLATES = {
    TASK_ASSIGNED: (taskTitle, assignerName) => ({
        title: "New Task Assigned",
        message: `${assignerName} assigned you to "${taskTitle}"`,
    }),
    TASK_COMPLETED: (taskTitle, completerName) => ({
        title: "Task Completed",
        message: `${completerName} completed "${taskTitle}"`,
    }),
    TASK_COMMENTED: (taskTitle, commenterName) => ({
        title: "New Comment",
        message: `${commenterName} commented on "${taskTitle}"`,
    }),
    TASK_DUE_SOON: (taskTitle, timeLeft) => ({
        title: "Task Due Soon",
        message: `"${taskTitle}" is due in ${timeLeft}`,
    }),
    TASK_OVERDUE: (taskTitle, timeOverdue) => ({
        title: "Task Overdue",
        message: `"${taskTitle}" is overdue by ${timeOverdue}`,
    }),
    MENTION: (mentionerName, context) => ({
        title: "You Were Mentioned",
        message: `${mentionerName} mentioned you in ${context}`,
    }),
    WORKSPACE_INVITE: (workspaceName, inviterName) => ({
        title: "Workspace Invitation",
        message: `${inviterName} invited you to join "${workspaceName}"`,
    }),
    PROJECT_UPDATE: (projectName, updaterName) => ({
        title: "Project Updated",
        message: `${updaterName} updated "${projectName}"`,
    }),
    FILE_SHARED: (fileName, sharerName) => ({
        title: "File Shared",
        message: `${sharerName} shared "${fileName}" with you`,
    }),
    DEADLINE_REMINDER: (itemName, deadline) => ({
        title: "Deadline Reminder",
        message: `"${itemName}" deadline is on ${deadline}`,
    }),
};
//# sourceMappingURL=notification.types.js.map