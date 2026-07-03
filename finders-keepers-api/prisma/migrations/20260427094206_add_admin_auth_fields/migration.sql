/*
  Warnings:

  - The `role` column on the `Admin` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER');

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "refreshToken" TEXT,
DROP COLUMN "role",
ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'ADMIN';
