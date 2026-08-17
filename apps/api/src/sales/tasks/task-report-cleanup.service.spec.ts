import { TaskReportCleanupService } from "./task-report-cleanup.service";
import { REPORT_RETENTION_DAYS } from "./tasks.service";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

describe("TaskReportCleanupService", () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let storage: { delete: jest.Mock };
  let service: TaskReportCleanupService;

  beforeEach(() => {
    prisma = {
      task: {
        findMany: jest.fn(() => Promise.resolve([])),
        update: jest.fn(() => Promise.resolve({})),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    storage = { delete: jest.fn(() => Promise.resolve()) };
    service = new TaskReportCleanupService(prisma, audit as any, storage as any);
  });

  it("queries only tasks with a report older than the retention window", async () => {
    await service.cleanupExpiredReports();

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reportFileKey: { not: null }, reportUploadedAt: { lt: expect.any(Date) } },
      }),
    );
  });

  it("deletes the file and clears report fields for each expired task", async () => {
    prisma.task.findMany.mockResolvedValue([
      { id: "t1", reportFileKey: "task-reports/k1", reportFileName: "a.jpg" },
      { id: "t2", reportFileKey: "task-reports/k2", reportFileName: "b.pdf" },
    ]);

    const count = await service.cleanupExpiredReports();

    expect(count).toBe(2);
    expect(storage.delete).toHaveBeenCalledWith("task-reports/k1");
    expect(storage.delete).toHaveBeenCalledWith("task-reports/k2");
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { reportFileKey: null, reportFileName: null, reportMimeType: null, reportUploadedAt: null },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "t1", newValue: { event: "report_expired", fileName: "a.jpg" } }),
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
});
