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
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });
  const teacher = user({ grants: [{ branchId, role: "TEACHER" }] });

  let prisma: any;
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: TasksService;

  beforeEach(() => {
    prisma = {
      task: {
        findMany: jest.fn(() => Promise.resolve([])),
        create: jest.fn((args: any) => Promise.resolve({ id: "t1", ...args.data })),
        update: jest.fn((args: any) => Promise.resolve({ id: "t1", ...args.data })),
        findUnique: jest.fn(() =>
          Promise.resolve({ id: "t1", leadId: "lead1", familyId: null, lead: { branchId }, family: null }),
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

    it("rejects when neither leadId nor familyId is given", async () => {
      await expect(
        service.create(manager, branchId, { description: "x", dueAt: "2026-09-01", assignedToId: "u2" } as any),
      ).rejects.toThrow(BadRequestException);
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
      expect(task).toMatchObject({ leadId: "lead1", description: "Перезвонить" });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "task", action: "create" }));
    });
  });

  describe("complete", () => {
    it("404s when the task's lead belongs to a different branch", async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: "t1",
        leadId: "lead1",
        familyId: null,
        lead: { branchId: "other-branch" },
        family: null,
      });
      await expect(service.complete(manager, branchId, "t1")).rejects.toThrow(NotFoundException);
    });

    it("sets completedAt", async () => {
      const task = await service.complete(manager, branchId, "t1");
      expect(task.completedAt).toBeInstanceOf(Date);
    });
  });
});
