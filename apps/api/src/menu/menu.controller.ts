import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { MenuService } from "./menu.service";
import { PublishMenuDayDto } from "./dto/publish-menu-day.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId/menu")
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get()
  getRange(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    if (!from || !to) throw new BadRequestException("from and to query params are required");
    return this.menu.getRange(user, branchId, from, to);
  }

  @Post(":date")
  publishDay(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("date") date: string,
    @Body() dto: PublishMenuDayDto,
  ) {
    return this.menu.publishDay(user, branchId, date, dto.items);
  }
}
