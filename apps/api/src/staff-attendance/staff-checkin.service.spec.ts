import { NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { StaffCheckinService } from "./staff-checkin.service";
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

describe("StaffCheckinService", () => {
  const branchId = "b1";
  const teacher = user({ id: "u1", grants: [{ branchId, role: "TEACHER" }] });

  let prisma: any;
  let tokens: { signCheckinToken: jest.Mock };
  let branchScope: BranchScopeService;
  let service: StaffCheckinService;

  beforeEach(() => {
    prisma = {
      staff: { findFirst: jest.fn(() => Promise.resolve({ id: "s1", userId: "u1", branchId })) },
    };
    tokens = { signCheckinToken: jest.fn(() => Promise.resolve("checkin-jwt")) };
    branchScope = new BranchScopeService();
    service = new StaffCheckinService(prisma, branchScope, tokens as any);
  });

  it("rejects a user with no access to the branch", async () => {
    const outsider = user({ id: "u2", grants: [] });
    await expect(service.issueToken(outsider, branchId)).rejects.toThrow();
  });

  it("404s when the user has no staff record in this branch", async () => {
    prisma.staff.findFirst.mockResolvedValue(null);
    await expect(service.issueToken(teacher, branchId)).rejects.toThrow(NotFoundException);
  });

  it("issues a QR data URL and expiry for the caller's own staff record", async () => {
    const result = await service.issueToken(teacher, branchId);
    expect(tokens.signCheckinToken).toHaveBeenCalledWith("s1", branchId);
    expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
