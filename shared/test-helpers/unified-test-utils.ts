import { vi } from 'vitest'

/**
 * Unified Test Utilities for WMS Project
 * Shared utilities for both frontend and backend tests
 */

// Common mock factories
export const createMockRequest = (overrides: any = {}): any => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: undefined,
  session: {},
  ...overrides,
})

export const createMockResponse = (): any => {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  res.send = vi.fn().mockReturnValue(res)
  res.set = vi.fn().mockReturnValue(res)
  res.cookie = vi.fn().mockReturnValue(res)
  res.clearCookie = vi.fn().mockReturnValue(res)
  res.redirect = vi.fn().mockReturnValue(res)
  return res
}

export const createMockNext = (): any => vi.fn()

// Common test data generators
export const generateMockUser = (overrides: any = {}) => ({
  id: Math.floor(Math.random() * 1000),
  name: `Test User ${Math.random()}`,
  email: `test${Math.random()}@example.com`,
  role: 'operator',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
})

export const generateMockProduct = (overrides: any = {}) => ({
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
  category: 'electronics',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
})

export const generateMockPallet = (overrides: any = {}) => ({
  id: Math.floor(Math.random() * 1000),
  code: `PAL-${Math.random().toString(36).substring(7)}`,
  status: 'active',
  maxWeight: 1000,
  maxHeight: 200,
  dimensions: {
    width: 120,
    height: 100,
    depth: 80
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
})

// Database mock helpers
export const mockDbResponse = (data: any[]): any => ({
  rows: data,
  rowCount: data.length,
})

export const mockDbError = (message: string): Error => new Error(message)

// API test helpers
export const expectSuccessResponse = (response: any, expectedStatus: number = 200) => {
  expect(response.status).toBe(expectedStatus)
  expect(response.body).toBeDefined()
}

export const expectErrorResponse = (response: any, expectedStatus: number, message?: string) => {
  expect(response.status).toBe(expectedStatus)
  if (message) {
    expect(response.body.error || response.body.message).toContain(message)
  }
}

// React Query test helpers
export const createQueryClient = () => {
  const { QueryClient } = require('@tanstack/react-query')
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export const createTestQueryWrapper = (queryClient?: any) => {
  const { QueryClientProvider } = require('@tanstack/react-query')
  const client = queryClient || createQueryClient()
  
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client }, children)
  )
}

// Custom matchers for Vitest
export const customMatchers = {
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () => `Expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      }
    } else {
      return {
        message: () => `Expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      }
    }
  },
  
  toHaveValidSku(received: any) {
    const skuPattern = /^[A-Z0-9-]+$/
    const pass = typeof received === 'string' && skuPattern.test(received)
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid SKU`,
        pass: true,
      }
    } else {
      return {
        message: () => `Expected ${received} to be a valid SKU (alphanumeric with dashes)`,
        pass: false,
      }
    }
  },
  
  toHaveValidPalletCode(received: any) {
    const palletCodePattern = /^PAL-[A-Z0-9]+$/
    const pass = typeof received === 'string' && palletCodePattern.test(received)
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid pallet code`,
        pass: true,
      }
    } else {
      return {
        message: () => `Expected ${received} to be a valid pallet code (PAL-XXXXXX)`,
        pass: false,
      }
    }
  },
}

// Performance monitoring for tests
export const measureTestPerformance = () => {
  let startTime: number
  
  return {
    start: () => {
      startTime = performance.now()
    },
    end: (testName: string, warnThreshold: number = 5000) => {
      const duration = performance.now() - startTime
      if (duration > warnThreshold) {
        console.warn(`⚠️ Slow test detected: ${testName} took ${duration.toFixed(2)}ms`)
      }
      return duration
    }
  }
}

// Environment helpers
export const isRunningInCI = () => process.env.CI === 'true'
export const getTestEnvironment = () => process.env.NODE_ENV || 'test'

// Mock data cleanup utility
export const resetAllMocks = (...mockObjects: any[]) => {
  mockObjects.forEach(mockObj => {
    Object.values(mockObj).forEach((mock: any) => {
      if (vi.isMockFunction(mock)) {
        mock.mockReset()
      }
    })
  })
}

// Async test helpers
export const waitFor = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms))

export const waitForCondition = async (
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await waitFor(interval)
  }
  
  throw new Error(`Condition not met within ${timeout}ms`)
}