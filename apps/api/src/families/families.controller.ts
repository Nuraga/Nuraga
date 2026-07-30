import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { FamiliesService } from "./families.service";
import { CreateFamilyDto } from "./dto/create-family.dto";
import { UpdateFamilyDto } from "./dto/update-family.dto";
import { CreateParentDto } from "./dto/create-parent.dto";
import { UpdateParentDto } from "./dto/update-parent.dto";
import { CreateTrustedPersonDto } from "./dto/create-trusted-person.dto";
import { UpdateTrustedPersonDto } from "./dto/update-trusted-person.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId/families")
export class FamiliesController {
  constructor(private readonly families: FamiliesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: CreateFamilyDto,
  ) {
    return this.families.create(user, branchId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("search") search?: string,
  ) {
    return this.families.findAllForBranch(user, branchId, search);
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
  ) {
    return this.families.findOne(user, branchId, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: UpdateFamilyDto,
  ) {
    return this.families.update(user, branchId, id, dto);
  }

  @Post(":id/parents")
  addParent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") familyId: string,
    @Body() dto: CreateParentDto,
  ) {
    return this.families.addParent(user, branchId, familyId, dto);
  }

  @Patch(":id/parents/:parentId")
  updateParent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") familyId: string,
    @Param("parentId") parentId: string,
    @Body() dto: UpdateParentDto,
  ) {
    return this.families.updateParent(user, branchId, familyId, parentId, dto);
  }

  @Delete(":id/parents/:parentId")
  removeParent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") familyId: string,
    @Param("parentId") parentId: string,
  ) {
    return this.families.removeParent(user, branchId, familyId, parentId);
  }

  @Post(":id/trusted-persons")
  addTrustedPerson(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") familyId: string,
    @Body() dto: CreateTrustedPersonDto,
  ) {
    return this.families.addTrustedPerson(user, branchId, familyId, dto);
  }

  @Patch(":id/trusted-persons/:personId")
  updateTrustedPerson(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") familyId: string,
    @Param("personId") personId: string,
    @Body() dto: UpdateTrustedPersonDto,
  ) {
    return this.families.updateTrustedPerson(user, branchId, familyId, personId, dto);
  }

  @Delete(":id/trusted-persons/:personId")
  removeTrustedPerson(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") familyId: string,
    @Param("personId") personId: string,
  ) {
    return this.families.removeTrustedPerson(user, branchId, familyId, personId);
  }
}
