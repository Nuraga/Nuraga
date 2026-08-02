import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { LeadRejectionReasonsService } from "./lead-rejection-reasons.service";
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

describe("LeadRejectionReasonsService", () => {
  let prisma: { leadRejectionReason: Record<string, jest.Mock> };
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: LeadRejectionReasonsService;

  const owner = user({ hasNetworkAccess: true, grants: [{ branchId: "b1", role: "OWNER" }] });
  const manager = user({ grants: [{ branchId: "b1", role: "MANAGER" }] });

  beforeEach(() => {
    prisma = {
      leadRejectionReason: {
        create: jest.fn((args: any) => Promise.resolve({ id: "lr1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() => Promise.resolve({ id: "lr1", name: "Дорого" })),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new LeadRejectionReasonsService(prisma as any, branchScope, audit as any);
  });

  it("rejects creation from a non-network-admin role", async () => {
    await expect(service.create(manager, { name: "Дорого" })).rejects.toThrow(ForbiddenException);
  });

  it("allows Owner to create a rejection reason and records an audit entry", async () => {
    const reason = await service.create(owner, { name: "Дорого" });
    expect(reason).toMatchObject({ name: "Дорого" });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "lead_rejection_reason", action: "create" }),
    );
  });

  it("raises NotFoundException when updating a missing reason", async () => {
    prisma.leadRejectionReason.findUnique.mockResolvedValue(null);
    await expect(service.update(owner, "missing", { name: "X" })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("archive() sets isActive to false", async () => {
    const result = await service.archive(owner, "lr1");
    expect(result).toMatchObject({ isActive: false });
  });
});
