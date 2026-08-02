import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { LeadSourcesService } from "./lead-sources.service";
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

describe("LeadSourcesService", () => {
  let prisma: { leadSource: Record<string, jest.Mock> };
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: LeadSourcesService;

  const owner = user({ hasNetworkAccess: true, grants: [{ branchId: "b1", role: "OWNER" }] });
  const manager = user({ grants: [{ branchId: "b1", role: "MANAGER" }] });

  beforeEach(() => {
    prisma = {
      leadSource: {
        create: jest.fn((args: any) => Promise.resolve({ id: "ls1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() => Promise.resolve({ id: "ls1", name: "Сайт" })),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new LeadSourcesService(prisma as any, branchScope, audit as any);
  });

  it("rejects creation from a non-network-admin role", async () => {
    await expect(service.create(manager, { name: "Сайт" })).rejects.toThrow(ForbiddenException);
  });

  it("allows Owner to create a lead source and records an audit entry", async () => {
    const source = await service.create(owner, { name: "Сайт" });
    expect(source).toMatchObject({ name: "Сайт" });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "lead_source", action: "create" }),
    );
  });

  it("raises NotFoundException when updating a missing source", async () => {
    prisma.leadSource.findUnique.mockResolvedValue(null);
    await expect(service.update(owner, "missing", { name: "X" })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("archive() sets isActive to false", async () => {
    const result = await service.archive(owner, "ls1");
    expect(result).toMatchObject({ isActive: false });
  });
});
