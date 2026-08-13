import { Body, Controller, Get, Param, Post, Delete, Query, UseGuards } from "@nestjs/common";
import { StaffService } from "./staff.service";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { TerminateStaffDto } from "./dto/terminate-staff.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId/staff")
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: CreateStaffDto,
  ) {
    return this.staff.create(user, branchId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("includeTerminated") includeTerminated?: string,
  ) {
    return this.staff.findAllForBranch(user, branchId, includeTerminated === "true");
  }

  @Delete(":staffId")
  terminate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("staffId") staffId: string,
    @Body() dto: TerminateStaffDto,
  ) {
    return this.staff.terminate(user, branchId, staffId, dto);
  }

  @Post(":staffId/groups/:groupId")
  assignGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("staffId") staffId: string,
    @Param("groupId") groupId: string,
  ) {
    return this.staff.assignGroup(user, branchId, staffId, groupId);
  }

  @Delete(":staffId/groups/:groupId")
  unassignGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("staffId") staffId: string,
    @Param("groupId") groupId: string,
  ) {
    return this.staff.unassignGroup(user, branchId, staffId, groupId);
  }
}
