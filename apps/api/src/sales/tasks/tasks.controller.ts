import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { TasksService } from "./tasks.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId/tasks")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("leadId") leadId?: string,
    @Query("familyId") familyId?: string,
    @Query("assignedToId") assignedToId?: string,
    @Query("onlyOpen") onlyOpen?: string,
  ) {
    return this.tasks.list(user, branchId, {
      leadId,
      familyId,
      assignedToId,
      onlyOpen: onlyOpen === "true",
    });
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(user, branchId, dto);
  }

  @Post(":id/complete")
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
  ) {
    return this.tasks.complete(user, branchId, id);
  }
}
