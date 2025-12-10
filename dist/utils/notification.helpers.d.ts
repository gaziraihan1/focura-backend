import { NotificationType } from "@prisma/client";
/**
 * Send notification to a single user
 */
export declare function notifyUser(params: {
    userId: string;
    senderId?: string;
    type: NotificationType;
    title: string;
    message: string;
    actionUrl?: string;
}): Promise<{
    sender: {
        id: string;
        name: string | null;
        email: string;
        image: string | null;
    } | null;
} & {
    id: string;
    type: import(".prisma/client").$Enums.NotificationType;
    title: string;
    message: string;
    read: boolean;
    actionUrl: string | null;
    createdAt: Date;
    readAt: Date | null;
    userId: string;
    senderId: string | null;
}>;
/**
 * Notify all assignees of a task
 */
export declare function notifyTaskAssignees(params: {
    taskId: string;
    senderId?: string;
    type: NotificationType;
    title: string;
    message: string;
    excludeUserId?: string;
}): Promise<({
    sender: {
        id: string;
        name: string | null;
        email: string;
        image: string | null;
    } | null;
} & {
    id: string;
    type: import(".prisma/client").$Enums.NotificationType;
    title: string;
    message: string;
    read: boolean;
    actionUrl: string | null;
    createdAt: Date;
    readAt: Date | null;
    userId: string;
    senderId: string | null;
})[]>;
/**
 * Notify all members of a workspace
 */
export declare function notifyWorkspaceMembers(params: {
    workspaceId: string;
    senderId?: string;
    type: NotificationType;
    title: string;
    message: string;
    actionUrl?: string;
    excludeUserId?: string;
    role?: string;
}): Promise<({
    sender: {
        id: string;
        name: string | null;
        email: string;
        image: string | null;
    } | null;
} & {
    id: string;
    type: import(".prisma/client").$Enums.NotificationType;
    title: string;
    message: string;
    read: boolean;
    actionUrl: string | null;
    createdAt: Date;
    readAt: Date | null;
    userId: string;
    senderId: string | null;
})[]>;
/**
 * Notify all members of a project (users assigned to any task in the project)
 */
export declare function notifyProjectMembers(params: {
    projectId: string;
    senderId?: string;
    type: NotificationType;
    title: string;
    message: string;
    actionUrl?: string;
    excludeUserId?: string;
}): Promise<({
    sender: {
        id: string;
        name: string | null;
        email: string;
        image: string | null;
    } | null;
} & {
    id: string;
    type: import(".prisma/client").$Enums.NotificationType;
    title: string;
    message: string;
    read: boolean;
    actionUrl: string | null;
    createdAt: Date;
    readAt: Date | null;
    userId: string;
    senderId: string | null;
})[]>;
/**
 * Parse @mentions from text and return user IDs
 */
export declare function parseMentions(text: string, workspaceId: string): Promise<string[]>;
/**
 * Notify users mentioned in text (e.g., @username in comments)
 */
export declare function notifyMentions(params: {
    text: string;
    workspaceId: string;
    senderId: string;
    senderName: string;
    context: string;
    actionUrl: string;
}): Promise<({
    sender: {
        id: string;
        name: string | null;
        email: string;
        image: string | null;
    } | null;
} & {
    id: string;
    type: import(".prisma/client").$Enums.NotificationType;
    title: string;
    message: string;
    read: boolean;
    actionUrl: string | null;
    createdAt: Date;
    readAt: Date | null;
    userId: string;
    senderId: string | null;
})[]>;
