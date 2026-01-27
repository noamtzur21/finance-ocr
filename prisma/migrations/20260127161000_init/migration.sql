-- CreateEnum
CREATE TYPE "InvestmentAccountType" AS ENUM ('btb', 'gemel');

-- CreateTable
CREATE TABLE "InvestmentAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InvestmentAccountType" NOT NULL,
    "provider" TEXT,
    "strategy" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "notes" TEXT,
    "currentBalance" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentYear" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "deposits" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "withdrawals" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "feesPaid" DECIMAL(14,2),
    "taxPaid" DECIMAL(14,2),
    "endBalance" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentYear_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvestmentAccount_userId_updatedAt_idx" ON "InvestmentAccount"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentAccount_userId_slug_key" ON "InvestmentAccount"("userId", "slug");

-- CreateIndex
CREATE INDEX "InvestmentYear_userId_year_idx" ON "InvestmentYear"("userId", "year");

-- CreateIndex
CREATE INDEX "InvestmentYear_userId_updatedAt_idx" ON "InvestmentYear"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentYear_accountId_year_key" ON "InvestmentYear"("accountId", "year");

-- AddForeignKey
ALTER TABLE "InvestmentAccount" ADD CONSTRAINT "InvestmentAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentYear" ADD CONSTRAINT "InvestmentYear_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentYear" ADD CONSTRAINT "InvestmentYear_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InvestmentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
