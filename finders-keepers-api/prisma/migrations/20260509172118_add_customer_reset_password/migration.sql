-- AlterTable
ALTER TABLE "CustomerAccount" ADD COLUMN     "passwordResetExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetToken" TEXT;
