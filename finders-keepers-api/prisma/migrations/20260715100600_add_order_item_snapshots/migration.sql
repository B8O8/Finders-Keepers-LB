-- Additive: immutable price/discount/backorder snapshot on order lines.
--
-- discountId is deliberately NOT a foreign key: historical orders must remain
-- unchanged (and readable) even after a discount is edited or deleted.
--
-- Existing orders predate discounts, so regularPrice is backfilled from
-- unitPrice, keeping historical totals truthful and self-consistent.

-- AlterTable
ALTER TABLE "OrderItem"
  ADD COLUMN "regularPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discountId" TEXT,
  ADD COLUMN "discountLabel" TEXT,
  ADD COLUMN "isBackorder" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "backorderQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "categorySnapshot" JSONB,
  ADD COLUMN "imageUrl" TEXT;

-- CreateIndex
CREATE INDEX "OrderItem_isBackorder_idx" ON "OrderItem"("isBackorder");

-- ---------------------------------------------------------------------------
-- DATA BACKFILL (idempotent)
-- Pre-existing lines were never discounted, so the regular price equals the
-- price actually charged.
-- ---------------------------------------------------------------------------
UPDATE "OrderItem"
SET "regularPrice" = "unitPrice"
WHERE "regularPrice" = 0;
