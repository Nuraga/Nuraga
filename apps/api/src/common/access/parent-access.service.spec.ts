import { ForbiddenException } from "@nestjs/common";
import { ParentAccessService } from "./parent-access.service";
import type { AuthenticatedUser } from "./branch-access.types";

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "u1",
    email: "u1@example.com",
    phone: null,
    fullName: "Test User",
    grants: [],
    hasNetworkAccess: false,
    ...overrides,
  };
}

describe("ParentAccessService", () => {
  const service = new ParentAccessService();

  it("rejects a user with no parent profile", () => {
    expect(() => service.assertFamilyId(user())).toThrow(ForbiddenException);
  });

  it("rejects a staff user (branch grants, no parent profile)", () => {
    expect(() =>
      service.assertFamilyId(user({ grants: [{ branchId: "b1", role: "MANAGER" }] })),
    ).toThrow(ForbiddenException);
  });

  it("returns the family id for an authenticated parent", () => {
    const familyId = service.assertFamilyId(
      user({ parentProfile: { id: "p1", familyId: "f1" } }),
    );
    expect(familyId).toBe("f1");
  });
});
