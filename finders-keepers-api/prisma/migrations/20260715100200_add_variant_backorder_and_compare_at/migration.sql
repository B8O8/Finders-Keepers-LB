-- Additive: backorder support + presentational compare-at price.
-- Defaults preserve current behaviour exactly: allowBackorder = false means
-- existing stock validation is unchanged for every existing variant.

-- AlterTable
ALTER TABLE "ProductVariant"
  ADD COLUMN "compareAtPrice" DECIMAL(10,2),
  ADD COLUMN "allowBackorder" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "backorderMessage" TEXT,
  ADD COLUMN "availabilityDate" TIMESTAMP(3);
