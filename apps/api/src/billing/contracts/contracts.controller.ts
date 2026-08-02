import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ContractsService } from "./contracts.service";
import { CreateContractDto } from "./dto/create-contract.dto";
import { UpdateContractDto } from "./dto/update-contract.dto";
import { ChangeTariffDto } from "./dto/change-tariff.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId")
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get("families/:familyId/contracts")
  listForFamily(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("familyId") familyId: string,
  ) {
    return this.contracts.listForFamily(user, branchId, familyId);
  }

  @Post("contracts")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: CreateContractDto,
  ) {
    return this.contracts.create(user, branchId, dto);
  }

  @Patch("contracts/:id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.contracts.update(user, branchId, id, dto);
  }

  @Post("contracts/:id/change-tariff")
  changeTariff(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: ChangeTariffDto,
  ) {
    return this.contracts.changeTariff(user, branchId, id, dto);
  }

  @Post("contracts/:id/terminate")
  terminate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
  ) {
    return this.contracts.terminate(user, branchId, id);
  }
}
