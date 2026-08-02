import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { BranchesService } from "./branches.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches")
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBranchDto) {
    return this.branches.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.branches.findAllForUser(user);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.branches.findOneForUser(user, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branches.update(user, id, dto);
  }

  @Post(":id/archive")
  archive(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.branches.archive(user, id);
  }
}
