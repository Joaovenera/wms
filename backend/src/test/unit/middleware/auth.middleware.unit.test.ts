import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware, requireRole, requirePermission } from '../../../middleware/auth.middleware';
import { createMockRequest, createMockResponse } from '../../utils/test-helpers';
import jwt from 'jsonwebtoken';

// Mock dependencies
vi.mock('jsonwebtoken');
vi.mock('../../../utils/logger');
vi.mock('../../../config/redis');

describe('Auth Middleware Unit Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;

  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    role: 'operator',
    permissions: ['read:products', 'write:ucps', 'read:pallets'],
    isActive: true,
  };

  beforeEach(() => {
    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnValue({ json: mockJson });
    mockNext = vi.fn();
    
    mockRequest = createMockRequest({
      headers: {
        authorization: 'Bearer valid-token'
      }
    });
    
    mockResponse = createMockResponse();
    mockResponse.json = mockJson;
    mockResponse.status = mockStatus;
    
    vi.clearAllMocks();
  });

  describe('authMiddleware', () => {
    it('should authenticate user with valid token', async () => {
      vi.mocked(jwt.verify).mockReturnValue(mockUser);
      
      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      mockRequest.headers = {};
      
      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Authorization header required',
        code: 'MISSING_AUTH_HEADER'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', async () => {
      mockRequest.headers = { authorization: 'InvalidFormat token' };
      
      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Invalid authorization format. Use: Bearer <token>',
        code: 'INVALID_AUTH_FORMAT'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with expired token', async () => {
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw expiredError;
      });
      
      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with malformed token', async () => {
      const malformedError = new Error('Malformed token');
      malformedError.name = 'JsonWebTokenError';
      
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw malformedError;
      });
      
      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    });

    it('should reject request for inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      vi.mocked(jwt.verify).mockReturnValue(inactiveUser);
      
      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'User account is inactive',
        code: 'INACTIVE_USER'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle token verification with custom secret', async () => {
      process.env.JWT_SECRET = 'custom-secret';
      vi.mocked(jwt.verify).mockReturnValue(mockUser);
      
      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'custom-secret');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract token from different header formats', async () => {
      const testCases = [
        'Bearer valid-token',
        'bearer valid-token',
        'BEARER valid-token',
      ];
      
      for (const authHeader of testCases) {
        mockRequest.headers = { authorization: authHeader };
        vi.mocked(jwt.verify).mockReturnValue(mockUser);
        
        await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
        
        expect(jwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String));
      }
    });

    it('should handle missing JWT_SECRET environment variable', async () => {
      delete process.env.JWT_SECRET;
      
      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Server configuration error',
        code: 'MISSING_JWT_SECRET'
      });
    });
  });

  describe('requireRole middleware', () => {
    beforeEach(() => {
      mockRequest.user = mockUser;
    });

    it('should allow access for user with correct role', async () => {
      const middleware = requireRole('operator');
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should deny access for user with incorrect role', async () => {
      const middleware = requireRole('admin');
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Insufficient privileges. Required role: admin',
        code: 'INSUFFICIENT_ROLE',
        required: 'admin',
        current: 'operator'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow access for user with multiple valid roles', async () => {
      const middleware = requireRole(['operator', 'supervisor']);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access for user without any valid roles', async () => {
      const middleware = requireRole(['admin', 'supervisor']);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Insufficient privileges. Required roles: admin, supervisor',
        code: 'INSUFFICIENT_ROLE',
        required: ['admin', 'supervisor'],
        current: 'operator'
      });
    });

    it('should handle case-insensitive role comparison', async () => {
      mockRequest.user = { ...mockUser, role: 'OPERATOR' };
      const middleware = requireRole('operator');
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle missing user in request', async () => {
      mockRequest.user = undefined;
      const middleware = requireRole('operator');
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Authentication required',
        code: 'UNAUTHENTICATED'
      });
    });

    it('should handle undefined role in user object', async () => {
      mockRequest.user = { ...mockUser, role: undefined };
      const middleware = requireRole('operator');
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'User role not defined',
        code: 'UNDEFINED_ROLE'
      });
    });
  });

  describe('requirePermission middleware', () => {
    beforeEach(() => {
      mockRequest.user = mockUser;
    });

    it('should allow access for user with required permission', async () => {
      const middleware = requirePermission('read:products');
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should deny access for user without required permission', async () => {
      const middleware = requirePermission('delete:products');
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Insufficient permissions. Required: delete:products',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: 'delete:products',
        current: mockUser.permissions
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow access for user with multiple required permissions', async () => {
      const middleware = requirePermission(['read:products', 'write:ucps']);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access if user missing any required permission', async () => {
      const middleware = requirePermission(['read:products', 'delete:products']);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Insufficient permissions. Required: read:products, delete:products',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: ['read:products', 'delete:products'],
        current: mockUser.permissions
      });
    });

    it('should handle wildcard permissions', async () => {
      const userWithWildcard = {
        ...mockUser,
        permissions: ['*', 'read:products']
      };
      mockRequest.user = userWithWildcard;
      
      const middleware = requirePermission('delete:anything');
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle resource-specific permissions', async () => {
      const userWithResourcePermissions = {
        ...mockUser,
        permissions: ['read:products:*', 'write:products:123']
      };
      mockRequest.user = userWithResourcePermissions;
      mockRequest.params = { id: '123' };
      
      const middleware = requirePermission('write:products:123');
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle missing permissions array', async () => {
      mockRequest.user = { ...mockUser, permissions: undefined };
      const middleware = requirePermission('read:products');
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'User permissions not defined',
        code: 'UNDEFINED_PERMISSIONS'
      });
    });

    it('should handle empty permissions array', async () => {
      mockRequest.user = { ...mockUser, permissions: [] };
      const middleware = requirePermission('read:products');
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Insufficient permissions. Required: read:products',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: 'read:products',
        current: []
      });
    });
  });

  describe('Combined middleware usage', () => {
    it('should work when chained with requireRole', async () => {
      mockRequest.user = {
        ...mockUser,
        role: 'admin',
        permissions: ['read:products', 'write:products', 'delete:products']
      };
      
      const roleMiddleware = requireRole('admin');
      const permissionMiddleware = requirePermission('delete:products');
      
      await roleMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      
      await permissionMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    it('should fail at first middleware if role check fails', async () => {
      mockRequest.user = {
        ...mockUser,
        role: 'operator',
        permissions: ['delete:products'] // Has permission but wrong role
      };
      
      const roleMiddleware = requireRole('admin');
      const permissionMiddleware = requirePermission('delete:products');
      
      await roleMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
      
      // Permission middleware should not be called
      vi.clearAllMocks();
      await permissionMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled(); // But would pass if called
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle JWT verification throwing unexpected errors', async () => {
      const unknownError = new Error('Unknown JWT error');
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw unknownError;
      });
      
      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Authentication error',
        code: 'AUTH_ERROR'
      });
    });

    it('should handle very long tokens', async () => {
      const longToken = 'a'.repeat(2000);
      mockRequest.headers = { authorization: `Bearer ${longToken}` };
      
      vi.mocked(jwt.verify).mockReturnValue(mockUser);
      
      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(jwt.verify).toHaveBeenCalledWith(longToken, expect.any(String));
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle malformed user objects from token', async () => {
      const malformedUser = { id: 'not-a-number', email: null };
      vi.mocked(jwt.verify).mockReturnValue(malformedUser);
      
      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Invalid user data in token',
        code: 'INVALID_USER_DATA'
      });
    });

    it('should handle concurrent authentication requests', async () => {
      vi.mocked(jwt.verify).mockReturnValue(mockUser);
      
      const requests = Array.from({ length: 10 }, () => {
        const req = createMockRequest({
          headers: { authorization: 'Bearer valid-token' }
        });
        const res = createMockResponse();
        const next = vi.fn();
        return { req, res, next };
      });
      
      await Promise.all(
        requests.map(({ req, res, next }) =>
          authMiddleware(req as Request, res as Response, next)
        )
      );
      
      requests.forEach(({ next }) => {
        expect(next).toHaveBeenCalled();
      });
    });

    it('should handle permission strings with special characters', async () => {
      const userWithSpecialPermissions = {
        ...mockUser,
        permissions: ['read:products/special-item', 'write:products@warehouse']
      };
      mockRequest.user = userWithSpecialPermissions;
      
      const middleware = requirePermission('read:products/special-item');
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Performance and security tests', () => {
    it('should complete authentication within reasonable time', async () => {
      vi.mocked(jwt.verify).mockReturnValue(mockUser);
      
      const start = performance.now();
      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(10); // Should complete within 10ms
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not leak sensitive information in error responses', async () => {
      const sensitiveError = new Error('Database password is wrong');
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw sensitiveError;
      });
      
      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.not.stringContaining('password'),
          code: expect.any(String)
        })
      );
    });

    it('should rate limit authentication attempts implicitly', async () => {
      // This would typically be handled by a separate rate limiting middleware
      // but we can test that auth middleware doesn't interfere
      
      const attempts = 100;
      vi.mocked(jwt.verify).mockReturnValue(mockUser);
      
      const promises = Array.from({ length: attempts }, () =>
        authMiddleware(mockRequest as Request, mockResponse as Response, mockNext)
      );
      
      await Promise.all(promises);
      
      expect(mockNext).toHaveBeenCalledTimes(attempts);
    });
  });
});