import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { InvoicingService } from "./invoicing.service";
import { GenerateInvoicesDto } from "./dto/generate-invoices.dto";
import { AddAdjustmentDto } from "./dto/add-adjustment.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId")
export class InvoicingController {
  constructor(private readonly invoicing: InvoicingService) {}

  @Post("invoices/generate")
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: GenerateInvoicesDto,
  ) {
    return this.invoicing.generateForBranch(user, branchId, dto);
  }

  @Get("invoices")
  listForBranch(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("year") year?: string,
    @Query("month") month?: string,
  ) {
    return this.invoicing.listForBranch(
      user,
      branchId,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }

  @Get("families/:familyId/invoices")
  listForFamily(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("familyId") familyId: string,
  ) {
    return this.invoicing.listForFamily(user, branchId, familyId);
  }

  @Get("invoices/:id")
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
  ) {
    return this.invoicing.getOne(user, branchId, id);
  }

  @Post("invoices/:id/adjustments")
  addAdjustment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: AddAdjustmentDto,
  ) {
    return this.invoicing.addAdjustment(user, branchId, id, dto);
  }

  @Post("invoices/:id/approve")
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
  ) {
    return this.invoicing.approve(user, branchId, id);
  }
}
