-- Additive: media metadata + storage backend discriminator.
-- Existing rows default to SUPABASE so their current public URLs keep resolving
-- after local uploads are introduced. No data is rewritten.

-- CreateEnum
CREATE TYPE "StorageType" AS ENUM ('SUPABASE', 'LOCAL');

-- AlterTable
ALTER TABLE "FileAsset"
  ADD COLUMN "storageType" "StorageType" NOT NULL DEFAULT 'SUPABASE',
  ADD COLUMN "title" TEXT,
  ADD COLUMN "altText" TEXT,
  ADD COLUMN "caption" TEXT;
