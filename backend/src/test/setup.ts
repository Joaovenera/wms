import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createMockDbQuery } from './utils/test-helpers';

// Global test setup for backend
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  
  // Mock console methods to reduce noise in tests
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.error = (...args: any[]) => {
    // Only show errors that aren't expected test errors
    if (
      typeof args[0] === 'string' &&
      !args[0].includes('Warning:') &&
      !args[0].includes('act(...)')
    ) {
      originalError.call(console, ...args);
    }
  };
  
  console.warn = (...args: any[]) => {
    // Only show warnings that aren't expected test warnings
    if (
      typeof args[0] === 'string' &&
      !args[0].includes('deprecated') &&
      !args[0].includes('Warning:')
    ) {
      originalWarn.call(console, ...args);
    }
  };
});

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  vi.resetAllMocks();
  
  // Mock timers for consistent testing
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));
});

afterEach(() => {
  // Restore real timers
  vi.useRealTimers();
  
  // Clear any remaining mocks
  vi.restoreAllMocks();
});

afterAll(() => {
  // Clean up any global changes
  delete process.env.JWT_SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.REDIS_URL;
});

// Global mock for database connections
vi.mock('../db', () => ({
  db: createMockDbQuery(),
}));

// Global mock for Redis
vi.mock('../config/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    flushall: vi.fn(),
    quit: vi.fn(),
  },
}));

// Global mock for logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Global mock for WebSocket
vi.mock('ws', () => ({
  default: {
    Server: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn(),
      clients: new Set(),
    })),
    OPEN: 1,
    CLOSED: 3,
  },
}));

// Performance monitoring for tests
const performanceMarks = new Map<string, number>();

global.performance = {
  ...global.performance,
  mark: (name: string) => {
    performanceMarks.set(name, Date.now());
  },
  measure: (name: string, startMark: string, endMark?: string) => {
    const start = performanceMarks.get(startMark) || 0;
    const end = endMark ? performanceMarks.get(endMark) || Date.now() : Date.now();
    return { duration: end - start, name, entryType: 'measure', startTime: start };
  },
  now: () => Date.now(),
};

// Global test utilities
declare global {
  namespace globalThis {
    var testConfig: {
      timeout: number;
      slowThreshold: number;
      enableCoverage: boolean;
    };
  }
}

globalThis.testConfig = {
  timeout: 10000, // 10 seconds default timeout
  slowThreshold: 100, // Tests slower than 100ms are considered slow
  enableCoverage: process.env.COVERAGE === 'true',
};