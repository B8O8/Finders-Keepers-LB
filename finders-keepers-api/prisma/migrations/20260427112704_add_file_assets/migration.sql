-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_path_key" ON "FileAsset"("path");

-- CreateIndex
CREATE INDEX "FileAsset_entity_idx" ON "FileAsset"("entity");

-- CreateIndex
CREATE INDEX "FileAsset_entityId_idx" ON "FileAsset"("entityId");
