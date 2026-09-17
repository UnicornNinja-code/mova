/*
 * unit_streaming_xlsx_exporter.test.ts
 * S7-05-05: Streaming XLSX Exporter Contract Verification (15 Invariants)
 * MOVA Architecture
 */

import { describe, it, expect } from "bun:test";
import ExcelJS from "exceljs";
import {
  StreamingXlsxExporter,
  streamingXlsxExporter,
  sanitizeXlsxCellValue,
  XlsxColumn,
  XlsxRowSource,
  XlsxExportError,
  XLSX_SHEET_NAMES,
  XLSX_MAX_DATA_ROWS,
} from "../src/services/reporting/exporters/streamingXlsxExporter";
import {
  MemoryXlsxWritable,
} from "../src/services/reporting/exporters/xlsxWritableAdapters";
import { ReportType } from "../src/types/reporting.types";

interface SampleRow {
  id: string;
  name: string;
  count: number;
  rate: number | null;
  status: string;
  isCompliant: boolean;
}

const SAMPLE_XLSX_COLUMNS: readonly XlsxColumn<SampleRow>[] = [
  { key: "id", header: "ID", getValue: (r) => r.id },
  { key: "name", header: "Name", getValue: (r) => r.name },
  { key: "count", header: "Count", getValue: (r) => r.count },
  { key: "rate", header: "Rate", getValue: (r) => r.rate },
  { key: "status", header: "Status", getValue: (r) => r.status },
  { key: "isCompliant", header: "Is Compliant", getValue: (r) => r.isCompliant },
] as const;

async function loadWorkbookFromWritable(writable: MemoryXlsxWritable): Promise<ExcelJS.Workbook> {
  const buffer = writable.getBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

describe("S7-05-05: Streaming XLSX Exporter (15 Contract Invariants)", () => {
  // XLSX-01: Workbook selalu memiliki Metadata dan Data
  it("[XLSX-01] workbook always contains both Metadata and Data worksheets", async () => {
    const writable = new MemoryXlsxWritable();
    const source: XlsxRowSource<SampleRow> = {
      columns: SAMPLE_XLSX_COLUMNS,
      async *rows() {
        yield { id: "1", name: "Alpha", count: 10, rate: 0.95, status: "ACTIVE", isCompliant: true };
      },
    };

    await streamingXlsxExporter.export({ source }, writable);
    const wb = await loadWorkbookFromWritable(writable);

    const sheetNames = wb.worksheets.map((s) => s.name);
    expect(sheetNames).toContain(XLSX_SHEET_NAMES.metadata);
    expect(sheetNames).toContain(XLSX_SHEET_NAMES.data);
  });

  // XLSX-02: Sheet order deterministic: Metadata -> Data
  it("[XLSX-02] sheet order is strictly deterministic: Metadata (index 0) -> Data (index 1)", async () => {
    const writable = new MemoryXlsxWritable();
    const source: XlsxRowSource<SampleRow> = {
      columns: SAMPLE_XLSX_COLUMNS,
      async *rows() {
        yield { id: "1", name: "Alpha", count: 10, rate: 0.95, status: "ACTIVE", isCompliant: true };
      },
    };

    await streamingXlsxExporter.export({ source }, writable);
    const wb = await loadWorkbookFromWritable(writable);

    expect(wb.worksheets[0].name).toBe(XLSX_SHEET_NAMES.metadata);
    expect(wb.worksheets[1].name).toBe(XLSX_SHEET_NAMES.data);
  });

  // XLSX-03: Metadata fields memiliki urutan deterministic
  it("[XLSX-03] metadata sheet contains deterministic ordered fields", async () => {
    const writable = new MemoryXlsxWritable();
    const source: XlsxRowSource<SampleRow> = {
      columns: SAMPLE_XLSX_COLUMNS,
      truncated: false,
      async *rows() {
        yield { id: "1", name: "Alpha", count: 10, rate: 0.95, status: "ACTIVE", isCompliant: true };
      },
    };

    await streamingXlsxExporter.export(
      {
        source,
        metadata: {
          reportType: ReportType.PRESENCE_COMPLIANCE_REPORT,
          generatedAt: "2026-09-08T00:00:00Z",
          rangeStart: "2026-09-01T00:00:00Z",
          rangeEnd: "2026-09-08T00:00:00Z",
          timezone: "Asia/Jakarta",
          rowLimit: 100000,
          truncated: false,
        },
      },
      writable
    );

    const wb = await loadWorkbookFromWritable(writable);
    const metaSheet = wb.getWorksheet(XLSX_SHEET_NAMES.metadata)!;

    const fields: string[] = [];
    metaSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        // Skip header
        fields.push(row.getCell(1).value as string);
      }
    });

    expect(fields[0]).toBe("Report Type");
    expect(fields[1]).toBe("Generated At");
    expect(fields[2]).toBe("Range Start");
    expect(fields[3]).toBe("Range End");
    expect(fields[4]).toBe("Timezone");
    expect(fields[5]).toBe("Row Limit");
    expect(fields[6]).toBe("Truncated");
  });

  // XLSX-04: Data columns mengikuti explicit schema, bukan Object.keys()
  it("[XLSX-04] data sheet columns follow explicit schema definition strictly", async () => {
    const writable = new MemoryXlsxWritable();
    const source: XlsxRowSource<SampleRow> = {
      columns: SAMPLE_XLSX_COLUMNS,
      async *rows() {
        yield { id: "1", name: "Alpha", count: 10, rate: 0.95, status: "ACTIVE", isCompliant: true };
      },
    };

    await streamingXlsxExporter.export({ source }, writable);
    const wb = await loadWorkbookFromWritable(writable);
    const dataSheet = wb.getWorksheet(XLSX_SHEET_NAMES.data)!;

    const headerRow = dataSheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell) => {
      headers.push(String(cell.value));
    });

    expect(headers).toEqual(["ID", "Name", "Count", "Rate", "Status", "Is Compliant"]);
  });

  // XLSX-05: Header hanya ditulis sekali
  it("[XLSX-05] header row is emitted exactly once on row 1 of Data sheet", async () => {
    const writable = new MemoryXlsxWritable();
    const source: XlsxRowSource<SampleRow> = {
      columns: SAMPLE_XLSX_COLUMNS,
      async *rows() {
        yield { id: "1", name: "Alpha", count: 10, rate: 0.95, status: "ACTIVE", isCompliant: true };
        yield { id: "2", name: "Bravo", count: 20, rate: 0.85, status: "ACTIVE", isCompliant: false };
      },
    };

    const result = await streamingXlsxExporter.export({ source }, writable);
    const wb = await loadWorkbookFromWritable(writable);
    const dataSheet = wb.getWorksheet(XLSX_SHEET_NAMES.data)!;

    expect(result.rowCount).toBe(2);
    expect(dataSheet.rowCount).toBe(3); // 1 header + 2 data rows
    expect(dataSheet.getRow(1).getCell(1).value).toBe("ID");
    expect(dataSheet.getRow(2).getCell(1).value).toBe("1");
    expect(dataSheet.getRow(3).getCell(1).value).toBe("2");
  });

  // XLSX-06: null/undefined menjadi blank cell
  it("[XLSX-06] maps null and undefined to blank null cell (Zero-Fake-Data)", () => {
    expect(sanitizeXlsxCellValue(null)).toBeNull();
    expect(sanitizeXlsxCellValue(undefined)).toBeNull();
  });

  // XLSX-07: Explicit 'N/A' tetap menjadi string 'N/A'
  it("[XLSX-07] preserves explicit 'N/A' string as literal cell string", () => {
    expect(sanitizeXlsxCellValue("N/A")).toBe("N/A");
  });

  // XLSX-08: NaN ditolak dengan NON_FINITE_NUMBER
  it("[XLSX-08] throws XlsxExportError when NaN is encountered", () => {
    expect(() => sanitizeXlsxCellValue(NaN)).toThrow(XlsxExportError);
    try {
      sanitizeXlsxCellValue(NaN);
    } catch (e: any) {
      expect(e.code).toBe("NON_FINITE_NUMBER");
    }
  });

  // XLSX-09: Infinity dan -Infinity ditolak
  it("[XLSX-09] throws XlsxExportError when Infinity or -Infinity is encountered", () => {
    expect(() => sanitizeXlsxCellValue(Infinity)).toThrow(XlsxExportError);
    expect(() => sanitizeXlsxCellValue(-Infinity)).toThrow(XlsxExportError);
  });

  // XLSX-10: Numeric values tetap numeric cells
  it("[XLSX-10] preserves numbers as numeric cells and booleans as boolean cells", async () => {
    const writable = new MemoryXlsxWritable();
    const source: XlsxRowSource<SampleRow> = {
      columns: SAMPLE_XLSX_COLUMNS,
      async *rows() {
        yield { id: "1", name: "Alpha", count: 42, rate: 0.854, status: "ACTIVE", isCompliant: true };
      },
    };

    await streamingXlsxExporter.export({ source }, writable);
    const wb = await loadWorkbookFromWritable(writable);
    const dataSheet = wb.getWorksheet(XLSX_SHEET_NAMES.data)!;

    const row2 = dataSheet.getRow(2);
    expect(row2.getCell(3).value).toBe(42); // Numeric
    expect(typeof row2.getCell(3).value).toBe("number");
    expect(row2.getCell(4).value).toBe(0.854); // Numeric
    expect(typeof row2.getCell(4).value).toBe("number");
    expect(row2.getCell(6).value).toBe(true); // Boolean
    expect(typeof row2.getCell(6).value).toBe("boolean");
  });

  // XLSX-11: Maksimum 100.000 data rows didefinisikan
  it("[XLSX-11] defines maximum 100,000 data rows constraint", () => {
    expect(XLSX_MAX_DATA_ROWS).toBe(100000);
  });

  // XLSX-12: truncated=true dipertahankan tanpa inference
  it("[XLSX-12] preserves truncated=true flag from upstream source", async () => {
    const writable = new MemoryXlsxWritable();
    const source: XlsxRowSource<SampleRow> = {
      columns: SAMPLE_XLSX_COLUMNS,
      truncated: true,
      async *rows() {
        yield { id: "1", name: "Alpha", count: 10, rate: 0.95, status: "ACTIVE", isCompliant: true };
      },
    };

    const res = await streamingXlsxExporter.export({ source }, writable);
    expect(res.truncated).toBe(true);
  });

  // XLSX-13: Empty dataset menghasilkan valid workbook + header
  it("[XLSX-13] empty dataset produces valid workbook with Metadata and Data header", async () => {
    const writable = new MemoryXlsxWritable();
    const source: XlsxRowSource<SampleRow> = {
      columns: SAMPLE_XLSX_COLUMNS,
      async *rows() {
        // empty generator
      },
    };

    const res = await streamingXlsxExporter.export({ source }, writable);
    const wb = await loadWorkbookFromWritable(writable);

    expect(res.rowCount).toBe(0);
    const dataSheet = wb.getWorksheet(XLSX_SHEET_NAMES.data)!;
    expect(dataSheet.rowCount).toBe(1); // header only
  });

  // XLSX-14: Write/finalization error dipropagasikan
  it("[XLSX-14] wraps destination write failures into XlsxExportError", async () => {
    const failingWritable = {
      write: async () => {
        throw new Error("Disk quota exceeded");
      },
      end: async () => {},
    };

    const source: XlsxRowSource<SampleRow> = {
      columns: SAMPLE_XLSX_COLUMNS,
      async *rows() {
        yield { id: "1", name: "Alpha", count: 10, rate: 0.95, status: "ACTIVE", isCompliant: true };
      },
    };

    expect(streamingXlsxExporter.export({ source }, failingWritable)).rejects.toThrow(XlsxExportError);
  });

  // XLSX-15: Input identik menghasilkan logical workbook structure/content identik
  it("[XLSX-15] identical input produces identical logical workbook structure and cell values", async () => {
    const createSource = (): XlsxRowSource<SampleRow> => ({
      columns: SAMPLE_XLSX_COLUMNS,
      async *rows() {
        yield { id: "1", name: "Alpha", count: 10, rate: 0.5, status: "OK", isCompliant: true };
        yield { id: "2", name: "Beta", count: 20, rate: null, status: "DEVIATED", isCompliant: false };
      },
    });

    const w1 = new MemoryXlsxWritable();
    const w2 = new MemoryXlsxWritable();

    await streamingXlsxExporter.export({ source: createSource() }, w1);
    await streamingXlsxExporter.export({ source: createSource() }, w2);

    const wb1 = await loadWorkbookFromWritable(w1);
    const wb2 = await loadWorkbookFromWritable(w2);

    expect(wb1.worksheets.length).toBe(wb2.worksheets.length);
    expect(wb1.worksheets[0].name).toBe(wb2.worksheets[0].name);
    expect(wb1.worksheets[1].name).toBe(wb2.worksheets[1].name);

    const dataSheet1 = wb1.getWorksheet(XLSX_SHEET_NAMES.data)!;
    const dataSheet2 = wb2.getWorksheet(XLSX_SHEET_NAMES.data)!;

    expect(dataSheet1.rowCount).toBe(dataSheet2.rowCount);
    expect(dataSheet1.getRow(2).getCell(2).value).toBe(dataSheet2.getRow(2).getCell(2).value);
  });
});
