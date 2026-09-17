/*
 * csvWritableAdapters.ts
 * Writable Destination Adapters for Streaming CSV Exporter
 * MOVA Architecture
 */

import fs from "fs";
import path from "path";
import type { CsvWritable } from "./streamingCsvExporter.js";

/**
 * In-Memory CsvWritable for unit testing and fast in-memory assertions
 */
export class MemoryCsvWritable implements CsvWritable {
  private chunks: string[] = [];
  public isEnded = false;

  public async write(chunk: string): Promise<void> {
    if (this.isEnded) {
      throw new Error("Cannot write to an ended MemoryCsvWritable stream.");
    }
    this.chunks.push(chunk);
  }

  public async end(): Promise<void> {
    this.isEnded = true;
  }

  public getContent(): string {
    return this.chunks.join("");
  }

  public getLines(): string[] {
    const content = this.getContent();
    if (!content) return [];
    return content.split("\r\n").filter((l, idx, arr) => idx < arr.length - 1 || l.length > 0);
  }
}

/**
 * File-backed CsvWritable utilizing Node fs.WriteStream with backpressure handling
 */
export class FileStreamCsvWritable implements CsvWritable {
  private stream: fs.WriteStream;
  private filePath: string;
  private isEnded = false;

  constructor(filePath: string) {
    this.filePath = filePath;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.stream = fs.createWriteStream(filePath, { encoding: "utf8" });
  }

  public async write(chunk: string): Promise<void> {
    if (this.isEnded) {
      throw new Error("Cannot write to an ended FileStreamCsvWritable stream.");
    }

    if (!this.stream.write(chunk)) {
      await new Promise<void>((resolve, reject) => {
        const onDrain = () => {
          this.stream.off("error", onError);
          resolve();
        };
        const onError = (err: Error) => {
          this.stream.off("drain", onDrain);
          reject(err);
        };
        this.stream.once("drain", onDrain);
        this.stream.once("error", onError);
      });
    }
  }

  public async end(): Promise<void> {
    if (this.isEnded) return;
    this.isEnded = true;
    await new Promise<void>((resolve, reject) => {
      this.stream.end((err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public getFilePath(): string {
    return this.filePath;
  }
}
