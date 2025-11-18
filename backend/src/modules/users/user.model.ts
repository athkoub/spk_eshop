import { z } from 'zod';

// User registration schema
export const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

// User login schema
export const userLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// User update schema
export const userUpdateSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').optional(),
}).refine((data) => {
  // If newPassword is provided, currentPassword must also be provided
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  return true;
}, {
  message: 'Current password is required when updating password',
  path: ['currentPassword'],
});

// Admin user update schema
export const adminUserUpdateSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  role: z.enum(['ADMIN', 'MEMBER', 'PENDING']).optional(),
  isActive: z.boolean().optional(),
});

// User approval schema
export const userApprovalSchema = z.object({
  approve: z.boolean(),
  reason: z.string().optional(),
});

// User query schema for filtering/pagination
export const userQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
  role: z.enum(['ADMIN', 'MEMBER', 'PENDING']).optional(),
  search: z.string().optional(),
  isActive: z.string().regex(/^(true|false)$/).transform(val => val === 'true').optional(),
  sortBy: z.enum(['createdAt', 'name', 'email', 'lastLogin']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Public user info (safe for API responses)
export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(['ADMIN', 'MEMBER', 'PENDING']),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLogin: z.date().nullable(),
});

// Types
export type UserRegistrationInput = z.infer<typeof userRegistrationSchema>;
export type UserLoginInput = z.infer<typeof userLoginSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;
export type UserApprovalInput = z.infer<typeof userApprovalSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;

// User role enum
export enum UserRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  PENDING = 'PENDING',
}

// User status for frontend display
export interface UserWithStatus extends PublicUser {
  statusLabel: string;
  canApprove: boolean;
  orderCount?: number;
}