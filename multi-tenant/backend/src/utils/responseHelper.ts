/*
 * responseHelper.ts
 * Universal Canonical API Response Envelope Helpers
 * Conforms strictly to PART 00 Reconstruction Governance (Section 7 & 10).
 */

import { Request, Response } from "express";

export interface PaginationInfo {
  page: number;
  limit: number;
  total_records: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface CanonicalSuccessEnvelope<T = any> {
  success: true;
  message: string;
  data: T;
  meta: {
    timestamp: string;
    request_id: string;
  };
}

export interface CanonicalPaginatedEnvelope<T = any> {
  success: true;
  message: string;
  data: T[];
  pagination: PaginationInfo;
  meta: {
    timestamp: string;
    request_id: string;
  };
}

export interface CanonicalErrorDetail {
  field?: string;
  issue: string;
  code?: string;
}

export interface CanonicalErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: CanonicalErrorDetail[];
  };
  meta: {
    timestamp: string;
    request_id: string;
  };
}

function getRequestId(req: Request): string {
  return req.requestId || (req.headers["x-request-id"] as string) || `req-gen-${Date.now()}`;
}

/**
 * Send Standard Single Resource / Command Success Envelope (HTTP 200/201)
 */
export function sendSuccess<T = any>(
  req: Request,
  res: Response,
  data: T,
  message: string = "Operasi berhasil",
  statusCode: number = 200
): Response {
  const envelope: CanonicalSuccessEnvelope<T> = {
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      request_id: getRequestId(req),
    },
  };
  return res.status(statusCode).json(envelope);
}

/**
 * Send Standard Paginated Collection Success Envelope (HTTP 200)
 */
export function sendPaginated<T = any>(
  req: Request,
  res: Response,
  data: T[],
  pagination: PaginationInfo,
  message: string = "Data berhasil diambil",
  statusCode: number = 200
): Response {
  const envelope: CanonicalPaginatedEnvelope<T> = {
    success: true,
    message,
    data,
    pagination,
    meta: {
      timestamp: new Date().toISOString(),
      request_id: getRequestId(req),
    },
  };
  return res.status(statusCode).json(envelope);
}

/**
 * Send Standard Machine-Readable Error Envelope (HTTP 4xx / 5xx)
 */
export function sendError(
  req: Request,
  res: Response,
  statusCode: number,
  errorCode: string,
  message: string,
  details?: CanonicalErrorDetail[]
): Response {
  const envelope: CanonicalErrorEnvelope = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details && details.length > 0 ? { details } : {}),
    },
    meta: {
      timestamp: new Date().toISOString(),
      request_id: getRequestId(req),
    },
  };
  return res.status(statusCode).json(envelope);
}
