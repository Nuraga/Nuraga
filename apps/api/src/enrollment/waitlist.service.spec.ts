import { BadRequestException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { WaitlistService } from "./waitlist.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import type { ChildAccessService } from "../children/child-access.service";

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

describe("WaitlistService", () => {
  const branchId = "b1";
  const groupId = "g1";
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });

  let prisma: any;
  let childAccess: { assertWriteAccess: jest.Mock };
  let audit: { record: jest.Mock };
  let service: WaitlistService;

  beforeEach(() => {
    prisma = {
      group: { findUnique: jest.fn(() => Promise.resolve({ id: groupId, branchId })) },
      child: {
        findUnique: jest.fn(() => Promise.resolve({ id: "c1", familyId: "f1", status: "WAITLIST" })),
      },
      family: { findUnique: jest.fn(() => Promise.resolve({ id: "f1", branchId })) },
      waitlistEntry: {
        create: jest.fn((args: any) => Promise.resolve({ id: "w1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() => Promise.resolve({ id: "w1", branchId, groupId })),
        delete: jest.fn(() => Promise.resolve()),
      },
    };
    childAccess = { assertWriteAccess: jest.fn() };
    audit = { record: jest.fn(() => Promise.resolve()) };
    service = new WaitlistService(
      prisma,
      new BranchScopeService(),
      childAccess as unknown as ChildAccessService,
      audit as any,
    );
  });

  it("adds a child to the waitlist with default priority 0", async () => {
    const entry = await service.add(manager, branchId, groupId, { childId: "c1" });
    expect(entry).toMatchObject({ branchId, groupId, childId: "c1", priority: 0 });
  });

  it("rejects waitlisting a discharged child", async () => {
    prisma.child.findUnique.mockResolvedValue({ id: "c1", familyId: "f1", status: "DISCHARGED" });
    await expect(service.add(manager, branchId, groupId, { childId: "c1" })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("orders candidates by priority desc, then queue time asc", async () => {
    await service.list(manager, branchId, groupId);
    expect(prisma.waitlistEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ priority: "desc" }, { queuedAt: "asc" }],
      }),
    );
  });

  it("404s remove() when the entry belongs to a different group", async () => {
    prisma.waitlistEntry.findUnique.mockResolvedValue({ id: "w1", branchId, groupId: "other-group" });
    await expect(service.remove(manager, branchId, groupId, "w1")).rejects.toThrow(
      NotFoundException,
    );
  });
});
