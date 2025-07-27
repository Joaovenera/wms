/**
 * Centralized Validation Middleware
 * 
 * Provides request validation using Zod schemas:
 * - Body validation
 * - Query parameter validation
 * - Path parameter validation
 * - Custom validation rules
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../../../utils/exceptions/index.js';
import { logError } from '../../../utils/logger.js';
import { metricsService } from '../../../infrastructure/monitoring/index.js';

export interface ValidationSchemas {
  body?: ZodSchema<any>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
}

/**
 * Create validation middleware for request validation
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    try {
      // Validate request body
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      // Validate query parameters
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }

      // Validate path parameters
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }

      next();
    } catch (error) {
      const validationTime = Date.now() - startTime;
      
      if (error instanceof ZodError) {
        const validationError = new ValidationError(
          'Validation failed',
          { 
            issues: error.issues.map(issue => ({
              path: issue.path.join('.'),
              message: issue.message,
              code: issue.code,
            }))
          }
        );

        // Record validation error metrics
        metricsService.recordError({
          error: 'Validation Error',
          route: req.route?.path || req.path,
          method: req.method,
          userId: req.user?.id,
        });

        metricsService.recordRequest({
          method: req.method,
          route: req.route?.path || req.path,
          statusCode: 400,
          responseTime: validationTime,
          timestamp: new Date().toISOString(),
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: req.user?.id,
        });

        logError('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: validationError.details,
        });

        res.status(400).json({
          message: 'Validation failed',
          errors: validationError.details,
        });
        return;
      }

      // Handle other validation errors
      metricsService.recordError({
        error: error instanceof Error ? error.message : 'Unknown validation error',
        route: req.route?.path || req.path,
        method: req.method,
        userId: req.user?.id,
      });

      logError('Unexpected validation error', {
        path: req.path,
        method: req.method,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      next(error);
    }
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // ID parameter validation
  idParam: z.object({
    id: z.string().transform(val => {
      const num = parseInt(val, 10);
      if (isNaN(num) || num <= 0) {
        throw new Error('ID must be a positive integer');
      }
      return num;
    }),
  }),

  // Pagination query validation
  paginationQuery: z.object({
    page: z.string().transform(val => Math.max(1, parseInt(val, 10) || 1)),
    limit: z.string().transform(val => Math.min(100, Math.max(1, parseInt(val, 10) || 20))),
    search: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
  }),

  // Date range query validation
  dateRangeQuery: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }).refine(data => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  }, {
    message: 'Start date must be before or equal to end date',
  }),

  // Status filter validation
  statusQuery: z.object({
    status: z.string().optional(),
    active: z.string().transform(val => val === 'true').optional(),
  }),
};

/**
 * Domain-specific validation schemas
 */
export const validationSchemas = {
  // User domain
  user: {
    create: z.object({
      name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
      email: z.string().email('Invalid email format'),
      password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be less than 128 characters'),
      role: z.enum(['admin', 'manager', 'operator']).optional().default('operator'),
    }),
    
    update: z.object({
      name: z.string().min(2).max(100).optional(),
      email: z.string().email().optional(),
      role: z.enum(['admin', 'manager', 'operator']).optional(),
    }),
    
    updatePassword: z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
    }),
    
    query: z.object({
      ...commonSchemas.paginationQuery.shape,
      role: z.enum(['admin', 'manager', 'operator']).optional(),
      status: z.enum(['active', 'inactive']).optional(),
    }),
  },

  // Product domain
  product: {
    create: z.object({
      name: z.string().min(1, 'Product name is required').max(200),
      description: z.string().max(1000).optional(),
      sku: z.string().min(1, 'SKU is required').max(50),
      barcode: z.string().max(50).optional(),
      category: z.string().max(100).optional(),
      weight: z.number().positive().optional(),
      dimensions: z.object({
        length: z.number().positive().optional(),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
      }).optional(),
      price: z.number().positive().optional(),
    }),
    
    update: z.object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).optional(),
      sku: z.string().min(1).max(50).optional(),
      barcode: z.string().max(50).optional(),
      category: z.string().max(100).optional(),
      weight: z.number().positive().optional(),
      dimensions: z.object({
        length: z.number().positive().optional(),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
      }).optional(),
      price: z.number().positive().optional(),
    }),
    
    query: z.object({
      ...commonSchemas.paginationQuery.shape,
      category: z.string().optional(),
      minPrice: z.string().transform(val => val ? parseFloat(val) : undefined).optional(),
      maxPrice: z.string().transform(val => val ? parseFloat(val) : undefined).optional(),
      inStock: z.string().transform(val => val === 'true').optional(),
    }),
  },

  // Pallet domain
  pallet: {
    create: z.object({
      code: z.string().min(1, 'Pallet code is required').max(50),
      type: z.enum(['standard', 'euro', 'custom']).default('standard'),
      maxWeight: z.number().positive().optional(),
      maxHeight: z.number().positive().optional(),
      positionId: z.number().positive().optional(),
    }),
    
    update: z.object({
      code: z.string().min(1).max(50).optional(),
      type: z.enum(['standard', 'euro', 'custom']).optional(),
      maxWeight: z.number().positive().optional(),
      maxHeight: z.number().positive().optional(),
      positionId: z.number().positive().optional(),
      status: z.enum(['available', 'occupied', 'maintenance', 'retired']).optional(),
    }),
    
    query: z.object({
      ...commonSchemas.paginationQuery.shape,
      type: z.enum(['standard', 'euro', 'custom']).optional(),
      status: z.enum(['available', 'occupied', 'maintenance', 'retired']).optional(),
      positionId: z.string().transform(val => val ? parseInt(val) : undefined).optional(),
    }),
  },

  // UCP domain
  ucp: {
    create: z.object({
      code: z.string().min(1, 'UCP code is required').max(50),
      palletId: z.number().positive(),
      maxItems: z.number().positive().optional(),
      description: z.string().max(500).optional(),
    }),
    
    update: z.object({
      code: z.string().min(1).max(50).optional(),
      palletId: z.number().positive().optional(),
      maxItems: z.number().positive().optional(),
      description: z.string().max(500).optional(),
      status: z.enum(['active', 'full', 'locked', 'retired']).optional(),
    }),
    
    addItem: z.object({
      productId: z.number().positive(),
      quantity: z.number().positive(),
      batchNumber: z.string().max(50).optional(),
      expirationDate: z.string().datetime().optional(),
    }),
    
    transferItem: z.object({
      fromUcpId: z.number().positive(),
      toUcpId: z.number().positive(),
      productId: z.number().positive(),
      quantity: z.number().positive(),
      reason: z.string().max(200).optional(),
    }),
    
    query: z.object({
      ...commonSchemas.paginationQuery.shape,
      palletId: z.string().transform(val => val ? parseInt(val) : undefined).optional(),
      status: z.enum(['active', 'full', 'locked', 'retired']).optional(),
      hasItems: z.string().transform(val => val === 'true').optional(),
    }),
  },

  // Auth domain
  auth: {
    login: z.object({
      email: z.string().email('Invalid email format'),
      password: z.string().min(1, 'Password is required'),
      rememberMe: z.boolean().optional().default(false),
    }),
    
    register: z.object({
      name: z.string().min(2, 'Name must be at least 2 characters').max(100),
      email: z.string().email('Invalid email format'),
      password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    }),
    
    resetPassword: z.object({
      email: z.string().email('Invalid email format'),
    }),
    
    changePassword: z.object({
      token: z.string().min(1, 'Reset token is required'),
      newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
    }),
  },
};

/**
 * Middleware factory for common validation patterns
 */
export const validationMiddleware = {
  // Validate ID parameter
  validateId: validate({
    params: commonSchemas.idParam,
  }),

  // Validate pagination query
  validatePagination: validate({
    query: commonSchemas.paginationQuery,
  }),

  // Validate date range query
  validateDateRange: validate({
    query: commonSchemas.dateRangeQuery,
  }),

  // User validation middleware
  user: {
    create: validate({
      body: validationSchemas.user.create,
    }),
    update: validate({
      params: commonSchemas.idParam,
      body: validationSchemas.user.update,
    }),
    updatePassword: validate({
      params: commonSchemas.idParam,
      body: validationSchemas.user.updatePassword,
    }),
    list: validate({
      query: validationSchemas.user.query,
    }),
  },

  // Product validation middleware
  product: {
    create: validate({
      body: validationSchemas.product.create,
    }),
    update: validate({
      params: commonSchemas.idParam,
      body: validationSchemas.product.update,
    }),
    list: validate({
      query: validationSchemas.product.query,
    }),
  },

  // Pallet validation middleware
  pallet: {
    create: validate({
      body: validationSchemas.pallet.create,
    }),
    update: validate({
      params: commonSchemas.idParam,
      body: validationSchemas.pallet.update,
    }),
    list: validate({
      query: validationSchemas.pallet.query,
    }),
  },

  // UCP validation middleware
  ucp: {
    create: validate({
      body: validationSchemas.ucp.create,
    }),
    update: validate({
      params: commonSchemas.idParam,
      body: validationSchemas.ucp.update,
    }),
    addItem: validate({
      params: commonSchemas.idParam,
      body: validationSchemas.ucp.addItem,
    }),
    transferItem: validate({
      body: validationSchemas.ucp.transferItem,
    }),
    list: validate({
      query: validationSchemas.ucp.query,
    }),
  },

  // Auth validation middleware
  auth: {
    login: validate({
      body: validationSchemas.auth.login,
    }),
    register: validate({
      body: validationSchemas.auth.register,
    }),
    resetPassword: validate({
      body: validationSchemas.auth.resetPassword,
    }),
    changePassword: validate({
      body: validationSchemas.auth.changePassword,
    }),
  },
};

export default validationMiddleware;