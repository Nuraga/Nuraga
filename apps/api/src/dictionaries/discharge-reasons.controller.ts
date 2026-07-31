import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { DischargeReasonsService } from "./discharge-reasons.service";
import { CreateDischargeReasonDto } from "./dto/create-discharge-reason.dto";
import { UpdateDischargeReasonDto } from "./dto/update-discharge-reason.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("discharge-reasons")
export class DischargeReasonsController {
  constructor(private readonly dischargeReasons: DischargeReasonsService) {}

  @Get()
  findAll() {
    return this.dischargeReasons.findAll();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDischargeReasonDto) {
    return this.dischargeReasons.create(user, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateDischargeReasonDto,
  ) {
    return this.dischargeReasons.update(user, id, dto);
  }

  @Post(":id/archive")
  archive(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.dischargeReasons.archive(user, id);
  }
}
