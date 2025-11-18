import { Router } from 'express';
import multer from 'multer';
import { productController } from './product.controller';
import { authenticate } from '../../middleware/auth';
import { adminOnly, memberOrAdmin } from '../../middleware/adminOnly';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'));
    }
  },
});

// Rate limiting for search
const searchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 search requests per minute
  message: {
    success: false,
    message: 'Too many search requests, please try again later',
  },
});

// Public routes (require authentication but available to members)
router.get('/', authenticate, memberOrAdmin, productController.getProducts);
router.get('/search', authenticate, memberOrAdmin, searchRateLimit, productController.searchProducts);
router.get('/categories', authenticate, memberOrAdmin, productController.getCategories);
router.get('/featured', authenticate, memberOrAdmin, productController.getFeaturedProducts);
router.get('/category/:category', authenticate, memberOrAdmin, productController.getProductsByCategory);
router.get('/sku/:sku', authenticate, memberOrAdmin, productController.getProductBySku);
router.get('/:id', authenticate, memberOrAdmin, productController.getProductById);

// Admin-only routes
router.post('/', authenticate, adminOnly, productController.createProduct);
router.put('/:id', authenticate, adminOnly, productController.updateProduct);
router.delete('/:id', authenticate, adminOnly, productController.deleteProduct);
router.post('/bulk-update', authenticate, adminOnly, productController.bulkUpdateProducts);
router.post('/:id/image', authenticate, adminOnly, upload.single('image'), productController.uploadProductImage);

// Admin analytics and management routes
router.get('/admin/stats', authenticate, adminOnly, productController.getProductStats);
router.get('/admin/low-stock', authenticate, adminOnly, productController.getLowStockProducts);
router.get('/admin/out-of-stock', authenticate, adminOnly, productController.getOutOfStockProducts);

export { router as productRoutes };