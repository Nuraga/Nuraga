import { BadRequestException, Controller, Get, Param, Query, Res, UseGuards } from "@nestjs/common";
import { StreamableFile } from "@nestjs/common";
import type { Response } from "express";
import { ReportsService } from "./reports.service";
import { ExcelExportService } from "../common/export/excel-export.service";
import { PdfExportService } from "../common/export/pdf-export.service";
import type { TabularData } from "../common/export/export.types";
import {
  occupancyTable,
  attendanceSummaryTable,
  waitlistTable,
  debtTable,
  invoicesTable,
  paymentsTable,
  discountsTable,
  portionsTable,
  funnelTable,
} from "./report-tables";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

type ExportFormat = "xlsx" | "pdf";

function parseFormat(value?: string): ExportFormat | undefined {
  if (value === "xlsx" || value === "pdf") return value;
  if (value !== undefined) throw new BadRequestException('format must be "xlsx" or "pdf"');
  return undefined;
}

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId/reports")
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly excel: ExcelExportService,
    private readonly pdf: PdfExportService,
  ) {}

  @Get("occupancy")
  async occupancy(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("format") formatRaw: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const format = parseFormat(formatRaw);
    const data = await this.reports.occupancy(user, branchId);
    return this.respond(res, format, "occupancy", () => occupancyTable(data), data);
  }

  @Get("attendance-summary")
  async attendanceSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("year") year: string | undefined,
    @Query("month") month: string | undefined,
    @Query("groupId") groupId: string | undefined,
    @Query("format") formatRaw: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!year || !month) {
      throw new BadRequestException("year and month query params are required");
    }
    const format = parseFormat(formatRaw);
    const data = await this.reports.attendanceSummary(user, branchId, Number(year), Number(month), groupId);
    return this.respond(res, format, `attendance-${year}-${month}`, () => attendanceSummaryTable(data), data);
  }

  @Get("waitlist")
  async waitlist(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("format") formatRaw: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const format = parseFormat(formatRaw);
    const data = await this.reports.waitlistSummary(user, branchId);
    return this.respond(res, format, "waitlist", () => waitlistTable(data), data);
  }

  @Get("debt")
  async debtRegistry(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("format") formatRaw: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const format = parseFormat(formatRaw);
    const data = await this.reports.debtRegistry(user, branchId);
    return this.respond(res, format, "debt", () => debtTable(data), data);
  }

  @Get("invoices")
  async invoicesRegistry(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("year") year: string | undefined,
    @Query("month") month: string | undefined,
    @Query("format") formatRaw: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!year || !month) {
      throw new BadRequestException("year and month query params are required");
    }
    const format = parseFormat(formatRaw);
    const data = await this.reports.invoicesRegistry(user, branchId, Number(year), Number(month));
    return this.respond(res, format, `invoices-${year}-${month}`, () => invoicesTable(data), data);
  }

  @Get("payments")
  async paymentsRegistry(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("year") year: string | undefined,
    @Query("month") month: string | undefined,
    @Query("format") formatRaw: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!year || !month) {
      throw new BadRequestException("year and month query params are required");
    }
    const format = parseFormat(formatRaw);
    const data = await this.reports.paymentsRegistry(user, branchId, Number(year), Number(month));
    return this.respond(res, format, `payments-${year}-${month}`, () => paymentsTable(data), data);
  }

  @Get("discounts")
  async discountsRegistry(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("activeOnly") activeOnly: string | undefined,
    @Query("format") formatRaw: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const format = parseFormat(formatRaw);
    const data = await this.reports.discountsRegistry(user, branchId, activeOnly !== "false");
    return this.respond(res, format, "discounts", () => discountsTable(data), data);
  }

  @Get("portions")
  async portionsToday(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("date") date: string | undefined,
    @Query("format") formatRaw: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!date) throw new BadRequestException("date query param is required");
    const format = parseFormat(formatRaw);
    const data = await this.reports.portionsToday(user, branchId, date);
    return this.respond(res, format, `portions-${date}`, () => portionsTable(data), data);
  }

  @Get("funnel")
  async funnelReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("year") year: string | undefined,
    @Query("month") month: string | undefined,
    @Query("format") formatRaw: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!year || !month) {
      throw new BadRequestException("year and month query params are required");
    }
    const format = parseFormat(formatRaw);
    const data = await this.reports.funnelReport(user, branchId, Number(year), Number(month));
    return this.respond(res, format, `funnel-${year}-${month}`, () => funnelTable(data), data);
  }

  /**
   * Shared JSON-or-file responder for every report above (ТЗ §9.2: "с
   * экспортом в Excel/PDF" is required on every report, not just one).
   * `format` absent → the existing JSON response, unchanged. Filenames are
   * kept ASCII (report key + date params) rather than the Cyrillic report
   * title, sidestepping Content-Disposition RFC 5987 encoding entirely —
   * the human-readable title still lives inside the file itself.
   */
  private async respond<T>(
    res: Response,
    format: ExportFormat | undefined,
    filenameBase: string,
    buildTable: () => TabularData,
    jsonData: T,
  ): Promise<T | StreamableFile> {
    if (!format) return jsonData;

    const table = buildTable();
    if (format === "xlsx") {
      const buffer = await this.excel.toBuffer(table);
      res.set({
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      });
      return new StreamableFile(buffer);
    }

    const buffer = await this.pdf.toBuffer(table);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
    });
    return new StreamableFile(buffer);
  }
}
