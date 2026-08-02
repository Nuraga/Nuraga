import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Role, TaskStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { AuditService } from "../../common/audit/audit.service";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";
import { CreateTaskDto } from "./dto/create-task.dto";

// ТЗ §2.2 has no dedicated "Задачи" row — reusing the "Лиды" row's roles for
// management access. Tasks with neither leadId nor familyId are general
// staff assignments (заведующий -> воспитатель/няня); any staff member can
// read/update the status of a task assigned to them regardless of role.
const TASK_READ_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER"];
const TASK_WRITE_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER"];

export interface TaskFilters {
  leadId?: string;
  familyId?: string;
  assignedToId?: string;
  onlyOpen?: boolean;
  /** "staff" restricts to general staff assignments (no lead/family link) — used by the kanban board. */
  scope?: "staff";
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, branchId: string, filters: TaskFilters) {
    const isOwnTasksOnly = Boolean(filters.assignedToId) && filters.assignedToId === user.id;
    if (isOwnTasksOnly) {
      this.branchScope.assertBranchAccess(user, branchId);
    } else {
      this.branchScope.assertRoleInBranch(user, TASK_READ_ROLES, branchId);
    }

    return this.prisma.task.findMany({
      where: {
        branchId,
        ...(filters.scope === "staff" ? { leadId: null, familyId: null } : {}),
        ...(filters.leadId ? { leadId: filters.leadId } : {}),
        ...(filters.familyId ? { familyId: filters.familyId } : {}),
        ...(filters.assignedToId ? { assignedToId: filters.assignedToId } : {}),
        ...(filters.onlyOpen ? { completedAt: null } : {}),
      },
      orderBy: { dueAt: "asc" },
    });
  }

  async create(user: AuthenticatedUser, branchId: string, dto: CreateTaskDto) {
    this.branchScope.assertRoleInBranch(user, TASK_WRITE_ROLES, branchId);

    if (dto.leadId && dto.familyId) {
      throw new BadRequestException("A task cannot be linked to both a lead and a family");
    }

    if (dto.leadId) await this.assertLeadInBranch(branchId, dto.leadId);
    if (dto.familyId) await this.assertFamilyInBranch(branchId, dto.familyId);

    const task = await this.prisma.task.create({
      data: {
        branchId,
        leadId: dto.leadId,
        familyId: dto.familyId,
        description: dto.description,
        dueAt: new Date(dto.dueAt),
        assignedToId: dto.assignedToId,
      },
    });
    await this.audit.record({
      entity: "task",
      entityId: task.id,
      action: "create",
      newValue: task,
      actorId: user.id,
    });
    return task;
  }

  async complete(user: AuthenticatedUser, branchId: string, id: string) {
    return this.updateStatus(user, branchId, id, "DONE");
  }

  async updateStatus(user: AuthenticatedUser, branchId: string, id: string, status: TaskStatus) {
    const existing = await this.getInBranch(user, branchId, id);

    if (!this.branchScope.hasAnyRoleInBranch(user, TASK_WRITE_ROLES, branchId) && existing.assignedToId !== user.id) {
      throw new ForbiddenException("You can only update tasks assigned to you");
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: { status, completedAt: status === "DONE" ? new Date() : null },
    });
    await this.audit.record({
      entity: "task",
      entityId: id,
      action: "update",
      oldValue: { status: existing.status },
      newValue: { status },
      actorId: user.id,
    });
    return task;
  }

  private async getInBranch(user: AuthenticatedUser, branchId: string, id: string) {
    this.branchScope.assertBranchAccess(user, branchId);

    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task || task.branchId !== branchId) throw new NotFoundException("Task not found");
    return task;
  }

  private async assertLeadInBranch(branchId: string, leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.branchId !== branchId) {
      throw new BadRequestException("Lead does not belong to this branch");
    }
  }

  private async assertFamilyInBranch(branchId: string, familyId: string): Promise<void> {
    const family = await this.prisma.family.findUnique({ where: { id: familyId } });
    if (!family || family.branchId !== branchId) {
      throw new BadRequestException("Family does not belong to this branch");
    }
  }
}
