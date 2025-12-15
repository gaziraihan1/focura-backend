-- CreateEnum
CREATE TYPE "TaskEnergy" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskEffort" AS ENUM ('QUICK', 'MEDIUM', 'DEEP');

-- CreateEnum
CREATE TYPE "TaskIntent" AS ENUM ('OUTCOME', 'LEARNING', 'MAINTENANCE', 'CREATIVE');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('BLOCKING', 'RELATED');

-- CreateEnum
CREATE TYPE "RecurrencePattern" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateTable
CREATE TABLE "TaskMetadata" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "energy" "TaskEnergy" NOT NULL DEFAULT 'MEDIUM',
    "effort" "TaskEffort" NOT NULL DEFAULT 'MEDIUM',
    "intent" "TaskIntent" NOT NULL DEFAULT 'OUTCOME',
    "postponedCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "aiHints" JSONB,

    CONSTRAINT "TaskMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'BLOCKING',

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskRecurrence" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "pattern" "RecurrencePattern" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "days" JSONB,
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "TaskRecurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskMetadata_taskId_key" ON "TaskMetadata"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDependency_taskId_dependsOnId_key" ON "TaskDependency"("taskId", "dependsOnId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskRecurrence_taskId_key" ON "TaskRecurrence"("taskId");

-- AddForeignKey
ALTER TABLE "TaskMetadata" ADD CONSTRAINT "TaskMetadata_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRecurrence" ADD CONSTRAINT "TaskRecurrence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
