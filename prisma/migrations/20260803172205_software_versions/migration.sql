-- AlterTable
ALTER TABLE "SoftwareItem" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "SoftwareVersion" (
    "id" TEXT NOT NULL,
    "softwareItemId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "note" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoftwareVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SoftwareVersion_softwareItemId_idx" ON "SoftwareVersion"("softwareItemId");

-- AddForeignKey
ALTER TABLE "SoftwareVersion" ADD CONSTRAINT "SoftwareVersion_softwareItemId_fkey" FOREIGN KEY ("softwareItemId") REFERENCES "SoftwareItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
