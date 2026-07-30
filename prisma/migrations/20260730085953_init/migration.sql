-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Piece" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Piece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Point" (
    "id" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "num" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Point_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftwareItem" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SoftwareItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "shareable" BOOLEAN NOT NULL DEFAULT false,
    "shareToken" TEXT,
    "pointId" TEXT,
    "softwareItemId" TEXT,
    "linkedPieceId" TEXT,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "Machine_organizationId_idx" ON "Machine"("organizationId");

-- CreateIndex
CREATE INDEX "Machine_deletedAt_idx" ON "Machine"("deletedAt");

-- CreateIndex
CREATE INDEX "Piece_machineId_idx" ON "Piece"("machineId");

-- CreateIndex
CREATE INDEX "Piece_deletedAt_idx" ON "Piece"("deletedAt");

-- CreateIndex
CREATE INDEX "Point_pieceId_idx" ON "Point"("pieceId");

-- CreateIndex
CREATE INDEX "Point_deletedAt_idx" ON "Point"("deletedAt");

-- CreateIndex
CREATE INDEX "SoftwareItem_machineId_idx" ON "SoftwareItem"("machineId");

-- CreateIndex
CREATE INDEX "SoftwareItem_deletedAt_idx" ON "SoftwareItem"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_shareToken_key" ON "Entry"("shareToken");

-- CreateIndex
CREATE INDEX "Entry_organizationId_idx" ON "Entry"("organizationId");

-- CreateIndex
CREATE INDEX "Entry_type_idx" ON "Entry"("type");

-- CreateIndex
CREATE INDEX "Entry_pointId_idx" ON "Entry"("pointId");

-- CreateIndex
CREATE INDEX "Entry_softwareItemId_idx" ON "Entry"("softwareItemId");

-- CreateIndex
CREATE INDEX "Entry_linkedPieceId_idx" ON "Entry"("linkedPieceId");

-- CreateIndex
CREATE INDEX "Entry_deletedAt_idx" ON "Entry"("deletedAt");

-- CreateIndex
CREATE INDEX "Entry_createdAt_idx" ON "Entry"("createdAt");

-- CreateIndex
CREATE INDEX "Media_entryId_idx" ON "Media"("entryId");

-- CreateIndex
CREATE INDEX "Media_deletedAt_idx" ON "Media"("deletedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Point" ADD CONSTRAINT "Point_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareItem" ADD CONSTRAINT "SoftwareItem_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_softwareItemId_fkey" FOREIGN KEY ("softwareItemId") REFERENCES "SoftwareItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_linkedPieceId_fkey" FOREIGN KEY ("linkedPieceId") REFERENCES "Piece"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
