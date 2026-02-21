-- CreateTable
CREATE TABLE "UploadRateLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadRateLimit_userId_workspaceId_uploadedAt_idx" ON "UploadRateLimit"("userId", "workspaceId", "uploadedAt");

-- CreateIndex
CREATE INDEX "UploadRateLimit_expiresAt_idx" ON "UploadRateLimit"("expiresAt");

-- CreateIndex
CREATE INDEX "File_uploadedAt_idx" ON "File"("uploadedAt");

-- AddForeignKey
ALTER TABLE "UploadRateLimit" ADD CONSTRAINT "UploadRateLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadRateLimit" ADD CONSTRAINT "UploadRateLimit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
