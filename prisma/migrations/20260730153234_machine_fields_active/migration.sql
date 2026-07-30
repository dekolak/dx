-- AlterTable
ALTER TABLE "Machine" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "brand" TEXT,
ADD COLUMN     "clientRef" TEXT,
ADD COLUMN     "machineRef" TEXT,
ADD COLUMN     "model" TEXT;

-- CreateIndex
CREATE INDEX "Machine_active_idx" ON "Machine"("active");
