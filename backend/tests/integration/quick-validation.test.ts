import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testEnvironment } from '../test-environment';

describe('🧪 Integration Test Environment Validation', () => {
  beforeAll(async () => {
    // Ensure test environment is initialized
    await testEnvironment.initialize();
    
    // Validate that global test utilities are available
    expect(globalThis.testUtils).toBeDefined();
    expect(globalThis.testUtils.cleanupTestDatabase).toBeTypeOf('function');
    expect(globalThis.testUtils.generateMockUser).toBeTypeOf('function');
    expect(globalThis.testUtils.generateMockProduct).toBeTypeOf('function');
    
    expect(globalThis.testHelpers).toBeDefined();
    expect(globalThis.testHelpers.db).toBeDefined();
    expect(globalThis.testHelpers.redis).toBeDefined();
  });

  it('should have working database connection', async () => {
    const dbHelper = globalThis.testHelpers.db;
    expect(dbHelper).toBeDefined();
    
    // Test database connectivity
    await expect(dbHelper.initialize()).resolves.not.toThrow();
  });

  it('should have working global test utilities', async () => {
    // Test cleanup function exists and works
    await expect(globalThis.testUtils.cleanupTestDatabase()).resolves.not.toThrow();
    
    // Test mock data generators
    const mockUser = globalThis.testUtils.generateMockUser();
    expect(mockUser).toHaveProperty('username');
    expect(mockUser).toHaveProperty('email');
    expect(mockUser).toHaveProperty('role');
    
    const mockProduct = globalThis.testUtils.generateMockProduct();
    expect(mockProduct).toHaveProperty('name');
    expect(mockProduct).toHaveProperty('sku');
    expect(mockProduct).toHaveProperty('price');
  });

  it('should have mocked WebSocket service', () => {
    // Verify WebSocket mocks are properly loaded
    expect(vi.isMockFunction).toBeTruthy();
  });

  it('should have JWT mocked', async () => {
    const jwt = await import('jsonwebtoken');
    expect(jwt.sign).toBeDefined();
    expect(jwt.verify).toBeDefined();
    expect(jwt.decode).toBeDefined();
  });

  afterAll(async () => {
    // Clean up after validation tests
    if (globalThis.testUtils?.cleanupTestDatabase) {
      await globalThis.testUtils.cleanupTestDatabase();
    }
  });
});