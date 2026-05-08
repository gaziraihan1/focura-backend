-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'KPI');

-- CreateEnum
CREATE TYPE "SystemEventType" AS ENUM ('WEEKLY_RESET', 'MONTHLY_REVIEW', 'SPRINT_END', 'BILLING', 'WORKSPACE_REVIEW');

-- CreateEnum
CREATE TYPE "BurnoutRisk" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "UserCapacity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weeklyHours" INTEGER NOT NULL DEFAULT 40,
    "dailyCapacityHours" INTEGER NOT NULL DEFAULT 8,
    "deepWorkHours" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWorkSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workDays" JSONB NOT NULL,
    "workStartHour" INTEGER NOT NULL DEFAULT 9,
    "workEndHour" INTEGER NOT NULL DEFAULT 17,
    "timezone" TEXT,

    CONSTRAINT "UserWorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarDayAggregate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalTasks" INTEGER NOT NULL DEFAULT 0,
    "dueTasks" INTEGER NOT NULL DEFAULT 0,
    "criticalTasks" INTEGER NOT NULL DEFAULT 0,
    "milestoneCount" INTEGER NOT NULL DEFAULT 0,
    "plannedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "focusMinutes" INTEGER NOT NULL DEFAULT 0,
    "workloadScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overCapacity" BOOLEAN NOT NULL DEFAULT false,
    "hasPrimaryFocus" BOOLEAN NOT NULL DEFAULT false,
    "isReviewDay" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarDayAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalCheckpoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "title" TEXT NOT NULL,
    "type" "GoalType" NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemCalendarEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "workspaceId" TEXT,
    "title" TEXT NOT NULL,
    "type" "SystemEventType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BurnoutSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "consecutiveHeavyDays" INTEGER NOT NULL,
    "avgDailyLoad" DOUBLE PRECISION NOT NULL,
    "riskLevel" "BurnoutRisk" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BurnoutSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCapacity_userId_key" ON "UserCapacity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserWorkSchedule_userId_key" ON "UserWorkSchedule"("userId");

-- CreateIndex
CREATE INDEX "CalendarDayAggregate_userId_date_idx" ON "CalendarDayAggregate"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDayAggregate_userId_date_key" ON "CalendarDayAggregate"("userId", "date");

-- CreateIndex
CREATE INDEX "GoalCheckpoint_userId_targetDate_idx" ON "GoalCheckpoint"("userId", "targetDate");

-- CreateIndex
CREATE INDEX "SystemCalendarEvent_date_idx" ON "SystemCalendarEvent"("date");

-- CreateIndex
CREATE INDEX "SystemCalendarEvent_userId_idx" ON "SystemCalendarEvent"("userId");

-- CreateIndex
CREATE INDEX "SystemCalendarEvent_workspaceId_idx" ON "SystemCalendarEvent"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "BurnoutSignal_userId_weekStart_key" ON "BurnoutSignal"("userId", "weekStart");

-- AddForeignKey
ALTER TABLE "UserCapacity" ADD CONSTRAINT "UserCapacity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorkSchedule" ADD CONSTRAINT "UserWorkSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarDayAggregate" ADD CONSTRAINT "CalendarDayAggregate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalCheckpoint" ADD CONSTRAINT "GoalCheckpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalCheckpoint" ADD CONSTRAINT "GoalCheckpoint_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemCalendarEvent" ADD CONSTRAINT "SystemCalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemCalendarEvent" ADD CONSTRAINT "SystemCalendarEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BurnoutSignal" ADD CONSTRAINT "BurnoutSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
