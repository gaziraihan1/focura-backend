import { WorkspaceRole } from '@prisma/client';
export declare class WorkspaceService {
    static generateSlug(name: string): Promise<string>;
    static getUserWorkspaces(userId: string): Promise<({
        _count: {
            members: number;
            projects: number;
        };
        members: ({
            user: {
                id: string;
                name: string | null;
                email: string;
                image: string | null;
            };
        } & {
            id: string;
            userId: string;
            role: import(".prisma/client").$Enums.WorkspaceRole;
            workspaceId: string | null;
            joinedAt: Date;
        })[];
        owner: {
            id: string;
            name: string | null;
            email: string;
            image: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        name: string;
        plan: import(".prisma/client").$Enums.WorkspacePlan;
        updatedAt: Date;
        description: string | null;
        color: string | null;
        slug: string;
        logo: string | null;
        isPublic: boolean;
        allowInvites: boolean;
        maxMembers: number;
        maxStorage: number;
        ownerId: string;
    })[]>;
    static create(userId: string, data: any): Promise<{
        members: ({
            user: {
                id: string;
                name: string | null;
                email: string;
                image: string | null;
            };
        } & {
            id: string;
            userId: string;
            role: import(".prisma/client").$Enums.WorkspaceRole;
            workspaceId: string | null;
            joinedAt: Date;
        })[];
        owner: {
            id: string;
            name: string | null;
            email: string;
            image: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        name: string;
        plan: import(".prisma/client").$Enums.WorkspacePlan;
        updatedAt: Date;
        description: string | null;
        color: string | null;
        slug: string;
        logo: string | null;
        isPublic: boolean;
        allowInvites: boolean;
        maxMembers: number;
        maxStorage: number;
        ownerId: string;
    }>;
    static getBySlug(slug: string, userId: string): Promise<{
        _count: {
            labels: number;
            members: number;
            projects: number;
        };
        members: ({
            user: {
                id: string;
                name: string | null;
                email: string;
                image: string | null;
            };
        } & {
            id: string;
            userId: string;
            role: import(".prisma/client").$Enums.WorkspaceRole;
            workspaceId: string | null;
            joinedAt: Date;
        })[];
        owner: {
            id: string;
            name: string | null;
            email: string;
            image: string | null;
        };
        projects: ({
            _count: {
                tasks: number;
            };
        } & {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            description: string | null;
            status: import(".prisma/client").$Enums.ProjectStatus;
            priority: import(".prisma/client").$Enums.Priority;
            startDate: Date | null;
            dueDate: Date | null;
            completedAt: Date | null;
            createdById: string;
            workspaceId: string | null;
            color: string | null;
            icon: string | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        name: string;
        plan: import(".prisma/client").$Enums.WorkspacePlan;
        updatedAt: Date;
        description: string | null;
        color: string | null;
        slug: string;
        logo: string | null;
        isPublic: boolean;
        allowInvites: boolean;
        maxMembers: number;
        maxStorage: number;
        ownerId: string;
    }>;
    static update(workspaceId: string, userId: string, data: any): Promise<{
        members: ({
            user: {
                id: string;
                createdAt: Date;
                name: string | null;
                email: string;
                password: string | null;
                emailVerified: Date | null;
                image: string | null;
                lastProfileUpdateAt: Date | null;
                bio: string | null;
                timezone: string | null;
                role: import(".prisma/client").$Enums.UserRole;
                plan: import(".prisma/client").$Enums.UserPlan;
                theme: string | null;
                notifications: boolean;
                updatedAt: Date;
                lastLoginAt: Date | null;
            };
        } & {
            id: string;
            userId: string;
            role: import(".prisma/client").$Enums.WorkspaceRole;
            workspaceId: string | null;
            joinedAt: Date;
        })[];
        owner: {
            id: string;
            createdAt: Date;
            name: string | null;
            email: string;
            password: string | null;
            emailVerified: Date | null;
            image: string | null;
            lastProfileUpdateAt: Date | null;
            bio: string | null;
            timezone: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            plan: import(".prisma/client").$Enums.UserPlan;
            theme: string | null;
            notifications: boolean;
            updatedAt: Date;
            lastLoginAt: Date | null;
        };
    } & {
        id: string;
        createdAt: Date;
        name: string;
        plan: import(".prisma/client").$Enums.WorkspacePlan;
        updatedAt: Date;
        description: string | null;
        color: string | null;
        slug: string;
        logo: string | null;
        isPublic: boolean;
        allowInvites: boolean;
        maxMembers: number;
        maxStorage: number;
        ownerId: string;
    }>;
    static delete(workspaceId: string, userId: string): Promise<void>;
    static getMembers(workspaceId: string, userId: string): Promise<({
        user: {
            id: string;
            name: string | null;
            email: string;
            image: string | null;
        };
    } & {
        id: string;
        userId: string;
        role: import(".prisma/client").$Enums.WorkspaceRole;
        workspaceId: string | null;
        joinedAt: Date;
    })[]>;
    static inviteMember(workspaceId: string, inviterId: string, email: string, role: WorkspaceRole): Promise<{
        workspace: {
            id: string;
            createdAt: Date;
            name: string;
            plan: import(".prisma/client").$Enums.WorkspacePlan;
            updatedAt: Date;
            description: string | null;
            color: string | null;
            slug: string;
            logo: string | null;
            isPublic: boolean;
            allowInvites: boolean;
            maxMembers: number;
            maxStorage: number;
            ownerId: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        email: string;
        role: import(".prisma/client").$Enums.WorkspaceRole;
        status: import(".prisma/client").$Enums.InvitationStatus;
        workspaceId: string | null;
        token: string;
        expiresAt: Date;
        invitedById: string;
    }>;
    static acceptInvitation(token: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        plan: import(".prisma/client").$Enums.WorkspacePlan;
        updatedAt: Date;
        description: string | null;
        color: string | null;
        slug: string;
        logo: string | null;
        isPublic: boolean;
        allowInvites: boolean;
        maxMembers: number;
        maxStorage: number;
        ownerId: string;
    } | null>;
    static getInvitationByToken(token: string): Promise<{
        workspace: {
            id: string;
            name: string;
            description: string | null;
            color: string | null;
            slug: string;
            logo: string | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        email: string;
        role: import(".prisma/client").$Enums.WorkspaceRole;
        status: import(".prisma/client").$Enums.InvitationStatus;
        workspaceId: string | null;
        token: string;
        expiresAt: Date;
        invitedById: string;
    }>;
    static removeMember(workspaceId: string, removerId: string, memberId: string): Promise<void>;
    static updateMemberRole(workspaceId: string, updaterId: string, memberId: string, role: WorkspaceRole): Promise<{
        user: {
            id: string;
            name: string | null;
            email: string;
            image: string | null;
            notifications: boolean;
        };
    } & {
        id: string;
        userId: string;
        role: import(".prisma/client").$Enums.WorkspaceRole;
        workspaceId: string | null;
        joinedAt: Date;
    }>;
    static leaveWorkspace(workspaceId: string, userId: string): Promise<void>;
    static getStats(workspaceId: string, userId: string): Promise<{
        totalProjects: number;
        totalTasks: number;
        totalMembers: number;
        completedTasks: number;
        overdueTasks: number;
        completionRate: number;
    }>;
}
