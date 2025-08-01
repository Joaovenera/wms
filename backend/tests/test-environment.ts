import { config } from 'dotenv';
import { DatabaseTestHelper } from './helpers/database-test-helper';
import { RedisTestHelper } from './helpers/redis-test-helper';

// Load test environment variables
config({ path: '.env.test' });

// Global test environment
class TestEnvironment {
  private static instance: TestEnvironment;
  private dbHelper?: DatabaseTestHelper;
  private redisHelper?: RedisTestHelper;
  private initialized = false;

  static getInstance(): TestEnvironment {
    if (!TestEnvironment.instance) {
      TestEnvironment.instance = new TestEnvironment();
    }
    return TestEnvironment.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🧪 Initializing test environment...');
    
    // Initialize database test helper
    this.dbHelper = new DatabaseTestHelper();
    await this.dbHelper.initialize();
    
    // Initialize Redis test helper  
    this.redisHelper = new RedisTestHelper();
    await this.redisHelper.initialize();

    // Setup global utilities
    this.setupGlobalUtils();
    
    this.initialized = true;
    console.log('✅ Test environment initialized');
  }

  private setupGlobalUtils(): void {
    // Make helpers available globally
    (globalThis as any).testHelpers = {
      db: this.dbHelper,
      redis: this.redisHelper
    };

    // Global test utilities
    (globalThis as any).testUtils = {
      cleanupTestDatabase: async () => {
        if (this.dbHelper) {
          await this.dbHelper.clearAllTables();
        }
      },
      generateMockUser: () => ({
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        role: 'user',
        password: 'test123456'
      }),
      generateMockProduct: () => ({
        name: `Test Product ${Date.now()}`,
        sku: `TEST-${Date.now()}`,
        price: 99.99,
        description: 'Test product description'
      })
    };
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test environment...');
    
    if (this.dbHelper) {
      await this.dbHelper.cleanup();
    }
    
    if (this.redisHelper) {
      await this.redisHelper.cleanup();
    }
    
    this.initialized = false;
    console.log('✅ Test environment cleaned up');
  }

  async clearState(): Promise<void> {
    if (this.dbHelper) {
      await this.dbHelper.clearAllTables();
    }
    
    if (this.redisHelper) {
      await this.redisHelper.flushAll();
    }
  }

  get db(): DatabaseTestHelper | undefined {
    return this.dbHelper;
  }

  get redis(): RedisTestHelper | undefined {
    return this.redisHelper;
  }
}

// Export singleton instance
export const testEnvironment = TestEnvironment.getInstance();

// Global type declarations
declare global {
  var testHelpers: {
    db: DatabaseTestHelper;
    redis: RedisTestHelper;
  };
  var testUtils: {
    cleanupTestDatabase: () => Promise<void>;
    generateMockUser: () => any;
    generateMockProduct: () => any;
  };
}