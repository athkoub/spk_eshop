import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { cache, CACHE_KEYS } from '../../config/redis';
import { r2Storage } from '../../config/r2';
import { logger } from '../../utils/logger';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/error';
import {
  ProductCreateInput,
  ProductUpdateInput,
  ProductQueryInput,
  ProductBulkUpdateInput,
  ProductSearchInput,
  PublicProduct,
  ProductWithAvailability,
  ProductAggregation,
  StockStatus,
  CategoryInput,
} from './product.model';

export class ProductService {
  private readonly LOW_STOCK_THRESHOLD = 10;
  private readonly CACHE_TTL = 3600; // 1 hour

  async createProduct(data: ProductCreateInput): Promise<PublicProduct> {
    // Check if SKU already exists
    const existingSku = await prisma.product.findUnique({
      where: { sku: data.sku },
    });

    if (existingSku) {
      throw new ConflictError('Product with this SKU already exists');
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        price: new Prisma.Decimal(data.price),
        weight: data.weight ? new Prisma.Decimal(data.weight) : null,
      },
    });

    // Clear products cache
    await this.invalidateProductsCache();

    logger.info(`Product created: ${product.name} (SKU: ${product.sku})`);
    return this.transformProduct(product);
  }

  async getProductById(productId: string): Promise<ProductWithAvailability> {
    // Try cache first
    const cacheKey = CACHE_KEYS.PRODUCT(productId);
    let product = await cache.get<ProductWithAvailability>(cacheKey);

    if (!product) {
      const dbProduct = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!dbProduct) {
        throw new NotFoundError('Product not found');
      }

      product = this.transformProductWithAvailability(dbProduct);

      // Cache for 1 hour
      await cache.set(cacheKey, product, this.CACHE_TTL);
    }

    return product;
  }

  async getProductBySku(sku: string): Promise<ProductWithAvailability> {
    const product = await prisma.product.findUnique({
      where: { sku },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return this.transformProductWithAvailability(product);
  }

  async getProducts(query: ProductQueryInput): Promise<{
    products: ProductWithAvailability[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    filters: {
      categories: string[];
      brands: string[];
      priceRange: { min: number; max: number };
    };
  }> {
    const { page, limit, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where = this.buildProductWhereClause(query);

    // Check cache for this query
    const cacheKey = `products:${JSON.stringify({ where, skip, limit, sortBy, sortOrder })}`;
    const cachedResult = await cache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const [products, total, aggregations] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
      this.getProductAggregations(where),
    ]);

    const transformedProducts = products.map(p => this.transformProductWithAvailability(p));

    const result = {
      products: transformedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        categories: aggregations.categories.map(c => c.name),
        brands: aggregations.brands.map(b => b.name),
        priceRange: aggregations.priceRange,
      },
    };

    // Cache for 30 minutes
    await cache.set(cacheKey, result, 1800);

    return result;
  }

  async updateProduct(productId: string, data: ProductUpdateInput): Promise<PublicProduct> {
    // Check if product exists
    await this.getProductById(productId);

    // Check SKU uniqueness if updating SKU
    if (data.sku) {
      const existingSku = await prisma.product.findFirst({
        where: {
          sku: data.sku,
          id: { not: productId },
        },
      });

      if (existingSku) {
        throw new ConflictError('Product with this SKU already exists');
      }
    }

    const updateData: any = { ...data };

    if (data.price !== undefined) {
      updateData.price = new Prisma.Decimal(data.price);
    }

    if (data.weight !== undefined) {
      updateData.weight = data.weight ? new Prisma.Decimal(data.weight) : null;
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    });

    // Clear caches
    await Promise.all([
      cache.del(CACHE_KEYS.PRODUCT(productId)),
      this.invalidateProductsCache(),
    ]);

    logger.info(`Product updated: ${product.name} (ID: ${productId})`);
    return this.transformProduct(product);
  }

  async deleteProduct(productId: string): Promise<void> {
    const product = await this.getProductById(productId);

    // Check if product is used in any orders
    const orderCount = await prisma.orderItem.count({
      where: { productId },
    });

    if (orderCount > 0) {
      // Don't delete, just deactivate
      await this.updateProduct(productId, { isActive: false });
      logger.info(`Product deactivated instead of deleted: ${productId}`);
      return;
    }

    // Delete product image if exists
    if (product.imageUrl) {
      try {
        const imageKey = this.extractImageKeyFromUrl(product.imageUrl);
        await r2Storage.deleteFile(imageKey);
      } catch (error) {
        logger.warn(`Failed to delete product image: ${error}`);
      }
    }

    await prisma.product.delete({
      where: { id: productId },
    });

    // Clear caches
    await Promise.all([
      cache.del(CACHE_KEYS.PRODUCT(productId)),
      this.invalidateProductsCache(),
    ]);

    logger.info(`Product deleted: ${productId}`);
  }

  async searchProducts(query: ProductSearchInput): Promise<ProductWithAvailability[]> {
    const cacheKey = CACHE_KEYS.PRODUCT_SEARCH(JSON.stringify(query));
    const cached = await cache.get<ProductWithAvailability[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      OR: [
        { name: { contains: query.query, mode: 'insensitive' } },
        { description: { contains: query.query, mode: 'insensitive' } },
        { sku: { contains: query.query, mode: 'insensitive' } },
        { brand: { contains: query.query, mode: 'insensitive' } },
      ],
    };

    if (query.category) {
      where.category = query.category;
    }

    const products = await prisma.product.findMany({
      where,
      take: query.limit,
      orderBy: [
        { name: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    const transformedProducts = products.map(p => this.transformProductWithAvailability(p));

    // Cache for 15 minutes
    await cache.set(cacheKey, transformedProducts, 900);

    return transformedProducts;
  }

  async bulkUpdateProducts(data: ProductBulkUpdateInput): Promise<{
    updated: number;
    errors: Array<{ sku: string; error: string }>;
  }> {
    const results = {
      updated: 0,
      errors: [] as Array<{ sku: string; error: string }>,
    };

    for (const update of data.updates) {
      try {
        const product = await prisma.product.findUnique({
          where: { sku: update.sku },
        });

        if (!product) {
          results.errors.push({
            sku: update.sku,
            error: 'Product not found',
          });
          continue;
        }

        const updateData: any = { ...update };
        delete updateData.sku;

        if (update.price !== undefined) {
          updateData.price = new Prisma.Decimal(update.price);
        }

        await prisma.product.update({
          where: { id: product.id },
          data: updateData,
        });

        // Clear product cache
        await cache.del(CACHE_KEYS.PRODUCT(product.id));

        results.updated++;
      } catch (error) {
        results.errors.push({
          sku: update.sku,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Clear products cache after bulk update
    await this.invalidateProductsCache();

    logger.info(`Bulk update completed: ${results.updated} updated, ${results.errors.length} errors`);
    return results;
  }

  async uploadProductImage(productId: string, imageFile: Express.Multer.File): Promise<string> {
    const product = await this.getProductById(productId);

    // Generate image key
    const imageKey = r2Storage.generateKey('products', imageFile.originalname);

    // Upload to R2
    const imageUrl = await r2Storage.uploadFile(
      imageKey,
      imageFile.buffer,
      imageFile.mimetype,
      {
        productId,
        originalName: imageFile.originalname,
      }
    );

    // Delete old image if exists
    if (product.imageUrl) {
      try {
        const oldImageKey = this.extractImageKeyFromUrl(product.imageUrl);
        await r2Storage.deleteFile(oldImageKey);
      } catch (error) {
        logger.warn(`Failed to delete old image: ${error}`);
      }
    }

    // Update product with new image URL
    await prisma.product.update({
      where: { id: productId },
      data: { imageUrl },
    });

    // Clear caches
    await cache.del(CACHE_KEYS.PRODUCT(productId));

    logger.info(`Product image uploaded: ${productId}`);
    return imageUrl;
  }

  async getCategories(): Promise<string[]> {
    const cacheKey = CACHE_KEYS.CATEGORIES;
    let categories = await cache.get<string[]>(cacheKey);

    if (!categories) {
      const result = await prisma.product.findMany({
        where: { isActive: true },
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      });

      categories = result.map(p => p.category);

      // Cache for 2 hours
      await cache.set(cacheKey, categories, 7200);
    }

    return categories;
  }

  async getLowStockProducts(threshold?: number): Promise<ProductWithAvailability[]> {
    const stockThreshold = threshold || this.LOW_STOCK_THRESHOLD;

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        stock: {
          lte: stockThreshold,
          gt: 0,
        },
      },
      orderBy: { stock: 'asc' },
    });

    return products.map(p => this.transformProductWithAvailability(p));
  }

  async getOutOfStockProducts(): Promise<ProductWithAvailability[]> {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        stock: 0,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return products.map(p => this.transformProductWithAvailability(p));
  }

  // Private helper methods
  private buildProductWhereClause(query: ProductQueryInput): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {
      isActive: query.isActive,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.brand) {
      where.brand = query.brand;
    }

    if (query.minPrice || query.maxPrice) {
      where.price = {};
      if (query.minPrice) where.price.gte = query.minPrice;
      if (query.maxPrice) where.price.lte = query.maxPrice;
    }

    if (query.inStock !== undefined) {
      where.stock = query.inStock ? { gt: 0 } : { lte: 0 };
    }

    return where;
  }

  private async getProductAggregations(where: Prisma.ProductWhereInput): Promise<ProductAggregation> {
    const [categories, brands, priceRange, stockSummary] = await Promise.all([
      prisma.product.groupBy({
        by: ['category'],
        where,
        _count: { category: true },
        orderBy: { category: 'asc' },
      }),
      prisma.product.groupBy({
        by: ['brand'],
        where: { ...where, brand: { not: null } },
        _count: { brand: true },
        orderBy: { brand: 'asc' },
      }),
      prisma.product.aggregate({
        where,
        _min: { price: true },
        _max: { price: true },
      }),
      this.getStockSummary(where),
    ]);

    return {
      totalProducts: 0, // Will be set by caller
      categories: categories.map(c => ({ name: c.category, count: c._count.category })),
      brands: brands.map(b => ({ name: b.brand || '', count: b._count.brand })),
      priceRange: {
        min: priceRange._min.price?.toNumber() || 0,
        max: priceRange._max.price?.toNumber() || 0,
      },
      stockSummary,
    };
  }

  private async getStockSummary(where: Prisma.ProductWhereInput) {
    const [inStock, lowStock, outOfStock] = await Promise.all([
      prisma.product.count({ where: { ...where, stock: { gt: this.LOW_STOCK_THRESHOLD } } }),
      prisma.product.count({ where: { ...where, stock: { gt: 0, lte: this.LOW_STOCK_THRESHOLD } } }),
      prisma.product.count({ where: { ...where, stock: 0 } }),
    ]);

    return { inStock, lowStock, outOfStock };
  }

  private transformProduct(product: any): PublicProduct {
    return {
      ...product,
      price: product.price.toNumber(),
      weight: product.weight?.toNumber() || null,
    };
  }

  private transformProductWithAvailability(product: any): ProductWithAvailability {
    const baseProduct = this.transformProduct(product);
    const isInStock = product.stock > 0;
    const stockStatus = this.getStockStatus(product.stock);

    return {
      ...baseProduct,
      isInStock,
      stockStatus,
      lowStockThreshold: this.LOW_STOCK_THRESHOLD,
    };
  }

  private getStockStatus(stock: number): StockStatus {
    if (stock === 0) return StockStatus.OUT_OF_STOCK;
    if (stock <= this.LOW_STOCK_THRESHOLD) return StockStatus.LOW_STOCK;
    return StockStatus.IN_STOCK;
  }

  private extractImageKeyFromUrl(url: string): string {
    // Extract the key from R2 URL
    const urlParts = url.split('/');
    return urlParts.slice(-2).join('/'); // Get last two parts (folder/filename)
  }

  private async invalidateProductsCache(): Promise<void> {
    // Clear all product-related caches
    await Promise.all([
      cache.del(CACHE_KEYS.PRODUCTS),
      cache.del(CACHE_KEYS.CATEGORIES),
      // Clear search cache (this is a simplification - in production you might want to be more selective)
    ]);
  }
}

export const productService = new ProductService();