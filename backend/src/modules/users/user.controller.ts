import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import {
  userRegistrationSchema,
  userLoginSchema,
  userUpdateSchema,
  adminUserUpdateSchema,
  userApprovalSchema,
  userQuerySchema,
} from './user.model';
import { generateToken } from '../../middleware/auth';
import { asyncHandler } from '../../utils/error';
import { logger } from '../../utils/logger';

export class UserController {
  // POST /users/register
  register = asyncHandler(async (req: Request, res: Response) => {
    const data = userRegistrationSchema.parse(req.body);
    const user = await userService.registerUser(data);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Your account is pending approval.',
      data: { user },
    });
  });

  // POST /users/login
  login = asyncHandler(async (req: Request, res: Response) => {
    const data = userLoginSchema.parse(req.body);
    const user = await userService.loginUser(data);
    
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token,
      },
    });
  });

  // POST /users/logout
  logout = asyncHandler(async (req: Request, res: Response) => {
    res.clearCookie('token');
    
    res.json({
      success: true,
      message: 'Logout successful',
    });
  });

  // GET /users/profile
  getProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getUserById(req.user!.id);
    
    res.json({
      success: true,
      data: { user },
    });
  });

  // PUT /users/profile
  updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const data = userUpdateSchema.parse(req.body);
    const user = await userService.updateUser(req.user!.id, data);
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  });

  // GET /users/:id (Admin only)
  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    
    res.json({
      success: true,
      data: { user },
    });
  });

  // GET /users (Admin only)
  getUsers = asyncHandler(async (req: Request, res: Response) => {
    const query = userQuerySchema.parse(req.query);
    const result = await userService.getUsers(query);
    
    res.json({
      success: true,
      data: result,
    });
  });

  // PUT /users/:id (Admin only)
  adminUpdateUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = adminUserUpdateSchema.parse(req.body);
    const user = await userService.adminUpdateUser(id, data);
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user },
    });
  });

  // POST /users/:id/approve (Admin only)
  approveUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = userApprovalSchema.parse(req.body);
    const user = await userService.approveUser(id, data);
    
    res.json({
      success: true,
      message: data.approve ? 'User approved successfully' : 'User approval denied',
      data: { user },
    });
  });

  // DELETE /users/:id (Admin only)
  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    // Prevent admin from deleting themselves
    if (id === req.user!.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account',
      });
    }
    
    await userService.deleteUser(id);
    
    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  });

  // GET /users/pending (Admin only)
  getPendingUsers = asyncHandler(async (req: Request, res: Response) => {
    const query = userQuerySchema.parse({
      ...req.query,
      role: 'PENDING',
    });
    const result = await userService.getUsers(query);
    
    res.json({
      success: true,
      data: result,
    });
  });
}

export const userController = new UserController();