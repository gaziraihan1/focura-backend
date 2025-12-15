/*
  Warnings:

  - You are about to drop the `TaskMetadata` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TaskMetadata" DROP CONSTRAINT "TaskMetadata_taskId_fkey";

-- DropTable
DROP TABLE "TaskMetadata";

-- DropEnum
DROP TYPE "EnergyType";

-- CreateIndex
CREATE INDEX "Task_focusRequired_idx" ON "Task"("focusRequired");

-- CreateIndex
CREATE INDEX "Task_energyType_idx" ON "Task"("energyType");

-- CreateIndex
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");
