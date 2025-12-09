-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MEMBER_REMOVED';

-- CreateIndex
CREATE INDEX "Task_workspaceId_idx" ON "Task"("workspaceId");
