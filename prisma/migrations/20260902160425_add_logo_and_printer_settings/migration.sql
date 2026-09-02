-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "printerWidth" INTEGER NOT NULL DEFAULT 58;
