import { z } from 'zod';

// Product creation schema
export const productCreateSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  price: z.number().min(0, 'Price must be positive'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  stock: z.number().int().min(0, 'Stock must be non-negative integer').default(0),
  weight: z.number().min(0, 'Weight must be positive').optional(),
  unit: z.string().optional(),
  brand: z.string().optional(),
  isActive: z.boolean().default(true),
});

// Product update schema
export const productUpdateSchema = z.object({
  name: z.string().min(1, 'Product name is required').optional(),
  sku: z.string().min(1, 'SKU is required').optional(),
  price: z.number().min(0, 'Price must be positive').optional(),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required').optional(),
  stock: z.number().int().min(0, 'Stock must be non-negative integer').optional(),
  weight: z.number().min(0, 'Weight must be positive').optional(),
  unit: z.string().optional(),
  brand: z.string().optional(),
  isActive: z.boolean().optional(),
});

// Product query schema for filtering/pagination
export const productQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  search: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional(),
  maxPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional(),
  inStock: z.string().regex(/^(true|false)$/).transform(val => val === 'true').optional(),
  isActive: z.string().regex(/^(true|false)$/).transform(val => val === 'true').default('true'),
  sortBy: z.enum(['name', 'price', 'createdAt', 'stock', 'category']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Bulk update schema for ERP sync
export const productBulkUpdateSchema = z.object({
  updates: z.array(z.object({
    sku: z.string(),
    price: z.number().min(0).optional(),
    stock: z.number().int().min(0).optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    isActive: z.boolean().optional(),
  })),
});

// Product search schema
export const productSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

// Image upload schema
export const productImageSchema = z.object({
  productId: z.string().cuid(),
  imageFile: z.any(), // File validation will be done in middleware
});

// Public product schema (safe for API responses)
export const publicProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  price: z.number(),
  imageUrl: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string(),
  stock: z.number(),
  isActive: z.boolean(),
  weight: z.number().nullable(),
  unit: z.string().nullable(),
  brand: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Admin product schema (includes all fields)
export const adminProductSchema = publicProductSchema.extend({
  // Add any admin-only fields here if needed
});

// Product with availability info
export const productWithAvailabilitySchema = publicProductSchema.extend({
  isInStock: z.boolean(),
  stockStatus: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']),
  lowStockThreshold: z.number().default(10),
});

// Category schema
export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

// Types
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type ProductBulkUpdateInput = z.infer<typeof productBulkUpdateSchema>;
export type ProductSearchInput = z.infer<typeof productSearchSchema>;
export type PublicProduct = z.infer<typeof publicProductSchema>;
export type AdminProduct = z.infer<typeof adminProductSchema>;
export type ProductWithAvailability = z.infer<typeof productWithAvailabilitySchema>;
export type CategoryInput = z.infer<typeof categorySchema>;

// Stock status enum
export enum StockStatus {
  IN_STOCK = 'IN_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

// Product filters interface
export interface ProductFilters {
  search?: string;
  category?: string;
  brand?: string;
  priceRange?: {
    min?: number;
    max?: number;
  };
  inStock?: boolean;
  isActive?: boolean;
}

// Product aggregation interface
export interface ProductAggregation {
  totalProducts: number;
  categories: Array<{
    name: string;
    count: number;
  }>;
  brands: Array<{
    name: string;
    count: number;
  }>;
  priceRange: {
    min: number;
    max: number;
  };
  stockSummary: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
  };
}