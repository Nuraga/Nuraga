import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

// Deliberately branch-agnostic — a notification belongs to a user, not a
// branch (mirrors /auth/me), so this doesn't sit under /branches/:branchId.
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query("onlyUnread") onlyUnread?: string) {
    return this.notifications.listForUser(user, onlyUnread === "true");
  }

  @Post(":id/read")
  async markRead(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    await this.notifications.markRead(user, id);
    return { ok: true };
  }

  @Post("read-all")
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    await this.notifications.markAllRead(user);
    return { ok: true };
  }
}
