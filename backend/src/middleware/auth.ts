import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { cache, CACHE_KEYS } from '../config/redis';
import { UnauthorizedError, ForbiddenError } from '../utils/error';
import { logger } from '../utils/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        name: string;
      };
    }
  }
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Extract token from request
const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Also check cookies for token
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  return null;
};

// Verify JWT token
const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid token');
    }
    throw new UnauthorizedError('Token verification failed');
  }
};

// Get user from cache or database
const getUser = async (userId: string) => {
  // Try cache first
  const cacheKey = CACHE_KEYS.USER(userId);
  let user = await cache.get(cacheKey);
  
  if (!user) {
    // Get from database
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });
    
    if (user) {
      // Cache for 30 minutes
      await cache.set(cacheKey, user, 1800);
    }
  }
  
  return user;
};

// Authentication middleware
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      throw new UnauthorizedError('Access token is required');
    }
    
    // Verify token
    const decoded = verifyToken(token);
    
    // Get user details
    const user = await getUser(decoded.userId);
    
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    
    if (!user.isActive) {
      throw new UnauthorizedError('User account is deactivated');
    }
    
    if (user.role === 'PENDING') {
      throw new ForbiddenError('Account is pending approval');
    }
    
    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    
    // Log access
    logger.info(`User ${user.email} accessed ${req.method} ${req.path}`);
    
    next();
  } catch (error) {
    next(error);
  }
};

// Optional authentication (for routes that work with or without auth)
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);
    
    if (token) {
      const decoded = verifyToken(token);
      const user = await getUser(decoded.userId);
      
      if (user && user.isActive && user.role !== 'PENDING') {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
        };
      }
    }
    
    next();
  } catch (error) {
    // In optional auth, we don't throw errors, just proceed without user
    next();
  }
};

// Generate JWT token
export const generateToken = (user: {
  id: string;
  email: string;
  role: string;
}): string => {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: 'grocery-ecommerce',
    audience: 'grocery-users',
  });
};

// Refresh token validation
export const validateRefreshToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch (error) {
    throw new UnauthorizedError('Invalid refresh token');
  }
};