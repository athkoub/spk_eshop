import { Router } from 'express';
import { userController } from '../users/user.controller';
import { authenticate } from '../../middleware/auth';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Rate limiting for authentication routes
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth attempts per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
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

// Authentication routes
router.post('/register', registerRateLimit, userController.register);
router.post('/login', authRateLimit, userController.login);
router.post('/logout', userController.logout);

// Protected routes
router.get('/me', authenticate, userController.getProfile);
router.put('/me', authenticate, userController.updateProfile);

// Health check for auth
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auth service is healthy',
    timestamp: new Date().toISOString(),
  });
});

export { router as authRoutes };