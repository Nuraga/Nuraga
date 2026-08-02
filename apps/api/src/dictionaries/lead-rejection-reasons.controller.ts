import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { LeadRejectionReasonsService } from "./lead-rejection-reasons.service";
import { CreateLeadRejectionReasonDto } from "./dto/create-lead-rejection-reason.dto";
import { UpdateLeadRejectionReasonDto } from "./dto/update-lead-rejection-reason.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("lead-rejection-reasons")
export class LeadRejectionReasonsController {
  constructor(private readonly leadRejectionReasons: LeadRejectionReasonsService) {}

  @Get()
  findAll() {
    return this.leadRejectionReasons.findAll();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLeadRejectionReasonDto) {
    return this.leadRejectionReasons.create(user, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateLeadRejectionReasonDto,
  ) {
    return this.leadRejectionReasons.update(user, id, dto);
  }

  @Post(":id/archive")
  archive(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.leadRejectionReasons.archive(user, id);
  }
}
