import { ForbiddenException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { TeacherScopeService } from "../common/access/teacher-scope.service";
import { EncryptionService } from "../common/crypto/encryption.service";
import { ChildMedicalService } from "./child-medical.service";
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

function makeEncryption(): EncryptionService {
  const key = randomBytes(32).toString("base64");
  const service = new EncryptionService({ get: () => key } as any);
  service.onModuleInit();
  return service;
}

describe("ChildMedicalService", () => {
  const branchId = "b1";
  const childId = "c1";
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });
  const accountant = user({ grants: [{ branchId, role: "ACCOUNTANT" }] });
  const teacherAssigned = user({ grants: [{ branchId, role: "TEACHER" }] });
  const teacherUnassigned = user({ id: "u2", grants: [{ branchId, role: "TEACHER" }] });

  let prisma: any;
  let teacherScope: { getAssignedGroupIds: jest.Mock; isAssignedToGroup: jest.Mock };
  let audit: { record: jest.Mock };
  let encryption: EncryptionService;
  let service: ChildMedicalService;

  beforeEach(() => {
    prisma = {
      child: { findUnique: jest.fn(() => Promise.resolve({ id: childId, familyId: "f1", groupId: "g1" })) },
      family: { findUnique: jest.fn(() => Promise.resolve({ id: "f1", branchId })) },
      childMedical: {
        findUnique: jest.fn(() => Promise.resolve(null)),
        upsert: jest.fn((args: any) => Promise.resolve({ childId, ...args.create })),
      },
      childAllergen: {
        findMany: jest.fn(() => Promise.resolve([])),
        deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
        createMany: jest.fn(() => Promise.resolve({ count: 0 })),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    teacherScope = {
      getAssignedGroupIds: jest.fn(() => Promise.resolve(["g1"])),
      isAssignedToGroup: jest.fn((userId: string, _branchId: string, groupId: string) =>
        Promise.resolve(userId === teacherAssigned.id && groupId === "g1"),
      ),
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    encryption = makeEncryption();
    service = new ChildMedicalService(
      prisma,
      new BranchScopeService(),
      teacherScope as unknown as TeacherScopeService,
      encryption,
      audit as any,
    );
  });

  it("denies Accountant entirely, even though they can read the basic child card", async () => {
    await expect(service.getForUser(accountant, branchId, childId)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("gives a Manager the full decrypted record", async () => {
    prisma.childMedical.findUnique.mockResolvedValue({
      childId,
      allergiesEnc: encryption.encrypt("орехи"),
      chronicEnc: null,
      activityLimitsEnc: null,
      doctorContactEnc: null,
      criticalInfo: "Аллергия на орехи",
    });

    const result = await service.getForUser(manager, branchId, childId);
    expect(result).toEqual({
      level: "full",
      allergies: "орехи",
      chronic: null,
      activityLimits: null,
      doctorContact: null,
      criticalInfo: "Аллергия на орехи",
      allergens: [],
    });
  });

  it("gives an assigned Teacher only the critical-info summary", async () => {
    prisma.childMedical.findUnique.mockResolvedValue({
      childId,
      allergiesEnc: encryption.encrypt("орехи"),
      criticalInfo: "Аллергия на орехи",
    });

    const result = await service.getForUser(teacherAssigned, branchId, childId);
    expect(result).toEqual({ level: "critical_only", criticalInfo: "Аллергия на орехи", allergens: [] });
  });

  it("includes structured allergen tags at both access levels", async () => {
    prisma.childMedical.findUnique.mockResolvedValue({ childId, criticalInfo: "x" });
    prisma.childAllergen.findMany.mockResolvedValue([
      { childId, allergenId: "a1", allergen: { id: "a1", name: "Орехи" } },
    ]);

    const full = await service.getForUser(manager, branchId, childId);
    expect(full.allergens).toEqual([{ id: "a1", name: "Орехи" }]);

    const critical = await service.getForUser(teacherAssigned, branchId, childId);
    expect(critical.allergens).toEqual([{ id: "a1", name: "Орехи" }]);
  });

  it("denies a Teacher not assigned to the child's group", async () => {
    await expect(service.getForUser(teacherUnassigned, branchId, childId)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("rejects medical writes from Accountant/Teacher", async () => {
    await expect(
      service.upsert(accountant, branchId, childId, { criticalInfo: "x" }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.upsert(teacherAssigned, branchId, childId, { criticalInfo: "x" }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("encrypts on write and never puts plaintext medical values in the audit log", async () => {
    await service.upsert(manager, branchId, childId, { allergies: "орехи", criticalInfo: "x" });

    const createArg = prisma.childMedical.upsert.mock.calls[0][0].create;
    expect(createArg.allergiesEnc).not.toContain("орехи");

    const auditCall = audit.record.mock.calls[0][0];
    expect(JSON.stringify(auditCall)).not.toContain("орехи");
    expect(auditCall.newValue).toEqual({ fieldsUpdated: ["allergies", "criticalInfo"] });
  });

  describe("setAllergens", () => {
    it("rejects Accountant/Teacher writes", async () => {
      await expect(service.setAllergens(accountant, branchId, childId, ["a1"])).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        service.setAllergens(teacherAssigned, branchId, childId, ["a1"]),
      ).rejects.toThrow(ForbiddenException);
    });

    it("replaces the child's allergen set and returns the new tags", async () => {
      prisma.childAllergen.findMany.mockResolvedValue([
        { childId, allergenId: "a1", allergen: { id: "a1", name: "Орехи" } },
      ]);

      const result = await service.setAllergens(manager, branchId, childId, ["a1"]);

      expect(prisma.childAllergen.deleteMany).toHaveBeenCalledWith({ where: { childId } });
      expect(prisma.childAllergen.createMany).toHaveBeenCalledWith({
        data: [{ childId, allergenId: "a1" }],
      });
      expect(result).toEqual([{ id: "a1", name: "Орехи" }]);
    });

    it("never writes allergen names into the audit log, only ids", async () => {
      await service.setAllergens(manager, branchId, childId, ["a1", "a2"]);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ entity: "child_medical", newValue: { allergenIds: ["a1", "a2"] } }),
      );
    });
  });
});
