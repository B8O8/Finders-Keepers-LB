-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL,
    "storeName" TEXT NOT NULL DEFAULT 'Finders Keepers LB',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultDeliveryFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "freeDeliveryThreshold" DECIMAL(65,30),
    "whatsappNumber" TEXT,
    "orderMinimumAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);
