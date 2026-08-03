import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { ShiftsService } from "./shifts.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

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

describe("ShiftsService", () => {
  const branchId = "b1";
  const branchManager = user({ grants: [{ branchId, role: "BRANCH_MANAGER" }] });
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });
  const teacher = user({ grants: [{ branchId, role: "TEACHER" }] });

  const staffRow = {
    id: "staff1",
    branchId,
    position: "Воспитатель",
    user: { fullName: "Иванова Анна" },
  };

  let prisma: any;
  let audit: { record: jest.Mock };
  let service: ShiftsService;

  beforeEach(() => {
    prisma = {
      shift: {
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() => Promise.resolve(null)),
        create: jest.fn((args: any) => Promise.resolve({ id: "shift1", ...args.data })),
        delete: jest.fn(() => Promise.resolve({})),
      },
      staff: {
        findUnique: jest.fn(() => Promise.resolve(staffRow)),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    service = new ShiftsService(prisma, new BranchScopeService(), audit as any);
  });

  describe("list", () => {
    it("allows a Teacher to read — the schedule isn't secret", async () => {
      await expect(service.list(teacher, branchId, "2026-08-01", "2026-08-07")).resolves.toEqual([]);
    });

    it("maps staff name and position onto each row", async () => {
      prisma.shift.findMany.mockResolvedValue([
        {
          id: "s1",
          staffId: "staff1",
          date: new Date("2026-08-03"),
          startTime: "08:00",
          endTime: "17:00",
          note: null,
          staff: staffRow,
        },
      ]);

      const rows = await service.list(branchManager, branchId, "2026-08-01", "2026-08-07");

      expect(rows).toEqual([
        {
          id: "s1",
          staffId: "staff1",
          staffFullName: "Иванова Анна",
          position: "Воспитатель",
          date: "2026-08-03",
          startTime: "08:00",
          endTime: "17:00",
          note: null,
        },
      ]);
    });
  });

  describe("create", () => {
    const dto = { staffId: "staff1", date: "2026-08-03", startTime: "08:00", endTime: "17:00" };

    it("rejects MANAGER — this is a заведующий concern, not sales", async () => {
      await expect(service.create(manager, branchId, dto as any)).rejects.toThrow(ForbiddenException);
    });

    it("rejects a Teacher entirely", async () => {
      await expect(service.create(teacher, branchId, dto as any)).rejects.toThrow(ForbiddenException);
    });

    it("rejects endTime at or before startTime", async () => {
      await expect(
        service.create(branchManager, branchId, { ...dto, endTime: "08:00" } as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(branchManager, branchId, { ...dto, endTime: "07:00" } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("404s when the staff member belongs to a different branch", async () => {
      prisma.staff.findUnique.mockResolvedValue({ ...staffRow, branchId: "other-branch" });
      await expect(service.create(branchManager, branchId, dto as any)).rejects.toThrow(NotFoundException);
    });

    it("creates the shift and audits it", async () => {
      const view = await service.create(branchManager, branchId, dto as any);

      expect(view).toMatchObject({ staffFullName: "Иванова Анна", startTime: "08:00", endTime: "17:00" });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "shift", action: "create" }));
    });
  });

  describe("remove", () => {
    it("rejects a Teacher", async () => {
      await expect(service.remove(teacher, branchId, "shift1")).rejects.toThrow(ForbiddenException);
    });

    it("404s when the shift belongs to a different branch", async () => {
      prisma.shift.findUnique.mockResolvedValue({ id: "shift1", branchId: "other-branch" });
      await expect(service.remove(branchManager, branchId, "shift1")).rejects.toThrow(NotFoundException);
    });

    it("deletes and audits", async () => {
      prisma.shift.findUnique.mockResolvedValue({ id: "shift1", branchId, staffId: "staff1", date: new Date() });
      await service.remove(branchManager, branchId, "shift1");

      expect(prisma.shift.delete).toHaveBeenCalledWith({ where: { id: "shift1" } });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "shift", action: "delete" }));
    });
  });
});
