-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_workspaceId_fkey";

-- AlterTable
ALTER TABLE "File" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Integration" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Label" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WorkspaceInvitation" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WorkspaceMember" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
