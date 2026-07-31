import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { ChildrenImportService } from "./children-import.service";
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

const HEADER =
  "family_name,child_full_name,child_birth_date,child_sex,parent_full_name,parent_relationship,parent_phone,parent_email";

function csv(...rows: string[]): { buffer: Buffer } {
  return { buffer: Buffer.from([HEADER, ...rows].join("\n"), "utf-8") };
}

describe("ChildrenImportService", () => {
  const branchId = "b1";
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });
  const teacher = user({ grants: [{ branchId, role: "TEACHER" }] });

  let prisma: any;
  let tx: any;
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: ChildrenImportService;

  beforeEach(() => {
    tx = {
      family: { create: jest.fn((args: any) => Promise.resolve({ id: "f1", ...args.data })) },
      parent: { create: jest.fn((args: any) => Promise.resolve({ id: "p1", ...args.data })) },
      child: { create: jest.fn((args: any) => Promise.resolve({ id: "c1", ...args.data })) },
    };
    prisma = { $transaction: jest.fn((fn: any) => fn(tx)) };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new ChildrenImportService(prisma, branchScope, audit as any);
  });

  it("rejects import from a role without write access", async () => {
    const file = csv("Иванова,Иван Иванов,2020-01-01,,Мария Иванова,мать,,");
    await expect(service.import(teacher, branchId, file, false)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("rejects a CSV missing a required column", async () => {
    const file = { buffer: Buffer.from("family_name,child_full_name\nA,B", "utf-8") };
    await expect(service.import(manager, branchId, file, false)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("rejects a CSV with no data rows", async () => {
    const file = { buffer: Buffer.from(HEADER, "utf-8") };
    await expect(service.import(manager, branchId, file, false)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("processes valid and invalid rows independently, reporting per-row errors", async () => {
    const file = csv(
      "Иванова,Иван Иванов,2020-01-01,М,Мария Иванова,мать,+79990000000,maria@example.com",
      ",Пропущено имя семьи,not-a-date,,,,,",
    );

    const report = await service.import(manager, branchId, file, false);

    expect(report.totalRows).toBe(2);
    expect(report.created).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.results[0]).toMatchObject({ row: 2, status: "created", familyId: "f1", childId: "c1" });
    expect(report.results[1]).toMatchObject({ row: 3, status: "error" });
    expect(report.results[1].errors!.length).toBeGreaterThan(0);
  });

  it("writes the family, parent, and child inside a transaction", async () => {
    const file = csv("Иванова,Иван Иванов,2020-01-01,М,Мария Иванова,мать,,");
    await service.import(manager, branchId, file, false);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.family.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { branchId, name: "Иванова" } }),
    );
    expect(tx.parent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ familyId: "f1", fullName: "Мария Иванова" }) }),
    );
    expect(tx.child.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ familyId: "f1", fullName: "Иван Иванов", status: "WAITLIST" }),
      }),
    );
  });

  it("records a single audit summary entry for a real (non-dry-run) import", async () => {
    const file = csv("Иванова,Иван Иванов,2020-01-01,,Мария Иванова,мать,,");
    await service.import(manager, branchId, file, false);

    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "import", newValue: expect.objectContaining({ created: 1 }) }),
    );
  });

  it("dry-run validates without writing to the database or recording audit", async () => {
    const file = csv("Иванова,Иван Иванов,2020-01-01,,Мария Иванова,мать,,");
    const report = await service.import(manager, branchId, file, true);

    expect(report.dryRun).toBe(true);
    expect(report.created).toBe(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
