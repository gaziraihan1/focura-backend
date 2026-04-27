-- CreateEnum
CREATE TYPE "JobDepartment" AS ENUM ('ENGINEERING', 'DESIGN', 'PRODUCT', 'MARKETING', 'SALES', 'CUSTOMER_SUCCESS', 'OPERATIONS', 'FINANCE', 'HR', 'OTHER');

-- CreateEnum
CREATE TYPE "JobLocationType" AS ENUM ('REMOTE', 'ONSITE', 'HYBRID');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE');

-- CreateEnum
CREATE TYPE "JobExperience" AS ENUM ('ENTRY', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'OPEN', 'PAUSED', 'CLOSED');

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "department" "JobDepartment" NOT NULL,
    "location" TEXT NOT NULL,
    "locationType" "JobLocationType" NOT NULL DEFAULT 'REMOTE',
    "type" "JobType" NOT NULL DEFAULT 'FULL_TIME',
    "experienceLevel" "JobExperience" NOT NULL DEFAULT 'MID',
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "niceToHave" TEXT,
    "benefits" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "postedById" TEXT NOT NULL,
    "closingDate" TIMESTAMP(3),
    "applicationUrl" TEXT,
    "applicationEmail" TEXT,
    "totalApplicants" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobPosting_slug_key" ON "JobPosting"("slug");

-- CreateIndex
CREATE INDEX "JobPosting_status_idx" ON "JobPosting"("status");

-- CreateIndex
CREATE INDEX "JobPosting_department_idx" ON "JobPosting"("department");

-- CreateIndex
CREATE INDEX "JobPosting_locationType_idx" ON "JobPosting"("locationType");

-- CreateIndex
CREATE INDEX "JobPosting_type_idx" ON "JobPosting"("type");

-- CreateIndex
CREATE INDEX "JobPosting_isPinned_idx" ON "JobPosting"("isPinned");

-- CreateIndex
CREATE INDEX "JobPosting_createdAt_idx" ON "JobPosting"("createdAt");
