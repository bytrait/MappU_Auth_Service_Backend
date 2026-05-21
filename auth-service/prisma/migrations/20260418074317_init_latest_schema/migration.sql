-- CreateEnum
CREATE TYPE "StudentRegistrationType" AS ENUM ('INDIVIDUAL', 'SCHOOL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "registrationType" "StudentRegistrationType";
