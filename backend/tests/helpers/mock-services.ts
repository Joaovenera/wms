import { vi } from 'vitest';

// Mock Redis client
export const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  keys: vi.fn(),
  flushdb: vi.fn(),
  ping: vi.fn(),
  disconnect: vi.fn(),
};

// Mock database client
export const mockDbClient = {
  query: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  end: vi.fn(),
  unsafe: vi.fn(),
};

// Mock file upload service
export const mockFileUploadService = {
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
  generateThumbnail: vi.fn(),
  validateFile: vi.fn(),
};

// Mock authentication service
export const mockAuthService = {
  login: vi.fn(),
  logout: vi.fn(),
  validateToken: vi.fn(),
  hashPassword: vi.fn(),
  comparePassword: vi.fn(),
  generateToken: vi.fn(),
};

// Mock cache service  
export const mockCacheService = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  exists: vi.fn(),
  keys: vi.fn(),
};

// Mock logger service
export const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

// Mock email service
export const mockEmailService = {
  sendEmail: vi.fn(),
  sendNotification: vi.fn(),
  validateEmailAddress: vi.fn(),
};

// Mock metrics service
export const mockMetricsService = {
  increment: vi.fn(),
  decrement: vi.fn(),
  histogram: vi.fn(),
  gauge: vi.fn(),
  timing: vi.fn(),
};

// Mock websocket service
export const mockWebSocketService = {
  broadcast: vi.fn(),
  sendToUser: vi.fn(),
  sendToRoom: vi.fn(),
  addToRoom: vi.fn(),
  removeFromRoom: vi.fn(),
};

// Helper function to reset all mocks
export const resetAllMocks = (): void => {
  Object.values(mockRedisClient).forEach(mock => {
    if (vi.isMockFunction(mock)) {
      mock.mockReset();
    }
  });

  Object.values(mockDbClient).forEach(mock => {
    if (vi.isMockFunction(mock)) {
      mock.mockReset();
    }
  });

  Object.values(mockFileUploadService).forEach(mock => {
    if (vi.isMockFunction(mock)) {
      mock.mockReset();
    }
  });

  Object.values(mockAuthService).forEach(mock => {
    if (vi.isMockFunction(mock)) {
      mock.mockReset();
    }
  });

  Object.values(mockCacheService).forEach(mock => {
    if (vi.isMockFunction(mock)) {
      mock.mockReset();
    }
  });

  Object.values(mockEmailService).forEach(mock => {
    if (vi.isMockFunction(mock)) {
      mock.mockReset();
    }
  });

  Object.values(mockMetricsService).forEach(mock => {
    if (vi.isMockFunction(mock)) {
      mock.mockReset();
    }
  });

  Object.values(mockWebSocketService).forEach(mock => {
    if (vi.isMockFunction(mock)) {
      mock.mockReset();
    }
  });
};

// Mock factory functions
export const createMockRequest = (overrides: any = {}): any => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: undefined,
  session: {},
  ...overrides,
});

export const createMockResponse = (): any => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  res.redirect = vi.fn().mockReturnValue(res);
  return res;
};

export const createMockNext = (): any => vi.fn();

// Database mock helpers
export const mockDbResponse = (data: any[]): any => ({
  rows: data,
  rowCount: data.length,
});

export const mockDbError = (message: string): Error => new Error(message);

// Redis mock helpers
export const mockRedisSuccess = (value: any = 'OK'): Promise<any> => Promise.resolve(value);
export const mockRedisError = (message: string): Promise<never> => Promise.reject(new Error(message));

// Authentication mock helpers
export const mockValidUser = {
  id: 'test-user-1',
  username: 'testuser',
  email: 'test@example.com',
  role: 'operator',
  isActive: true,
};

export const mockAdminUser = {
  id: 'test-admin-1',
  username: 'testadmin',
  email: 'admin@example.com',
  role: 'admin',
  isActive: true,
};

export const mockInvalidUser = null;

// File upload mock helpers
export const mockUploadedFile = {
  fieldname: 'image',
  originalname: 'test-image.jpg',
  encoding: '7bit',
  mimetype: 'image/jpeg',
  size: 12345,
  destination: '/tmp/uploads',
  filename: 'test-image-123.jpg',
  path: '/tmp/uploads/test-image-123.jpg',
  buffer: Buffer.from('fake image data'),
};

// WebSocket mock helpers
export const mockWebSocketClient = {
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1, // OPEN
  on: vi.fn(),
  emit: vi.fn(),
};

// Error mock helpers
export const mockValidationError = (field: string, message: string): any => ({
  name: 'ValidationError',
  field,
  message,
  status: 400,
});

export const mockNotFoundError = (resource: string): any => ({
  name: 'NotFoundError',
  message: `${resource} not found`,
  status: 404,
});

export const mockUnauthorizedError = (message: string = 'Unauthorized'): any => ({
  name: 'UnauthorizedError',
  message,
  status: 401,
});

export const mockForbiddenError = (message: string = 'Forbidden'): any => ({
  name: 'ForbiddenError',
  message,
  status: 403,
});

export const mockServerError = (message: string = 'Internal Server Error'): any => ({
  name: 'InternalServerError',
  message,
  status: 500,
});