import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId/families/:familyId")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("payments")
  recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("familyId") familyId: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.payments.recordPayment(user, branchId, familyId, dto);
  }

  @Get("payments")
  listForFamily(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("familyId") familyId: string,
  ) {
    return this.payments.listForFamily(user, branchId, familyId);
  }

  @Get("balance")
  getBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("familyId") familyId: string,
  ) {
    return this.payments.getFamilyBalance(user, branchId, familyId);
  }
}
