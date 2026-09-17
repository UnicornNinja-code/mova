/*
 * pdfWritableAdapters.ts
 * Writable Destination Adapters for Executive PDF Exporter
 * MOVA Architecture
 */

import fs from "fs";
import path from "path";
import type { PdfWritable } from "./pdfTypes.js";

/**
 * In-Memory PdfWritable for unit testing and fast in-memory assertions
 */
export class MemoryPdfWritable implements PdfWritable {
  private chunks: Uint8Array[] = [];
  public isEnded = false;

  public async write(chunk: Uint8Array): Promise<void> {
    if (this.isEnded) {
      throw new Error("Cannot write to an ended MemoryPdfWritable stream.");
    }
    this.chunks.push(new Uint8Array(chunk));
  }

  public async end(): Promise<void> {
    this.isEnded = true;
  }

  public getBuffer(): Buffer {
    return Buffer.concat(this.chunks.map((c) => Buffer.from(c)));
  }

  public getByteLength(): number {
    return this.chunks.reduce((acc, c) => acc + c.byteLength, 0);
  }
}

/**
 * File-backed PdfWritable utilizing Node fs.WriteStream with backpressure handling
 */
export class FileStreamPdfWritable implements PdfWritable {
  private stream: fs.WriteStream;
  private filePath: string;
  private isEnded = false;

  constructor(filePath: string) {
    this.filePath = filePath;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.stream = fs.createWriteStream(filePath);
  }

  public async write(chunk: Uint8Array): Promise<void> {
    if (this.isEnded) {
      throw new Error("Cannot write to an ended FileStreamPdfWritable stream.");
    }

    if (!this.stream.write(Buffer.from(chunk))) {
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
