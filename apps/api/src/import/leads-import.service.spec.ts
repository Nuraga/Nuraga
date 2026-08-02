import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { LeadsImportService } from "./leads-import.service";
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
  "parent_full_name,parent_phone,parent_email,child_full_name,child_birth_date,target_date,source_name,responsible_email";

function csv(...rows: string[]): { buffer: Buffer } {
  return { buffer: Buffer.from([HEADER, ...rows].join("\n"), "utf-8") };
}

describe("LeadsImportService", () => {
  const branchId = "b1";
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });
  const teacher = user({ grants: [{ branchId, role: "TEACHER" }] });

  let prisma: any;
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: LeadsImportService;

  beforeEach(() => {
    prisma = {
      leadSource: {
        findFirst: jest.fn(() => Promise.resolve({ id: "src1", name: "Сайт" })),
      },
      user: {
        findUnique: jest.fn(() => Promise.resolve({ id: "resp1", email: "manager@example.com" })),
      },
      lead: {
        create: jest.fn((args: any) => Promise.resolve({ id: "lead1", ...args.data })),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new LeadsImportService(prisma, branchScope, audit as any);
  });

  it("rejects import from a role without write access", async () => {
    const file = csv("Иванова,+77011112233,,,,,,manager@example.com");
    await expect(service.import(teacher, branchId, file, false)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("rejects a CSV missing a required column", async () => {
    const file = { buffer: Buffer.from("parent_full_name,parent_phone\nA,B", "utf-8") };
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
      "Иванова Анна,+77011112233,anna@example.com,Иван Иванов,2020-01-01,2026-09-01,Сайт,manager@example.com",
      ",,,,not-a-date,,,",
    );

    const report = await service.import(manager, branchId, file, false);

    expect(report.totalRows).toBe(2);
    expect(report.created).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.results[0]).toMatchObject({ row: 2, status: "created", leadId: "lead1" });
    expect(report.results[1]).toMatchObject({ row: 3, status: "error" });
    expect(report.results[1].errors!.length).toBeGreaterThan(0);
  });

  it("resolves source_name and responsible_email to ids and normalizes the phone", async () => {
    const file = csv("Иванова Анна,8 (701) 111-22-33,,,,,Сайт,manager@example.com");
    await service.import(manager, branchId, file, false);

    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceId: "src1",
          responsibleUserId: "resp1",
          parentPhoneNormalized: "77011112233",
        }),
      }),
    );
  });

  it("reports a row error when source_name doesn't match any active source", async () => {
    prisma.leadSource.findFirst.mockResolvedValue(null);
    const file = csv("Иванова Анна,+77011112233,,,,,Несуществующий,manager@example.com");

    const report = await service.import(manager, branchId, file, false);

    expect(report.failed).toBe(1);
    expect(report.results[0].errors![0]).toMatch(/Unknown or archived lead source/);
  });

  it("reports a row error when responsible_email doesn't match any user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const file = csv("Иванова Анна,+77011112233,,,,,,ghost@example.com");

    const report = await service.import(manager, branchId, file, false);

    expect(report.failed).toBe(1);
    expect(report.results[0].errors![0]).toMatch(/Unknown responsible user email/);
  });

  it("does not block on a duplicate phone across rows (bulk migration, no interactive confirm)", async () => {
    const file = csv(
      "Иванова Анна,+77011112233,,,,,,manager@example.com",
      "Иванова Анна 2,+77011112233,,,,,,manager@example.com",
    );

    const report = await service.import(manager, branchId, file, false);

    expect(report.created).toBe(2);
    expect(report.failed).toBe(0);
  });

  it("records a single audit summary entry for a real (non-dry-run) import", async () => {
    const file = csv("Иванова Анна,+77011112233,,,,,,manager@example.com");
    await service.import(manager, branchId, file, false);

    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "import", newValue: expect.objectContaining({ type: "leads", created: 1 }) }),
    );
  });

  it("dry-run resolves references but does not create or record audit", async () => {
    const file = csv("Иванова Анна,+77011112233,,,,,Сайт,manager@example.com");
    const report = await service.import(manager, branchId, file, true);

    expect(report.dryRun).toBe(true);
    expect(report.created).toBe(1);
    expect(prisma.leadSource.findFirst).toHaveBeenCalled();
    expect(prisma.lead.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
