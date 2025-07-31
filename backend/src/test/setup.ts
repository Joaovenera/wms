import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { config } from 'dotenv'

// Load test environment variables
config({ path: '.env.test' })

// Global test configuration
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test'
  process.env.LOG_LEVEL = 'silent'
  
  console.log('🧪 Test environment initialized')
})

afterAll(async () => {
  console.log('🧪 Test environment cleanup completed')
})

beforeEach(() => {
  // Clear any module cache if needed
  vi.clearAllMocks()
})

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks()
})

// Global test utilities
declare global {
  var testUtils: {
    generateMockUser: () => any
    generateMockProduct: () => any
    generateMockPallet: () => any
    createTestDatabase: () => Promise<any>
    cleanupTestDatabase: () => Promise<void>
  }
}

globalThis.testUtils = {
  generateMockUser: () => ({
    id: Math.floor(Math.random() * 1000),
    name: `Test User ${Math.random()}`,
    email: `test${Math.random()}@example.com`,
    createdAt: new Date(),
    updatedAt: new Date()
  }),

  generateMockProduct: () => ({
    id: Math.floor(Math.random() * 1000),
    sku: `SKU-${Math.random().toString(36).substring(7)}`,
    name: `Test Product ${Math.random()}`,
    description: 'Test product description',
    weight: Math.random() * 10,
    dimensions: {
      length: Math.random() * 100,
      width: Math.random() * 100,
      height: Math.random() * 100
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }),

  generateMockPallet: () => ({
    id: Math.floor(Math.random() * 1000),
    code: `PAL-${Math.random().toString(36).substring(7)}`,
    status: 'active',
    maxWeight: 1000,
    maxHeight: 200,
    createdAt: new Date(),
    updatedAt: new Date()
  }),

  createTestDatabase: async () => {
    // Mock database creation for tests
    return {
      query: vi.fn(),
      close: vi.fn()
    }
  },

  cleanupTestDatabase: async () => {
    // Mock database cleanup
    console.log('🧹 Test database cleaned up')
  }
}