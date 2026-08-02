import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { LeadSourcesService } from "./lead-sources.service";
import { CreateLeadSourceDto } from "./dto/create-lead-source.dto";
import { UpdateLeadSourceDto } from "./dto/update-lead-source.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("lead-sources")
export class LeadSourcesController {
  constructor(private readonly leadSources: LeadSourcesService) {}

  @Get()
  findAll() {
    return this.leadSources.findAll();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLeadSourceDto) {
    return this.leadSources.create(user, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateLeadSourceDto,
  ) {
    return this.leadSources.update(user, id, dto);
  }

  @Post(":id/archive")
  archive(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.leadSources.archive(user, id);
  }
}
