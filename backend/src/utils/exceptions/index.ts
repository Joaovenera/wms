// Custom exception classes

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly errors: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    errors: Array<{ field: string; message: string }> = [],
    code: string = 'VALIDATION_ERROR'
  ) {
    super(message, 400, true, code);
    this.errors = errors;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const message = id 
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    
    super(message, 404, true, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, true, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden access') {
    super(message, 403, true, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: string = 'CONFLICT') {
    super(message, 409, true, code);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code: string = 'BAD_REQUEST') {
    super(message, 400, true, code);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', code: string = 'INTERNAL_ERROR') {
    super(message, 500, false, code);
  }
}

// Business logic specific errors
export class PalletNotAvailableError extends ConflictError {
  constructor(palletCode: string) {
    super(`Pallet ${palletCode} is not available for use`, 'PALLET_NOT_AVAILABLE');
  }
}

export class PositionOccupiedError extends ConflictError {
  constructor(positionCode: string) {
    super(`Position ${positionCode} is already occupied`, 'POSITION_OCCUPIED');
  }
}

export class InsufficientStockError extends BadRequestError {
  constructor(productSku: string, requested: number, available: number) {
    super(
      `Insufficient stock for product ${productSku}. Requested: ${requested}, Available: ${available}`,
      'INSUFFICIENT_STOCK'
    );
  }
}

export class UcpNotActiveError extends BadRequestError {
  constructor(ucpCode: string) {
    super(`UCP ${ucpCode} is not active`, 'UCP_NOT_ACTIVE');
  }
}

export class TransferNotAllowedError extends BadRequestError {
  constructor(reason: string) {
    super(`Transfer not allowed: ${reason}`, 'TRANSFER_NOT_ALLOWED');
  }
}

export class DatabaseConnectionError extends InternalServerError {
  constructor(message: string = 'Database connection failed') {
    super(message, 'DATABASE_CONNECTION_ERROR');
  }
}

export class CacheConnectionError extends InternalServerError {
  constructor(message: string = 'Cache connection failed') {
    super(message, 'CACHE_CONNECTION_ERROR');
  }
}

export class FileUploadError extends BadRequestError {
  constructor(message: string, code: string = 'FILE_UPLOAD_ERROR') {
    super(message, code);
  }
}

export class FileSizeExceededError extends FileUploadError {
  constructor(maxSize: number) {
    super(`File size exceeds maximum allowed size of ${maxSize} bytes`, 'FILE_SIZE_EXCEEDED');
  }
}

export class InvalidFileTypeError extends FileUploadError {
  constructor(allowedTypes: string[]) {
    super(
      `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
      'INVALID_FILE_TYPE'
    );
  }
}

// Error handler utility
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

// HTTP status code mapper
export function getHttpStatusFromError(error: Error): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  return 500;
}

// Error response formatter
export function formatErrorResponse(error: Error) {
  if (error instanceof ValidationError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      errors: error.errors,
    };
  }

  if (error instanceof AppError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    success: false,
    error: isDevelopment ? error.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isDevelopment && { stack: error.stack }),
  };
}