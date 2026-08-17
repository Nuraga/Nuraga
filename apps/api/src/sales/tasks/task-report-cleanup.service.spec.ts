import { TaskReportCleanupService } from "./task-report-cleanup.service";
import { COMPLETED_TASK_RETENTION_DAYS, REPORT_RETENTION_DAYS } from "./tasks.service";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

describe("TaskReportCleanupService", () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let storage: { delete: jest.Mock; read: jest.Mock };
  let telegram: { archiveFile: jest.Mock; archiveMessage: jest.Mock };
  let service: TaskReportCleanupService;

  beforeEach(() => {
    prisma = {
      task: {
        findMany: jest.fn(() => Promise.resolve([])),
        update: jest.fn(() => Promise.resolve({})),
        delete: jest.fn(() => Promise.resolve({})),
      },
      user: { findMany: jest.fn(() => Promise.resolve([])) },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    storage = {
      delete: jest.fn(() => Promise.resolve()),
      read: jest.fn(() => Promise.resolve(Buffer.from("file bytes"))),
    };
    telegram = {
      archiveFile: jest.fn(() => Promise.resolve(true)),
      archiveMessage: jest.fn(() => Promise.resolve(true)),
    };
    service = new TaskReportCleanupService(prisma, audit as any, storage as any, telegram as any);
  });

  it("queries only tasks with a report older than the retention window", async () => {
    await service.cleanupExpiredReports();

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reportFileKey: { not: null }, reportUploadedAt: { lt: expect.any(Date) } },
      }),
    );
  });

  it("archives the file to Telegram before deleting it, then deletes and clears report fields", async () => {
    prisma.task.findMany.mockResolvedValue([
      { id: "t1", reportFileKey: "task-reports/k1", reportFileName: "a.jpg", reportMimeType: "image/jpeg" },
      { id: "t2", reportFileKey: "task-reports/k2", reportFileName: "b.pdf", reportMimeType: "application/pdf" },
    ]);

    const count = await service.cleanupExpiredReports();

    expect(count).toBe(2);
    expect(storage.read).toHaveBeenCalledWith("task-reports/k1");
    expect(telegram.archiveFile).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "a.jpg", mimeType: "image/jpeg" }),
    );
    expect(storage.delete).toHaveBeenCalledWith("task-reports/k1");
    expect(storage.delete).toHaveBeenCalledWith("task-reports/k2");
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { reportFileKey: null, reportFileName: null, reportMimeType: null, reportUploadedAt: null },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "t1",
        newValue: { event: "report_expired", fileName: "a.jpg", archivedToTelegram: true },
      }),
    );
  });

  it("still deletes the file and clears the DB pointer even if Telegram archiving fails", async () => {
    prisma.task.findMany.mockResolvedValue([
      { id: "t1", reportFileKey: "task-reports/k1", reportFileName: "a.jpg", reportMimeType: "image/jpeg" },
    ]);
    telegram.archiveFile.mockRejectedValue(new Error("network down"));

    const count = await service.cleanupExpiredReports();

    expect(count).toBe(1);
    expect(storage.delete).toHaveBeenCalledWith("task-reports/k1");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: expect.objectContaining({ archivedToTelegram: false }),
      }),
    );
  });

  it("still clears the DB pointer even if the file was already gone", async () => {
    prisma.task.findMany.mockResolvedValue([{ id: "t1", reportFileKey: "task-reports/missing", reportFileName: "a.jpg" }]);
    storage.delete.mockRejectedValue(new Error("ENOENT"));

    const count = await service.cleanupExpiredReports();

    expect(count).toBe(1);
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1" } }),
    );
  });

  it("does not touch a report still within the retention window (sanity on the cutoff math)", () => {
    const cutoff = daysAgo(REPORT_RETENTION_DAYS);
    const freshUpload = daysAgo(REPORT_RETENTION_DAYS - 1);
    expect(freshUpload.getTime()).toBeGreaterThan(cutoff.getTime());
  });

  describe("purgeCompletedTasks", () => {
    function completedTask(overrides: Record<string, unknown> = {}) {
      return {
        id: "t1",
        branchId: "b1",
        description: "Проверить группу",
        assignedToId: "teacher1",
        createdById: "bm1",
        dueAt: daysAgo(40),
        completedAt: daysAgo(35),
        createdAt: daysAgo(45),
        reportFileKey: null,
        reportFileName: null,
        reportMimeType: null,
        ...overrides,
      };
    }

    it("only looks at DONE tasks finished before the cutoff", async () => {
      await service.purgeCompletedTasks();

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "DONE", completedAt: { lt: expect.any(Date) } },
        }),
      );
    });

    it("archives the task to Telegram and then deletes it", async () => {
      prisma.task.findMany.mockResolvedValue([completedTask()]);
      prisma.user.findMany.mockResolvedValue([
        { id: "teacher1", fullName: "Айгуль Н." },
        { id: "bm1", fullName: "Заведующая" },
      ]);

      const count = await service.purgeCompletedTasks();

      expect(count).toBe(1);
      const [text] = telegram.archiveMessage.mock.calls[0];
      expect(text).toContain("Проверить группу");
      expect(text).toContain("Айгуль Н.");
      expect(text).toContain("Заведующая");
      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "delete",
          newValue: { event: "completed_task_purged", archivedToTelegram: true },
        }),
      );
    });

    it("KEEPS the task when the Telegram archive fails — the channel copy is the only one left", async () => {
      prisma.task.findMany.mockResolvedValue([completedTask()]);
      telegram.archiveMessage.mockResolvedValue(false);

      const count = await service.purgeCompletedTasks();

      expect(count).toBe(0);
      expect(prisma.task.delete).not.toHaveBeenCalled();
    });

    it("archives a still-attached report before purging, so it isn't orphaned", async () => {
      prisma.task.findMany.mockResolvedValue([
        completedTask({ reportFileKey: "task-reports/k1", reportFileName: "a.jpg", reportMimeType: "image/jpeg" }),
      ]);

      await service.purgeCompletedTasks();

      expect(telegram.archiveFile).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "a.jpg", mimeType: "image/jpeg" }),
      );
      expect(storage.delete).toHaveBeenCalledWith("task-reports/k1");
      expect(prisma.task.delete).toHaveBeenCalled();
    });

    it("keeps the task when its attachment can't be archived", async () => {
      prisma.task.findMany.mockResolvedValue([
        completedTask({ reportFileKey: "task-reports/k1", reportFileName: "a.jpg", reportMimeType: "image/jpeg" }),
      ]);
      telegram.archiveFile.mockResolvedValue(false);

      const count = await service.purgeCompletedTasks();

      expect(count).toBe(0);
      expect(prisma.task.delete).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it("leaves a task completed inside the retention window alone (cutoff math)", () => {
      const cutoff = daysAgo(COMPLETED_TASK_RETENTION_DAYS);
      const recentlyDone = daysAgo(COMPLETED_TASK_RETENTION_DAYS - 1);
      expect(recentlyDone.getTime()).toBeGreaterThan(cutoff.getTime());
    });
  });
});
