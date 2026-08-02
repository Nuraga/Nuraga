import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditRecordInput {
  entity: string;
  entityId: string;
  action: "create" | "update" | "delete";
  oldValue?: unknown;
  newValue?: unknown;
  actorId?: string | null;
  ip?: string | null;
}

// Append-only. No update/delete method is exposed on purpose (TRD 9.3:
// audit log must not be editable from the app layer).
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        oldValue: input.oldValue === undefined ? undefined : (input.oldValue as object),
        newValue: input.newValue === undefined ? undefined : (input.newValue as object),
        actorId: input.actorId ?? null,
        ip: input.ip ?? null,
      },
    });
  }
}
