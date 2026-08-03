import { randomUUID } from "node:crypto";
import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { FileUrlService } from "../common/storage/file-url.service";
import { OBJECT_STORAGE, type ObjectStorage } from "../common/storage/object-storage.interface";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { PhotoAccessService } from "./photo-access.service";
import type { UploadPhotoDto } from "./dto/upload-photo.dto";

export interface PhotoConsentGap {
  childId: string;
  fullName: string;
}

export interface PhotoView {
  id: string;
  groupId: string;
  caption: string | null;
  takenAt: string;
  uploadedById: string;
  createdAt: string;
  downloadUrl: string;
}

interface StoredPhoto {
  id: string;
  groupId: string;
  caption: string | null;
  takenAt: Date;
  uploadedById: string;
  createdAt: Date;
  fileKey: string;
  fileName: string;
  mimeType: string;
}

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photoAccess: PhotoAccessService,
    private readonly audit: AuditService,
    private readonly fileUrls: FileUrlService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async upload(
    user: AuthenticatedUser,
    branchId: string,
    dto: UploadPhotoDto,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ): Promise<PhotoView> {
    await this.photoAccess.assertGroupAccess(user, branchId, dto.groupId);

    const group = await this.prisma.group.findUnique({ where: { id: dto.groupId } });
    if (!group || group.branchId !== branchId) throw new NotFoundException("Group not found");

    const key = `photos/${branchId}/${dto.groupId}/${randomUUID()}-${this.sanitizeFileName(file.originalname)}`;
    await this.storage.save(key, file.buffer, file.mimetype);

    const photo = await this.prisma.photo.create({
      data: {
        branchId,
        groupId: dto.groupId,
        fileKey: key,
        fileName: file.originalname,
        mimeType: file.mimetype,
        caption: dto.caption,
        takenAt: dto.takenAt ? new Date(dto.takenAt) : undefined,
        uploadedById: user.id,
      },
    });

    await this.audit.record({
      entity: "photo",
      entityId: photo.id,
      action: "create",
      newValue: { groupId: photo.groupId, fileName: photo.fileName },
      actorId: user.id,
    });

    return this.toView(photo);
  }

  async list(user: AuthenticatedUser, branchId: string, groupId: string): Promise<PhotoView[]> {
    await this.photoAccess.assertGroupAccess(user, branchId, groupId);

    const photos = await this.prisma.photo.findMany({
      where: { branchId, groupId },
      orderBy: { takenAt: "desc" },
    });

    return Promise.all(photos.map((p) => this.toView(p)));
  }

  async remove(user: AuthenticatedUser, branchId: string, photoId: string): Promise<void> {
    const photo = await this.prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo || photo.branchId !== branchId) throw new NotFoundException("Photo not found");

    if (!this.photoAccess.canManage(user, branchId)) {
      const isAssignedToGroup = await this.photoAccess
        .assertGroupAccess(user, branchId, photo.groupId)
        .then(() => true)
        .catch(() => false);
      if (!isAssignedToGroup || photo.uploadedById !== user.id) {
        throw new ForbiddenException("Can only delete your own photos");
      }
    }

    await this.storage.delete(photo.fileKey);
    await this.prisma.photo.delete({ where: { id: photoId } });

    await this.audit.record({
      entity: "photo",
      entityId: photoId,
      action: "delete",
      oldValue: { fileName: photo.fileName },
      actorId: user.id,
    });
  }

  /**
   * Informational only (mirrors MenuService.computeConflicts' non-blocking
   * pattern) — enrolled children in this group without a granted photo
   * consent, so the uploader can leave them out of the shot. Never blocks
   * the upload and is never used to filter what a parent sees.
   */
  async consentGaps(user: AuthenticatedUser, branchId: string, groupId: string): Promise<PhotoConsentGap[]> {
    await this.photoAccess.assertGroupAccess(user, branchId, groupId);

    const children = await this.prisma.child.findMany({
      where: { groupId, status: "ENROLLED" },
      select: { id: true, fullName: true, photoConsent: { select: { consent: true } } },
    });

    return children
      .filter((c) => !c.photoConsent?.consent)
      .map((c) => ({ childId: c.id, fullName: c.fullName }));
  }

  private async toView(photo: StoredPhoto): Promise<PhotoView> {
    const token = await this.fileUrls.sign({
      key: photo.fileKey,
      contentType: photo.mimeType,
      fileName: photo.fileName,
    });
    return {
      id: photo.id,
      groupId: photo.groupId,
      caption: photo.caption,
      takenAt: photo.takenAt.toISOString(),
      uploadedById: photo.uploadedById,
      createdAt: photo.createdAt.toISOString(),
      downloadUrl: `/api/files/${token}`,
    };
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  }
}
