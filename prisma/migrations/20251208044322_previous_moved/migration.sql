/*
  Warnings:

  - You are about to drop the `WorkspaceActivity` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "WorkspaceActivity" DROP CONSTRAINT "WorkspaceActivity_actorId_fkey";

-- DropForeignKey
ALTER TABLE "WorkspaceActivity" DROP CONSTRAINT "WorkspaceActivity_workspaceId_fkey";

-- DropTable
DROP TABLE "WorkspaceActivity";
