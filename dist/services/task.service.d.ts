export declare const TaskService: {
    /**
     * Create task and notify assignees
     */
    createTask(data: {
        title: string;
        description?: string;
        projectId?: string;
        createdById: string;
        assigneeIds?: string[];
    }): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        status: import(".prisma/client").$Enums.TaskStatus;
        priority: import(".prisma/client").$Enums.Priority;
        startDate: Date | null;
        dueDate: Date | null;
        completedAt: Date | null;
        estimatedHours: number | null;
        actualHours: number | null;
        position: number;
        projectId: string | null;
        createdById: string;
        parentId: string | null;
        workspaceId: string | null;
    }>;
    /**
     * Assign user to task
     */
    assignUserToTask(params: {
        taskId: string;
        userId: string;
        assignedBy: string;
    }): Promise<{
        id: string;
        userId: string;
        assignedAt: Date;
        taskId: string;
    }>;
    /**
     * Complete task and notify assignees
     */
    completeTask(taskId: string, completedBy: string): Promise<{
        assignees: {
            id: string;
            userId: string;
            assignedAt: Date;
            taskId: string;
        }[];
    } & {
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        status: import(".prisma/client").$Enums.TaskStatus;
        priority: import(".prisma/client").$Enums.Priority;
        startDate: Date | null;
        dueDate: Date | null;
        completedAt: Date | null;
        estimatedHours: number | null;
        actualHours: number | null;
        position: number;
        projectId: string | null;
        createdById: string;
        parentId: string | null;
        workspaceId: string | null;
    }>;
    /**
     * Add comment and notify assignees + mentioned users
     */
    addComment(params: {
        taskId: string;
        userId: string;
        content: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        updatedAt: Date;
        parentId: string | null;
        taskId: string;
        content: string;
        edited: boolean;
    }>;
    /**
     * Update task status and notify if needed
     */
    updateTaskStatus(params: {
        taskId: string;
        status: string;
        updatedBy: string;
    }): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        status: import(".prisma/client").$Enums.TaskStatus;
        priority: import(".prisma/client").$Enums.Priority;
        startDate: Date | null;
        dueDate: Date | null;
        completedAt: Date | null;
        estimatedHours: number | null;
        actualHours: number | null;
        position: number;
        projectId: string | null;
        createdById: string;
        parentId: string | null;
        workspaceId: string | null;
    }>;
};
