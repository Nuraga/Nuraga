import { Injectable, NotFoundException } from "@nestjs/common";
import type { InvoiceStatus, Role } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { AuditService } from "../../common/audit/audit.service";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";
import { RecordPaymentDto } from "./dto/record-payment.dto";

// ТЗ §2.2 "Приём оплаты": Branch Manager/Manager can record (ПС), Accountant
// has full control (ПСРУ). Owner is technically П (view-only) in the letter
// of the matrix, but this codebase's BranchScopeService always grants Owner
// full access via hasNetworkAccess — see billing invoicing.service.ts for
// the same note.
const PAYMENT_RECORD_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT"];
const PAYMENT_READ_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT"];
const OPEN_INVOICE_STATUSES: InvoiceStatus[] = ["APPROVED", "PARTIALLY_PAID"];

export interface FamilyBalance {
  totalPaidMinor: number;
  totalInvoicedMinor: number;
  balanceMinor: number;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Records the payment then allocates it FIFO across the family's open
   * invoices, oldest period first (ТЗ §6.5: "Разнесение платежей ... в
   * порядке от старых к новым"). Any amount left over after all open
   * invoices are covered simply isn't allocated — it becomes advance credit,
   * read back later via getFamilyBalance / InvoicingService's carry-forward.
   */
  async recordPayment(user: AuthenticatedUser, branchId: string, familyId: string, dto: RecordPaymentDto) {
    this.branchScope.assertRoleInBranch(user, PAYMENT_RECORD_ROLES, branchId);
    await this.assertFamilyInBranch(branchId, familyId);

    const payment = await this.prisma.payment.create({
      data: {
        familyId,
        branchId,
        amountMinor: dto.amountMinor,
        method: dto.method,
        paidAt: new Date(dto.paidAt),
        externalRef: dto.externalRef,
        recordedById: user.id,
      },
    });

    await this.allocateFifo(payment.id, familyId, dto.amountMinor);

    await this.audit.record({
      entity: "payment",
      entityId: payment.id,
      action: "create",
      newValue: payment,
      actorId: user.id,
    });
    return payment;
  }

  async listForFamily(user: AuthenticatedUser, branchId: string, familyId: string) {
    this.branchScope.assertRoleInBranch(user, PAYMENT_READ_ROLES, branchId);
    await this.assertFamilyInBranch(branchId, familyId);
    return this.prisma.payment.findMany({ where: { familyId }, orderBy: { paidAt: "desc" } });
  }

  /** ТЗ §11.3 invariant #2: balance = Σ оплат − Σ утверждённых начислений. */
  async getFamilyBalance(user: AuthenticatedUser, branchId: string, familyId: string): Promise<FamilyBalance> {
    this.branchScope.assertRoleInBranch(user, PAYMENT_READ_ROLES, branchId);
    await this.assertFamilyInBranch(branchId, familyId);

    const [paid, invoiced] = await Promise.all([
      this.prisma.payment.aggregate({ where: { familyId }, _sum: { amountMinor: true } }),
      this.prisma.invoice.aggregate({
        where: { familyId, status: { in: ["APPROVED", "PARTIALLY_PAID", "PAID"] } },
        _sum: { totalMinor: true },
      }),
    ]);

    const totalPaidMinor = paid._sum.amountMinor ?? 0;
    const totalInvoicedMinor = invoiced._sum.totalMinor ?? 0;
    return { totalPaidMinor, totalInvoicedMinor, balanceMinor: totalPaidMinor - totalInvoicedMinor };
  }

  private async allocateFifo(paymentId: string, familyId: string, amountMinor: number): Promise<void> {
    const openInvoices = await this.prisma.invoice.findMany({
      where: { familyId, status: { in: OPEN_INVOICE_STATUSES } },
      orderBy: [{ year: "asc" }, { month: "asc" }],
      include: { allocations: true },
    });

    let remaining = amountMinor;
    for (const invoice of openInvoices) {
      if (remaining <= 0) break;

      const alreadyAllocated = invoice.allocations.reduce((sum, a) => sum + a.amountMinor, 0);
      const owed = invoice.totalMinor - alreadyAllocated;
      if (owed <= 0) continue;

      const toAllocate = Math.min(owed, remaining);
      await this.prisma.paymentAllocation.create({
        data: { paymentId, invoiceId: invoice.id, amountMinor: toAllocate },
      });
      remaining -= toAllocate;

      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: toAllocate === owed ? "PAID" : "PARTIALLY_PAID" },
      });
    }
  }

  private async assertFamilyInBranch(branchId: string, familyId: string): Promise<void> {
    const family = await this.prisma.family.findUnique({ where: { id: familyId } });
    if (!family || family.branchId !== branchId) {
      throw new NotFoundException("Family not found in this branch");
    }
  }
}
