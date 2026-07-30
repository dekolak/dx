-- AlterTable
ALTER TABLE "Point" ADD COLUMN     "photoEnsembleId" TEXT,
ADD COLUMN     "targetPieceId" TEXT,
ALTER COLUMN "pieceId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PhotoEnsemble" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PhotoEnsemble_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoEnsemble_installationId_idx" ON "PhotoEnsemble"("installationId");

-- CreateIndex
CREATE INDEX "PhotoEnsemble_deletedAt_idx" ON "PhotoEnsemble"("deletedAt");

-- CreateIndex
CREATE INDEX "Point_photoEnsembleId_idx" ON "Point"("photoEnsembleId");

-- CreateIndex
CREATE INDEX "Point_targetPieceId_idx" ON "Point"("targetPieceId");

-- AddForeignKey
ALTER TABLE "PhotoEnsemble" ADD CONSTRAINT "PhotoEnsemble_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Point" ADD CONSTRAINT "Point_photoEnsembleId_fkey" FOREIGN KEY ("photoEnsembleId") REFERENCES "PhotoEnsemble"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Point" ADD CONSTRAINT "Point_targetPieceId_fkey" FOREIGN KEY ("targetPieceId") REFERENCES "Piece"("id") ON DELETE SET NULL ON UPDATE CASCADE;
