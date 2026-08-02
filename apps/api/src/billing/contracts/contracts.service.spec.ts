import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { ContractsService } from "./contracts.service";
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

describe("ContractsService", () => {
  const branchId = "b1";
  const owner = user({ grants: [{ branchId, role: "OWNER" }] });
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });
  const teacher = user({ grants: [{ branchId, role: "TEACHER" }] });

  const validDto = {
    familyId: "f1",
    childId: "c1",
    tariffId: "t1",
    number: "D-001",
    startDate: "2026-09-01",
  };

  let prisma: any;
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: ContractsService;

  beforeEach(() => {
    prisma = {
      contract: {
        create: jest.fn((args: any) => Promise.resolve({ id: "ct1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() =>
          Promise.resolve({ id: "ct1", familyId: "f1", tariffId: "t1", status: "ACTIVE" }),
        ),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
      family: { findUnique: jest.fn(() => Promise.resolve({ id: "f1", branchId })) },
      child: { findUnique: jest.fn(() => Promise.resolve({ id: "c1", familyId: "f1" })) },
      tariff: {
        findUnique: jest.fn(() => Promise.resolve({ id: "t1", branchId: null, isActive: true })),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new ContractsService(prisma, branchScope, audit as any);
  });

  it("rejects creation from Teacher", async () => {
    await expect(service.create(teacher, branchId, validDto)).rejects.toThrow(ForbiddenException);
  });

  it("rejects a child that doesn't belong to the given family", async () => {
    prisma.child.findUnique.mockResolvedValue({ id: "c1", familyId: "other-family" });
    await expect(service.create(manager, branchId, validDto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("rejects a tariff scoped to a different branch", async () => {
    prisma.tariff.findUnique.mockResolvedValue({ id: "t1", branchId: "other-branch", isActive: true });
    await expect(service.create(manager, branchId, validDto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("rejects an archived tariff", async () => {
    prisma.tariff.findUnique.mockResolvedValue({ id: "t1", branchId: null, isActive: false });
    await expect(service.create(manager, branchId, validDto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("creates an ACTIVE contract and records an audit entry", async () => {
    const contract = await service.create(manager, branchId, validDto);
    expect(contract).toMatchObject({ status: "ACTIVE", number: "D-001" });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "contract" }));
  });

  it("rejects update from Manager (create-only role)", async () => {
    await expect(service.update(manager, branchId, "ct1", { number: "D-002" })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("changeTariff records old and new tariffId in the audit entry", async () => {
    await service.changeTariff(owner, branchId, "ct1", { tariffId: "t2" });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        oldValue: { tariffId: "t1" },
        newValue: expect.objectContaining({ event: "tariff_change", tariffId: "t2" }),
      }),
    );
  });

  it("rejects terminate from Branch Manager (Owner-only)", async () => {
    const branchManager = user({ grants: [{ branchId, role: "BRANCH_MANAGER" }] });
    await expect(service.terminate(branchManager, branchId, "ct1")).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("terminate() sets status to TERMINATED", async () => {
    const result = await service.terminate(owner, branchId, "ct1");
    expect(result).toMatchObject({ status: "TERMINATED" });
  });
});
