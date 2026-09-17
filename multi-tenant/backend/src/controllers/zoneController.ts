/*
 * zoneController.ts
 * HTTP Controller for Zone Management in TypeScript
 */

import type { Request, Response } from "express";
import { zoneService } from "../services/zoneService.js";

export const getZoneConfig = async (req: Request, res: Response): Promise<any> => {
  try {
    const config = await zoneService.getZoneConfig();
    return res.status(200).json(config);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getAllZones = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, search } = req.query as { status?: string; search?: string };
    const result = await zoneService.getAllZones({ status, search });
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getZoneById = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const zone = await zoneService.getZoneById(id);
    return res.status(200).json({ zone });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const validateZone = async (req: Request, res: Response): Promise<any> => {
  try {
    const { polygon, name, exclude_id } = req.body;
    const validation = await zoneService.preValidateZonePolygon({
      polygon,
      name,
      excludeId: exclude_id || null,
    });
    return res.status(200).json(validation);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const createZone = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, description, max_capacity, status, polygon } = req.body;
    const newZone = await zoneService.createZone({
      name,
      description,
      max_capacity,
      status,
      polygon,
    });
    return res.status(201).json({
      msg: "Zona operasional berhasil ditambahkan",
      zone: newZone,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const updateZone = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { name, description, max_capacity, status, polygon } = req.body;
    const updated = await zoneService.updateZone(id, {
      name,
      description,
      max_capacity,
      status,
      polygon,
    });
    return res.status(200).json({
      msg: "Data zona operasional berhasil diperbarui",
      zone: updated,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const updateZoneStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;
    const updated = await zoneService.updateZoneStatus(id, status);
    return res.status(200).json({
      msg: "Status zona operasional berhasil diubah",
      zone: updated,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const updateZoneCapacity = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { max_capacity } = req.body;
    const updated = await zoneService.updateZoneCapacity(id, max_capacity);
    return res.status(200).json({
      msg: "Kapasitas kuota zona operasional berhasil diubah",
      zone: updated,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const deleteZone = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const deleted = await zoneService.deleteZone(id);
    return res.status(200).json({
      msg: "Zona operasional berhasil dihapus",
      zone: deleted,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};
