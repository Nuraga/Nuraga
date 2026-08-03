import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ParentPortalService } from "./parent-portal.service";
import { CreateAbsenceRequestDto } from "./dto/create-absence-request.dto";
import { SetPhotoConsentDto } from "./dto/set-photo-consent.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

// No :branchId in this controller's routes on purpose — a parent session is
// scoped to exactly one family via the JWT (ParentAccessService), not a
// branch role, so the branch is never a caller-supplied parameter here.
@UseGuards(JwtAuthGuard)
@Controller("parent")
export class ParentPortalController {
  constructor(private readonly parentPortal: ParentPortalService) {}

  @Get("me")
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.parentPortal.getMe(user);
  }

  @Get("invoices")
  listInvoices(@CurrentUser() user: AuthenticatedUser) {
    return this.parentPortal.listInvoices(user);
  }

  @Get("payments")
  listPayments(@CurrentUser() user: AuthenticatedUser) {
    return this.parentPortal.listPayments(user);
  }

  @Get("balance")
  getBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.parentPortal.getBalance(user);
  }

  @Get("children/:childId/attendance")
  getChildAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param("childId") childId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.parentPortal.getChildAttendance(user, childId, from, to);
  }

  @Post("children/:childId/absence-requests")
  createAbsenceRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("childId") childId: string,
    @Body() dto: CreateAbsenceRequestDto,
  ) {
    return this.parentPortal.createAbsenceRequest(user, childId, dto);
  }

  @Get("absence-requests")
  listAbsenceRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.parentPortal.listAbsenceRequests(user);
  }

  @Get("menu/today")
  todayMenu(@CurrentUser() user: AuthenticatedUser) {
    return this.parentPortal.todayMenu(user);
  }

  @Get("photos")
  photos(@CurrentUser() user: AuthenticatedUser) {
    return this.parentPortal.photos(user);
  }

  @Get("photo-consents")
  getPhotoConsents(@CurrentUser() user: AuthenticatedUser) {
    return this.parentPortal.getPhotoConsents(user);
  }

  @Post("children/:childId/photo-consent")
  setPhotoConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("childId") childId: string,
    @Body() dto: SetPhotoConsentDto,
  ) {
    return this.parentPortal.setPhotoConsent(user, childId, dto.consent);
  }
}
