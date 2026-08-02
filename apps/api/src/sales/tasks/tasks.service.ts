import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Role } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { AuditService } from "../../common/audit/audit.service";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";
import { CreateTaskDto } from "./dto/create-task.dto";

// ТЗ §2.2 has no dedicated "Задачи" row — reusing the "Лиды" row's roles
// since tasks in this MVP pass are always lead-linked (family-linked tasks
// are modeled but not yet exposed in the UI).
const TASK_READ_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER"];
const TASK_WRITE_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER"];

export interface TaskFilters {
  leadId?: string;
  familyId?: string;
  assignedToId?: string;
  onlyOpen?: boolean;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, branchId: string, filters: TaskFilters) {
    this.branchScope.assertRoleInBranch(user, TASK_READ_ROLES, branchId);

    return this.prisma.task.findMany({
      where: {
        OR: [{ lead: { branchId } }, { family: { branchId } }],
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

    const hasLead = Boolean(dto.leadId);
    const hasFamily = Boolean(dto.familyId);
    if (hasLead === hasFamily) {
      throw new BadRequestException("Provide exactly one of leadId or familyId");
    }

    if (dto.leadId) await this.assertLeadInBranch(branchId, dto.leadId);
    if (dto.familyId) await this.assertFamilyInBranch(branchId, dto.familyId);

    const task = await this.prisma.task.create({
      data: {
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
    const existing = await this.getInBranch(user, branchId, id);

    const task = await this.prisma.task.update({
      where: { id },
      data: { completedAt: new Date() },
    });
    await this.audit.record({
      entity: "task",
      entityId: id,
      action: "update",
      oldValue: { completedAt: existing.completedAt },
      newValue: { event: "complete" },
      actorId: user.id,
    });
    return task;
  }

  private async getInBranch(user: AuthenticatedUser, branchId: string, id: string) {
    this.branchScope.assertRoleInBranch(user, TASK_WRITE_ROLES, branchId);

    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { lead: { select: { branchId: true } }, family: { select: { branchId: true } } },
    });
    if (!task) throw new NotFoundException("Task not found");

    const taskBranchId = task.lead?.branchId ?? task.family?.branchId;
    if (taskBranchId !== branchId) throw new NotFoundException("Task not found");
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
