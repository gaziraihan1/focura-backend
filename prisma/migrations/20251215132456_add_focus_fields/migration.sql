-- CreateEnum
CREATE TYPE "EnergyType" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "distractionCost" INTEGER,
ADD COLUMN     "energyType" "TaskEnergy",
ADD COLUMN     "focusLevel" INTEGER,
ADD COLUMN     "focusRequired" BOOLEAN NOT NULL DEFAULT false;
