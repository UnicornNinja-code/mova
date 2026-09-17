/*
 * traceMiddleware.ts
 * Injects unique request_id (UUID) into each inbound request and sets X-Request-Id header.
 * Conforms to PART 00 Canonical Governance Specification.
 */

import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function traceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerId = req.headers["x-request-id"] as string | undefined;
  const requestId = headerId || `req-${randomUUID().slice(0, 12)}`;
  
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}
