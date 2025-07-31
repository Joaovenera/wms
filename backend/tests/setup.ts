import { config } from 'dotenv';
import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { DatabaseTestHelper } from './helpers/database-test-helper';
import { RedisTestHelper } from './helpers/redis-test-helper';

// Load test environment variables
config({ path: '.env.test' });

// Global test helpers
let dbHelper: DatabaseTestHelper;
let redisHelper: RedisTestHelper;

// Global setup - runs once before all tests
beforeAll(async () => {
  console.log('🧪 Setting up test environment...');
  
  // Initialize database test helper
  dbHelper = new DatabaseTestHelper();
  await dbHelper.initialize();
  
  // Initialize Redis test helper
  redisHelper = new RedisTestHelper();
  await redisHelper.initialize();
  
  console.log('✅ Test environment ready');
}, 60000); // 60 second timeout for setup

// Global teardown - runs once after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');
  
  if (dbHelper) {
    await dbHelper.cleanup();
  }
  
  if (redisHelper) {
    await redisHelper.cleanup();
  }
  
  console.log('✅ Test environment cleaned up');
}, 30000);

// Before each test - runs before every test
beforeEach(async () => {
  // Clean up database state
  if (dbHelper) {
    await dbHelper.clearAllTables();
  }
  
  // Clear Redis cache
  if (redisHelper) {
    await redisHelper.flushAll();
  }
});

// After each test - runs after every test
afterEach(async () => {
  // Additional cleanup if needed
  jest.clearAllMocks();
});

// Make helpers available globally
declare global {
  var testHelpers: {
    db: DatabaseTestHelper;
    redis: RedisTestHelper;
  };
}

global.testHelpers = {
  get db() { return dbHelper; },
  get redis() { return redisHelper; }
};

// Configure test timeouts
jest.setTimeout(30000);

// Suppress console.log in tests unless explicitly needed
const originalConsole = console.log;
console.log = (...args: any[]) => {
  if (process.env.JEST_VERBOSE === 'true') {
    originalConsole(...args);
  }
};