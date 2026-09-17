/*
 * tenantController.ts
 * Controller for Tenant Lifecycle & Quota Management
 */

import type { Request, Response } from "express";
import { TenantModel } from "../models/tenantModel.js";
import { isLiteProfile } from "../config/runtimeProfile.js";

export const getAllTenants = async (req: Request, res: Response): Promise<any> => {
  try {
    if (isLiteProfile()) {
      const defaultTenant = await TenantModel.findById("thesis-default");
      return res.json({
        success: true,
        data: defaultTenant ? [defaultTenant] : [],
        profile: "lite",
      });
    }

    const tenants = await TenantModel.listAll();
    return res.json({
      success: true,
      data: tenants,
      total: tenants.length,
    });
  } catch (error: any) {
    console.error("❌ [GET ALL TENANTS] Error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil daftar tenant.", error: error.message });
  }
};

export const getTenantById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const tenant = await TenantModel.findById(id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant tidak ditemukan." });
    }
    return res.json({ success: true, data: tenant });
  } catch (error: any) {
    console.error("❌ [GET TENANT BY ID] Error:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil data tenant.", error: error.message });
  }
};

export const createTenant = async (req: Request, res: Response): Promise<any> => {
  try {
    if (isLiteProfile()) {
      return res.status(403).json({
        success: false,
        code: "FEATURE_DISABLED_IN_LITE",
        message: "Manajemen pembuatan tenant multi-organisasi dinonaktifkan pada profil MOVA Lite.",
      });
    }

    const { id, name, code, max_fleets, max_riders, max_zones, metadata } = req.body;

    if (!id || !name || !code) {
      return res.status(400).json({
        success: false,
        message: "ID, nama, dan kode tenant wajib diisi.",
      });
    }

    const existingCode = await TenantModel.findByCode(code);
    if (existingCode) {
      return res.status(409).json({
        success: false,
        message: `Tenant dengan kode '${code}' sudah ada.`,
      });
    }

    const existingId = await TenantModel.findById(id);
    if (existingId) {
      return res.status(409).json({
        success: false,
        message: `Tenant dengan ID '${id}' sudah ada.`,
      });
    }

    const newTenant = await TenantModel.create({
      id,
      name,
      code,
      max_fleets,
      max_riders,
      max_zones,
      metadata,
    });

    return res.status(201).json({
      success: true,
      message: "Organisasi/Tenant baru berhasil didaftarkan.",
      data: newTenant,
    });
  } catch (error: any) {
    console.error("❌ [CREATE TENANT] Error:", error);
    return res.status(500).json({ success: false, message: "Gagal membuat tenant.", error: error.message });
  }
};

export const updateTenantQuota = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { max_fleets, max_riders, max_zones } = req.body;

    const updated = await TenantModel.updateQuota(id, { max_fleets, max_riders, max_zones });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Tenant tidak ditemukan." });
    }

    return res.json({
      success: true,
      message: "Batas kuota resource tenant berhasil diperbarui.",
      data: updated,
    });
  } catch (error: any) {
    console.error("❌ [UPDATE TENANT QUOTA] Error:", error);
    return res.status(500).json({ success: false, message: "Gagal memperbarui kuota tenant.", error: error.message });
  }
};

export const updateTenantStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status tidak valid. Gunakan ACTIVE, INACTIVE, atau SUSPENDED." });
    }

    const updated = await TenantModel.updateStatus(id, status);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Tenant tidak ditemukan." });
    }

    return res.json({
      success: true,
      message: `Status tenant berhasil diubah menjadi ${status}.`,
      data: updated,
    });
  } catch (error: any) {
    console.error("❌ [UPDATE TENANT STATUS] Error:", error);
    return res.status(500).json({ success: false, message: "Gagal memperbarui status tenant.", error: error.message });
  }
};
