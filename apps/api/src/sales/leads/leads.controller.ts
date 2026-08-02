import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type { LeadStage } from "@prisma/client";
import { LeadsService } from "./leads.service";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { UpdateLeadDto } from "./dto/update-lead.dto";
import { UpdateLeadStageDto } from "./dto/update-lead-stage.dto";
import { ConvertLeadDto } from "./dto/convert-lead.dto";
import { CreateLeadActivityDto } from "./dto/create-lead-activity.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId/leads")
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("stage") stage?: LeadStage,
    @Query("sourceId") sourceId?: string,
    @Query("responsibleUserId") responsibleUserId?: string,
    @Query("q") q?: string,
  ) {
    return this.leads.list(user, branchId, { stage, sourceId, responsibleUserId, q });
  }

  @Get("needing-attention")
  listNeedingAttention(@CurrentUser() user: AuthenticatedUser, @Param("branchId") branchId: string) {
    return this.leads.listNeedingAttention(user, branchId);
  }

  @Get("duplicates")
  checkDuplicates(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("phone") phone: string,
  ) {
    return this.leads.checkDuplicates(user, branchId, phone ?? "");
  }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("branchId") branchId: string, @Param("id") id: string) {
    return this.leads.get(user, branchId, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leads.create(user, branchId, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leads.update(user, branchId, id, dto);
  }

  @Patch(":id/stage")
  updateStage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UpdateLeadStageDto,
  ) {
    return this.leads.updateStage(user, branchId, id, dto);
  }

  @Post(":id/convert")
  convert(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: ConvertLeadDto,
  ) {
    return this.leads.convert(user, branchId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("branchId") branchId: string, @Param("id") id: string) {
    return this.leads.remove(user, branchId, id);
  }

  @Post(":id/activities")
  addActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: CreateLeadActivityDto,
  ) {
    return this.leads.addActivity(user, branchId, id, dto);
  }
}
