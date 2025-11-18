import { Request, Response } from 'express';
import { productService } from './product.service';
import {
  productCreateSchema,
  productUpdateSchema,
  productQuerySchema,
  productBulkUpdateSchema,
  productSearchSchema,
} from './product.model';
import { asyncHandler } from '../../utils/error';
import { logger } from '../../utils/logger';

export class ProductController {
  // POST /products (Admin only)
  createProduct = asyncHandler(async (req: Request, res: Response) => {
    const data = productCreateSchema.parse(req.body);
    const product = await productService.createProduct(data);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
    });
  });

  // GET /products
  getProducts = asyncHandler(async (req: Request, res: Response) => {
    const query = productQuerySchema.parse(req.query);
    const result = await productService.getProducts(query);

    res.json({
      success: true,
      data: result,
    });
  });

  // GET /products/:id
  getProductById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const product = await productService.getProductById(id);

    res.json({
      success: true,
      data: { product },
    });
  });

  // GET /products/sku/:sku
  getProductBySku = asyncHandler(async (req: Request, res: Response) => {
    const { sku } = req.params;
    const product = await productService.getProductBySku(sku);

    res.json({
      success: true,
      data: { product },
    });
  });

  // PUT /products/:id (Admin only)
  updateProduct = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = productUpdateSchema.parse(req.body);
    const product = await productService.updateProduct(id, data);

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: { product },
    });
  });

  // DELETE /products/:id (Admin only)
  deleteProduct = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await productService.deleteProduct(id);

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  });

  // GET /products/search
  searchProducts = asyncHandler(async (req: Request, res: Response) => {
    const query = productSearchSchema.parse(req.query);
    const products = await productService.searchProducts(query);

    res.json({
      success: true,
      data: { products },
    });
  });

  // POST /products/bulk-update (Admin only)
  bulkUpdateProducts = asyncHandler(async (req: Request, res: Response) => {
    const data = productBulkUpdateSchema.parse(req.body);
    const result = await productService.bulkUpdateProducts(data);

    res.json({
      success: true,
      message: `Bulk update completed: ${result.updated} products updated`,
      data: result,
    });
  });

  // POST /products/:id/image (Admin only)
  uploadProductImage = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Image file is required',
      });
    }

    const imageUrl = await productService.uploadProductImage(id, req.file);

    res.json({
      success: true,
      message: 'Product image uploaded successfully',
      data: { imageUrl },
    });
  });

  // GET /products/categories
  getCategories = asyncHandler(async (req: Request, res: Response) => {
    const categories = await productService.getCategories();

    res.json({
      success: true,
      data: { categories },
    });
  });

  // GET /products/admin/low-stock (Admin only)
  getLowStockProducts = asyncHandler(async (req: Request, res: Response) => {
    const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : undefined;
    const products = await productService.getLowStockProducts(threshold);

    res.json({
      success: true,
      data: { products },
    });
  });

  // GET /products/admin/out-of-stock (Admin only)
  getOutOfStockProducts = asyncHandler(async (req: Request, res: Response) => {
    const products = await productService.getOutOfStockProducts();

    res.json({
      success: true,
      data: { products },
    });
  });

  // GET /products/featured
  getFeaturedProducts = asyncHandler(async (req: Request, res: Response) => {
    // Get featured products (you can customize this logic)
    const query = productQuerySchema.parse({
      ...req.query,
      limit: '12',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    
    const result = await productService.getProducts(query);

    res.json({
      success: true,
      data: {
        products: result.products.slice(0, 12), // Featured products
      },
    });
  });

  // GET /products/category/:category
  getProductsByCategory = asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.params;
    const query = productQuerySchema.parse({
      ...req.query,
      category,
    });
    
    const result = await productService.getProducts(query);

    res.json({
      success: true,
      data: result,
    });
  });

  // GET /products/admin/stats (Admin only)
  getProductStats = asyncHandler(async (req: Request, res: Response) => {
    // Get overall product statistics
    const query = productQuerySchema.parse({ isActive: 'true' });
    const result = await productService.getProducts({ ...query, limit: 1 });
    
    const [lowStockProducts, outOfStockProducts] = await Promise.all([
      productService.getLowStockProducts(),
      productService.getOutOfStockProducts(),
    ]);

    const stats = {
      totalProducts: result.pagination.total,
      lowStock: lowStockProducts.length,
      outOfStock: outOfStockProducts.length,
      categories: result.filters.categories.length,
      brands: result.filters.brands.length,
      priceRange: result.filters.priceRange,
    };

    res.json({
      success: true,
      data: { stats },
    });
  });
}

export const productController = new ProductController();