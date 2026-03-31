-- CreateEnum
CREATE TYPE "AnnouncementVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "visibility" "AnnouncementVisibility" NOT NULL DEFAULT 'PUBLIC',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementTarget" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_workspaceId_idx" ON "Announcement"("workspaceId");

-- CreateIndex
CREATE INDEX "Announcement_createdById_idx" ON "Announcement"("createdById");

-- CreateIndex
CREATE INDEX "Announcement_visibility_idx" ON "Announcement"("visibility");

-- CreateIndex
CREATE INDEX "Announcement_isPinned_idx" ON "Announcement"("isPinned");

-- CreateIndex
CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");

-- CreateIndex
CREATE INDEX "AnnouncementTarget_announcementId_idx" ON "AnnouncementTarget"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementTarget_userId_idx" ON "AnnouncementTarget"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementTarget_announcementId_userId_key" ON "AnnouncementTarget"("announcementId", "userId");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementTarget" ADD CONSTRAINT "AnnouncementTarget_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementTarget" ADD CONSTRAINT "AnnouncementTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
