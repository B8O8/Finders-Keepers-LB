/*
  Warnings:

  - You are about to drop the column `posProductId` on the `ProductVariant` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ProductVariant_posProductId_key";

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "posProductId";
