/**
 * storage.access.ts
 * Responsibility: Authorization checks for the Storage domain.
 *
 * Bug fixed — silent null return:
 *  The original `getUserRole` was used as an access guard:
 *    await this.getUserRole(userId, workspaceId); // result silently ignored!
 *
 *  If the user wasn't a member, getUserRole returned null but nothing threw.
 *  Those endpoints were effectively open to any authenticated user.
 *
 *  Now:
 *   - getUserRole()      → returns role string or null (for callers that need the value)
 *   - assertMember()     → throws UnauthorizedError if not a member
 *   - assertAdmin()      → throws UnauthorizedError if not OWNER/ADMIN
 *   - isAdmin()          → returns boolean (for branching logic, no throw)
 *
 * Performance: all checks use findUnique (indexed) — single query, fast.
 */

import { prisma } from '../../index.js';
import { UnauthorizedError, NotFoundError } from './storage.types.js';

export const StorageAccess = {
  /**
   * Returns the user's role in the workspace, or null if not a member.
   */
  async getUserRole(userId: string, workspaceId: string): Promise<string | null> {
    const member = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    });
    return member?.role ?? null;
  },

  /**
   * Throws UnauthorizedError if the user is not a workspace member.
   * Returns the role for callers that need it.
   */
  async assertMember(userId: string, workspaceId: string): Promise<string> {
    const role = await this.getUserRole(userId, workspaceId);
    if (!role) throw new UnauthorizedError('You do not have access to this workspace');
    return role;
  },

  /**
   * Returns true if the user is a workspace OWNER or ADMIN.
   * Does NOT throw — use assertAdmin() when you want a hard guard.
   */
  async isAdmin(userId: string, workspaceId: string): Promise<boolean> {
    const role = await this.getUserRole(userId, workspaceId);
    return role === 'OWNER' || role === 'ADMIN';
  },

  /**
   * Throws UnauthorizedError if the user is not a workspace OWNER or ADMIN.
   */
  async assertAdmin(userId: string, workspaceId: string): Promise<void> {
    const isAdmin = await this.isAdmin(userId, workspaceId);
    if (!isAdmin) {
      throw new UnauthorizedError('Only workspace owners and admins can perform this action');
    }
  },

  /**
   * Verifies the workspace exists and the user is a member.
   * Returns { workspace, role } so callers don't need extra fetches.
   *
   * Performance: member check + workspace fetch run in parallel.
   */
  async assertMemberWithWorkspace(userId: string, workspaceId: string) {
    const [member, workspace] = await Promise.all([
      prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId, workspaceId } },
        select: { role: true },
      }),
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true, plan: true, maxStorage: true },
      }),
    ]);

    if (!member) throw new UnauthorizedError('You do not have access to this workspace');
    if (!workspace) throw new NotFoundError('Workspace not found');

    return { workspace, role: member.role };
  },
};