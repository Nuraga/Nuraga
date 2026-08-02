import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import { plainToInstance } from "class-transformer";
import { validate, type ValidationError } from "class-validator";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { normalizePhone } from "../sales/leads/leads.service";
import { ImportLeadRowDto } from "./dto/import-lead-row.dto";

const IMPORT_WRITE_ROLES = ["OWNER", "BRANCH_MANAGER", "MANAGER"] as const;

const REQUIRED_COLUMNS = ["parent_full_name", "parent_phone", "responsible_email"] as const;

const MAX_ROWS = 2000;

export interface ImportRowResult {
  row: number;
  status: "created" | "error";
  leadId?: string;
  errors?: string[];
}

export interface ImportReport {
  totalRows: number;
  created: number;
  failed: number;
  dryRun: boolean;
  results: ImportRowResult[];
}

function toRowShape(row: Record<string, string>) {
  return {
    parentFullName: row.parent_full_name,
    parentPhone: row.parent_phone,
    parentEmail: row.parent_email || undefined,
    childFullName: row.child_full_name || undefined,
    childBirthDate: row.child_birth_date || undefined,
    targetDate: row.target_date || undefined,
    sourceName: row.source_name || undefined,
    responsibleEmail: row.responsible_email,
  };
}

function flattenErrors(errors: ValidationError[]): string[] {
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

// One CSV row = one Lead in stage NEW — bulk intake for a network migrating
// its existing lead spreadsheet (ТЗ §3.1 "Импорт из CSV/Excel"). Unlike
// real-time lead creation via LeadsService.create, this path does NOT block
// on cross-network phone duplicates — a bulk historical import is expected
// to contain repeat contacts, and there is no user present to confirm each
// one interactively.
@Injectable()
export class LeadsImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async import(
    user: AuthenticatedUser,
    branchId: string,
    file: { buffer: Buffer },
    dryRun: boolean,
  ): Promise<ImportReport> {
    this.branchScope.assertRoleInBranch(user, [...IMPORT_WRITE_ROLES], branchId);

    const rawRows = this.parseCsv(file.buffer);
    if (rawRows.length === 0) {
      throw new BadRequestException("CSV file has no data rows");
    }
    if (rawRows.length > MAX_ROWS) {
      throw new BadRequestException(`CSV has too many rows (max ${MAX_ROWS})`);
    }

    const results: ImportRowResult[] = [];
    let created = 0;
    let failed = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const rowNumber = i + 2; // header occupies row 1
      const instance = plainToInstance(ImportLeadRowDto, toRowShape(rawRows[i]));
      const errors = await validate(instance, { whitelist: true });

      if (errors.length > 0) {
        failed++;
        results.push({ row: rowNumber, status: "error", errors: flattenErrors(errors) });
        continue;
      }

      const resolved = await this.resolveReferences(instance);
      if (resolved.errors.length > 0) {
        failed++;
        results.push({ row: rowNumber, status: "error", errors: resolved.errors });
        continue;
      }

      if (dryRun) {
        created++;
        results.push({ row: rowNumber, status: "created" });
        continue;
      }

      try {
        const leadId = await this.createLead(branchId, instance, resolved);
        created++;
        results.push({ row: rowNumber, status: "created", leadId });
      } catch (err) {
        failed++;
        results.push({
          row: rowNumber,
          status: "error",
          errors: [err instanceof Error ? err.message : "Unknown error"],
        });
      }
    }

    if (!dryRun) {
      await this.audit.record({
        entity: "import",
        entityId: randomUUID(),
        action: "create",
        newValue: { branchId, type: "leads", totalRows: rawRows.length, created, failed },
        actorId: user.id,
      });
    }

    return { totalRows: rawRows.length, created, failed, dryRun, results };
  }

  /**
   * Resolves the human-readable source_name/responsible_email columns to
   * ids — a read, so it runs in dry-run too. Mirrors LeadsService.create,
   * which likewise doesn't verify the responsible user holds a role in this
   * branch — that's a staff-management concern, not an import one.
   */
  private async resolveReferences(row: ImportLeadRowDto) {
    const errors: string[] = [];

    let sourceId: string | undefined;
    if (row.sourceName) {
      const source = await this.prisma.leadSource.findFirst({
        where: { name: { equals: row.sourceName, mode: "insensitive" }, isActive: true },
      });
      if (!source) errors.push(`Unknown or archived lead source: "${row.sourceName}"`);
      else sourceId = source.id;
    }

    const responsible = await this.prisma.user.findUnique({ where: { email: row.responsibleEmail } });
    let responsibleUserId: string | undefined;
    if (!responsible) errors.push(`Unknown responsible user email: "${row.responsibleEmail}"`);
    else responsibleUserId = responsible.id;

    return { sourceId, responsibleUserId, errors };
  }

  private async createLead(
    branchId: string,
    row: ImportLeadRowDto,
    resolved: { sourceId?: string; responsibleUserId?: string },
  ) {
    const lead = await this.prisma.lead.create({
      data: {
        branchId,
        parentFullName: row.parentFullName,
        parentPhone: row.parentPhone,
        parentPhoneNormalized: normalizePhone(row.parentPhone),
        parentEmail: row.parentEmail,
        childFullName: row.childFullName,
        childBirthDate: row.childBirthDate ? new Date(row.childBirthDate) : undefined,
        targetDate: row.targetDate ? new Date(row.targetDate) : undefined,
        sourceId: resolved.sourceId,
        responsibleUserId: resolved.responsibleUserId!,
      },
    });
    return lead.id;
  }

  private parseCsv(buffer: Buffer): Record<string, string>[] {
    try {
      return parse(buffer, {
        columns: (header: string[]) => {
          const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
          if (missing.length > 0) {
            throw new BadRequestException(
              `CSV is missing required column(s): ${missing.join(", ")}`,
            );
          }
          return header;
        },
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException("Could not parse CSV file");
    }
  }
}
