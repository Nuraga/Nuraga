import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { TasksService } from "./tasks.service";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "u1",
    email: "u1@example.com",
    phone: null,
    fullName: "Test",
    grants: [],
    hasNetworkAccess: false,
    ...overrides,
  };
}

describe("TasksService", () => {
  const branchId = "b1";
  const manager = user({ id: "mgr1", grants: [{ branchId, role: "MANAGER" }] });
  const branchManager = user({ id: "bm1", grants: [{ branchId, role: "BRANCH_MANAGER" }] });
  const teacher = user({ id: "teacher1", grants: [{ branchId, role: "TEACHER" }] });
  const otherTeacher = user({ id: "teacher2", grants: [{ branchId, role: "TEACHER" }] });
  const methodist = user({ id: "meth1", grants: [{ branchId, role: "METHODIST" }] });

  let prisma: any;
  let audit: { record: jest.Mock };
  let fileUrls: { sign: jest.Mock };
  let storage: { save: jest.Mock; delete: jest.Mock };
  let notifications: { create: jest.Mock };
  let branchScope: BranchScopeService;
  let service: TasksService;

  beforeEach(() => {
    prisma = {
      task: {
        findMany: jest.fn(() => Promise.resolve([])),
        create: jest.fn((args: any) => Promise.resolve({ id: "t1", status: "TODO", ...args.data })),
        update: jest.fn((args: any) => Promise.resolve({ id: "t1", ...args.data })),
        findUnique: jest.fn(() =>
          Promise.resolve({
            id: "t1",
            branchId,
            leadId: "lead1",
            familyId: null,
            assignedToId: "teacher1",
            status: "TODO",
            completedAt: null,
            reportFileKey: null,
            reportFileName: null,
            reportMimeType: null,
            reportUploadedAt: null,
          }),
        ),
      },
      lead: { findUnique: jest.fn(() => Promise.resolve({ id: "lead1", branchId })) },
      family: { findUnique: jest.fn(() => Promise.resolve({ id: "fam1", branchId })) },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    fileUrls = { sign: jest.fn(() => Promise.resolve("signed-token")) };
    storage = { save: jest.fn(() => Promise.resolve()), delete: jest.fn(() => Promise.resolve()) };
    notifications = { create: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new TasksService(
      prisma,
      branchScope,
      audit as any,
      fileUrls as any,
      storage as any,
      notifications as any,
    );
  });

  describe("create", () => {
    it("rejects a role without task write access", async () => {
      await expect(
        service.create(teacher, branchId, { leadId: "lead1", description: "x", dueAt: "2026-09-01", assignedToId: "u2" } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it("creates a general staff task when neither leadId nor familyId is given", async () => {
      const task = await service.create(branchManager, branchId, {
        description: "Проверить группу",
        dueAt: "2026-09-01",
        assignedToId: "teacher1",
      } as any);
      expect(task).toMatchObject({ branchId, leadId: undefined, familyId: undefined, description: "Проверить группу" });
    });

    it("allows a METHODIST to create a general staff task (даёт задания воспитателям/няням)", async () => {
      const task = await service.create(methodist, branchId, {
        description: "Проверить группу",
        dueAt: "2026-09-01",
        assignedToId: "teacher1",
      } as any);
      expect(task).toMatchObject({ description: "Проверить группу" });
    });

    it("rejects a sales manager (MANAGER) from creating a general staff task", async () => {
      await expect(
        service.create(manager, branchId, {
          description: "Проверить группу",
          dueAt: "2026-09-01",
          assignedToId: "teacher1",
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects when both leadId and familyId are given", async () => {
      await expect(
        service.create(manager, branchId, {
          leadId: "lead1",
          familyId: "fam1",
          description: "x",
          dueAt: "2026-09-01",
          assignedToId: "u2",
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates a lead-linked task", async () => {
      const task = await service.create(manager, branchId, {
        leadId: "lead1",
        description: "Перезвонить",
        dueAt: "2026-09-01",
        assignedToId: "u2",
      } as any);
      expect(task).toMatchObject({ branchId, leadId: "lead1", description: "Перезвонить" });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "task", action: "create" }));
    });
  });

  describe("list", () => {
    it("rejects a role without task read access when listing branch-wide", async () => {
      await expect(service.list(teacher, branchId, {})).rejects.toThrow(ForbiddenException);
    });

    it("allows a teacher to list only their own tasks", async () => {
      await expect(service.list(teacher, branchId, { assignedToId: "teacher1" })).resolves.toEqual([]);
    });

    it("rejects a teacher trying to list someone else's tasks", async () => {
      await expect(service.list(teacher, branchId, { assignedToId: "mgr1" })).rejects.toThrow(ForbiddenException);
    });

    it("allows a branch manager to list the branch-wide staff board", async () => {
      await expect(service.list(branchManager, branchId, { scope: "staff" })).resolves.toEqual([]);
    });

    it("rejects a sales manager (MANAGER) from listing the staff board", async () => {
      await expect(service.list(manager, branchId, { scope: "staff" })).rejects.toThrow(ForbiddenException);
    });
  });

  describe("complete", () => {
    it("404s when the task belongs to a different branch", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "t1",
        branchId: "other-branch",
        leadId: "lead1",
        familyId: null,
        assignedToId: "teacher1",
        status: "TODO",
        completedAt: null,
      });
      await expect(service.complete(manager, branchId, "t1")).rejects.toThrow(NotFoundException);
    });

    it("sets completedAt", async () => {
      const task = await service.complete(manager, branchId, "t1");
      expect(task.completedAt).toBeInstanceOf(Date);
    });
  });

  describe("updateStatus", () => {
    it("allows the assignee to move their own task", async () => {
      const task = await service.updateStatus(teacher, branchId, "t1", "IN_PROGRESS");
      expect(task.status).toBe("IN_PROGRESS");
      expect(task.completedAt).toBeNull();
    });

    it("rejects a different staff member moving someone else's task", async () => {
      await expect(service.updateStatus(otherTeacher, branchId, "t1", "IN_PROGRESS")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("allows a manager to move any task regardless of assignee", async () => {
      const task = await service.updateStatus(manager, branchId, "t1", "DONE");
      expect(task.status).toBe("DONE");
      expect(task.completedAt).toBeInstanceOf(Date);
    });

    it("clears completedAt when moved away from DONE", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "t1",
        branchId,
        leadId: "lead1",
        familyId: null,
        assignedToId: "teacher1",
        status: "DONE",
        completedAt: new Date("2026-08-01"),
      });
      const task = await service.updateStatus(teacher, branchId, "t1", "TODO");
      expect(task.completedAt).toBeNull();
    });

    it("rejects a sales manager (MANAGER) from moving someone else's general staff task", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "t1",
        branchId,
        leadId: null,
        familyId: null,
        assignedToId: "teacher1",
        status: "TODO",
        completedAt: null,
      });
      await expect(service.updateStatus(manager, branchId, "t1", "IN_PROGRESS")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("allows a branch manager to move someone else's general staff task", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "t1",
        branchId,
        leadId: null,
        familyId: null,
        assignedToId: "teacher1",
        status: "TODO",
        completedAt: null,
      });
      const task = await service.updateStatus(branchManager, branchId, "t1", "IN_PROGRESS");
      expect(task.status).toBe("IN_PROGRESS");
    });
  });

  describe("notifications", () => {
    /** Task assigned to teacher1 by branchManager (bm1), in the given status. */
    function assignedTask(status = "TODO") {
      prisma.task.findUnique.mockResolvedValue({
        id: "t1",
        branchId,
        leadId: null,
        familyId: null,
        description: "Проверить группу",
        assignedToId: "teacher1",
        createdById: "bm1",
        status,
        completedAt: null,
        reportFileKey: null,
        reportFileName: null,
        reportMimeType: null,
        reportUploadedAt: null,
      });
    }

    it("notifies the assignee when a task is created for them", async () => {
      await service.create(branchManager, branchId, {
        description: "Проверить группу",
        dueAt: "2026-09-01",
        assignedToId: "teacher1",
      } as any);

      expect(notifications.create).toHaveBeenCalledWith(
        "teacher1",
        "TASK_ASSIGNED",
        expect.stringContaining("Проверить группу"),
      );
    });

    it("records who assigned the task, so the completion can be reported back", async () => {
      await service.create(branchManager, branchId, {
        description: "Проверить группу",
        dueAt: "2026-09-01",
        assignedToId: "teacher1",
      } as any);

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ createdById: "bm1" }) }),
      );
    });

    it("does not notify anyone when a manager assigns a task to themselves", async () => {
      await service.create(branchManager, branchId, {
        description: "Своя задача",
        dueAt: "2026-09-01",
        assignedToId: "bm1",
      } as any);

      expect(notifications.create).not.toHaveBeenCalled();
    });

    it("notifies the assigner when the assignee marks the task DONE", async () => {
      assignedTask("IN_PROGRESS");

      await service.updateStatus(teacher, branchId, "t1", "DONE");

      expect(notifications.create).toHaveBeenCalledWith(
        "bm1",
        "TASK_COMPLETED",
        expect.stringContaining("Проверить группу"),
      );
    });

    it("does not re-notify when an already-DONE task is moved to DONE again", async () => {
      assignedTask("DONE");

      await service.updateStatus(teacher, branchId, "t1", "DONE");

      expect(notifications.create).not.toHaveBeenCalled();
    });

    it("does not notify on intermediate status moves", async () => {
      assignedTask("TODO");

      await service.updateStatus(teacher, branchId, "t1", "IN_PROGRESS");

      expect(notifications.create).not.toHaveBeenCalled();
    });

    it("does not notify the assigner when they complete the task themselves", async () => {
      assignedTask("TODO");

      await service.updateStatus(branchManager, branchId, "t1", "DONE");

      expect(notifications.create).not.toHaveBeenCalled();
    });

    it("stays silent for legacy tasks that predate createdById", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "t1",
        branchId,
        leadId: null,
        familyId: null,
        description: "Старая задача",
        assignedToId: "teacher1",
        createdById: null,
        status: "TODO",
        completedAt: null,
      });

      await service.updateStatus(teacher, branchId, "t1", "DONE");

      expect(notifications.create).not.toHaveBeenCalled();
    });

    it("notifies the assigner when the assignee attaches a report", async () => {
      assignedTask("IN_PROGRESS");

      await service.attachReport(teacher, branchId, "t1", {
        buffer: Buffer.from("x"),
        mimetype: "image/jpeg",
        originalname: "отчёт.jpg",
      });

      expect(notifications.create).toHaveBeenCalledWith(
        "bm1",
        "TASK_REPORT_SUBMITTED",
        expect.stringContaining("Проверить группу"),
      );
    });
  });

  describe("attachReport", () => {
    const file = { buffer: Buffer.from("x"), mimetype: "image/jpeg", originalname: "отчёт.jpg" };

    it("rejects a staff member who isn't the assignee and has no management role", async () => {
      await expect(service.attachReport(otherTeacher, branchId, "t1", file)).rejects.toThrow(ForbiddenException);
    });

    it("lets the assignee attach a report and returns a signed download URL", async () => {
      const task = await service.attachReport(teacher, branchId, "t1", file);

      expect(storage.save).toHaveBeenCalledWith(
        expect.stringContaining(`task-reports/${branchId}/t1/`),
        file.buffer,
        "image/jpeg",
      );
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reportFileName: "отчёт.jpg", reportUploadedAt: expect.any(Date) }),
        }),
      );
      expect(task.reportDownloadUrl).toBe("/api/files/signed-token");
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ newValue: { event: "report_attached", fileName: "отчёт.jpg" } }),
      );
    });

    it("deletes the previous file when replacing an existing report", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "t1",
        branchId,
        leadId: "lead1",
        familyId: null,
        assignedToId: "teacher1",
        status: "TODO",
        completedAt: null,
        reportFileKey: "task-reports/old-key",
        reportFileName: "old.pdf",
        reportMimeType: "application/pdf",
        reportUploadedAt: new Date("2026-08-01"),
      });

      await service.attachReport(teacher, branchId, "t1", file);

      expect(storage.delete).toHaveBeenCalledWith("task-reports/old-key");
    });
  });

  describe("removeReport", () => {
    it("rejects a staff member who isn't the assignee and has no management role", async () => {
      await expect(service.removeReport(otherTeacher, branchId, "t1")).rejects.toThrow(ForbiddenException);
    });

    it("is a no-op when there is no report attached", async () => {
      const task = await service.removeReport(teacher, branchId, "t1");
      expect(storage.delete).not.toHaveBeenCalled();
      expect(task.reportDownloadUrl).toBeNull();
    });

    it("deletes the file and clears the report fields", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "t1",
        branchId,
        leadId: "lead1",
        familyId: null,
        assignedToId: "teacher1",
        status: "TODO",
        completedAt: null,
        reportFileKey: "task-reports/key1",
        reportFileName: "report.jpg",
        reportMimeType: "image/jpeg",
        reportUploadedAt: new Date("2026-08-01"),
      });

      await service.removeReport(teacher, branchId, "t1");

      expect(storage.delete).toHaveBeenCalledWith("task-reports/key1");
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reportFileKey: null, reportFileName: null, reportMimeType: null, reportUploadedAt: null },
        }),
      );
    });
  });
});
