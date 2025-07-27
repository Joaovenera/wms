// Common types used across the application

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    redis: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
  };
}

// Logger metadata
export interface LogMetadata {
  correlationId?: string;
  userId?: number | string;
  userAgent?: string;
  ip?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: any;
}

// File upload info
export interface FileUploadInfo {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  path: string;
  url: string;
}

// Coordinates for warehouse positions
export interface Coordinates {
  x: number;
  y: number;
  z?: number;
}

// Dimensions
export interface Dimensions {
  width: number;
  length: number;
  height: number;
}

// Stock information
export interface StockInfo {
  quantity: number;
  unit: string;
  lot?: string;
  expiryDate?: Date;
  location?: {
    ucpCode: string;
    positionCode: string;
  };
}

// Transfer operation result
export interface TransferResult {
  success: boolean;
  transferId?: number;
  sourceUpdated: boolean;
  targetCreated: boolean;
  sourceUcpId: number;
  targetUcpId: number;
  timestamp: Date;
  error?: string;
}

// Cache operation result
export interface CacheResult<T = any> {
  success: boolean;
  data?: T;
  cached: boolean;
  ttl?: number;
  error?: string;
}

// Database query filters
export interface QueryFilters {
  search?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  createdBy?: number;
  [key: string]: any;
}

// Audit trail entry
export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string | number;
  action: string;
  oldValue?: any;
  newValue?: any;
  performedBy: number;
  performedAt: Date;
  metadata?: any;
}

// Error details
export interface ErrorDetails {
  code: string;
  message: string;
  details?: any;
  stack?: string;
  timestamp: Date;
  path?: string;
  method?: string;
  userId?: number;
}

// Configuration validation result
export interface ConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Generic entity with common fields
export interface BaseEntity {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: number;
}

// Generic insert type (excludes generated fields)
export type InsertEntity<T extends BaseEntity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

// Generic update type (all fields optional except id)
export type UpdateEntity<T extends BaseEntity> = Partial<Omit<T, 'id' | 'createdAt'>> & { id: number };

// Generic repository interface
export interface Repository<T extends BaseEntity> {
  findById(id: number): Promise<T | null>;
  findAll(filters?: QueryFilters): Promise<T[]>;
  create(data: InsertEntity<T>): Promise<T>;
  update(id: number, data: Partial<T>): Promise<T | null>;
  delete(id: number): Promise<boolean>;
}

// Generic service interface
export interface Service<T extends BaseEntity> {
  findById(id: number): Promise<T | null>;
  findAll(filters?: QueryFilters): Promise<PaginatedResponse<T>>;
  create(data: InsertEntity<T>): Promise<T>;
  update(id: number, data: Partial<T>): Promise<T>;
  delete(id: number): Promise<void>;
}