import { Request, Response } from 'express';
import { vi } from 'vitest';

// Type definitions for our domain models
interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  category?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
}

interface PackagingType {
  id: number;
  productId: number;
  name: string;
  level: number;
  baseUnitQuantity: number;
  isBaseUnit: boolean;
  isActive: boolean;
  barcode?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: number;
}

interface Pallet {
  id: number;
  code: string;
  type: string;
  material: string;
  width: number;
  length: number;
  height: number;
  maxWeight: string;
  status: string;
  location?: string | null;
  observations?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

interface UCP {
  id: number;
  code: string;
  palletId: number;
  status: string;
  currentPositionId?: number | null;
  totalItems: number;
  totalWeight: string;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
}

// Mock factory for Request objects
export const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  params: {},
  query: {},
  body: {},
  headers: {},
  user: { id: 1, name: 'Test User', email: 'test@example.com' },
  ...overrides,
});

// Mock factory for Response objects
export const createMockResponse = (): Partial<Response> => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ 
    json, 
    send: vi.fn(),
    end: vi.fn() 
  });
  const send = vi.fn();
  const end = vi.fn();

  return {
    json,
    status,
    send,
    end,
    setHeader: vi.fn(),
    getHeader: vi.fn(),
    removeHeader: vi.fn(),
  };
};

// Mock data generators
export const generateMockProduct = (overrides: Partial<Product> = {}): Product => ({
  id: Math.floor(Math.random() * 1000) + 1,
  sku: `SKU-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
  name: `Test Product ${Math.floor(Math.random() * 100)}`,
  description: 'Test product description',
  weight: Number((Math.random() * 10).toFixed(2)),
  dimensions: {
    length: Number((Math.random() * 100).toFixed(2)),
    width: Number((Math.random() * 100).toFixed(2)),
    height: Number((Math.random() * 100).toFixed(2)),
  },
  category: 'Test Category',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 1,
  ...overrides,
});

export const generateMockPackaging = (overrides: Partial<PackagingType> = {}): PackagingType => ({
  id: Math.floor(Math.random() * 1000) + 1,
  productId: 1,
  name: `Packaging ${Math.floor(Math.random() * 100)}`,
  level: Math.floor(Math.random() * 5),
  baseUnitQuantity: Math.floor(Math.random() * 100) + 1,
  isBaseUnit: false,
  isActive: true,
  barcode: `BAR${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
  weight: Number((Math.random() * 5).toFixed(2)),
  dimensions: {
    length: Number((Math.random() * 50).toFixed(2)),
    width: Number((Math.random() * 50).toFixed(2)),
    height: Number((Math.random() * 50).toFixed(2)),
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 1,
  ...overrides,
});

export const generateMockPallet = (overrides: Partial<Pallet> = {}): Pallet => ({
  id: Math.floor(Math.random() * 1000) + 1,
  code: `PLT${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
  type: 'PBR',
  material: 'Madeira',
  width: 100,
  length: 120,
  height: 14,
  maxWeight: '1500.00',
  status: 'disponivel',
  location: null,
  observations: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 1,
  ...overrides,
});

export const generateMockUser = (overrides: Partial<User> = {}): User => ({
  id: Math.floor(Math.random() * 1000) + 1,
  name: `Test User ${Math.floor(Math.random() * 100)}`,
  email: `test${Math.floor(Math.random() * 1000)}@example.com`,
  role: 'operator',
  department: 'warehouse',
  isActive: true,
  lastLogin: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const generateMockUCP = (overrides: Partial<UCP> = {}): UCP => ({
  id: Math.floor(Math.random() * 1000) + 1,
  code: `UCP${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
  palletId: 1,
  status: 'ativo',
  currentPositionId: null,
  totalItems: 0,
  totalWeight: '0.00',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 1,
  ...overrides,
});

// Database mock helpers
export const createMockDbQuery = () => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  rightJoin: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  having: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  returning: vi.fn(),
  execute: vi.fn(),
});

// Service mock helpers
export const createMockStorageService = () => ({
  getProducts: vi.fn(),
  getProduct: vi.fn(),
  getProductsWithStock: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  getProductPhotos: vi.fn(),
  addProductPhoto: vi.fn(),
  updateProductPhoto: vi.fn(),
  deleteProductPhoto: vi.fn(),
});

export const createMockPackagingService = () => ({
  getPackagingsByProduct: vi.fn(),
  getPackagingByBarcode: vi.fn(),
  getBasePackaging: vi.fn(),
  convertToBaseUnits: vi.fn(),
  convertFromBaseUnits: vi.fn(),
  createPackaging: vi.fn(),
  updatePackaging: vi.fn(),
  deletePackaging: vi.fn(),
  optimizePickingByPackaging: vi.fn(),
  calculateConversionFactor: vi.fn(),
  getPackagingHierarchy: vi.fn(),
});

export const createMockImageService = () => ({
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
  resizeImage: vi.fn(),
  generateThumbnail: vi.fn(),
  validateImageFormat: vi.fn(),
  optimizeImage: vi.fn(),
});

export const createMockWebSocketService = () => ({
  broadcast: vi.fn(),
  broadcastToRoom: vi.fn(),
  sendToUser: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  getConnectedUsers: vi.fn(),
});

// Validation helpers
export const createValidationError = (field: string, message: string) => ({
  field,
  message,
  value: null,
});

// Async helper for testing promises
export const waitFor = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// Test data cleanup
export const cleanupTestData = async () => {
  // Clean up test database records, files, etc.
  // Implementation depends on your cleanup strategy
};

// Error testing helpers
export const createDatabaseError = (message: string = 'Database connection failed') => {
  const error = new Error(message);
  error.name = 'DatabaseError';
  return error;
};

export const createNotFoundError = (resource: string = 'Resource') => {
  const error = new Error(`${resource} not found`);
  error.name = 'NotFoundError';
  return error;
};

// Performance testing helpers
export const measureExecutionTime = async (fn: () => Promise<any>): Promise<number> => {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
};

// Global test utilities (available in all test files)
declare global {
  namespace globalThis {
    var testUtils: {
      generateMockProduct: typeof generateMockProduct;
      generateMockPackaging: typeof generateMockPackaging;
      generateMockPallet: typeof generateMockPallet;
      generateMockUser: typeof generateMockUser;
      generateMockUCP: typeof generateMockUCP;
      createMockRequest: typeof createMockRequest;
      createMockResponse: typeof createMockResponse;
      createMockDbQuery: typeof createMockDbQuery;
      createValidationError: typeof createValidationError;
      waitFor: typeof waitFor;
      measureExecutionTime: typeof measureExecutionTime;
    };
  }
}

// Export utilities for global access
globalThis.testUtils = {
  generateMockProduct,
  generateMockPackaging,
  generateMockPallet,
  generateMockUser,
  generateMockUCP,
  createMockRequest,
  createMockResponse,
  createMockDbQuery,
  createValidationError,
  waitFor,
  measureExecutionTime,
};