import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import { plainToInstance } from "class-transformer";
import { validate, type ValidationError } from "class-validator";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { ImportChildRowDto } from "./dto/import-child-row.dto";

const IMPORT_WRITE_ROLES = ["OWNER", "BRANCH_MANAGER", "MANAGER"] as const;

const REQUIRED_COLUMNS = [
  "family_name",
  "child_full_name",
  "child_birth_date",
  "parent_full_name",
  "parent_relationship",
] as const;

const MAX_ROWS = 2000;

export interface ImportRowResult {
  row: number;
  status: "created" | "error";
  familyId?: string;
  childId?: string;
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
    familyName: row.family_name,
    childFullName: row.child_full_name,
    childBirthDate: row.child_birth_date,
    childSex: row.child_sex || undefined,
    parentFullName: row.parent_full_name,
    parentRelationship: row.parent_relationship,
    parentPhone: row.parent_phone || undefined,
    parentEmail: row.parent_email || undefined,
  };
}

function flattenErrors(errors: ValidationError[]): string[] {
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

// Each row creates one Family (with one Parent) and one Child onto the
// waitlist — bulk onboarding for a kindergarten migrating off spreadsheets.
// Enrollment into a group is a deliberate, separate step (capacity checks
// don't belong inside a batch import), matching the Milestone 5 flow.
@Injectable()
export class ChildrenImportService {
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
      const instance = plainToInstance(ImportChildRowDto, toRowShape(rawRows[i]));
      const errors = await validate(instance, { whitelist: true });

      if (errors.length > 0) {
        failed++;
        results.push({ row: rowNumber, status: "error", errors: flattenErrors(errors) });
        continue;
      }

      if (dryRun) {
        created++;
        results.push({ row: rowNumber, status: "created" });
        continue;
      }

      try {
        const { familyId, childId } = await this.createFamilyAndChild(branchId, instance);
        created++;
        results.push({ row: rowNumber, status: "created", familyId, childId });
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
        newValue: { branchId, totalRows: rawRows.length, created, failed },
        actorId: user.id,
      });
    }

    return { totalRows: rawRows.length, created, failed, dryRun, results };
  }

  private async createFamilyAndChild(branchId: string, row: ImportChildRowDto) {
    return this.prisma.$transaction(async (tx) => {
      const family = await tx.family.create({ data: { branchId, name: row.familyName } });
      await tx.parent.create({
        data: {
          familyId: family.id,
          fullName: row.parentFullName,
          relationship: row.parentRelationship,
          phone: row.parentPhone,
          email: row.parentEmail,
        },
      });
      const child = await tx.child.create({
        data: {
          familyId: family.id,
          fullName: row.childFullName,
          birthDate: new Date(row.childBirthDate),
          sex: row.childSex,
          status: "WAITLIST",
        },
      });
      return { familyId: family.id, childId: child.id };
    });
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
