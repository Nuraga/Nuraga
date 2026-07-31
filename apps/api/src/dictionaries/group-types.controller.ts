import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { GroupTypesService } from "./group-types.service";
import { CreateGroupTypeDto } from "./dto/create-group-type.dto";
import { UpdateGroupTypeDto } from "./dto/update-group-type.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("group-types")
export class GroupTypesController {
  constructor(private readonly groupTypes: GroupTypesService) {}

  @Get()
  findAll() {
    return this.groupTypes.findAll();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGroupTypeDto) {
    return this.groupTypes.create(user, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateGroupTypeDto,
  ) {
    return this.groupTypes.update(user, id, dto);
  }

  @Post(":id/archive")
  archive(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.groupTypes.archive(user, id);
  }
}
