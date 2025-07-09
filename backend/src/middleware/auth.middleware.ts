import { Request, Response, NextFunction } from 'express';
import { User } from '../db/schema.js';
import { logWarn } from '../utils/logger';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: User;
}

// Authentication middleware
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || !req.user) {
    logWarn('Unauthorized access attempt', { 
      url: req.url, 
      method: req.method, 
      ip: req.ip 
    });
    return res.status(401).json({ message: 'Não autenticado' });
  }
  next();
};

// Role-based authorization middleware
export const requireRole = (allowedRoles: string | string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      logWarn('No user found in authenticated request', { 
        url: req.url, 
        method: req.method 
      });
      return res.status(401).json({ message: 'Usuário não encontrado' });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(user.role)) {
      logWarn('Insufficient permissions', { 
        url: req.url, 
        method: req.method, 
        userRole: user.role, 
        requiredRoles: roles,
        userId: user.id
      });
      return res.status(403).json({ 
        message: 'Acesso negado. Permissões insuficientes.' 
      });
    }

    next();
  };
};

// Admin only middleware
export const requireAdmin = requireRole('admin');

// Manager or Admin middleware
export const requireManagerOrAdmin = requireRole(['manager', 'admin']);

// User, Manager or Admin middleware (for most endpoints)
export const requireUser = requireRole(['user', 'manager', 'admin']);

// Optional authentication (for endpoints that work with or without auth)
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  // Just proceed, user might be null
  next();
};

// Check if user owns resource or has admin rights
export const requireOwnershipOrAdmin = (getUserId: (req: Request) => number) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    const resourceUserId = getUserId(req);
    
    if (user.role === 'admin' || user.id === resourceUserId) {
      return next();
    }
    
    logWarn('Ownership or admin access denied', { 
      url: req.url, 
      method: req.method, 
      userId: user.id,
      resourceUserId: resourceUserId
    });
    
    return res.status(403).json({ 
      message: 'Acesso negado. Você só pode acessar seus próprios recursos.' 
    });
  };
}; 