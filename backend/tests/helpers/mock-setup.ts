import { vi } from 'vitest';

// Mock WebSocket server setup
export class MockWebSocketServer {
  constructor(public options: any) {}
  
  on(event: string, handler: Function) {
    return this;
  }
  
  emit(event: string, ...args: any[]) {
    return true;
  }
  
  close() {
    return Promise.resolve();
  }
}

// WebSocket service mock
export const mockWebSocketService = {
  initWebSocket: vi.fn().mockReturnValue(new MockWebSocketServer({})),
  broadcast: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined)
};

// Setup global mocks
vi.mock('../src/services/websocket.service', () => mockWebSocketService);

// JWT mock
vi.mock('jsonwebtoken', () => ({
  sign: vi.fn(() => 'mock-jwt-token'),
  verify: vi.fn(() => ({ userId: 1, role: 'user' })),
  decode: vi.fn(() => ({ userId: 1, role: 'user' }))
}));

// Storage mock
export const mockStorage = {
  getUserById: vi.fn(),
  getDashboardStats: vi.fn(),
  getProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  // Add more methods as needed
};

// All exports are already defined above