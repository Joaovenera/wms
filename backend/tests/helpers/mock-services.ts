import { jest } from '@jest/globals';

// Mock Redis client
export const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  keys: jest.fn(),
  flushdb: jest.fn(),
  ping: jest.fn(),
  disconnect: jest.fn(),
};

// Mock database client
export const mockDbClient = {
  query: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  end: jest.fn(),
  unsafe: jest.fn(),
};

// Mock file upload service
export const mockFileUploadService = {
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
  generateThumbnail: jest.fn(),
  validateFile: jest.fn(),
};

// Mock authentication service
export const mockAuthService = {
  login: jest.fn(),
  logout: jest.fn(),
  validateToken: jest.fn(),
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
  generateToken: jest.fn(),
};

// Mock cache service  
export const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  exists: jest.fn(),
  keys: jest.fn(),
};

// Mock logger service
export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Mock email service
export const mockEmailService = {
  sendEmail: jest.fn(),
  sendNotification: jest.fn(),
  validateEmailAddress: jest.fn(),
};

// Mock metrics service
export const mockMetricsService = {
  increment: jest.fn(),
  decrement: jest.fn(),
  histogram: jest.fn(),
  gauge: jest.fn(),
  timing: jest.fn(),
};

// Mock websocket service
export const mockWebSocketService = {
  broadcast: jest.fn(),
  sendToUser: jest.fn(),
  sendToRoom: jest.fn(),
  addToRoom: jest.fn(),
  removeFromRoom: jest.fn(),
};

// Helper function to reset all mocks
export const resetAllMocks = (): void => {
  Object.values(mockRedisClient).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });

  Object.values(mockDbClient).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });

  Object.values(mockFileUploadService).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });

  Object.values(mockAuthService).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });

  Object.values(mockCacheService).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });

  Object.values(mockEmailService).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });

  Object.values(mockMetricsService).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockReset();
    }
  });

  Object.values(mockWebSocketService).forEach(mock => {
    if (jest.isMockFunction(mock)) {
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
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
};

export const createMockNext = (): any => jest.fn();

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
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
  on: jest.fn(),
  emit: jest.fn(),
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