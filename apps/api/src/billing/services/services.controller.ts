import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";
import { EnrollServiceDto } from "./dto/enroll-service.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId")
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get("services")
  listForBranch(@CurrentUser() user: AuthenticatedUser, @Param("branchId") branchId: string) {
    return this.services.listForBranch(user, branchId);
  }

  @Post("services")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: CreateServiceDto,
  ) {
    return this.services.create(user, branchId, dto);
  }

  @Patch("services/:id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.services.update(user, branchId, id, dto);
  }

  @Post("services/:id/archive")
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
  ) {
    return this.services.archive(user, branchId, id);
  }

  @Post("children/:childId/services/:serviceId")
  enroll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("childId") childId: string,
    @Param("serviceId") serviceId: string,
    @Body() dto: EnrollServiceDto,
  ) {
    return this.services.enrollChild(user, branchId, childId, serviceId, dto);
  }

  @Delete("service-enrollments/:enrollmentId")
  unenroll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("enrollmentId") enrollmentId: string,
  ) {
    return this.services.unenrollChild(user, branchId, enrollmentId);
  }
}
