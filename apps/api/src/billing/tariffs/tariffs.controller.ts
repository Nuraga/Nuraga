import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TariffsService } from "./tariffs.service";
import { CreateTariffDto } from "./dto/create-tariff.dto";
import { UpdateTariffDto } from "./dto/update-tariff.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller()
export class TariffsController {
  constructor(private readonly tariffs: TariffsService) {}

  @Get("branches/:branchId/tariffs")
  listForBranch(@CurrentUser() user: AuthenticatedUser, @Param("branchId") branchId: string) {
    return this.tariffs.listForBranch(user, branchId);
  }

  @Post("tariffs")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTariffDto) {
    return this.tariffs.create(user, dto);
  }

  @Patch("tariffs/:id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateTariffDto,
  ) {
    return this.tariffs.update(user, id, dto);
  }

  @Post("tariffs/:id/archive")
  archive(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.tariffs.archive(user, id);
  }
}
