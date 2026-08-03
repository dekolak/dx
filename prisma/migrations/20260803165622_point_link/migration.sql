-- CreateTable
CREATE TABLE "PointLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "aPointId" TEXT NOT NULL,
    "bPointId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointLink_aPointId_idx" ON "PointLink"("aPointId");

-- CreateIndex
CREATE INDEX "PointLink_bPointId_idx" ON "PointLink"("bPointId");

-- CreateIndex
CREATE INDEX "PointLink_organizationId_idx" ON "PointLink"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PointLink_aPointId_bPointId_key" ON "PointLink"("aPointId", "bPointId");

-- AddForeignKey
ALTER TABLE "PointLink" ADD CONSTRAINT "PointLink_aPointId_fkey" FOREIGN KEY ("aPointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLink" ADD CONSTRAINT "PointLink_bPointId_fkey" FOREIGN KEY ("bPointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;
