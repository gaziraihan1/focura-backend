/*
  Warnings:

  - You are about to drop the column `stripeEventId` on the `BillingEvent` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[providerEventId]` on the table `BillingEvent` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "BillingEvent_stripeEventId_idx";

-- DropIndex
DROP INDEX "BillingEvent_stripeEventId_key";

-- AlterTable
ALTER TABLE "BillingEvent" DROP COLUMN "stripeEventId",
ADD COLUMN     "providerEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_providerEventId_key" ON "BillingEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "BillingEvent_providerEventId_idx" ON "BillingEvent"("providerEventId");
