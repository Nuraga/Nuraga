import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

type MockUser = {
  id: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  isActive: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
  totpEnabled: boolean;
  totpSecret: string | null;
  branchRoles: { branchId: string; role: string }[];
};

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1",
    email: "owner@example.com",
    phone: null,
    passwordHash: "hashed",
    isActive: true,
    failedLoginCount: 0,
    lockedUntil: null,
    totpEnabled: false,
    totpSecret: null,
    branchRoles: [],
    ...overrides,
  };
}

describe("AuthService.login", () => {
  let prisma: { user: Record<string, jest.Mock> };
  let password: { verify: jest.Mock; hash: jest.Mock };
  let tokens: {
    signAccessToken: jest.Mock;
    issueRefreshToken: jest.Mock;
    signMfaToken: jest.Mock;
    revokeAllForUser: jest.Mock;
  };
  let audit: { record: jest.Mock };
  let service: AuthService;
  let currentUser: MockUser;

  beforeEach(() => {
    currentUser = makeUser();

    prisma = {
      user: {
        findFirst: jest.fn(() => Promise.resolve(currentUser)),
        findUniqueOrThrow: jest.fn(() => Promise.resolve(currentUser)),
        update: jest.fn((args: any) => {
          Object.assign(currentUser, args.data);
          return Promise.resolve(currentUser);
        }),
      },
    };
    password = { verify: jest.fn(), hash: jest.fn() };
    tokens = {
      signAccessToken: jest.fn(() => Promise.resolve("access-token")),
      issueRefreshToken: jest.fn(() => Promise.resolve("refresh-token")),
      signMfaToken: jest.fn(() => Promise.resolve("mfa-token")),
      revokeAllForUser: jest.fn(() => Promise.resolve()),
    };
    audit = { record: jest.fn(() => Promise.resolve()) };

    service = new AuthService(
      prisma as any,
      password as any,
      tokens as any,
      {} as any,
      audit as any,
    );
  });

  it("rejects an unknown identifier with a generic error", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.login("nobody@example.com", "pw")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("issues tokens on a correct password with no 2FA-required role", async () => {
    password.verify.mockResolvedValue(true);

    const result = await service.login("owner@example.com", "correct");

    expect(result).toMatchObject({ status: "ok", accessToken: "access-token" });
    expect(tokens.signAccessToken).toHaveBeenCalledWith("user-1");
  });

  it("locks the account after 5 consecutive failed attempts", async () => {
    password.verify.mockResolvedValue(false);

    for (let i = 0; i < 5; i++) {
      await expect(service.login("owner@example.com", "wrong")).rejects.toThrow(
        UnauthorizedException,
      );
    }

    expect(currentUser.lockedUntil).not.toBeNull();
    expect(currentUser.failedLoginCount).toBe(0);
  });

  it("rejects login while locked even with the correct password", async () => {
    currentUser.lockedUntil = new Date(Date.now() + 60_000);
    password.verify.mockResolvedValue(true);

    await expect(service.login("owner@example.com", "correct")).rejects.toThrow(
      "Account temporarily locked. Try again later.",
    );
  });

  it("resets the failed-attempt counter after a successful login", async () => {
    currentUser.failedLoginCount = 3;
    password.verify.mockResolvedValue(true);

    await service.login("owner@example.com", "correct");

    expect(currentUser.failedLoginCount).toBe(0);
  });

  it("requires MFA for a role that mandates 2FA once it's enabled", async () => {
    currentUser.branchRoles = [{ branchId: "b1", role: "OWNER" }];
    currentUser.totpEnabled = true;
    password.verify.mockResolvedValue(true);

    const result = await service.login("owner@example.com", "correct");

    expect(result).toEqual({ status: "mfa_required", mfaToken: "mfa-token" });
  });

  it("flags totpSetupRequired for a 2FA-mandatory role that hasn't enabled it yet", async () => {
    currentUser.branchRoles = [{ branchId: "b1", role: "SUPERADMIN" }];
    currentUser.totpEnabled = false;
    password.verify.mockResolvedValue(true);

    const result = await service.login("owner@example.com", "correct");

    expect(result).toMatchObject({ status: "ok", totpSetupRequired: true });
  });
});

describe("AuthService.changePassword", () => {
  let prisma: { user: Record<string, jest.Mock> };
  let password: { verify: jest.Mock; hash: jest.Mock };
  let tokens: { revokeAllForUser: jest.Mock };
  let audit: { record: jest.Mock };
  let service: AuthService;
  let currentUser: MockUser;

  beforeEach(() => {
    currentUser = makeUser();

    prisma = {
      user: {
        findUniqueOrThrow: jest.fn(() => Promise.resolve(currentUser)),
        update: jest.fn((args: any) => {
          Object.assign(currentUser, args.data);
          return Promise.resolve(currentUser);
        }),
      },
    };
    password = { verify: jest.fn(), hash: jest.fn(() => Promise.resolve("new-hash")) };
    tokens = { revokeAllForUser: jest.fn(() => Promise.resolve()) };
    audit = { record: jest.fn(() => Promise.resolve()) };

    service = new AuthService(
      prisma as any,
      password as any,
      tokens as any,
      {} as any,
      audit as any,
    );
  });

  it("rejects with the wrong current password and leaves the hash untouched", async () => {
    password.verify.mockResolvedValue(false);

    await expect(service.changePassword("user-1", "wrong", "newpassword")).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(tokens.revokeAllForUser).not.toHaveBeenCalled();
  });

  it("hashes the new password, saves it, and revokes every other session", async () => {
    password.verify.mockResolvedValue(true);

    await service.changePassword("user-1", "correct", "newpassword");

    expect(currentUser.passwordHash).toBe("new-hash");
    expect(tokens.revokeAllForUser).toHaveBeenCalledWith("user-1");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ newValue: { event: "password_changed" } }),
    );
  });
});
