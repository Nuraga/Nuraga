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
          }),
        ),
      },
      lead: { findUnique: jest.fn(() => Promise.resolve({ id: "lead1", branchId })) },
      family: { findUnique: jest.fn(() => Promise.resolve({ id: "fam1", branchId })) },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new TasksService(prisma, branchScope, audit as any);
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
});
