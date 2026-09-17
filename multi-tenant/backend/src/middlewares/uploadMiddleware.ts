/*
 * uploadMiddleware.ts
 * High-Performance Image Upload & WebP Compression Middleware via Sharp & Multer
 */

import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "uploads", "products");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer in-memory storage (max 5MB raw upload)
const storage = multer.memoryStorage();

export const uploadSingleImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/avif"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Format file tidak didukung. Harap upload gambar berformat JPG, PNG, atau WebP."));
    }
  },
}).single("image");

/**
 * Process raw image buffer into an ultra-compact WebP format
 * Target output size: ~15KB - 40KB (Max dimension: 600x600 px)
 */
export async function compressAndSaveProductImage(fileBuffer: Buffer): Promise<{
  imageUrl: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
}> {
  const originalSize = fileBuffer.length;
  const uniqueId = crypto.randomBytes(6).toString("hex");
  const filename = `prod-${Date.now()}-${uniqueId}.webp`;
  const targetFilePath = path.join(UPLOADS_DIR, filename);

  // Compress & convert to WebP using Sharp
  await sharp(fileBuffer)
    .resize(600, 600, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: 80,
      effort: 4, // Balances CPU vs compression density
    })
    .toFile(targetFilePath);

  const stats = fs.statSync(targetFilePath);
  const compressedSize = stats.size;
  const savings = (((originalSize - compressedSize) / originalSize) * 100).toFixed(1);

  return {
    imageUrl: `/uploads/products/${filename}`,
    originalSize,
    compressedSize,
    compressionRatio: `${savings}% lebih hemat`,
  };
}
