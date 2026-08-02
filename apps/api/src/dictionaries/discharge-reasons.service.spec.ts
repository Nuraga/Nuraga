import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { DischargeReasonsService } from "./discharge-reasons.service";
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

describe("DischargeReasonsService", () => {
  let prisma: { dischargeReason: Record<string, jest.Mock> };
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: DischargeReasonsService;

  const owner = user({ hasNetworkAccess: true, grants: [{ branchId: "b1", role: "OWNER" }] });
  const manager = user({ grants: [{ branchId: "b1", role: "BRANCH_MANAGER" }] });

  beforeEach(() => {
    prisma = {
      dischargeReason: {
        create: jest.fn((args: any) => Promise.resolve({ id: "dr1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() => Promise.resolve({ id: "dr1", name: "Выпуск" })),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new DischargeReasonsService(prisma as any, branchScope, audit as any);
  });

  it("rejects creation from a non-network-admin role", async () => {
    await expect(service.create(manager, { name: "Иное" })).rejects.toThrow(ForbiddenException);
  });

  it("allows Owner to create a discharge reason and records an audit entry", async () => {
    const reason = await service.create(owner, { name: "Иное" });
    expect(reason).toMatchObject({ name: "Иное" });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "discharge_reason", action: "create" }),
    );
  });

  it("raises NotFoundException when updating a missing reason", async () => {
    prisma.dischargeReason.findUnique.mockResolvedValue(null);
    await expect(service.update(owner, "missing", { name: "X" })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("archive() sets isActive to false", async () => {
    const result = await service.archive(owner, "dr1");
    expect(result).toMatchObject({ isActive: false });
  });
});
