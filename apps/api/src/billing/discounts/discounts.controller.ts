import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { DiscountsService } from "./discounts.service";
import { CreateDiscountDto } from "./dto/create-discount.dto";
import { UpdateDiscountDto } from "./dto/update-discount.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId")
export class DiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @Get("families/:familyId/discounts")
  listForFamily(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("familyId") familyId: string,
  ) {
    return this.discounts.listForFamily(user, branchId, familyId);
  }

  @Post("discounts")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: CreateDiscountDto,
  ) {
    return this.discounts.create(user, branchId, dto);
  }

  @Patch("discounts/:id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UpdateDiscountDto,
  ) {
    return this.discounts.update(user, branchId, id, dto);
  }

  @Post("discounts/:id/archive")
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
  ) {
    return this.discounts.archive(user, branchId, id);
  }
}
