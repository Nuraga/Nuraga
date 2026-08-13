import { Injectable, NotFoundException } from "@nestjs/common";
import type { NotificationType } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

// In-app only (bell icon in AppLayout) — no email/SMS/push infra in this
// project (see DEPLOY.md). Other services (e.g. StaffAttendanceService on a
// late check-in) call `create` directly; there is no public POST endpoint —
// notifications are always system-generated, never user-authored.
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, type: NotificationType, message: string): Promise<void> {
    await this.prisma.notification.create({ data: { userId, type, message } });
  }

  async listForUser(user: AuthenticatedUser, onlyUnread: boolean) {
    return this.prisma.notification.findMany({
      where: { userId: user.id, ...(onlyUnread ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async markRead(user: AuthenticatedUser, id: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== user.id) {
      throw new NotFoundException("Notification not found");
    }
    if (notification.readAt) return;

    await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(user: AuthenticatedUser): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
