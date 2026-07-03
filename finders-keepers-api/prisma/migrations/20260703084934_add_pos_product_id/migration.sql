-- Made idempotent: on a fresh database this column/index does not exist yet
-- (it is re-created by the later 20260703120000_add_pos_product_id migration).
-- Guarding with IF EXISTS makes this a safe no-op on a clean install while
-- still applying correctly to databases where the column was already present.

-- DropIndex
DROP INDEX IF EXISTS "ProductVariant_posProductId_key";

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN IF EXISTS "posProductId";
