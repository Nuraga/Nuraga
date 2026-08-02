-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'OWNER', 'BRANCH_MANAGER', 'MANAGER', 'ACCOUNTANT', 'TEACHER', 'PARENT');

-- CreateEnum
CREATE TYPE "ChildStatus" AS ENUM ('WAITLIST', 'ENROLLED', 'SUSPENDED', 'DISCHARGED');

-- CreateEnum
CREATE TYPE "DocumentOwnerType" AS ENUM ('CHILD', 'STAFF');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT_SICK', 'ABSENT_EXCUSED', 'VACATION', 'LATE', 'UNMARKED');

-- CreateEnum
CREATE TYPE "TimesheetPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_branch_role" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "user_branch_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_type" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minAgeMonths" INTEGER NOT NULL,
    "maxAgeMonths" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "group_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "groupTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plannedCapacity" INTEGER NOT NULL,
    "maxCapacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "contactPriority" INTEGER NOT NULL DEFAULT 1,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_person" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "documentInfo" TEXT,
    "photoKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trusted_person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "groupId" TEXT,
    "fullName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "sex" TEXT,
    "photoKey" TEXT,
    "status" "ChildStatus" NOT NULL DEFAULT 'WAITLIST',
    "enrolledAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "discharedAt" TIMESTAMP(3),
    "dischargeReasonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_medical" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "allergiesEnc" TEXT,
    "chronicEnc" TEXT,
    "activityLimitsEnc" TEXT,
    "doctorContactEnc" TEXT,
    "criticalInfo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_medical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_history_entry" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromGroupId" TEXT,
    "toGroupId" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "child_history_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_type" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hasExpiry" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "document_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" TEXT NOT NULL,
    "ownerType" "DocumentOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discharge_reason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "discharge_reason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_entry" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "childId" TEXT,
    "leadName" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'UNMARKED',
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "pickedUpById" TEXT,
    "pickedUpByType" TEXT,
    "markedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_period" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "TimesheetPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheet_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_correction" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheet_correction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "hiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_group" (
    "staffId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "staff_group_pkey" PRIMARY KEY ("staffId","groupId")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "actorId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_key" ON "user"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_tokenHash_key" ON "refresh_token"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_token_userId_idx" ON "refresh_token"("userId");

-- CreateIndex
CREATE INDEX "user_branch_role_branchId_idx" ON "user_branch_role"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "user_branch_role_userId_branchId_role_key" ON "user_branch_role"("userId", "branchId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "group_type_name_key" ON "group_type"("name");

-- CreateIndex
CREATE INDEX "group_branchId_idx" ON "group"("branchId");

-- CreateIndex
CREATE INDEX "family_branchId_idx" ON "family"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "parent_userId_key" ON "parent"("userId");

-- CreateIndex
CREATE INDEX "parent_familyId_idx" ON "parent"("familyId");

-- CreateIndex
CREATE INDEX "trusted_person_familyId_idx" ON "trusted_person"("familyId");

-- CreateIndex
CREATE INDEX "child_familyId_idx" ON "child"("familyId");

-- CreateIndex
CREATE INDEX "child_groupId_idx" ON "child"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "child_medical_childId_key" ON "child_medical"("childId");

-- CreateIndex
CREATE INDEX "child_history_entry_childId_idx" ON "child_history_entry"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "document_type_name_key" ON "document_type"("name");

-- CreateIndex
CREATE INDEX "document_ownerType_ownerId_idx" ON "document"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "document_expiresAt_idx" ON "document"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "discharge_reason_name_key" ON "discharge_reason"("name");

-- CreateIndex
CREATE INDEX "waitlist_entry_branchId_groupId_idx" ON "waitlist_entry"("branchId", "groupId");

-- CreateIndex
CREATE INDEX "attendance_groupId_date_idx" ON "attendance"("groupId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_childId_date_key" ON "attendance"("childId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_period_branchId_year_month_key" ON "timesheet_period"("branchId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "staff_userId_key" ON "staff"("userId");

-- CreateIndex
CREATE INDEX "audit_log_entity_entityId_idx" ON "audit_log"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branch_role" ADD CONSTRAINT "user_branch_role_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branch_role" ADD CONSTRAINT "user_branch_role_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group" ADD CONSTRAINT "group_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group" ADD CONSTRAINT "group_groupTypeId_fkey" FOREIGN KEY ("groupTypeId") REFERENCES "group_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family" ADD CONSTRAINT "family_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent" ADD CONSTRAINT "parent_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent" ADD CONSTRAINT "parent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_person" ADD CONSTRAINT "trusted_person_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child" ADD CONSTRAINT "child_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child" ADD CONSTRAINT "child_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child" ADD CONSTRAINT "child_dischargeReasonId_fkey" FOREIGN KEY ("dischargeReasonId") REFERENCES "discharge_reason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_medical" ADD CONSTRAINT "child_medical_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_history_entry" ADD CONSTRAINT "child_history_entry_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "document_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_child_fk" FOREIGN KEY ("ownerId") REFERENCES "child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entry" ADD CONSTRAINT "waitlist_entry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entry" ADD CONSTRAINT "waitlist_entry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entry" ADD CONSTRAINT "waitlist_entry_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_period" ADD CONSTRAINT "timesheet_period_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_correction" ADD CONSTRAINT "timesheet_correction_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "timesheet_period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_group" ADD CONSTRAINT "staff_group_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_group" ADD CONSTRAINT "staff_group_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
