import bcrypt from 'bcryptjs';
import { prisma } from '../../config/db';
import { cache, CACHE_KEYS } from '../../config/redis';
import { kafkaProducer } from '../../config/kafka';
import { logger } from '../../utils/logger';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils/error';
import {
  UserRegistrationInput,
  UserLoginInput,
  UserUpdateInput,
  AdminUserUpdateInput,
  UserApprovalInput,
  UserQueryInput,
  PublicUser,
  UserWithStatus,
} from './user.model';

export class UserService {
  async registerUser(data: UserRegistrationInput): Promise<PublicUser> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: 'PENDING', // All new users start as pending
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
      },
    });

    // Send user registration event to Kafka
    await kafkaProducer.sendUserEvent(user.id, 'user_registered', {
      email: user.email,
      name: user.name,
    });

    logger.info(`User registered: ${user.email}`);
    return user;
  }

  async loginUser(data: UserLoginInput): Promise<PublicUser> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.role === 'PENDING') {
      throw new UnauthorizedError('Account is pending approval');
    }

    // Update last login
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
      },
    });

    // Clear user cache
    await cache.del(CACHE_KEYS.USER(user.id));

    // Send login event to Kafka
    await kafkaProducer.sendUserEvent(user.id, 'user_login', {
      email: user.email,
      timestamp: new Date(),
    });

    logger.info(`User logged in: ${user.email}`);
    return updatedUser;
  }

  async getUserById(userId: string): Promise<PublicUser> {
    // Try cache first
    const cacheKey = CACHE_KEYS.USER(userId);
    let user = await cache.get<PublicUser>(cacheKey);

    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Cache for 30 minutes
      await cache.set(cacheKey, user, 1800);
    }

    return user;
  }

  async updateUser(userId: string, data: UserUpdateInput): Promise<PublicUser> {
    const user = await this.getUserById(userId);

    const updateData: any = {};

    if (data.email) {
      // Check if email is already taken by another user
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          id: { not: userId },
        },
      });

      if (existingUser) {
        throw new ConflictError('Email is already taken');
      }

      updateData.email = data.email;
    }

    if (data.name) {
      updateData.name = data.name;
    }

    if (data.newPassword && data.currentPassword) {
      // Verify current password
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!currentUser) {
        throw new NotFoundError('User not found');
      }

      const isValidPassword = await bcrypt.compare(
        data.currentPassword,
        currentUser.passwordHash
      );

      if (!isValidPassword) {
        throw new ValidationError('Current password is incorrect');
      }

      updateData.passwordHash = await bcrypt.hash(data.newPassword, 12);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
      },
    });

    // Clear user cache
    await cache.del(CACHE_KEYS.USER(userId));

    // Send update event to Kafka
    await kafkaProducer.sendUserEvent(userId, 'user_updated', {
      changes: Object.keys(updateData),
    });

    logger.info(`User updated: ${updatedUser.email}`);
    return updatedUser;
  }

  async getUsers(query: UserQueryInput): Promise<{
    users: UserWithStatus[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page, limit, role, search, isActive, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
          _count: {
            select: { orders: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const usersWithStatus: UserWithStatus[] = users.map(user => ({
      ...user,
      statusLabel: this.getUserStatusLabel(user.role, user.isActive),
      canApprove: user.role === 'PENDING',
      orderCount: user._count.orders,
    }));

    return {
      users: usersWithStatus,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async approveUser(userId: string, data: UserApprovalInput): Promise<PublicUser> {
    const user = await this.getUserById(userId);

    if (user.role !== 'PENDING') {
      throw new ValidationError('User is not pending approval');
    }

    const newRole = data.approve ? 'MEMBER' : 'PENDING';
    const isActive = data.approve;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: newRole,
        isActive,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
      },
    });

    // Clear user cache
    await cache.del(CACHE_KEYS.USER(userId));

    // Send approval event to Kafka
    await kafkaProducer.sendUserEvent(userId, 'user_approval_changed', {
      approved: data.approve,
      reason: data.reason,
      newRole,
    });

    logger.info(`User ${data.approve ? 'approved' : 'denied'}: ${user.email}`);
    return updatedUser;
  }

  async adminUpdateUser(userId: string, data: AdminUserUpdateInput): Promise<PublicUser> {
    const updateData: any = {};

    if (data.email) {
      // Check if email is already taken by another user
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          id: { not: userId },
        },
      });

      if (existingUser) {
        throw new ConflictError('Email is already taken');
      }

      updateData.email = data.email;
    }

    if (data.name) {
      updateData.name = data.name;
    }

    if (data.role) {
      updateData.role = data.role;
    }

    if (typeof data.isActive === 'boolean') {
      updateData.isActive = data.isActive;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
      },
    });

    // Clear user cache
    await cache.del(CACHE_KEYS.USER(userId));

    // Send admin update event to Kafka
    await kafkaProducer.sendUserEvent(userId, 'user_admin_updated', {
      changes: Object.keys(updateData),
      adminAction: true,
    });

    logger.info(`User admin updated: ${updatedUser.email}`);
    return updatedUser;
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.getUserById(userId);

    await prisma.user.delete({
      where: { id: userId },
    });

    // Clear user cache
    await cache.del(CACHE_KEYS.USER(userId));

    // Send deletion event to Kafka
    await kafkaProducer.sendUserEvent(userId, 'user_deleted', {
      email: user.email,
    });

    logger.info(`User deleted: ${user.email}`);
  }

  private getUserStatusLabel(role: string, isActive: boolean): string {
    if (!isActive) return 'Deactivated';
    switch (role) {
      case 'ADMIN': return 'Administrator';
      case 'MEMBER': return 'Active Member';
      case 'PENDING': return 'Pending Approval';
      default: return 'Unknown';
    }
  }
}

export const userService = new UserService();