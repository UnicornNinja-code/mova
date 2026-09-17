/*
 * tenantScopeMiddleware.ts
 * Tenant Scope Middleware & Anti-IDOR / BOLA Guard
 * 
 * Memastikan setiap request HTTP terikat ke tenant yang valid dan authorized,
 * serta mencegah kebocoran data antar-tenant (IDOR/BOLA).
 */

import type { Request, Response, NextFunction } from "express";
import { runtimeConfig } from "../config/runtimeProfile.js";
import { TenantModel } from "../models/tenantModel.js";

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

export const tenantScopeMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    // 1. In Lite Profile (Single-Tenant Thesis Scope), enforce default tenant id without breaking security context
    if (runtimeConfig.profile === "lite") {
      req.tenantId = runtimeConfig.defaultTenantId;
      return next();
    }

    // 2. In Platform Profile (Multi-Tenant Showcase), extract tenant from authenticated user context
    let targetTenantId: string | undefined = undefined;

    if (req.user && req.user.tenant_id) {
      targetTenantId = req.user.tenant_id;
    } else if (req.headers["x-tenant-id"]) {
      targetTenantId = req.headers["x-tenant-id"] as string;
    } else {
      targetTenantId = runtimeConfig.defaultTenantId;
    }

    // 3. Check for Cross-Tenant IDOR/BOLA Attempt
    const requestedParamTenantId = req.params.tenantId || req.query.tenantId || req.body?.tenantId;
    
    if (
      requestedParamTenantId &&
      req.user &&
      req.user.role !== "SUPERADMIN" &&
      requestedParamTenantId !== targetTenantId
    ) {
      return res.status(403).json({
        success: false,
        code: "CROSS_TENANT_ACCESS_DENIED",
        message: "Akses ditolak: Anda tidak memiliki izin untuk mengakses data milik organisasi/tenant lain.",
      });
    }

    // 4. Validate Tenant Exists & is Active
    const tenant = await TenantModel.findById(targetTenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        code: "TENANT_NOT_FOUND",
        message: "Organisasi/Tenant tidak terdaftar dalam sistem.",
      });
    }

    if (tenant.status !== "ACTIVE" && req.user?.role !== "SUPERADMIN") {
      return res.status(403).json({
        success: false,
        code: "TENANT_SUSPENDED",
        message: "Organisasi/Tenant Anda sedang dinonaktifkan atau ditangguhkan.",
      });
    }

    req.tenantId = targetTenantId;
    next();
  } catch (error: any) {
    console.error("❌ [TENANT_SCOPE_MIDDLEWARE] Error:", error);
    return res.status(500).json({
      success: false,
      code: "TENANT_SCOPE_ERROR",
      message: "Gagal memvalidasi context organisasi tenant.",
      error: error.message,
    });
  }
};
