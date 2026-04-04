/*
  Warnings:

  - You are about to drop the column `schoolCode` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ReferenceType" AS ENUM ('COUNSELLOR', 'INSTITUTION');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "schoolCode",
ADD COLUMN     "counsellorId" TEXT,
ADD COLUMN     "institutionId" TEXT;

-- CreateTable
CREATE TABLE "ReferenceCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ReferenceType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceCode_code_key" ON "ReferenceCode"("code");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_counsellorId_fkey" FOREIGN KEY ("counsellorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
