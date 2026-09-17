import { productService } from "../services/product/ProductService.js";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode);
};

export const getProducts = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const { status, search, page = 1, limit = 20, sort_by, sort_order } = req.query;

    const result = await productService.getAllProducts(userRole, {
      status,
      search,
      page: Number(page),
      limit: Number(limit),
      sortBy: sort_by,
      sortOrder: sort_order,
    });

    return sendPaginated(
      res,
      result.products,
      result.pagination,
      "Katalog produk berhasil dimuat.",
      200,
      { data: result.products }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await productService.getProductById(id);
    return sendSuccess(res, product, "Detail produk berhasil dimuat.", 200, { data: product });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const createProduct = async (req, res) => {
  try {
    const { name, description, price, status } = req.body;
    const newProduct = await productService.createProduct({
      name,
      description,
      price,
      status,
    });

    return sendSuccess(
      res,
      newProduct,
      `Produk '${newProduct.name}' berhasil ditambahkan ke katalog menu.`,
      201,
      { data: newProduct }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, status } = req.body;

    const updated = await productService.updateProduct(id, {
      name,
      description,
      price,
      status,
    });

    return sendSuccess(
      res,
      updated,
      `Data produk '${updated.name}' berhasil diperbarui.`,
      200,
      { data: updated }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await productService.updateProductStatus(id, status);

    return sendSuccess(
      res,
      updated,
      `Status produk '${updated.name}' berhasil diubah menjadi '${updated.status}'.`,
      200,
      { data: updated }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await productService.deleteProduct(id);

    return sendSuccess(
      res,
      deleted,
      `Produk '${deleted.name}' berhasil dihapus secara permanen dari katalog menu.`,
      200,
      { data: deleted }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};
