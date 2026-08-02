import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AllergensService } from "./allergens.service";
import { CreateAllergenDto } from "./dto/create-allergen.dto";
import { UpdateAllergenDto } from "./dto/update-allergen.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("allergens")
export class AllergensController {
  constructor(private readonly allergens: AllergensService) {}

  @Get()
  findAll() {
    return this.allergens.findAll();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAllergenDto) {
    return this.allergens.create(user, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateAllergenDto,
  ) {
    return this.allergens.update(user, id, dto);
  }

  @Post(":id/archive")
  archive(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.allergens.archive(user, id);
  }
}
