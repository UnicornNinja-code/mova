/*
 * unit_streaming_csv_exporter.test.ts
 * S7-05-04: Streaming CSV Exporter Contract Verification (20 Contract Invariants)
 * MOVA Architecture
 */

import { describe, it, expect } from "bun:test";
import {
  StreamingCsvExporter,
  streamingCsvExporter,
  serializeCsvCell,
  serializeCsvRow,
  CsvColumn,
  CsvRowSource,
  CsvExportError,
  PRESENCE_COMPLIANCE_CSV_COLUMNS,
  ZONE_PERFORMANCE_CSV_COLUMNS,
  RIDER_DUTY_CSV_COLUMNS,
} from "../src/services/reporting/exporters/streamingCsvExporter";
import {
  MemoryCsvWritable,
} from "../src/services/reporting/exporters/csvWritableAdapters";

interface SampleRow {
  id: string;
  name: string;
  count: number;
  rate: number | null;
  status: string;
}

const SAMPLE_COLUMNS: readonly CsvColumn<SampleRow>[] = [
  { key: "id", header: "ID", getValue: (r) => r.id },
  { key: "name", header: "Name", getValue: (r) => r.name },
  { key: "count", header: "Count", getValue: (r) => r.count },
  { key: "rate", header: "Rate", getValue: (r) => r.rate },
  { key: "status", header: "Status", getValue: (r) => r.status },
] as const;

describe("S7-05-04: Streaming CSV Exporter (20 Invariants)", () => {
  // CSV-01: Header emitted exactly once
  it("[CSV-01] emits header line exactly once at the top of the stream", async () => {
    const writable = new MemoryCsvWritable();
    const source: CsvRowSource<SampleRow> = {
      columns: SAMPLE_COLUMNS,
      async *rows() {
        yield { id: "1", name: "Alpha", count: 10, rate: 0.95, status: "ACTIVE" };
      },
    };

    await streamingCsvExporter.export({ source }, writable);
    const lines = writable.getLines();

    expect(lines[0]).toBe("ID,Name,Count,Rate,Status");
    expect(lines.length).toBe(2);
  });

  // CSV-02: Column order deterministic
  it("[CSV-02] column order is strictly deterministic and follows column definition", async () => {
    const writable = new MemoryCsvWritable();
    const source: CsvRowSource<SampleRow> = {
      columns: SAMPLE_COLUMNS,
      async *rows() {
        yield { id: "1", name: "Bravo", count: 5, rate: null, status: "INACTIVE" };
      },
    };

    await streamingCsvExporter.export({ source }, writable);
    const content = writable.getContent();
    expect(content.startsWith("ID,Name,Count,Rate,Status\r\n")).toBe(true);
  });

  // CSV-03: RFC 4180 comma escaping
  it("[CSV-03] wraps values containing commas in double quotes", () => {
    const raw = "Jakarta, Selatan";
    expect(serializeCsvCell(raw)).toBe('"Jakarta, Selatan"');
  });

  // CSV-04: RFC 4180 quote escaping
  it("[CSV-04] escapes internal double quotes by doubling them and wrapping in quotes", () => {
    const raw = 'Andi "Budi"';
    expect(serializeCsvCell(raw)).toBe('"Andi ""Budi"""');
  });

  // CSV-05: RFC 4180 newline escaping
  it("[CSV-05] wraps values containing CRLF or LF in double quotes", () => {
    const rawLf = "Line 1\nLine 2";
    expect(serializeCsvCell(rawLf)).toBe('"Line 1\nLine 2"');

    const rawCrlf = "Line 1\r\nLine 2";
    expect(serializeCsvCell(rawCrlf)).toBe('"Line 1\r\nLine 2"');
  });

  // CSV-06: null -> empty field
  it("[CSV-06] maps null and undefined to empty field (Zero-Fake-Data)", () => {
    expect(serializeCsvCell(null)).toBe("");
    expect(serializeCsvCell(undefined)).toBe("");

    const row = serializeCsvRow(["Rider1", null, undefined, "Active"]);
    expect(row).toBe("Rider1,,,Active\r\n");
  });

  // CSV-07: explicit N/A -> "N/A"
  it("[CSV-07] maps explicit 'N/A' string to literal 'N/A'", () => {
    expect(serializeCsvCell("N/A")).toBe("N/A");
  });

  // CSV-08: finite numbers preserved
  it("[CSV-08] preserves finite numbers exactly (integer and floating)", () => {
    expect(serializeCsvCell(42)).toBe("42");
    expect(serializeCsvCell(0)).toBe("0");
    expect(serializeCsvCell(-15.75)).toBe("-15.75");
  });

  // CSV-09: NaN rejected
  it("[CSV-09] throws CsvExportError when NaN is encountered", () => {
    expect(() => serializeCsvCell(NaN)).toThrow(CsvExportError);
    try {
      serializeCsvCell(NaN);
    } catch (e: any) {
      expect(e.code).toBe("NON_FINITE_NUMBER");
    }
  });

  // CSV-10: Infinity / -Infinity rejected
  it("[CSV-10] throws CsvExportError when Infinity or -Infinity is encountered", () => {
    expect(() => serializeCsvCell(Infinity)).toThrow(CsvExportError);
    expect(() => serializeCsvCell(-Infinity)).toThrow(CsvExportError);
  });

  // CSV-11: bounded row processing
  it("[CSV-11] processes multiple rows via AsyncIterable without full array buffering", async () => {
    const writable = new MemoryCsvWritable();
    let iteratedCount = 0;

    const source: CsvRowSource<SampleRow> = {
      columns: SAMPLE_COLUMNS,
      async *rows() {
        for (let i = 1; i <= 5; i++) {
          iteratedCount++;
          yield { id: String(i), name: `Item ${i}`, count: i * 10, rate: 0.8, status: "OK" };
        }
      },
    };

    const res = await streamingCsvExporter.export({ source }, writable);
    expect(res.rowCount).toBe(5);
    expect(iteratedCount).toBe(5);
    expect(writable.getLines().length).toBe(6); // 1 header + 5 rows
  });

  // CSV-12: row count returned correctly
  it("[CSV-12] returns accurate rowCount in CsvExportResult", async () => {
    const writable = new MemoryCsvWritable();
    const source: CsvRowSource<SampleRow> = {
      columns: SAMPLE_COLUMNS,
      async *rows() {
        yield { id: "1", name: "A", count: 1, rate: 1, status: "OK" };
        yield { id: "2", name: "B", count: 2, rate: 2, status: "OK" };
        yield { id: "3", name: "C", count: 3, rate: 3, status: "OK" };
      },
    };

    const res = await streamingCsvExporter.export({ source }, writable);
    expect(res.rowCount).toBe(3);
  });

  // CSV-13: truncated=true propagated
  it("[CSV-13] propagates truncated=true when row source was capped at limit", async () => {
    const writable = new MemoryCsvWritable();
    const source: CsvRowSource<SampleRow> = {
      columns: SAMPLE_COLUMNS,
      truncated: true,
      totalCount: 100000,
      async *rows() {
        yield { id: "1", name: "A", count: 1, rate: 1, status: "OK" };
      },
    };

    const res = await streamingCsvExporter.export({ source }, writable);
    expect(res.truncated).toBe(true);
  });

  // CSV-14: truncated=false propagated
  it("[CSV-14] propagates truncated=false for complete datasets", async () => {
    const writable = new MemoryCsvWritable();
    const source: CsvRowSource<SampleRow> = {
      columns: SAMPLE_COLUMNS,
      truncated: false,
      async *rows() {
        yield { id: "1", name: "A", count: 1, rate: 1, status: "OK" };
      },
    };

    const res = await streamingCsvExporter.export({ source }, writable);
    expect(res.truncated).toBe(false);
  });

  // CSV-15: write error propagated
  it("[CSV-15] wraps and propagates destination write failures as CsvExportError('WRITE_FAILED')", async () => {
    const failingWritable = {
      write: async () => {
        throw new Error("Disk out of space");
      },
      end: async () => {},
    };

    const source: CsvRowSource<SampleRow> = {
      columns: SAMPLE_COLUMNS,
      async *rows() {
        yield { id: "1", name: "A", count: 1, rate: 1, status: "OK" };
      },
    };

    expect(streamingCsvExporter.export({ source }, failingWritable)).rejects.toThrow(CsvExportError);
  });

  // CSV-16: partial write cannot become success
  it("[CSV-16] ensures failed stream aborts immediately and does not return success result", async () => {
    let callCount = 0;
    const failingOnRowWritable = {
      write: async () => {
        callCount++;
        if (callCount > 1) {
          throw new Error("Network pipe broke");
        }
      },
      end: async () => {},
    };

    const source: CsvRowSource<SampleRow> = {
      columns: SAMPLE_COLUMNS,
      async *rows() {
        yield { id: "1", name: "A", count: 1, rate: 1, status: "OK" };
        yield { id: "2", name: "B", count: 2, rate: 2, status: "OK" };
      },
    };

    expect(streamingCsvExporter.export({ source }, failingOnRowWritable)).rejects.toThrow();
  });

  // CSV-17: destination finalized exactly once
  it("[CSV-17] calls destination.end() exactly once after successful streaming", async () => {
    let endCalls = 0;
    const trackingWritable = {
      write: async () => {},
      end: async () => {
        endCalls++;
      },
    };

    const source: CsvRowSource<SampleRow> = {
      columns: SAMPLE_COLUMNS,
      async *rows() {
        yield { id: "1", name: "A", count: 1, rate: 1, status: "OK" };
      },
    };

    await streamingCsvExporter.export({ source }, trackingWritable);
    expect(endCalls).toBe(1);
  });

  // CSV-18: deterministic output for identical input
  it("[CSV-18] generates byte-for-byte identical output for identical dataset", async () => {
    const createSource = (): CsvRowSource<SampleRow> => ({
      columns: SAMPLE_COLUMNS,
      async *rows() {
        yield { id: "1", name: "Alpha", count: 10, rate: 0.5, status: "OK" };
        yield { id: "2", name: 'Beta "Quoted"', count: 20, rate: null, status: "DEVIATED" };
      },
    });

    const w1 = new MemoryCsvWritable();
    const w2 = new MemoryCsvWritable();

    await streamingCsvExporter.export({ source: createSource() }, w1);
    await streamingCsvExporter.export({ source: createSource() }, w2);

    expect(w1.getContent()).toBe(w2.getContent());
  });

  // CSV-19: empty dataset produces header only
  it("[CSV-19] emits only header line for empty dataset (0 data rows)", async () => {
    const writable = new MemoryCsvWritable();
    const source: CsvRowSource<SampleRow> = {
      columns: SAMPLE_COLUMNS,
      async *rows() {
        // empty generator
      },
    };

    const res = await streamingCsvExporter.export({ source }, writable);
    expect(res.rowCount).toBe(0);
    expect(writable.getContent()).toBe("ID,Name,Count,Rate,Status\r\n");
  });

  // CSV-20: Canonical Report Schemas defined without queries
  it("[CSV-20] canonical report column schemas have static definitions and correct headers", () => {
    expect(PRESENCE_COMPLIANCE_CSV_COLUMNS.length).toBe(9);
    expect(PRESENCE_COMPLIANCE_CSV_COLUMNS[0].header).toBe("Timestamp");
    expect(PRESENCE_COMPLIANCE_CSV_COLUMNS[1].header).toBe("Rider Name");

    expect(ZONE_PERFORMANCE_CSV_COLUMNS.length).toBe(10);
    expect(ZONE_PERFORMANCE_CSV_COLUMNS[0].header).toBe("Zone Name");

    expect(RIDER_DUTY_CSV_COLUMNS.length).toBe(10);
    expect(RIDER_DUTY_CSV_COLUMNS[0].header).toBe("Rider Name");
  });
});
