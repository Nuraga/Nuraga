import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import { FileUrlService } from "../common/storage/file-url.service";
import { OBJECT_STORAGE, type ObjectStorage } from "../common/storage/object-storage.interface";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { ChildAccessService, CHILD_READ_ROLES } from "./child-access.service";
import { UploadDocumentDto } from "./dto/upload-document.dto";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly childAccess: ChildAccessService,
    private readonly audit: AuditService,
    private readonly fileUrls: FileUrlService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async upload(
    user: AuthenticatedUser,
    branchId: string,
    childId: string,
    dto: UploadDocumentDto,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    this.childAccess.assertWriteAccess(user, branchId);
    await this.childAccess.getReadableOrThrow(user, branchId, childId);

    const docType = await this.prisma.documentType.findUnique({
      where: { id: dto.documentTypeId },
    });
    if (!docType) throw new NotFoundException("Unknown document type");
    if (!docType.isActive) throw new BadRequestException("This document type is archived");

    const key = `children/${childId}/${randomUUID()}-${this.sanitizeFileName(file.originalname)}`;
    await this.storage.save(key, file.buffer, file.mimetype);

    const document = await this.prisma.document.create({
      data: {
        ownerType: "CHILD",
        ownerId: childId,
        documentTypeId: dto.documentTypeId,
        fileKey: key,
        fileName: file.originalname,
        mimeType: file.mimetype,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        uploadedById: user.id,
      },
    });

    await this.audit.record({
      entity: "document",
      entityId: document.id,
      action: "create",
      newValue: { fileName: document.fileName, documentTypeId: document.documentTypeId },
      actorId: user.id,
    });

    return document;
  }

  async list(user: AuthenticatedUser, branchId: string, childId: string) {
    await this.childAccess.getReadableOrThrow(user, branchId, childId);

    const documents = await this.prisma.document.findMany({
      where: { ownerType: "CHILD", ownerId: childId },
      include: { documentType: true },
      orderBy: { createdAt: "desc" },
    });

    return Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        downloadUrl: await this.signDownloadUrl(doc),
      })),
    );
  }

  async remove(user: AuthenticatedUser, branchId: string, childId: string, documentId: string) {
    this.childAccess.assertWriteAccess(user, branchId);
    await this.childAccess.getReadableOrThrow(user, branchId, childId);

    const doc = await this.getOwnedOrThrow(childId, documentId);
    await this.storage.delete(doc.fileKey);
    await this.prisma.document.delete({ where: { id: documentId } });

    await this.audit.record({
      entity: "document",
      entityId: documentId,
      action: "delete",
      oldValue: { fileName: doc.fileName },
      actorId: user.id,
    });
  }

  /** Documents (any owner type) expiring within `daysAhead` for a branch — TRD 4.2 (14-day warning). */
  async listExpiring(user: AuthenticatedUser, branchId: string, daysAhead = 14) {
    this.branchScope.assertRoleInBranch(user, CHILD_READ_ROLES, branchId);

    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const children = await this.prisma.child.findMany({
      where: { family: { branchId } },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);

    return this.prisma.document.findMany({
      where: {
        ownerType: "CHILD",
        ownerId: { in: childIds },
        expiresAt: { gte: now, lte: cutoff },
      },
      include: { documentType: true },
      orderBy: { expiresAt: "asc" },
    });
  }

  private async signDownloadUrl(doc: { fileKey: string; mimeType: string; fileName: string }) {
    const token = await this.fileUrls.sign({
      key: doc.fileKey,
      contentType: doc.mimeType,
      fileName: doc.fileName,
    });
    return `/api/files/${token}`;
  }

  private async getOwnedOrThrow(childId: string, documentId: string) {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc || doc.ownerType !== "CHILD" || doc.ownerId !== childId) {
      throw new NotFoundException("Document not found");
    }
    return doc;
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  }
}
