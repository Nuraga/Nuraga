import { join } from "node:path";
import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import type { TabularData } from "./export.types";

const PAGE_MARGIN = 36;
const ROW_HEIGHT = 18;
const HEADER_FONT_SIZE = 9;
const BODY_FONT_SIZE = 8;

// PDFKit's built-in "Helvetica" is a standard-14 AFM font with WinAnsi
// encoding only — it silently drops Cyrillic glyphs. Every report in this
// app is Russian-language, so a Unicode-capable font must be embedded.
// PT Sans (SIL OFL, vendored under apps/api/assets/fonts/) was designed by
// Paratype specifically for Cyrillic+Latin coverage — see assets/fonts/OFL.txt.
const FONT_REGULAR = join(process.cwd(), "assets", "fonts", "PTSans-Regular.ttf");
const FONT_BOLD = join(process.cwd(), "assets", "fonts", "PTSans-Bold.ttf");

@Injectable()
export class PdfExportService {
  async toBuffer(data: TabularData): Promise<Buffer> {
    const doc = new PDFDocument({ margin: PAGE_MARGIN, size: "A4", layout: "landscape" });
    doc.registerFont("body", FONT_REGULAR);
    doc.registerFont("bold", FONT_BOLD);

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

    const pageWidth = doc.page.width - PAGE_MARGIN * 2;
    const totalWeight = data.columns.reduce((sum, c) => sum + (c.width ?? 1), 0);
    const colWidths = data.columns.map((c) => (pageWidth * (c.width ?? 1)) / totalWeight);

    doc.font("bold").fontSize(14).text(data.title, PAGE_MARGIN, PAGE_MARGIN);
    let y = doc.y + 10;

    const drawRow = (values: (string | number)[], bold: boolean, fontSize: number) => {
      let x = PAGE_MARGIN;
      doc.font(bold ? "bold" : "body").fontSize(fontSize);
      values.forEach((value, i) => {
        doc.text(String(value), x, y, { width: colWidths[i] - 4, ellipsis: true });
        x += colWidths[i];
      });
      y += ROW_HEIGHT;
    };

    const drawHeader = () => {
      drawRow(data.columns.map((c) => c.header), true, HEADER_FONT_SIZE);
      doc
        .moveTo(PAGE_MARGIN, y - 4)
        .lineTo(PAGE_MARGIN + pageWidth, y - 4)
        .strokeColor("#999999")
        .stroke();
    };

    drawHeader();

    for (const row of data.rows) {
      if (y > doc.page.height - PAGE_MARGIN) {
        doc.addPage();
        y = PAGE_MARGIN;
        drawHeader();
      }
      drawRow(row, false, BODY_FONT_SIZE);
    }

    if (data.rows.length === 0) {
      doc.font("body").fontSize(BODY_FONT_SIZE).text("Нет данных", PAGE_MARGIN, y);
    }

    doc.end();
    return done;
  }
}
