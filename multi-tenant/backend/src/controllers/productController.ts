/*
 * productController.ts
 * HTTP Controller for Product Catalog CRUD & Image Upload in TypeScript
 */

import type { Request, Response } from "express";
import { productService } from "../services/product/ProductService.js";
import { compressAndSaveProductImage } from "../middlewares/uploadMiddleware.js";

export const getProducts = async (req: Request, res: Response): Promise<any> => {
  try {
    const userRole = req.user?.role;
    const { status, category, search, page, limit, sort_by, sort_order } = req.query as any;

    const result = await productService.getAllProducts(userRole, {
      status,
      category,
      search,
      page,
      limit,
      sortBy: sort_by,
      sortOrder: sort_order,
    });

    return res.status(200).json({
      status: "success",
      data: result.products,
      pagination: result.pagination,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const product = await productService.getProductById(id);

    return res.status(200).json({
      status: "success",
      data: product,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const uploadProductImage = async (req: Request, res: Response): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "Tidak ada file gambar yang di-upload." });
    }

    const result = await compressAndSaveProductImage(req.file.buffer);

    return res.status(200).json({
      status: "success",
      msg: "Gambar berhasil di-upload dan dikompresi ke format WebP super ringan.",
      data: {
        image_url: result.imageUrl,
        original_size: result.originalSize,
        compressed_size: result.compressedSize,
        compression_ratio: result.compressionRatio,
      },
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal memproses upload gambar." });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, sku, category, description, base_price, price, image_url, status } = req.body;
    const newProduct = await productService.createProduct({
      name,
      sku,
      category,
      description,
      base_price,
      price,
      image_url,
      status,
    });

    return res.status(201).json({
      status: "success",
      msg: `Produk '${newProduct.name}' berhasil ditambahkan ke katalog menu.`,
      data: newProduct,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { name, sku, category, description, base_price, price, image_url, status } = req.body;

    const updated = await productService.updateProduct(id, {
      name,
      sku,
      category,
      description,
      base_price,
      price,
      image_url,
      status,
    });

    return res.status(200).json({
      status: "success",
      msg: `Data produk '${updated.name}' berhasil diperbarui.`,
      data: updated,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const updateProductStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    const updated = await productService.updateProductStatus(id, status);

    return res.status(200).json({
      status: "success",
      msg: `Status produk '${updated.name}' berhasil diubah menjadi '${updated.status}'.`,
      data: updated,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const deleted = await productService.deleteProduct(id);

    return res.status(200).json({
      status: "success",
      msg: `Produk '${deleted.name}' berhasil dihapus secara permanen dari katalog menu.`,
      data: deleted,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};
