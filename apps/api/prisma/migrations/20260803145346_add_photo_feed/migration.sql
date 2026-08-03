-- CreateTable
CREATE TABLE "photo" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_photo_consent" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByParentId" TEXT,

    CONSTRAINT "child_photo_consent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "photo_branchId_idx" ON "photo"("branchId");

-- CreateIndex
CREATE INDEX "photo_groupId_takenAt_idx" ON "photo"("groupId", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "child_photo_consent_childId_key" ON "child_photo_consent"("childId");

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_photo_consent" ADD CONSTRAINT "child_photo_consent_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_photo_consent" ADD CONSTRAINT "child_photo_consent_updatedByParentId_fkey" FOREIGN KEY ("updatedByParentId") REFERENCES "parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
