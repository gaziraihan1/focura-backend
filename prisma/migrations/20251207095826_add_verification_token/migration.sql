/*
  Warnings:

  - You are about to drop the column `deviceMeta` on the `RefreshToken` table. All the data in the column will be lost.
  - You are about to drop the column `failedLoginAttempts` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lockedUntil` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `passwordChangedAt` on the `User` table. All the data in the column will be lost.
  - The primary key for the `VerificationToken` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `VerificationToken` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `VerificationToken` table. All the data in the column will be lost.
  - You are about to drop the column `tokenHash` on the `VerificationToken` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `VerificationToken` table. All the data in the column will be lost.
  - You are about to drop the column `used` on the `VerificationToken` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token]` on the table `VerificationToken` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[identifier,token]` on the table `VerificationToken` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `token` to the `VerificationToken` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "User_email_idx";

-- DropIndex
DROP INDEX "VerificationToken_identifier_type_idx";

-- AlterTable
ALTER TABLE "RefreshToken" DROP COLUMN "deviceMeta",
ADD COLUMN     "replacedById" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "failedLoginAttempts",
DROP COLUMN "lockedUntil",
DROP COLUMN "passwordChangedAt";

-- AlterTable
ALTER TABLE "VerificationToken" DROP CONSTRAINT "VerificationToken_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "id",
DROP COLUMN "tokenHash",
DROP COLUMN "type",
DROP COLUMN "used",
ADD COLUMN     "token" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
