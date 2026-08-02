import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { AuditService } from "../../common/audit/audit.service";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";
import { EnrollServiceDto } from "./dto/enroll-service.dto";

// Services (кружки/секции) are branch-operational, unlike network-wide
// tariffs, so Branch Manager can manage them too — matches how Groups/Staff
// are gated elsewhere in this codebase.
const SERVICE_MANAGER_ROLES = ["OWNER", "BRANCH_MANAGER"] as const;

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async listForBranch(user: AuthenticatedUser, branchId: string) {
    this.branchScope.assertBranchAccess(user, branchId);
    return this.prisma.service.findMany({ where: { branchId }, orderBy: { name: "asc" } });
  }

  async create(user: AuthenticatedUser, branchId: string, dto: CreateServiceDto) {
    this.branchScope.assertRoleInBranch(user, [...SERVICE_MANAGER_ROLES], branchId);

    const service = await this.prisma.service.create({ data: { ...dto, branchId } });
    await this.audit.record({
      entity: "service",
      entityId: service.id,
      action: "create",
      newValue: service,
      actorId: user.id,
    });
    return service;
  }

  async update(user: AuthenticatedUser, branchId: string, id: string, dto: UpdateServiceDto) {
    this.branchScope.assertRoleInBranch(user, [...SERVICE_MANAGER_ROLES], branchId);
    const existing = await this.getInBranch(branchId, id);

    const service = await this.prisma.service.update({ where: { id }, data: dto });
    await this.audit.record({
      entity: "service",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: service,
      actorId: user.id,
    });
    return service;
  }

  async archive(user: AuthenticatedUser, branchId: string, id: string) {
    return this.update(user, branchId, id, { isActive: false });
  }

  async enrollChild(
    user: AuthenticatedUser,
    branchId: string,
    childId: string,
    serviceId: string,
    dto: EnrollServiceDto,
  ) {
    this.branchScope.assertRoleInBranch(user, [...SERVICE_MANAGER_ROLES], branchId);
    const service = await this.getInBranch(branchId, serviceId);
    await this.assertChildInBranch(branchId, childId);

    if (service.capacity) {
      const activeCount = await this.prisma.serviceEnrollment.count({
        where: { serviceId, OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
      });
      if (activeCount >= service.capacity) {
        throw new ConflictException("This service is at capacity");
      }
    }

    const enrollment = await this.prisma.serviceEnrollment.create({
      data: {
        childId,
        serviceId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
    await this.audit.record({
      entity: "service_enrollment",
      entityId: enrollment.id,
      action: "create",
      newValue: enrollment,
      actorId: user.id,
    });
    return enrollment;
  }

  async unenrollChild(user: AuthenticatedUser, branchId: string, enrollmentId: string) {
    this.branchScope.assertRoleInBranch(user, [...SERVICE_MANAGER_ROLES], branchId);

    const enrollment = await this.prisma.serviceEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { service: true },
    });
    if (!enrollment || enrollment.service.branchId !== branchId) {
      throw new NotFoundException("Enrollment not found in this branch");
    }

    await this.prisma.serviceEnrollment.delete({ where: { id: enrollmentId } });
    await this.audit.record({
      entity: "service_enrollment",
      entityId: enrollmentId,
      action: "delete",
      oldValue: enrollment,
      actorId: user.id,
    });
  }

  private async getInBranch(branchId: string, id: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service || service.branchId !== branchId) {
      throw new NotFoundException("Service not found in this branch");
    }
    return service;
  }

  private async assertChildInBranch(branchId: string, childId: string): Promise<void> {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child) throw new NotFoundException("Child not found");
    const family = await this.prisma.family.findUnique({ where: { id: child.familyId } });
    if (!family || family.branchId !== branchId) {
      throw new NotFoundException("Child not found");
    }
  }
}
