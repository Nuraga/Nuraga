-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- AlterTable (branchId added nullable first, backfilled below, then required)
ALTER TABLE "task" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "status" "TaskStatus" NOT NULL DEFAULT 'TODO';

-- Backfill branchId from the task's lead/family (whichever is set) for
-- existing rows, and status from completedAt so existing "done" tasks show
-- up in the DONE kanban column.
UPDATE "task" t
SET "branchId" = COALESCE(
  (SELECT l."branchId" FROM "lead" l WHERE l.id = t."leadId"),
  (SELECT f."branchId" FROM "family" f WHERE f.id = t."familyId")
);

UPDATE "task" SET "status" = 'DONE' WHERE "completedAt" IS NOT NULL;

-- AlterTable
ALTER TABLE "task" ALTER COLUMN "branchId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "task_branchId_idx" ON "task"("branchId");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
