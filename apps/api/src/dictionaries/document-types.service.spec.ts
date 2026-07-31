import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { DocumentTypesService } from "./document-types.service";
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

describe("DocumentTypesService", () => {
  let prisma: { documentType: Record<string, jest.Mock> };
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: DocumentTypesService;

  const owner = user({ hasNetworkAccess: true, grants: [{ branchId: "b1", role: "OWNER" }] });
  const manager = user({ grants: [{ branchId: "b1", role: "BRANCH_MANAGER" }] });

  beforeEach(() => {
    prisma = {
      documentType: {
        create: jest.fn((args: any) => Promise.resolve({ id: "dt1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() =>
          Promise.resolve({ id: "dt1", name: "Медицинская справка", hasExpiry: true }),
        ),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new DocumentTypesService(prisma as any, branchScope, audit as any);
  });

  it("rejects creation from a non-network-admin role", async () => {
    await expect(service.create(manager, { name: "Справка" })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("allows Owner to create a document type and records an audit entry", async () => {
    const docType = await service.create(owner, { name: "Справка", hasExpiry: true });
    expect(docType).toMatchObject({ name: "Справка", hasExpiry: true });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "document_type", action: "create" }),
    );
  });

  it("raises NotFoundException when updating a missing document type", async () => {
    prisma.documentType.findUnique.mockResolvedValue(null);
    await expect(service.update(owner, "missing", { name: "X" })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("archive() sets isActive to false", async () => {
    const result = await service.archive(owner, "dt1");
    expect(result).toMatchObject({ isActive: false });
  });
});
