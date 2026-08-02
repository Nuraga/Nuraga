import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { DishesService } from "./dishes.service";
import { CreateDishDto } from "./dto/create-dish.dto";
import { UpdateDishDto } from "./dto/update-dish.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("dishes")
export class DishesController {
  constructor(private readonly dishes: DishesService) {}

  @Get()
  findAll() {
    return this.dishes.findAll();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDishDto) {
    return this.dishes.create(user, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateDishDto,
  ) {
    return this.dishes.update(user, id, dto);
  }

  @Post(":id/archive")
  archive(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.dishes.archive(user, id);
  }
}
