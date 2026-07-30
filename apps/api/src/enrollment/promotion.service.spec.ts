import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PromotionService } from "./promotion.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import type { ChildAccessService } from "../children/child-access.service";
import type { EnrollmentService } from "./enrollment.service";

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

describe("PromotionService", () => {
  const branchId = "b1";
  const fromGroupId = "g1";
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });

  let prisma: any;
  let childAccess: { assertWriteAccess: jest.Mock };
  let enrollment: { transfer: jest.Mock; discharge: jest.Mock };
  let service: PromotionService;

  beforeEach(() => {
    prisma = {
      group: { findUnique: jest.fn(() => Promise.resolve({ id: fromGroupId, branchId })) },
      child: {
        findMany: jest.fn(() =>
          Promise.resolve([{ id: "c1" }, { id: "c2" }, { id: "c3" }]),
        ),
      },
    };
    childAccess = { assertWriteAccess: jest.fn() };
    enrollment = {
      transfer: jest.fn(() => Promise.resolve({})),
      discharge: jest.fn(() => Promise.resolve({})),
    };
    service = new PromotionService(
      prisma,
      childAccess as unknown as ChildAccessService,
      enrollment as unknown as EnrollmentService,
    );
  });

  it("rejects when neither toGroupId nor dischargeReasonId is given", async () => {
    await expect(service.promoteGroup(manager, branchId, fromGroupId, {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it("rejects when both toGroupId and dischargeReasonId are given", async () => {
    await expect(
      service.promoteGroup(manager, branchId, fromGroupId, {
        toGroupId: "g2",
        dischargeReasonId: "dr1",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("404s when the source group isn't in this branch", async () => {
    prisma.group.findUnique.mockResolvedValue({ id: fromGroupId, branchId: "other" });
    await expect(
      service.promoteGroup(manager, branchId, fromGroupId, { toGroupId: "g2" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("transfers every enrolled child in the group when promoting", async () => {
    const result = await service.promoteGroup(manager, branchId, fromGroupId, { toGroupId: "g2" });

    expect(enrollment.transfer).toHaveBeenCalledTimes(3);
    expect(enrollment.transfer).toHaveBeenCalledWith(manager, branchId, "c1", {
      toGroupId: "g2",
      confirmOverride: true,
    });
    expect(result).toEqual({ total: 3, succeeded: ["c1", "c2", "c3"], failed: [] });
  });

  it("discharges every enrolled child when graduating, and isolates per-child failures", async () => {
    enrollment.discharge
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({});

    const result = await service.promoteGroup(manager, branchId, fromGroupId, {
      dischargeReasonId: "dr1",
    });

    expect(enrollment.discharge).toHaveBeenCalledTimes(3);
    expect(result.succeeded).toEqual(["c1", "c3"]);
    expect(result.failed).toEqual([{ childId: "c2", error: "boom" }]);
  });
});
