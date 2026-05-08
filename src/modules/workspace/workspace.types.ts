export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "GUEST";
export type WorkspacePlan = "FREE" | "PRO" | "BUSINESS" | "ENTERPRISE";

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  color?: string;
  logo?: string;
  isPublic?: boolean;
  plan?: WorkspacePlan;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  color?: string;
  logo?: string;
  isPublic?: boolean;
  allowInvites?: boolean;
}

export interface InviteMemberInput {
  email: string;
  role: WorkspaceRole;
}

export interface WorkspaceStats {
  totalProjects: number;
  totalTasks: number;
  totalMembers: number;
  completedTasks: number;
  overdueTasks: number;
  completionRate: number;
}
