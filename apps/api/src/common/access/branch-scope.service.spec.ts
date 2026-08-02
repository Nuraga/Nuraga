import { ForbiddenException } from "@nestjs/common";
import { BranchScopeService } from "./branch-scope.service";
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

describe("BranchScopeService", () => {
  const service = new BranchScopeService();

  it("restricts a branch-scoped user to their granted branches", () => {
    const u = user({ grants: [{ branchId: "b1", role: "TEACHER" }] });

    expect(service.accessibleBranchIds(u)).toEqual(["b1"]);
    expect(service.canAccessBranch(u, "b1")).toBe(true);
    expect(service.canAccessBranch(u, "b2")).toBe(false);
  });

  it("throws ForbiddenException when asserting access to an ungranted branch", () => {
    const u = user({ grants: [{ branchId: "b1", role: "TEACHER" }] });
    expect(() => service.assertBranchAccess(u, "b2")).toThrow(ForbiddenException);
  });

  it("gives network-wide users access to every branch", () => {
    const u = user({ hasNetworkAccess: true, grants: [{ branchId: "b1", role: "OWNER" }] });

    expect(service.accessibleBranchIds(u)).toBe("all");
    expect(service.canAccessBranch(u, "b2")).toBe(true);
    expect(() => service.assertBranchAccess(u, "any-branch")).not.toThrow();
  });

  it("checks role membership scoped to a specific branch", () => {
    const u = user({
      grants: [
        { branchId: "b1", role: "TEACHER" },
        { branchId: "b2", role: "BRANCH_MANAGER" },
      ],
    });

    expect(service.hasRoleInBranch(u, "TEACHER", "b1")).toBe(true);
    expect(service.hasRoleInBranch(u, "TEACHER", "b2")).toBe(false);
    expect(service.hasRoleInBranch(u, "BRANCH_MANAGER", "b2")).toBe(true);
  });

  it("checks role membership across any branch", () => {
    const u = user({ grants: [{ branchId: "b1", role: "ACCOUNTANT" }] });

    expect(service.hasAnyRole(u, ["ACCOUNTANT", "OWNER"])).toBe(true);
    expect(service.hasAnyRole(u, ["TEACHER"])).toBe(false);
  });

  it("checks role membership scoped to one branch out of several roles", () => {
    const u = user({
      grants: [
        { branchId: "b1", role: "TEACHER" },
        { branchId: "b2", role: "BRANCH_MANAGER" },
      ],
    });

    expect(service.hasAnyRoleInBranch(u, ["BRANCH_MANAGER", "OWNER"], "b2")).toBe(true);
    expect(service.hasAnyRoleInBranch(u, ["BRANCH_MANAGER", "OWNER"], "b1")).toBe(false);
  });

  it("assertRoleInBranch throws ForbiddenException when the role isn't held in that branch", () => {
    const u = user({ grants: [{ branchId: "b1", role: "TEACHER" }] });

    expect(() => service.assertRoleInBranch(u, ["BRANCH_MANAGER"], "b1")).toThrow(
      ForbiddenException,
    );
    expect(() => service.assertRoleInBranch(u, ["TEACHER"], "b1")).not.toThrow();
  });

  it("assertRoleInBranch never throws for network-wide users", () => {
    const u = user({ hasNetworkAccess: true });
    expect(() => service.assertRoleInBranch(u, ["BRANCH_MANAGER"], "any-branch")).not.toThrow();
  });

  it("produces an empty Prisma filter for network-wide users and an `in` filter otherwise", () => {
    const scoped = user({ grants: [{ branchId: "b1", role: "TEACHER" }] });
    const network = user({ hasNetworkAccess: true });

    expect(service.branchFilter(scoped)).toEqual({ branchId: { in: ["b1"] } });
    expect(service.branchFilter(network)).toEqual({});
  });
});
