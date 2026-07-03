-- AlterTable: add posProductId to ProductVariant
ALTER TABLE "ProductVariant" ADD COLUMN "posProductId" TEXT;

-- CreateIndex: unique on posProductId (nullable unique — Postgres allows multiple NULLs)
CREATE UNIQUE INDEX "ProductVariant_posProductId_key" ON "ProductVariant"("posProductId");
