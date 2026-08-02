import { ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { DeviceAuthService } from "./device-auth.service";
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

describe("DeviceAuthService", () => {
  const branchId = "b1";
  const branchManager = user({ id: "bm1", grants: [{ branchId, role: "BRANCH_MANAGER" }] });
  const teacher = user({ id: "t1", grants: [{ branchId, role: "TEACHER" }] });

  let prisma: any;
  let audit: { record: jest.Mock };
  let password: { hash: jest.Mock; verify: jest.Mock };
  let tokens: { signDeviceToken: jest.Mock };
  let branchScope: BranchScopeService;
  let service: DeviceAuthService;

  beforeEach(() => {
    prisma = {
      device: {
        create: jest.fn((args: any) => Promise.resolve({ id: "d1", revokedAt: null, ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() =>
          Promise.resolve({ id: "d1", branchId, revokedAt: null, secretHash: "hashed" }),
        ),
        update: jest.fn((args: any) => Promise.resolve({ id: "d1", branchId, ...args.data })),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    password = {
      hash: jest.fn(() => Promise.resolve("hashed")),
      verify: jest.fn(() => Promise.resolve(true)),
    };
    tokens = { signDeviceToken: jest.fn(() => Promise.resolve("device-jwt")) };
    branchScope = new BranchScopeService();
    service = new DeviceAuthService(prisma, branchScope, audit as any, password as any, tokens as any);
  });

  describe("provision", () => {
    it("rejects a role without device-management access", async () => {
      await expect(service.provision(teacher, branchId, { name: "Kiosk" })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("creates a device and returns the secret exactly once", async () => {
      const { device, secret } = await service.provision(branchManager, branchId, { name: "Kiosk" });
      expect(device).toMatchObject({ branchId, name: "Kiosk" });
      expect(typeof secret).toBe("string");
      expect(secret.length).toBeGreaterThan(0);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "device", action: "create" }));
    });
  });

  describe("revoke", () => {
    it("rejects a role without device-management access", async () => {
      await expect(service.revoke(teacher, branchId, "d1")).rejects.toThrow(ForbiddenException);
    });

    it("404s for a device in a different branch", async () => {
      prisma.device.findUnique.mockResolvedValue({ id: "d1", branchId: "other", revokedAt: null });
      await expect(service.revoke(branchManager, branchId, "d1")).rejects.toThrow(NotFoundException);
    });

    it("sets revokedAt", async () => {
      await service.revoke(branchManager, branchId, "d1");
      expect(prisma.device.update).toHaveBeenCalledWith({
        where: { id: "d1" },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe("pair", () => {
    it("rejects an unknown device", async () => {
      prisma.device.findUnique.mockResolvedValue(null);
      await expect(service.pair("missing", "secret")).rejects.toThrow(UnauthorizedException);
    });

    it("rejects a revoked device", async () => {
      prisma.device.findUnique.mockResolvedValue({ id: "d1", branchId, revokedAt: new Date() });
      await expect(service.pair("d1", "secret")).rejects.toThrow(UnauthorizedException);
    });

    it("rejects a wrong secret", async () => {
      password.verify.mockResolvedValue(false);
      await expect(service.pair("d1", "wrong")).rejects.toThrow(UnauthorizedException);
    });

    it("issues a device token for a valid secret", async () => {
      const result = await service.pair("d1", "correct-secret");
      expect(result).toMatchObject({ accessToken: "device-jwt", branchId });
      expect(tokens.signDeviceToken).toHaveBeenCalledWith("d1", branchId);
    });
  });

  describe("assertActive", () => {
    it("throws for a revoked device", async () => {
      prisma.device.findUnique.mockResolvedValue({ id: "d1", branchId, revokedAt: new Date() });
      await expect(service.assertActive("d1", branchId)).rejects.toThrow(ForbiddenException);
    });

    it("throws when the branch no longer matches", async () => {
      prisma.device.findUnique.mockResolvedValue({ id: "d1", branchId: "other", revokedAt: null });
      await expect(service.assertActive("d1", branchId)).rejects.toThrow(ForbiddenException);
    });

    it("resolves for an active device in the right branch", async () => {
      await expect(service.assertActive("d1", branchId)).resolves.toBeUndefined();
    });
  });
});
