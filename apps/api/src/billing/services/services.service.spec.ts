import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { ServicesService } from "./services.service";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";

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

describe("ServicesService", () => {
  const branchId = "b1";
  const manager = user({ grants: [{ branchId, role: "BRANCH_MANAGER" }] });
  const teacher = user({ grants: [{ branchId, role: "TEACHER" }] });

  let prisma: any;
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: ServicesService;

  beforeEach(() => {
    prisma = {
      service: {
        create: jest.fn((args: any) => Promise.resolve({ id: "s1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() =>
          Promise.resolve({ id: "s1", branchId, name: "Английский", capacity: 2 }),
        ),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
      serviceEnrollment: {
        count: jest.fn(() => Promise.resolve(0)),
        create: jest.fn((args: any) => Promise.resolve({ id: "e1", ...args.data })),
        findUnique: jest.fn(() =>
          Promise.resolve({ id: "e1", serviceId: "s1", service: { branchId } }),
        ),
        delete: jest.fn(() => Promise.resolve()),
      },
      child: { findUnique: jest.fn(() => Promise.resolve({ id: "c1", familyId: "f1" })) },
      family: { findUnique: jest.fn(() => Promise.resolve({ id: "f1", branchId })) },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new ServicesService(prisma, branchScope, audit as any);
  });

  it("rejects creation from a role without branch management rights", async () => {
    await expect(
      service.create(teacher, branchId, { name: "Английский", priceMinor: 500000 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("creates a service and records an audit entry", async () => {
    const created = await service.create(manager, branchId, {
      name: "Английский",
      priceMinor: 500000,
    });
    expect(created).toMatchObject({ name: "Английский", branchId });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "service" }));
  });

  describe("enrollChild", () => {
    it("404s for a service outside the branch", async () => {
      prisma.service.findUnique.mockResolvedValue({ id: "s1", branchId: "other" });
      await expect(
        service.enrollChild(manager, branchId, "c1", "s1", { startDate: "2026-09-01" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects enrollment once the service is at capacity", async () => {
      prisma.serviceEnrollment.count.mockResolvedValue(2);
      await expect(
        service.enrollChild(manager, branchId, "c1", "s1", { startDate: "2026-09-01" }),
      ).rejects.toThrow(ConflictException);
    });

    it("enrolls the child and records an audit entry", async () => {
      const enrollment = await service.enrollChild(manager, branchId, "c1", "s1", {
        startDate: "2026-09-01",
      });
      expect(enrollment).toMatchObject({ childId: "c1", serviceId: "s1" });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ entity: "service_enrollment", action: "create" }),
      );
    });
  });

  describe("unenrollChild", () => {
    it("404s when the enrollment's service belongs to a different branch", async () => {
      prisma.serviceEnrollment.findUnique.mockResolvedValue({
        id: "e1",
        service: { branchId: "other" },
      });
      await expect(service.unenrollChild(manager, branchId, "e1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("deletes the enrollment", async () => {
      await service.unenrollChild(manager, branchId, "e1");
      expect(prisma.serviceEnrollment.delete).toHaveBeenCalledWith({ where: { id: "e1" } });
    });
  });
});
