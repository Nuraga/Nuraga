import { NotFoundException } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
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

describe("NotificationsService", () => {
  let prisma: any;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      notification: {
        create: jest.fn(() => Promise.resolve({})),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() => Promise.resolve({ id: "n1", userId: "u1", readAt: null })),
        update: jest.fn(() => Promise.resolve({})),
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
      },
    };
    service = new NotificationsService(prisma);
  });

  describe("create", () => {
    it("writes a notification row for the given user", async () => {
      await service.create("u1", "STAFF_LATE_CHECK_IN", "Вы опоздали");
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: { userId: "u1", type: "STAFF_LATE_CHECK_IN", message: "Вы опоздали" },
      });
    });
  });

  describe("listForUser", () => {
    it("filters to unread only when requested", async () => {
      await service.listForUser(user(), true);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "u1", readAt: null } }),
      );
    });

    it("returns all recent notifications otherwise", async () => {
      await service.listForUser(user(), false);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "u1" } }),
      );
    });
  });

  describe("markRead", () => {
    it("404s when the notification belongs to a different user (IDOR guard)", async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: "n1", userId: "other-user", readAt: null });
      await expect(service.markRead(user(), "n1")).rejects.toThrow(NotFoundException);
    });

    it("marks an unread notification as read", async () => {
      await service.markRead(user(), "n1");
      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "n1" }, data: expect.objectContaining({ readAt: expect.any(Date) }) }),
      );
    });

    it("is a no-op when already read", async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: "n1", userId: "u1", readAt: new Date() });
      await service.markRead(user(), "n1");
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });
  });

  describe("markAllRead", () => {
    it("marks every unread notification for the user as read", async () => {
      await service.markAllRead(user());
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: "u1", readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });
});
