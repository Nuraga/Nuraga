import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ShiftsService } from "./shifts.service";
import { CreateShiftDto } from "./dto/create-shift.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId/shifts")
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    if (!from || !to) throw new BadRequestException("from and to query params are required");
    return this.shifts.list(user, branchId, from, to);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: CreateShiftDto,
  ) {
    return this.shifts.create(user, branchId, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("branchId") branchId: string, @Param("id") id: string) {
    return this.shifts.remove(user, branchId, id);
  }
}
