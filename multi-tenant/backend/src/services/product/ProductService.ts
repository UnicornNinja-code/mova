/*
 * ProductService.ts
 * Domain Service for Product Catalog Management in TypeScript
 */

import { productRepository, ProductRepository } from "../../repositories/productRepository.js";

export class ProductService {
  private static instance: ProductService | null = null;
  private repo: ProductRepository;

  constructor(repo: ProductRepository = productRepository) {
    if (ProductService.instance && repo === productRepository) {
      return ProductService.instance;
    }
    this.repo = repo;
    if (repo === productRepository) {
      ProductService.instance = this;
    }
  }

  public static getInstance(repo: ProductRepository = productRepository): ProductService {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService(repo);
    }
    return ProductService.instance;
  }

  /**
   * Fetch all products with role-based filtering & pagination
   */
  public async getAllProducts(
    userRole: string,
    {
      status,
      category,
      search,
      page = 1,
      limit = 50,
      sortBy = "name",
      sortOrder = "ASC",
    }: {
      status?: string;
      category?: string;
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    } = {}
  ): Promise<any> {
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    let effectiveStatus = status;
    if (userRole === "RIDER") {
      effectiveStatus = "AVAILABLE";
    }

    const [products, total] = await Promise.all([
      this.repo.findAll({
        status: effectiveStatus,
        category,
        search,
        limit: limitNum,
        offset,
        sortBy,
        sortOrder,
      }),
      this.repo.countAll({
        status: effectiveStatus,
        category,
        search,
      }),
    ]);

    return {
      products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  /**
   * Fetch single product by ID
   */
  public async getProductById(id: number | string): Promise<any> {
    if (!id) {
      const error: any = new Error("Product ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const product = await this.repo.findById(id);
    if (!product) {
      const error: any = new Error(`Produk dengan ID '${id}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }
    return product;
  }

  /**
   * Create a new product in master catalog
   */
  public async createProduct({
    name,
    sku,
    category = "KOPI",
    description = "",
    base_price = 0,
    price,
    image_url,
    status = "AVAILABLE",
  }: {
    name: string;
    sku?: string;
    category?: string;
    description?: string;
    base_price?: number | string;
    price: number | string;
    image_url?: string;
    status?: string;
  }): Promise<any> {
    if (!name || typeof name !== "string" || !name.trim()) {
      const error: any = new Error("Nama produk wajib diisi.");
      error.statusCode = 400;
      throw error;
    }

    const numericPrice = parseFloat(String(price));
    if (isNaN(numericPrice) || numericPrice <= 0) {
      const error: any = new Error("Harga produk harus berupa angka positif lebih dari 0.");
      error.statusCode = 400;
      throw error;
    }

    const numericBasePrice = base_price ? parseFloat(String(base_price)) : 0;

    const validStatuses = ["AVAILABLE", "DISCONTINUED"];
    const productStatus = status ? status.toUpperCase() : "AVAILABLE";
    if (!validStatuses.includes(productStatus)) {
      const error: any = new Error(`Status produk tidak valid. Harus salah satu dari: ${validStatuses.join(", ")}`);
      error.statusCode = 400;
      throw error;
    }

    const existing = await this.repo.findByName(name);
    if (existing) {
      const error: any = new Error(`Produk dengan nama '${name.trim()}' sudah terdaftar.`);
      error.statusCode = 400;
      throw error;
    }

    const newProduct = await this.repo.create({
      name: name.trim(),
      sku: sku?.trim(),
      category: (category || "KOPI").toUpperCase(),
      description: description ? description.trim() : "",
      base_price: numericBasePrice,
      price: numericPrice,
      image_url: image_url || undefined,
      status: productStatus,
    });

    return newProduct;
  }

  /**
   * Update existing product details
   */
  public async updateProduct(
    id: number | string,
    {
      name,
      sku,
      category,
      description,
      base_price,
      price,
      image_url,
      status,
    }: {
      name?: string;
      sku?: string;
      category?: string;
      description?: string;
      base_price?: number | string;
      price?: number | string;
      image_url?: string;
      status?: string;
    }
  ): Promise<any> {
    await this.getProductById(id);

    const updates: any = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        const error: any = new Error("Nama produk tidak boleh kosong.");
        error.statusCode = 400;
        throw error;
      }
      const duplicate = await this.repo.findByName(name, id);
      if (duplicate) {
        const error: any = new Error(`Produk dengan nama '${name.trim()}' sudah terdaftar.`);
        error.statusCode = 400;
        throw error;
      }
      updates.name = name.trim();
    }

    if (sku !== undefined) {
      updates.sku = sku.trim();
    }

    if (category !== undefined) {
      updates.category = category.toUpperCase();
    }

    if (description !== undefined) {
      updates.description = description ? description.trim() : "";
    }

    if (base_price !== undefined) {
      updates.base_price = parseFloat(String(base_price)) || 0;
    }

    if (price !== undefined) {
      const numericPrice = parseFloat(String(price));
      if (isNaN(numericPrice) || numericPrice <= 0) {
        const error: any = new Error("Harga produk harus berupa angka positif lebih dari 0.");
        error.statusCode = 400;
        throw error;
      }
      updates.price = numericPrice;
    }

    if (image_url !== undefined) {
      updates.image_url = image_url;
    }

    if (status !== undefined) {
      const validStatuses = ["AVAILABLE", "DISCONTINUED"];
      const upperStatus = status.toUpperCase();
      if (!validStatuses.includes(upperStatus)) {
        const error: any = new Error(`Status produk tidak valid. Harus salah satu dari: ${validStatuses.join(", ")}`);
        error.statusCode = 400;
        throw error;
      }
      updates.status = upperStatus;
    }

    const updated = await this.repo.update(id, updates);
    return updated;
  }

  /**
   * Quick status toggle (AVAILABLE / DISCONTINUED)
   */
  public async updateProductStatus(id: number | string, status: string): Promise<any> {
    await this.getProductById(id);

    const validStatuses = ["AVAILABLE", "DISCONTINUED"];
    const upperStatus = status ? status.toUpperCase() : "";
    if (!validStatuses.includes(upperStatus)) {
      const error: any = new Error(`Status produk tidak valid. Harus salah satu dari: ${validStatuses.join(", ")}`);
      error.statusCode = 400;
      throw error;
    }

    const updated = await this.repo.updateStatus(id, upperStatus);
    return updated;
  }

  /**
   * Delete product with historical sales guard
   */
  public async deleteProduct(id: number | string): Promise<any> {
    const existing = await this.getProductById(id);

    const hasHistory = await this.repo.hasSalesHistory(id);
    if (hasHistory) {
      const error: any = new Error(
        `Produk '${existing.name}' tidak dapat dihapus karena telah memiliki histori transaksi penjualan. Harap gunakan fitur Nonaktifkan (status: DISCONTINUED) untuk menjaga integritas data akuntansi.`
      );
      error.statusCode = 400;
      throw error;
    }

    const deleted = await this.repo.delete(id);
    return deleted;
  }
}

export const productService = ProductService.getInstance();
