import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Role } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { AuditService } from "../../common/audit/audit.service";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";
import { GenerateInvoicesDto } from "./dto/generate-invoices.dto";
import { AddAdjustmentDto } from "./dto/add-adjustment.dto";

// ТЗ §2.2 "Начисления и счета": only Owner and Accountant have write access
// (ПСРУ); Branch Manager/Manager are view-only (П) for this row specifically
// — unlike most other financial rows where Branch Manager can act.
const INVOICE_WRITE_ROLES: Role[] = ["OWNER", "ACCOUNTANT"];
const INVOICE_READ_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT"];

interface DraftLine {
  childId?: string;
  serviceId?: string;
  type: "TARIFF" | "SERVICE" | "RECALC" | "DISCOUNT" | "PREVIOUS_BALANCE";
  description: string;
  amountMinor: number;
  ruleRef?: string;
}

@Injectable()
export class InvoicingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Month-close draft generation (ТЗ §6.4 steps 1-3). Requires the
   * attendance timesheet for the period to already be closed. Idempotent:
   * re-running regenerates DRAFT invoices from scratch but never touches an
   * APPROVED/PAID one for the same family+period.
   */
  async generateForBranch(user: AuthenticatedUser, branchId: string, dto: GenerateInvoicesDto) {
    this.branchScope.assertRoleInBranch(user, INVOICE_WRITE_ROLES, branchId);

    const period = await this.prisma.timesheetPeriod.findUnique({
      where: { branchId_year_month: { branchId, year: dto.year, month: dto.month } },
    });
    if (period?.status !== "CLOSED") {
      throw new BadRequestException(
        "The attendance timesheet for this period must be closed before generating invoices",
      );
    }

    const { monthStart, monthEnd } = this.monthRange(dto.year, dto.month);

    const contracts = await this.prisma.contract.findMany({
      where: {
        status: "ACTIVE",
        family: { branchId },
        startDate: { lt: monthEnd },
        OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
      },
      include: { tariff: true },
    });

    const contractsByFamily = new Map<string, typeof contracts>();
    for (const contract of contracts) {
      const list = contractsByFamily.get(contract.familyId) ?? [];
      list.push(contract);
      contractsByFamily.set(contract.familyId, list);
    }

    const results: { familyId: string; status: string; totalMinor?: number }[] = [];

    for (const [familyId, familyContracts] of contractsByFamily) {
      const existing = await this.prisma.invoice.findUnique({
        where: { familyId_year_month: { familyId, year: dto.year, month: dto.month } },
      });
      if (existing && existing.status !== "DRAFT") {
        results.push({ familyId, status: "skipped_already_finalized" });
        continue;
      }

      const lines = await this.buildDraftLines(familyId, familyContracts, dto.year, dto.month, monthStart, monthEnd);
      const totalMinor = lines.reduce((sum, l) => sum + l.amountMinor, 0);

      if (existing) {
        await this.prisma.invoiceLine.deleteMany({ where: { invoiceId: existing.id } });
        await this.prisma.invoice.update({
          where: { id: existing.id },
          data: { totalMinor, lines: { create: lines } },
        });
      } else {
        await this.prisma.invoice.create({
          data: { familyId, branchId, year: dto.year, month: dto.month, totalMinor, lines: { create: lines } },
        });
      }
      results.push({ familyId, status: "draft_generated", totalMinor });
    }

    await this.audit.record({
      entity: "invoice_batch",
      entityId: `${branchId}:${dto.year}-${dto.month}`,
      action: "create",
      newValue: { branchId, year: dto.year, month: dto.month, familiesProcessed: results.length },
      actorId: user.id,
    });

    return { totalFamilies: results.length, results };
  }

  async listForBranch(user: AuthenticatedUser, branchId: string, year?: number, month?: number) {
    this.branchScope.assertRoleInBranch(user, INVOICE_READ_ROLES, branchId);
    return this.prisma.invoice.findMany({
      where: { branchId, year, month },
      include: { family: { select: { id: true, name: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  async listForFamily(user: AuthenticatedUser, branchId: string, familyId: string) {
    this.branchScope.assertRoleInBranch(user, INVOICE_READ_ROLES, branchId);
    await this.assertFamilyInBranch(branchId, familyId);
    return this.prisma.invoice.findMany({
      where: { familyId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  async getOne(user: AuthenticatedUser, branchId: string, id: string) {
    this.branchScope.assertRoleInBranch(user, INVOICE_READ_ROLES, branchId);
    return this.getInBranch(branchId, id, { lines: { orderBy: { createdAt: "asc" } } });
  }

  async addAdjustment(user: AuthenticatedUser, branchId: string, id: string, dto: AddAdjustmentDto) {
    this.branchScope.assertRoleInBranch(user, INVOICE_WRITE_ROLES, branchId);
    const invoice = await this.getInBranch(branchId, id);
    if (invoice.status !== "DRAFT") {
      throw new BadRequestException("Only a draft invoice can be manually adjusted");
    }

    await this.prisma.invoiceLine.create({
      data: {
        invoiceId: id,
        childId: dto.childId,
        type: "MANUAL_ADJUSTMENT",
        description: dto.description,
        amountMinor: dto.amountMinor,
        ruleRef: `manual: ${dto.comment}`,
      },
    });
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { totalMinor: invoice.totalMinor + dto.amountMinor },
    });

    await this.audit.record({
      entity: "invoice",
      entityId: id,
      action: "update",
      newValue: { event: "manual_adjustment", amountMinor: dto.amountMinor, comment: dto.comment },
      actorId: user.id,
    });
    return updated;
  }

  /** Freezes the invoice (ТЗ §6.4 step 4-5): immutable from here on except via a corrective record. */
  async approve(user: AuthenticatedUser, branchId: string, id: string) {
    this.branchScope.assertRoleInBranch(user, INVOICE_WRITE_ROLES, branchId);
    const invoice = await this.getInBranch(branchId, id);
    if (invoice.status !== "DRAFT") {
      throw new BadRequestException("Only a draft invoice can be approved");
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
    });
    await this.audit.record({
      entity: "invoice",
      entityId: id,
      action: "update",
      oldValue: { status: "DRAFT" },
      newValue: { event: "approve", status: "APPROVED" },
      actorId: user.id,
    });
    return updated;
  }

  private async buildDraftLines(
    familyId: string,
    familyContracts: Array<{ id: string; childId: string; tariffId: string; tariff: { id: string; name: string; baseAmountMinor: number; recalcRule: string; recalcThresholdDays: number | null } }>,
    year: number,
    month: number,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<DraftLine[]> {
    const lines: DraftLine[] = [];
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    for (const contract of familyContracts) {
      const tariff = contract.tariff;
      lines.push({
        childId: contract.childId,
        type: "TARIFF",
        description: `Абонплата: ${tariff.name}`,
        amountMinor: tariff.baseAmountMinor,
        ruleRef: `tariff:${tariff.id}`,
      });

      if (tariff.recalcRule !== "NONE") {
        const sickDays = await this.prisma.attendance.count({
          where: { childId: contract.childId, date: { gte: monthStart, lt: monthEnd }, status: "ABSENT_SICK" },
        });
        const dailyRate = Math.round(tariff.baseAmountMinor / daysInMonth);

        if (tariff.recalcRule === "FULL_DAY_WITH_THRESHOLD") {
          const threshold = tariff.recalcThresholdDays ?? 1;
          if (sickDays >= threshold) {
            lines.push({
              childId: contract.childId,
              type: "RECALC",
              description: `Перерасчёт за болезнь: ${sickDays} дн.`,
              amountMinor: -(dailyRate * sickDays),
              ruleRef: `recalc:full_day,sick_days=${sickDays},threshold=${threshold}`,
            });
          }
        } else if (tariff.recalcRule === "MEALS_ONLY" && sickDays > 0) {
          // Meal-portion fraction is a placeholder — ТЗ §15.2 open question #3
          // leaves per-branch recalculation rules unconfirmed by the client.
          // Flag this for review before relying on it for a real invoice.
          const MEALS_FRACTION_PLACEHOLDER = 0.3;
          lines.push({
            childId: contract.childId,
            type: "RECALC",
            description: `Перерасчёт питания за болезнь: ${sickDays} дн.`,
            amountMinor: -Math.round(dailyRate * MEALS_FRACTION_PLACEHOLDER * sickDays),
            ruleRef: `recalc:meals_only[UNCONFIRMED_FRACTION],sick_days=${sickDays}`,
          });
        }
      }

      const enrollments = await this.prisma.serviceEnrollment.findMany({
        where: {
          childId: contract.childId,
          startDate: { lt: monthEnd },
          OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
        },
        include: { service: true },
      });
      for (const enrollment of enrollments) {
        lines.push({
          childId: contract.childId,
          serviceId: enrollment.serviceId,
          type: "SERVICE",
          description: enrollment.service.name,
          amountMinor: enrollment.service.priceMinor,
          ruleRef: `service:${enrollment.serviceId}`,
        });
      }
    }

    const discounts = await this.prisma.discount.findMany({
      where: {
        isActive: true,
        validFrom: { lte: monthEnd },
        OR: [{ validTo: null }, { validTo: { gte: monthStart } }],
        AND: [{ OR: [{ familyId }, { child: { familyId } }] }],
      },
    });
    for (const discount of discounts) {
      const basisMinor = discount.childId
        ? lines.filter((l) => l.childId === discount.childId && l.amountMinor > 0).reduce((s, l) => s + l.amountMinor, 0)
        : lines.filter((l) => l.amountMinor > 0).reduce((s, l) => s + l.amountMinor, 0);
      const amount = discount.kind === "PERCENT" ? Math.round((basisMinor * discount.value) / 100) : discount.value;

      lines.push({
        childId: discount.childId ?? undefined,
        type: "DISCOUNT",
        description: `Скидка (${discount.basis})`,
        amountMinor: -amount,
        ruleRef: `discount:${discount.id}`,
      });
    }

    const advanceMinor = await this.computeAdvanceCredit(familyId);
    if (advanceMinor > 0) {
      const subtotal = lines.reduce((s, l) => s + l.amountMinor, 0);
      const applied = Math.min(advanceMinor, Math.max(subtotal, 0));
      if (applied > 0) {
        lines.push({
          type: "PREVIOUS_BALANCE",
          description: "Зачёт аванса с прошлого периода",
          amountMinor: -applied,
          ruleRef: "carry_forward:advance",
        });
      }
    }

    return lines;
  }

  /** Payments received but not yet allocated to any invoice (ТЗ §11.3 invariant #2). */
  private async computeAdvanceCredit(familyId: string): Promise<number> {
    const [paid, invoiced] = await Promise.all([
      this.prisma.payment.aggregate({ where: { familyId }, _sum: { amountMinor: true } }),
      this.prisma.invoice.aggregate({
        where: { familyId, status: { in: ["APPROVED", "PARTIALLY_PAID", "PAID"] } },
        _sum: { totalMinor: true },
      }),
    ]);
    const totalPaid = paid._sum.amountMinor ?? 0;
    const totalInvoiced = invoiced._sum.totalMinor ?? 0;
    return Math.max(0, totalPaid - totalInvoiced);
  }

  private monthRange(year: number, month: number) {
    return {
      monthStart: new Date(Date.UTC(year, month - 1, 1)),
      monthEnd: new Date(Date.UTC(year, month, 1)),
    };
  }

  private async getInBranch(branchId: string, id: string, include?: Record<string, unknown>) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include });
    if (!invoice || invoice.branchId !== branchId) {
      throw new NotFoundException("Invoice not found in this branch");
    }
    return invoice;
  }

  private async assertFamilyInBranch(branchId: string, familyId: string): Promise<void> {
    const family = await this.prisma.family.findUnique({ where: { id: familyId } });
    if (!family || family.branchId !== branchId) {
      throw new NotFoundException("Family not found in this branch");
    }
  }
}
