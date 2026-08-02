-- CreateEnum
CREATE TYPE "AbsenceRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "absence_request" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "dateFrom" DATE NOT NULL,
    "dateTo" DATE NOT NULL,
    "reason" TEXT,
    "status" "AbsenceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "submittedByParentId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "absence_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "absence_request_childId_idx" ON "absence_request"("childId");

-- AddForeignKey
ALTER TABLE "absence_request" ADD CONSTRAINT "absence_request_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absence_request" ADD CONSTRAINT "absence_request_submittedByParentId_fkey" FOREIGN KEY ("submittedByParentId") REFERENCES "parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
