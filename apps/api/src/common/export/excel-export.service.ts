import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import type { TabularData } from "./export.types";

@Injectable()
export class ExcelExportService {
  async toBuffer(data: TabularData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    // Sheet names can't contain []:*?/\ or exceed 31 chars.
    const sheetName = data.title.replace(/[[\]:*?/\\]/g, "").slice(0, 31) || "Отчёт";
    const sheet = workbook.addWorksheet(sheetName);

    sheet.columns = data.columns.map((c) => ({ header: c.header, width: c.width ?? 20 }));
    sheet.getRow(1).font = { bold: true };
    for (const row of data.rows) {
      sheet.addRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
