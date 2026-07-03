/*
  Warnings:

  - You are about to alter the column `defaultDeliveryFee` on the `StoreSettings` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `freeDeliveryThreshold` on the `StoreSettings` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `orderMinimumAmount` on the `StoreSettings` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH_ON_DELIVERY', 'ONLINE_CARD');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH_ON_DELIVERY',
ALTER COLUMN "deliveryFee" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "plu" TEXT;

-- AlterTable
ALTER TABLE "StoreSettings" ALTER COLUMN "defaultDeliveryFee" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "freeDeliveryThreshold" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "orderMinimumAmount" SET DATA TYPE DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "Order_paymentMethod_idx" ON "Order"("paymentMethod");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "ProductVariant_plu_idx" ON "ProductVariant"("plu");
