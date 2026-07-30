import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { GroupsService } from "./groups.service";
import { GroupCapacityService } from "./group-capacity.service";
import { CreateGroupDto } from "./dto/create-group.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller()
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly capacity: GroupCapacityService,
  ) {}

  @Get("group-types")
  listGroupTypes() {
    return this.groups.listGroupTypes();
  }

  @Post("branches/:branchId/groups")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groups.create(user, branchId, dto);
  }

  @Get("branches/:branchId/groups")
  findAll(@CurrentUser() user: AuthenticatedUser, @Param("branchId") branchId: string) {
    return this.groups.findAllForBranch(user, branchId);
  }

  @Get("branches/:branchId/groups/:id")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
  ) {
    return this.groups.findOne(user, branchId, id);
  }

  @Get("branches/:branchId/groups/:id/occupancy")
  async occupancy(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
  ) {
    // findOne enforces branch access + IDOR (group must belong to branchId).
    await this.groups.findOne(user, branchId, id);
    return this.capacity.getOccupancy(id);
  }

  @Patch("branches/:branchId/groups/:id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groups.update(user, branchId, id, dto);
  }

  @Post("branches/:branchId/groups/:id/archive")
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
  ) {
    return this.groups.archive(user, branchId, id);
  }
}
