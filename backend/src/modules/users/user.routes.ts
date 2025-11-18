import { Router } from 'express';
import { userController } from './user.controller';
import { authenticate } from '../../middleware/auth';
import { adminOnly, adminOrOwner } from '../../middleware/adminOnly';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Rate limiting for authentication routes
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
  },
});

// Rate limiting for registration
const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 registrations per hour
  message: {
    success: false,
    message: 'Too many registration attempts, please try again later',
  },
});

// Public routes
router.post('/register', registerRateLimit, userController.register);
router.post('/login', authRateLimit, userController.login);
router.post('/logout', userController.logout);

// Protected routes - User profile management
router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);

// Admin routes - User management
router.get('/', authenticate, adminOnly, userController.getUsers);
router.get('/pending', authenticate, adminOnly, userController.getPendingUsers);
router.get('/:id', authenticate, adminOrOwner('id'), userController.getUserById);
router.put('/:id', authenticate, adminOnly, userController.adminUpdateUser);
router.post('/:id/approve', authenticate, adminOnly, userController.approveUser);
router.delete('/:id', authenticate, adminOnly, userController.deleteUser);

export { router as userRoutes };