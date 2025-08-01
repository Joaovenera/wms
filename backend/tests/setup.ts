import './helpers/mock-setup';
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { testEnvironment } from './test-environment';

// Global setup - runs once before all tests
beforeAll(async () => {
  await testEnvironment.initialize();
}, 60000); // 60 second timeout for setup

// Global teardown - runs once after all tests
afterAll(async () => {
  await testEnvironment.cleanup();
}, 30000);

// Before each test - runs before every test
beforeEach(async () => {
  await testEnvironment.clearState();
});

// After each test - runs after every test
afterEach(async () => {
  // Additional cleanup if needed
  vi.clearAllMocks();
});

// Test timeout is configured in vitest.config.ts

// Suppress console.log in tests unless explicitly needed
const originalConsole = console.log;
console.log = (...args: any[]) => {
  if (process.env.VITEST_VERBOSE === 'true') {
    originalConsole(...args);
  }
};