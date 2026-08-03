import { Controller, Get, UseGuards } from "@nestjs/common";
import { NetworkAnalyticsService } from "./network-analytics.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("network-analytics")
export class NetworkAnalyticsController {
  constructor(private readonly analytics: NetworkAnalyticsService) {}

  @Get("dashboard")
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.dashboard(user);
  }
}
