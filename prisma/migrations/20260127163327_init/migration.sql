-- CreateEnum
CREATE TYPE "InvestmentEntryType" AS ENUM ('deposit', 'withdrawal', 'fee', 'tax');

-- AlterTable
ALTER TABLE "InvestmentAccount" ADD COLUMN     "currentBalanceUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "InvestmentEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "InvestmentEntryType" NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvestmentEntry_userId_date_idx" ON "InvestmentEntry"("userId", "date");

-- CreateIndex
CREATE INDEX "InvestmentEntry_accountId_date_idx" ON "InvestmentEntry"("accountId", "date");

-- CreateIndex
CREATE INDEX "InvestmentEntry_userId_updatedAt_idx" ON "InvestmentEntry"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "InvestmentEntry" ADD CONSTRAINT "InvestmentEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentEntry" ADD CONSTRAINT "InvestmentEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InvestmentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
