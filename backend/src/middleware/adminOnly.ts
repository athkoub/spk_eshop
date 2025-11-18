import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/error';
import { logger } from '../utils/logger';

/**
 * Middleware to ensure only admin users can access the route
 * Must be used after the authenticate middleware
 */
export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }
    
    // Check if user has admin role
    if (req.user.role !== 'ADMIN') {
      logger.warn(`Non-admin user ${req.user.email} attempted to access admin route: ${req.method} ${req.path}`);
      throw new ForbiddenError('Admin access required');
    }
    
    logger.info(`Admin ${req.user.email} accessing admin route: ${req.method} ${req.path}`);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to ensure only admin or the resource owner can access
 * Requires a userId parameter in the route or query
 */
export const adminOrOwner = (userIdParam: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }
      
      const targetUserId = req.params[userIdParam] || req.query[userIdParam];
      
      // Admin can access anything
      if (req.user.role === 'ADMIN') {
        return next();
      }
      
      // User can only access their own resources
      if (req.user.id !== targetUserId) {
        logger.warn(`User ${req.user.email} attempted to access another user's resource: ${targetUserId}`);
        throw new ForbiddenError('Access denied');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to ensure user has member status or above
 * Blocks pending users from accessing member-only content
 */
export const memberOrAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }
    
    if (req.user.role === 'PENDING') {
      throw new ForbiddenError('Account is pending approval');
    }
    
    if (!['MEMBER', 'ADMIN'].includes(req.user.role)) {
      throw new ForbiddenError('Member access required');
    }
    
    next();
  } catch (error) {
    next(error);
  }
};