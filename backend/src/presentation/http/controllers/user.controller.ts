/**
 * User Domain Controller
 * 
 * Handles all user-related HTTP requests:
 * - Authentication and authorization
 * - User profile management
 * - User preferences
 * - User sessions
 */

import { Request, Response, NextFunction } from 'express';
import { userRepository } from '../../../infrastructure/database/repositories/index.js';
import { strategicCache, strategies } from '../../../infrastructure/cache/index.js';
import { metricsService } from '../../../infrastructure/monitoring/index.js';
import { ValidationError, NotFoundError } from '../../../utils/exceptions/index.js';
import { logInfo, logError } from '../../../utils/logger.js';
import { z } from 'zod';

// Request validation schemas
const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'manager', 'operator']).optional().default('operator'),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'manager', 'operator']).optional(),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export class UserController {
  /**
   * Get all users with pagination and filtering
   */
  async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const search = req.query.search as string;
      const role = req.query.role as string;
      const status = req.query.status as string;

      // Build cache key
      const cacheKey = `users:list:${page}:${limit}:${search || ''}:${role || ''}:${status || ''}`;
      
      // Try to get from cache first
      const cached = await strategicCache.get(strategies.user.profile, cacheKey);
      if (cached) {
        const responseTime = Date.now() - startTime;
        
        // Record metrics
        metricsService.recordRequest({
          method: req.method,
          route: '/api/users',
          statusCode: 200,
          responseTime,
          timestamp: new Date().toISOString(),
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: req.user?.id,
        });

        res.json(cached);
        return;
      }

      // Build query filters
      const filters: any = {};
      if (search) {
        filters.search = search;
      }
      if (role) {
        filters.role = role;
      }
      if (status) {
        filters.status = status;
      }

      // Fetch from database
      const { users, total } = await userRepository.findMany({
        ...filters,
        page,
        limit,
      });

      const result = {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        timestamp: new Date().toISOString(),
      };

      // Cache the result
      await strategicCache.set(strategies.user.profile, cacheKey, result, 300); // 5 minutes

      const responseTime = Date.now() - startTime;
      
      // Record metrics
      metricsService.recordRequest({
        method: req.method,
        route: '/api/users',
        statusCode: 200,
        responseTime,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
      });

      res.json(result);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Record error metrics
      metricsService.recordError({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        route: '/api/users',
        method: req.method,
        userId: req.user?.id,
      });

      metricsService.recordRequest({
        method: req.method,
        route: '/api/users',
        statusCode: 500,
        responseTime,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
      });

      next(error);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        throw new ValidationError('Invalid user ID');
      }

      // Try cache first
      const cacheKey = userId.toString();
      const cached = await strategicCache.get(strategies.user.profile, cacheKey);
      
      if (cached) {
        const responseTime = Date.now() - startTime;
        
        metricsService.recordRequest({
          method: req.method,
          route: '/api/users/:id',
          statusCode: 200,
          responseTime,
          timestamp: new Date().toISOString(),
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: req.user?.id,
        });

        res.json(cached);
        return;
      }

      // Fetch from database
      const user = await userRepository.findById(userId);
      
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Cache the result
      await strategicCache.set(strategies.user.profile, cacheKey, user);

      const responseTime = Date.now() - startTime;
      
      metricsService.recordRequest({
        method: req.method,
        route: '/api/users/:id',
        statusCode: 200,
        responseTime,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
      });

      res.json(user);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const statusCode = error instanceof NotFoundError ? 404 : 
                         error instanceof ValidationError ? 400 : 500;
      
      metricsService.recordError({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        route: '/api/users/:id',
        method: req.method,
        userId: req.user?.id,
      });

      metricsService.recordRequest({
        method: req.method,
        route: '/api/users/:id',
        statusCode,
        responseTime,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
      });

      next(error);
    }
  }

  /**
   * Create new user
   */
  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const validatedData = createUserSchema.parse(req.body);
      
      // Create user
      const newUser = await userRepository.create(validatedData);
      
      // Invalidate related caches
      await strategicCache.invalidateEntity('user');

      const responseTime = Date.now() - startTime;
      
      metricsService.recordRequest({
        method: req.method,
        route: '/api/users',
        statusCode: 201,
        responseTime,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
      });

      logInfo('User created', {
        userId: newUser.id,
        createdBy: req.user?.id,
      });

      res.status(201).json(newUser);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const statusCode = error instanceof ValidationError ? 400 : 500;
      
      metricsService.recordError({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        route: '/api/users',
        method: req.method,
        userId: req.user?.id,
      });

      metricsService.recordRequest({
        method: req.method,
        route: '/api/users',
        statusCode,
        responseTime,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
      });

      next(error);
    }
  }

  /**
   * Update user
   */
  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        throw new ValidationError('Invalid user ID');
      }

      const validatedData = updateUserSchema.parse(req.body);
      
      // Update user
      const updatedUser = await userRepository.update(userId, validatedData);
      
      if (!updatedUser) {
        throw new NotFoundError('User not found');
      }

      // Update cache
      await strategicCache.set(strategies.user.profile, userId.toString(), updatedUser);
      
      // Invalidate list caches
      await strategicCache.invalidateEntity('user');

      const responseTime = Date.now() - startTime;
      
      metricsService.recordRequest({
        method: req.method,
        route: '/api/users/:id',
        statusCode: 200,
        responseTime,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
      });

      logInfo('User updated', {
        userId,
        updatedBy: req.user?.id,
      });

      res.json(updatedUser);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const statusCode = error instanceof NotFoundError ? 404 : 
                         error instanceof ValidationError ? 400 : 500;
      
      metricsService.recordError({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        route: '/api/users/:id',
        method: req.method,
        userId: req.user?.id,
      });

      metricsService.recordRequest({
        method: req.method,
        route: '/api/users/:id',
        statusCode,
        responseTime,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
      });

      next(error);
    }
  }

  /**
   * Delete user
   */
  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        throw new ValidationError('Invalid user ID');
      }

      // Prevent self-deletion
      if (userId === req.user?.id) {
        throw new ValidationError('Cannot delete your own account');
      }

      const deleted = await userRepository.delete(userId);
      
      if (!deleted) {
        throw new NotFoundError('User not found');
      }

      // Invalidate caches
      await strategicCache.delete(strategies.user.profile, userId.toString());
      await strategicCache.invalidateEntity('user');

      const responseTime = Date.now() - startTime;
      
      metricsService.recordRequest({
        method: req.method,
        route: '/api/users/:id',
        statusCode: 204,
        responseTime,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
      });

      logInfo('User deleted', {
        userId,
        deletedBy: req.user?.id,
      });

      res.status(204).send();
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const statusCode = error instanceof NotFoundError ? 404 : 
                         error instanceof ValidationError ? 400 : 500;
      
      metricsService.recordError({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        route: '/api/users/:id',
        method: req.method,
        userId: req.user?.id,
      });

      metricsService.recordRequest({
        method: req.method,
        route: '/api/users/:id',
        statusCode,
        responseTime,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
      });

      next(error);
    }
  }

  /**
   * Update user password
   */
  async updatePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        throw new ValidationError('Invalid user ID');
      }

      // Only allow users to change their own password or admins
      if (userId !== req.user?.id && req.user?.role !== 'admin') {
        throw new ValidationError('You can only change your own password');
      }

      const validatedData = updatePasswordSchema.parse(req.body);
      
      // Update password
      await userRepository.updatePassword(userId, validatedData.currentPassword, validatedData.newPassword);

      const responseTime = Date.now() - startTime;
      
      metricsService.recordRequest({
        method: req.method,
        route: '/api/users/:id/password',
        statusCode: 200,
        responseTime,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
      });

      logInfo('User password updated', {
        userId,
        updatedBy: req.user?.id,
      });

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const statusCode = error instanceof ValidationError ? 400 : 500;
      
      metricsService.recordError({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        route: '/api/users/:id/password',
        method: req.method,
        userId: req.user?.id,
      });

      metricsService.recordRequest({
        method: req.method,
        route: '/api/users/:id/password',
        statusCode,
        responseTime,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
      });

      next(error);
    }
  }
}

// Export singleton instance
export const userController = new UserController();