// A generic tabular shape any report can be flattened into before handing
// off to ExcelExportService/PdfExportService — keeps those two services
// report-agnostic (ТЗ §9.2 requires export on every report, not just one).
export interface TabularColumn {
  header: string;
  width?: number;
}

export interface TabularData {
  title: string;
  columns: TabularColumn[];
  rows: (string | number)[][];
}
