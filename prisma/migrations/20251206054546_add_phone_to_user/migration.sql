-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PRO', 'BUSINESS', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastProfileUpdateAt" TIMESTAMP(3),
ADD COLUMN     "plan" "UserPlan" NOT NULL DEFAULT 'FREE';
