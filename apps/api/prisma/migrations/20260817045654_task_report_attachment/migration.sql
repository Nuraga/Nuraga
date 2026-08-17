-- AlterTable
ALTER TABLE "task" ADD COLUMN     "reportFileKey" TEXT,
ADD COLUMN     "reportFileName" TEXT,
ADD COLUMN     "reportMimeType" TEXT,
ADD COLUMN     "reportUploadedAt" TIMESTAMP(3);
