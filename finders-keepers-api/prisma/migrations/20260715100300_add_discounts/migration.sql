-- Additive: discount engine tables.
-- Product prices are never mutated; final prices are derived at read time.

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TYPE "DiscountTargetType" AS ENUM ('PRODUCT', 'VARIANT', 'CATEGORY');

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "publicLabel" TEXT,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minOrderAmount" DECIMAL(10,2),
    "maxDiscountAmount" DECIMAL(10,2),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "createdByAdminId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "notificationsEnqueuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountTarget" (
    "id" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "targetType" "DiscountTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Discount_isActive_startsAt_endsAt_idx" ON "Discount"("isActive", "startsAt", "endsAt");
CREATE INDEX "Discount_priority_idx" ON "Discount"("priority");
CREATE INDEX "Discount_createdByAdminId_idx" ON "Discount"("createdByAdminId");
CREATE INDEX "Discount_archivedAt_idx" ON "Discount"("archivedAt");
CREATE INDEX "Discount_notificationsEnqueuedAt_idx" ON "Discount"("notificationsEnqueuedAt");

-- Duplicate-target prevention. Uses the non-null targetId mirror column because
-- a composite unique over nullable productId/variantId/categoryId would not
-- dedupe (Postgres treats each NULL as distinct).
CREATE UNIQUE INDEX "DiscountTarget_discountId_targetType_targetId_key" ON "DiscountTarget"("discountId", "targetType", "targetId");
CREATE INDEX "DiscountTarget_discountId_idx" ON "DiscountTarget"("discountId");
CREATE INDEX "DiscountTarget_productId_idx" ON "DiscountTarget"("productId");
CREATE INDEX "DiscountTarget_variantId_idx" ON "DiscountTarget"("variantId");
CREATE INDEX "DiscountTarget_categoryId_idx" ON "DiscountTarget"("categoryId");

-- AddForeignKey
ALTER TABLE "DiscountTarget" ADD CONSTRAINT "DiscountTarget_discountId_fkey"
  FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscountTarget" ADD CONSTRAINT "DiscountTarget_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscountTarget" ADD CONSTRAINT "DiscountTarget_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscountTarget" ADD CONSTRAINT "DiscountTarget_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
