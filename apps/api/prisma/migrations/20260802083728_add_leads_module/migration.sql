-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'TOUR_SCHEDULED', 'TOUR_DONE', 'TRIAL_DAY', 'CONTRACT_SIGNING', 'ENROLLED', 'REJECTED', 'WAITLISTED');

-- AlterTable
ALTER TABLE "waitlist_entry" ADD COLUMN     "leadId" TEXT;

-- CreateTable
CREATE TABLE "lead_source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lead_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_rejection_reason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lead_rejection_reason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "parentFullName" TEXT NOT NULL,
    "parentPhone" TEXT NOT NULL,
    "parentPhoneNormalized" TEXT NOT NULL,
    "parentEmail" TEXT,
    "childFullName" TEXT,
    "childBirthDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "sourceId" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rejectionReasonId" TEXT,
    "rejectionComment" TEXT,
    "responsibleUserId" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "convertedFamilyId" TEXT,
    "convertedChildId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "familyId" TEXT,
    "description" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_source_name_key" ON "lead_source"("name");

-- CreateIndex
CREATE UNIQUE INDEX "lead_rejection_reason_name_key" ON "lead_rejection_reason"("name");

-- CreateIndex
CREATE INDEX "lead_branchId_stage_idx" ON "lead"("branchId", "stage");

-- CreateIndex
CREATE INDEX "lead_parentPhoneNormalized_idx" ON "lead"("parentPhoneNormalized");

-- CreateIndex
CREATE INDEX "lead_activity_leadId_idx" ON "lead_activity"("leadId");

-- CreateIndex
CREATE INDEX "task_leadId_idx" ON "task"("leadId");

-- CreateIndex
CREATE INDEX "task_familyId_idx" ON "task"("familyId");

-- CreateIndex
CREATE INDEX "task_assignedToId_idx" ON "task"("assignedToId");

-- AddForeignKey
ALTER TABLE "waitlist_entry" ADD CONSTRAINT "waitlist_entry_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "lead_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_rejectionReasonId_fkey" FOREIGN KEY ("rejectionReasonId") REFERENCES "lead_rejection_reason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
