import { NotificationType } from "@prisma/client";
export interface CreateNotificationDTO {
    userId: string;
    senderId?: string;
    type: NotificationType;
    title: string;
    message: string;
    actionUrl?: string;
}
export interface NotificationWithSender {
    id: string;
    userId: string;
    senderId: string | null;
    type: NotificationType;
    title: string;
    message: string;
    read: boolean;
    readAt: Date | null;
    actionUrl: string | null;
    createdAt: Date;
    sender: {
        id: string;
        name: string | null;
        email: string;
        image: string | null;
    } | null;
}
export declare const NOTIFICATION_CONFIG: {
    readonly TASK_DUE_REMINDERS: readonly [{
        readonly label: "6h";
        readonly ms: number;
    }, {
        readonly label: "3h";
        readonly ms: number;
    }, {
        readonly label: "30m";
        readonly ms: number;
    }];
    readonly TASK_OVERDUE_REMINDERS: readonly [{
        readonly label: "1h";
        readonly ms: number;
    }, {
        readonly label: "6h";
        readonly ms: number;
    }, {
        readonly label: "24h";
        readonly ms: number;
    }];
    readonly PAGINATION: {
        readonly DEFAULT_LIMIT: 20;
        readonly MAX_LIMIT: 100;
    };
};
export declare const NOTIFICATION_TEMPLATES: {
    readonly TASK_ASSIGNED: (taskTitle: string, assignerName: string) => {
        title: string;
        message: string;
    };
    readonly TASK_COMPLETED: (taskTitle: string, completerName: string) => {
        title: string;
        message: string;
    };
    readonly TASK_COMMENTED: (taskTitle: string, commenterName: string) => {
        title: string;
        message: string;
    };
    readonly TASK_DUE_SOON: (taskTitle: string, timeLeft: string) => {
        title: string;
        message: string;
    };
    readonly TASK_OVERDUE: (taskTitle: string, timeOverdue: string) => {
        title: string;
        message: string;
    };
    readonly MENTION: (mentionerName: string, context: string) => {
        title: string;
        message: string;
    };
    readonly WORKSPACE_INVITE: (workspaceName: string, inviterName: string) => {
        title: string;
        message: string;
    };
    readonly PROJECT_UPDATE: (projectName: string, updaterName: string) => {
        title: string;
        message: string;
    };
    readonly FILE_SHARED: (fileName: string, sharerName: string) => {
        title: string;
        message: string;
    };
    readonly DEADLINE_REMINDER: (itemName: string, deadline: string) => {
        title: string;
        message: string;
    };
};
