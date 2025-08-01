import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { intelligentCache } from '../infrastructure/cache/intelligent-cache.service';

/**
 * Comprehensive error handling system for packaging composition operations
 * Provides intelligent error recovery, detailed error reporting, and performance optimization
 */

export enum CompositionErrorCode {
  // Validation Errors (4000-4099)
  INVALID_PRODUCT_ID = 4001,
  INVALID_PALLET_ID = 4002,
  INVALID_PACKAGING_TYPE = 4003,
  INVALID_QUANTITY = 4004,
  INVALID_CONSTRAINTS = 4005,
  MISSING_REQUIRED_FIELD = 4006,
  DUPLICATE_PRODUCTS = 4007,
  INCOMPATIBLE_PRODUCTS = 4008,

  // Business Logic Errors (4100-4199)
  PRODUCT_NOT_FOUND = 4101,
  PALLET_NOT_FOUND = 4102,
  PALLET_UNAVAILABLE = 4103,
  INSUFFICIENT_PALLET_CAPACITY = 4104,
  WEIGHT_LIMIT_EXCEEDED = 4105,
  VOLUME_LIMIT_EXCEEDED = 4106,
  HEIGHT_LIMIT_EXCEEDED = 4107,
  STABILITY_CHECK_FAILED = 4108,
  INCOMPATIBLE_PACKAGING = 4109,

  // Composition Errors (4200-4299)
  COMPOSITION_NOT_FOUND = 4201,
  COMPOSITION_ALREADY_EXECUTED = 4202,
  COMPOSITION_NOT_APPROVED = 4203,
  COMPOSITION_EXPIRED = 4204,
  CALCULATION_FAILED = 4205,
  OPTIMIZATION_FAILED = 4206,
  LAYOUT_GENERATION_FAILED = 4207,

  // System Errors (5000-5099)
  DATABASE_CONNECTION_ERROR = 5001,
  CACHE_SERVICE_ERROR = 5002,
  EXTERNAL_API_ERROR = 5003,
  CALCULATION_TIMEOUT = 5004,
  MEMORY_LIMIT_EXCEEDED = 5005,
  SERVICE_UNAVAILABLE = 5006,

  // Performance Errors (5100-5199)
  REQUEST_TIMEOUT = 5101,
  RATE_LIMIT_EXCEEDED = 5102,
  CIRCUIT_BREAKER_OPEN = 5103,
  RESOURCE_EXHAUSTED = 5104,
}

export interface CompositionError {
  code: CompositionErrorCode;
  message: string;
  details?: any;
  timestamp: Date;
  requestId?: string;
  userId?: number;
  context?: any;
  suggestions?: string[];
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorRecoveryOptions {
  useCache?: boolean;
  fallbackAlgorithm?: boolean;
  simplifyRequest?: boolean;
  retryCount?: number;
  timeout?: number;
}

/**
 * Main error handler for composition operations
 */
export class CompositionErrorHandler {
  private static errorStats = new Map<CompositionErrorCode, number>();
  private static recoveryAttempts = new Map<string, number>();

  /**
   * Handle and process composition errors
   */
  static async handleError(
    error: any,
    req: Request,
    context?: any
  ): Promise<CompositionError> {
    const requestId = (req as any).performanceContext?.requestId || 'unknown';
    const userId = (req as any).user?.id;
    
    let compositionError: CompositionError;

    // Classify the error
    if (error instanceof z.ZodError) {
      compositionError = this.handleValidationError(error, requestId, userId);
    } else if (error.message?.includes('não encontrado')) {
      compositionError = this.handleNotFoundError(error, requestId, userId);
    } else if (error.message?.includes('limite')) {
      compositionError = this.handleLimitError(error, requestId, userId);
    } else if (error.name === 'TimeoutError') {
      compositionError = this.handleTimeoutError(error, requestId, userId);
    } else if (error.code?.startsWith('23')) { // PostgreSQL constraint violations
      compositionError = this.handleDatabaseError(error, requestId, userId);
    } else {
      compositionError = this.handleGenericError(error, requestId, userId, context);
    }

    // Record error statistics
    this.recordErrorStats(compositionError.code);

    // Attempt intelligent recovery if possible
    if (compositionError.retryable && context?.allowRecovery !== false) {
      const recoveryResult = await this.attemptRecovery(compositionError, req, context);
      if (recoveryResult) {
        compositionError.suggestions?.push('Error was automatically recovered');
      }
    }

    // Log error for monitoring
    await this.logError(compositionError, req);

    return compositionError;
  }

  /**
   * Handle validation errors from Zod
   */
  private static handleValidationError(
    zodError: z.ZodError,
    requestId: string,
    userId?: number
  ): CompositionError {
    const firstError = zodError.errors[0];
    let code = CompositionErrorCode.MISSING_REQUIRED_FIELD;
    let suggestions: string[] = [];

    // Classify validation error type
    if (firstError.path.includes('productId')) {
      code = CompositionErrorCode.INVALID_PRODUCT_ID;
      suggestions = ['Verify product ID exists in the system'];
    } else if (firstError.path.includes('palletId')) {
      code = CompositionErrorCode.INVALID_PALLET_ID;
      suggestions = ['Verify pallet ID exists and is available'];
    } else if (firstError.path.includes('quantity')) {
      code = CompositionErrorCode.INVALID_QUANTITY;
      suggestions = ['Quantity must be positive and reasonable'];
    } else if (firstError.path.includes('constraints')) {
      code = CompositionErrorCode.INVALID_CONSTRAINTS;
      suggestions = ['Check constraint values are within acceptable ranges'];
    }

    return {
      code,
      message: `Validation error: ${firstError.message}`,
      details: zodError.errors,
      timestamp: new Date(),
      requestId,
      userId,
      suggestions,
      retryable: false,
      severity: 'medium'
    };
  }

  /**
   * Handle not found errors
   */
  private static handleNotFoundError(
    error: Error,
    requestId: string,
    userId?: number
  ): CompositionError {
    let code = CompositionErrorCode.PRODUCT_NOT_FOUND;
    let suggestions: string[] = [];

    if (error.message.includes('Pallet')) {
      code = CompositionErrorCode.PALLET_NOT_FOUND;
      suggestions = ['Check if pallet ID is correct', 'Verify pallet is not archived'];
    } else if (error.message.includes('Composição')) {
      code = CompositionErrorCode.COMPOSITION_NOT_FOUND;
      suggestions = ['Verify composition ID', 'Check if composition was deleted'];
    } else {
      suggestions = ['Verify the resource ID', 'Check if resource was recently created'];
    }

    return {
      code,
      message: error.message,
      timestamp: new Date(),
      requestId,
      userId,
      suggestions,
      retryable: false,
      severity: 'medium'
    };
  }

  /**
   * Handle limit exceeded errors
   */
  private static handleLimitError(
    error: Error,
    requestId: string,
    userId?: number
  ): CompositionError {
    let code = CompositionErrorCode.WEIGHT_LIMIT_EXCEEDED;
    let suggestions: string[] = [];

    if (error.message.includes('peso')) {
      code = CompositionErrorCode.WEIGHT_LIMIT_EXCEEDED;
      suggestions = [
        'Use a larger pallet or split into multiple pallets',
        'Remove heavy items or reduce quantities',
        'Consider alternative packaging types'
      ];
    } else if (error.message.includes('volume')) {
      code = CompositionErrorCode.VOLUME_LIMIT_EXCEEDED;
      suggestions = [
        'Optimize product arrangement',
        'Use more compact packaging',
        'Split into multiple compositions'
      ];
    } else if (error.message.includes('altura')) {
      code = CompositionErrorCode.HEIGHT_LIMIT_EXCEEDED;
      suggestions = [
        'Reduce stacking height',
        'Use wider pallet arrangement',
        'Remove tall items from composition'
      ];
    }

    return {
      code,
      message: error.message,
      timestamp: new Date(),
      requestId,
      userId,
      suggestions,
      retryable: true,
      severity: 'high'
    };
  }

  /**
   * Handle timeout errors
   */
  private static handleTimeoutError(
    error: Error,
    requestId: string,
    userId?: number
  ): CompositionError {
    return {
      code: CompositionErrorCode.CALCULATION_TIMEOUT,
      message: 'Calculation timed out - request too complex',
      details: { timeout: error.message },
      timestamp: new Date(),
      requestId,
      userId,
      suggestions: [
        'Reduce number of products in composition',
        'Simplify constraints',
        'Try using standard algorithm instead of enhanced',
        'Split complex request into smaller parts'
      ],
      retryable: true,
      severity: 'high'
    };
  }

  /**
   * Handle database errors
   */
  private static handleDatabaseError(
    error: any,
    requestId: string,
    userId?: number
  ): CompositionError {
    let code = CompositionErrorCode.DATABASE_CONNECTION_ERROR;
    let suggestions: string[] = [];

    if (error.code === '23505') { // Unique violation
      code = CompositionErrorCode.DUPLICATE_PRODUCTS;
      suggestions = ['Remove duplicate products from request'];
    } else if (error.code === '23503') { // Foreign key violation
      code = CompositionErrorCode.PRODUCT_NOT_FOUND;
      suggestions = ['Verify all product and pallet IDs exist'];
    } else if (error.code === '23514') { // Check constraint violation
      code = CompositionErrorCode.INVALID_CONSTRAINTS;
      suggestions = ['Check all constraint values are valid'];
    }

    return {
      code,
      message: `Database error: ${error.message}`,
      details: { sqlCode: error.code, constraint: error.constraint },
      timestamp: new Date(),
      requestId,
      userId,
      suggestions,
      retryable: error.code !== '23505', // Don't retry unique violations
      severity: 'high'
    };
  }

  /**
   * Handle generic errors
   */
  private static handleGenericError(
    error: any,
    requestId: string,
    userId?: number,
    context?: any
  ): CompositionError {
    let code = CompositionErrorCode.SERVICE_UNAVAILABLE;
    let suggestions: string[] = ['Please try again later'];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    if (error.message?.includes('memory')) {
      code = CompositionErrorCode.MEMORY_LIMIT_EXCEEDED;
      suggestions = ['Reduce request complexity', 'Try again later'];
      severity = 'high';
    } else if (error.message?.includes('connection')) {
      code = CompositionErrorCode.DATABASE_CONNECTION_ERROR;
      suggestions = ['System is experiencing connectivity issues'];
      severity = 'critical';
    }

    return {
      code,
      message: error.message || 'An unexpected error occurred',
      details: { 
        stack: error.stack,
        context: context 
      },
      timestamp: new Date(),
      requestId,
      userId,
      suggestions,
      retryable: true,
      severity
    };
  }

  /**
   * Attempt intelligent error recovery
   */
  private static async attemptRecovery(
    error: CompositionError,
    req: Request,
    context?: any
  ): Promise<boolean> {
    const recoveryKey = `${error.requestId}-${error.code}`;
    const attemptCount = this.recoveryAttempts.get(recoveryKey) || 0;

    if (attemptCount >= 3) {
      return false; // Max retry attempts reached
    }

    this.recoveryAttempts.set(recoveryKey, attemptCount + 1);

    try {
      switch (error.code) {
        case CompositionErrorCode.CALCULATION_TIMEOUT:
          return await this.recoverFromTimeout(req, context);
        
        case CompositionErrorCode.CACHE_SERVICE_ERROR:
          return await this.recoverFromCacheError(req, context);
        
        case CompositionErrorCode.WEIGHT_LIMIT_EXCEEDED:
        case CompositionErrorCode.VOLUME_LIMIT_EXCEEDED:
          return await this.recoverFromLimitExceeded(req, context);
        
        default:
          return false;
      }
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError);
      return false;
    }
  }

  /**
   * Recover from timeout by simplifying request
   */
  private static async recoverFromTimeout(req: Request, context?: any): Promise<boolean> {
    if (req.body.useEnhancedAlgorithm !== false) {
      // Try with standard algorithm
      req.body.useEnhancedAlgorithm = false;
      return true;
    }

    // Simplify constraints
    if (req.body.constraints) {
      delete req.body.constraints;
      return true;
    }

    return false;
  }

  /**
   * Recover from cache errors by bypassing cache
   */
  private static async recoverFromCacheError(req: Request, context?: any): Promise<boolean> {
    try {
      // Clear problematic cache entries
      await intelligentCache.invalidateByDependency('composition');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Recover from limit exceeded by suggesting alternatives
   */
  private static async recoverFromLimitExceeded(req: Request, context?: any): Promise<boolean> {
    const { products } = req.body;
    
    if (products && products.length > 1) {
      // Try with fewer products
      req.body.products = products.slice(0, Math.ceil(products.length / 2));
      req.body._recoveryNote = 'Request simplified by reducing product count';
      return true;
    }

    return false;
  }

  /**
   * Record error statistics for monitoring
   */
  private static recordErrorStats(code: CompositionErrorCode): void {
    const current = this.errorStats.get(code) || 0;
    this.errorStats.set(code, current + 1);
  }

  /**
   * Log error for monitoring and alerting
   */
  private static async logError(error: CompositionError, req: Request): Promise<void> {
    const logData = {
      error_code: error.code,
      message: error.message,
      request_id: error.requestId,
      user_id: error.userId,
      endpoint: req.path,
      method: req.method,
      user_agent: req.get('User-Agent'),
      ip_address: req.ip,
      timestamp: error.timestamp,
      severity: error.severity,
      retryable: error.retryable,
      details: error.details
    };

    // Log to console (in production, send to logging service)
    if (error.severity === 'critical') {
      console.error('CRITICAL COMPOSITION ERROR:', logData);
    } else if (error.severity === 'high') {
      console.warn('HIGH PRIORITY COMPOSITION ERROR:', logData);
    } else {
      console.log('Composition error logged:', logData);
    }

    // Store in cache for error analytics
    try {
      const errorKey = `error_log:${error.timestamp.getTime()}`;
      await intelligentCache.set(errorKey, logData, { ttl: 86400 }); // 24 hours
    } catch (cacheError) {
      console.error('Failed to cache error log:', cacheError);
    }
  }

  /**
   * Get error statistics for monitoring dashboard
   */
  static getErrorStatistics(timeframe: string = '24h'): any {
    const stats = Array.from(this.errorStats.entries()).map(([code, count]) => ({
      code: CompositionErrorCode[code],
      count,
      percentage: (count / Array.from(this.errorStats.values()).reduce((a, b) => a + b, 0)) * 100
    }));

    return {
      totalErrors: Array.from(this.errorStats.values()).reduce((a, b) => a + b, 0),
      errorsByType: stats.sort((a, b) => b.count - a.count),
      activeRecoveryAttempts: this.recoveryAttempts.size,
      timeframe
    };
  }

  /**
   * Clear error statistics (for testing or scheduled cleanup)
   */
  static clearErrorStatistics(): void {
    this.errorStats.clear();
    this.recoveryAttempts.clear();
  }
}

/**
 * Express middleware for composition error handling
 */
export function compositionErrorMiddleware(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip if response already sent
  if (res.headersSent) {
    return next(error);
  }

  CompositionErrorHandler.handleError(error, req)
    .then(compositionError => {
      const statusCode = getHttpStatusCode(compositionError.code);
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: compositionError.code,
          message: compositionError.message,
          details: compositionError.details,
          suggestions: compositionError.suggestions,
          retryable: compositionError.retryable,
          timestamp: compositionError.timestamp
        },
        request_id: compositionError.requestId
      });
    })
    .catch(handlerError => {
      console.error('Error handler itself failed:', handlerError);
      res.status(500).json({
        success: false,
        error: {
          code: CompositionErrorCode.SERVICE_UNAVAILABLE,
          message: 'Internal error handling failed',
          retryable: true,
          timestamp: new Date()
        }
      });
    });
}

/**
 * Map error codes to HTTP status codes
 */
function getHttpStatusCode(errorCode: CompositionErrorCode): number {
  if (errorCode >= 4000 && errorCode < 4100) return 400; // Validation errors
  if (errorCode >= 4100 && errorCode < 4200) return 409; // Business logic errors
  if (errorCode >= 4200 && errorCode < 4300) return 404; // Not found errors
  if (errorCode >= 5000 && errorCode < 5100) return 500; // System errors
  if (errorCode >= 5100 && errorCode < 5200) return 503; // Performance errors
  
  return 500; // Default to internal server error
}

/**
 * Validation middleware with intelligent error handling
 */
export function validateCompositionRequest(schema: z.ZodType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      const compositionError = await CompositionErrorHandler.handleError(error, req);
      const statusCode = getHttpStatusCode(compositionError.code);
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: compositionError.code,
          message: compositionError.message,
          details: compositionError.details,
          suggestions: compositionError.suggestions
        }
      });
    }
  };
}