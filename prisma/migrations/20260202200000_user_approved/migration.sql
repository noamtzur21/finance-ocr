-- AlterTable
ALTER TABLE "User" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;

-- First user and any existing user should be approved (run after deploy: UPDATE "User" SET "approved" = true WHERE "isAdmin" = true OR id IN (...))
UPDATE "User" SET "approved" = true WHERE "isAdmin" = true;
