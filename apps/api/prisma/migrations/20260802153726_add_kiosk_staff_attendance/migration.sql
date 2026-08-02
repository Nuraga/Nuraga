-- CreateEnum
CREATE TYPE "StaffAttendanceEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "StaffAttendanceEventSource" AS ENUM ('QR', 'MANUAL_CORRECTION');

-- CreateTable
CREATE TABLE "device" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_attendance_event" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" "StaffAttendanceEventType" NOT NULL,
    "source" "StaffAttendanceEventSource" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "deviceId" TEXT,
    "correctionReason" TEXT,
    "correctionById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_attendance_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_branchId_idx" ON "device"("branchId");

-- CreateIndex
CREATE INDEX "staff_attendance_event_staffId_occurredAt_idx" ON "staff_attendance_event"("staffId", "occurredAt");

-- CreateIndex
CREATE INDEX "staff_attendance_event_branchId_occurredAt_idx" ON "staff_attendance_event"("branchId", "occurredAt");

-- AddForeignKey
ALTER TABLE "device" ADD CONSTRAINT "device_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_event" ADD CONSTRAINT "staff_attendance_event_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_event" ADD CONSTRAINT "staff_attendance_event_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_event" ADD CONSTRAINT "staff_attendance_event_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
