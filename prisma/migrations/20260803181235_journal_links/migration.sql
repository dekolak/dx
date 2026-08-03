-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "linkedInstallationId" TEXT,
ADD COLUMN     "linkedSoftwareItemId" TEXT;

-- CreateIndex
CREATE INDEX "Entry_linkedInstallationId_idx" ON "Entry"("linkedInstallationId");

-- CreateIndex
CREATE INDEX "Entry_linkedSoftwareItemId_idx" ON "Entry"("linkedSoftwareItemId");

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_linkedInstallationId_fkey" FOREIGN KEY ("linkedInstallationId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_linkedSoftwareItemId_fkey" FOREIGN KEY ("linkedSoftwareItemId") REFERENCES "SoftwareItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
