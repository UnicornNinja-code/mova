/*
 * roleMiddleware.ts
 * RBAC Role Check Middleware in TypeScript
 */

import type { Request, Response, NextFunction } from "express";

export const checkRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): any => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ msg: "Access forbidden: insufficient permissions" });
    }
    next();
  };
};

export const roleMiddleware = checkRole;

