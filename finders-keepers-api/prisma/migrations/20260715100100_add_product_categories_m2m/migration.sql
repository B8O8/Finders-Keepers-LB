-- Additive: many-to-many product <-> category, plus an explicit primary category.
--
-- SAFETY: Product."categoryId" is intentionally NOT dropped here. It is kept
-- (deprecated) for one release so the previous application image can be
-- redeployed without data loss. A later migration removes it once no code reads it.
--
-- Existing single-category assignments are copied into the join table and into
-- primaryCategoryId, so no product loses its category.

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_productId_categoryId_key" ON "ProductCategory"("productId", "categoryId");
CREATE INDEX "ProductCategory_productId_idx" ON "ProductCategory"("productId");
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

-- AddForeignKey
-- Deleting a category removes only the link row; the product itself survives.
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "primaryCategoryId" TEXT;

-- CreateIndex
CREATE INDEX "Product_primaryCategoryId_idx" ON "Product"("primaryCategoryId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_primaryCategoryId_fkey"
  FOREIGN KEY ("primaryCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- DATA BACKFILL (idempotent)
-- ---------------------------------------------------------------------------

-- Copy each product's existing category into the join table.
INSERT INTO "ProductCategory" ("id", "productId", "categoryId", "createdAt")
SELECT gen_random_uuid(), p."id", p."categoryId", CURRENT_TIMESTAMP
FROM "Product" p
WHERE p."categoryId" IS NOT NULL
ON CONFLICT ("productId", "categoryId") DO NOTHING;

-- The pre-existing category becomes the primary category.
UPDATE "Product"
SET "primaryCategoryId" = "categoryId"
WHERE "categoryId" IS NOT NULL
  AND "primaryCategoryId" IS NULL;
