import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { WaitlistService } from "./waitlist.service";
import { CreateWaitlistEntryDto } from "./dto/create-waitlist-entry.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId/groups/:groupId/waitlist")
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post()
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("groupId") groupId: string,
    @Body() dto: CreateWaitlistEntryDto,
  ) {
    return this.waitlist.add(user, branchId, groupId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("groupId") groupId: string,
    @Query("limit") limit?: string,
  ) {
    return this.waitlist.list(user, branchId, groupId, limit ? Number(limit) : undefined);
  }

  @Delete(":entryId")
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("groupId") groupId: string,
    @Param("entryId") entryId: string,
  ) {
    return this.waitlist.remove(user, branchId, groupId, entryId);
  }
}
