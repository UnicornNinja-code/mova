import { productRepository } from "../../repositories/productRepository.js";

export const PRODUCT_STATUSES = Object.freeze({
  AVAILABLE: "AVAILABLE",
  DISCONTINUED: "DISCONTINUED",
});

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const VALID_PRODUCT_STATUSES = Object.values(PRODUCT_STATUSES);

const validateProductStatus = (status) => {
  const upperStatus = String(status || "").toUpperCase();
  if (!VALID_PRODUCT_STATUSES.includes(upperStatus)) {
    const error = new Error(`Status produk tidak valid. Harus salah satu dari: ${VALID_PRODUCT_STATUSES.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
  return upperStatus;
};

export class ProductService {
  static instance = null;

  constructor(repo = productRepository) {
    if (ProductService.instance && repo === productRepository) {
      return ProductService.instance;
    }
    this.repo = repo;
    if (repo === productRepository) {
      ProductService.instance = this;
    }
  }

  static getInstance(repo = productRepository) {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService(repo);
    }
    return ProductService.instance;
  }

  async getAllProducts(userRole, { status, search, page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, sortBy = "name", sortOrder = "ASC" } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || DEFAULT_PAGE);
    const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10) || DEFAULT_LIMIT));
    const offset = (pageNum - 1) * limitNum;

    let effectiveStatus = status;
    if (userRole === "RIDER") {
      effectiveStatus = PRODUCT_STATUSES.AVAILABLE;
    }

    const [products, total] = await Promise.all([
      this.repo.findAll({
        status: effectiveStatus,
        search,
        limit: limitNum,
        offset,
        sortBy,
        sortOrder,
      }),
      this.repo.countAll({
        status: effectiveStatus,
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

  async getProductById(id) {
    if (!id) {
      const error = new Error("Product ID harus diisi.");
      error.statusCode = 400;
      throw error;
    }

    const product = await this.repo.findById(id);
    if (!product) {
      const error = new Error(`Produk dengan ID '${id}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }
    return product;
  }

  async createProduct({ name, description = "", price, status = PRODUCT_STATUSES.AVAILABLE }) {
    if (!name || typeof name !== "string" || !name.trim()) {
      const error = new Error("Nama produk wajib diisi.");
      error.statusCode = 400;
      throw error;
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      const error = new Error("Harga produk harus berupa angka positif lebih dari 0.");
      error.statusCode = 400;
      throw error;
    }

    const productStatus = validateProductStatus(status);

    const existing = await this.repo.findByName(name);
    if (existing) {
      const error = new Error(`Produk dengan nama '${name.trim()}' sudah terdaftar.`);
      error.statusCode = 400;
      throw error;
    }

    return await this.repo.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      price: numericPrice,
      status: productStatus,
    });
  }

  async updateProduct(id, { name, description, price, status }) {
    await this.getProductById(id);

    const updates = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        const error = new Error("Nama produk tidak boleh kosong.");
        error.statusCode = 400;
        throw error;
      }
      const duplicate = await this.repo.findByName(name, id);
      if (duplicate) {
        const error = new Error(`Produk dengan nama '${name.trim()}' sudah terdaftar.`);
        error.statusCode = 400;
        throw error;
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description ? description.trim() : "";
    }

    if (price !== undefined) {
      const numericPrice = parseFloat(price);
      if (isNaN(numericPrice) || numericPrice <= 0) {
        const error = new Error("Harga produk harus berupa angka positif lebih dari 0.");
        error.statusCode = 400;
        throw error;
      }
      updates.price = numericPrice;
    }

    if (status !== undefined) {
      updates.status = validateProductStatus(status);
    }

    return await this.repo.update(id, updates);
  }

  async updateProductStatus(id, status) {
    await this.getProductById(id);
    const upperStatus = validateProductStatus(status);
    return await this.repo.updateStatus(id, upperStatus);
  }

  async deleteProduct(id) {
    const existing = await this.getProductById(id);

    const hasHistory = await this.repo.hasSalesHistory(id);
    if (hasHistory) {
      const error = new Error(
        `Produk '${existing.name}' tidak dapat dihapus karena telah memiliki histori transaksi penjualan. Harap gunakan fitur Nonaktifkan (status: DISCONTINUED) untuk menjaga integritas data akuntansi.`
      );
      error.statusCode = 400;
      throw error;
    }

    return await this.repo.delete(id);
  }
}

export const productService = ProductService.getInstance();
