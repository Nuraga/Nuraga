import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CreateDocumentTypeDto } from "./dto/create-document-type.dto";
import { UpdateDocumentTypeDto } from "./dto/update-document-type.dto";

const NETWORK_ADMIN_ROLES = ["OWNER", "SUPERADMIN"] as const;

@Injectable()
export class DocumentTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    return this.prisma.documentType.findMany({ orderBy: { name: "asc" } });
  }

  async create(user: AuthenticatedUser, dto: CreateDocumentTypeDto) {
    this.assertNetworkAdmin(user);

    const docType = await this.prisma.documentType.create({ data: dto });
    await this.audit.record({
      entity: "document_type",
      entityId: docType.id,
      action: "create",
      newValue: docType,
      actorId: user.id,
    });
    return docType;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateDocumentTypeDto) {
    this.assertNetworkAdmin(user);

    const existing = await this.prisma.documentType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Document type not found");

    const docType = await this.prisma.documentType.update({ where: { id }, data: dto });
    await this.audit.record({
      entity: "document_type",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: docType,
      actorId: user.id,
    });
    return docType;
  }

  async archive(user: AuthenticatedUser, id: string) {
    return this.update(user, id, { isActive: false });
  }

  private assertNetworkAdmin(user: AuthenticatedUser): void {
    if (!this.branchScope.hasAnyRole(user, [...NETWORK_ADMIN_ROLES])) {
      throw new ForbiddenException("Only Owner/Superadmin may manage dictionaries");
    }
  }
}
