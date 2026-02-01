-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('exempt', 'licensed', 'company');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "isRecognized" DECIMAL(5,2) NOT NULL DEFAULT 100.0,
ADD COLUMN     "preVatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "businessType" "BusinessType" NOT NULL DEFAULT 'exempt',
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "vatPercent" DECIMAL(4,2) NOT NULL DEFAULT 18.0;
