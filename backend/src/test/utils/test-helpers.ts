import { vi } from 'vitest'

/**
 * Test helper utilities for WMS testing
 */

export const createMockRequest = (overrides: any = {}) => ({
  params: {},
  query: {},
  body: {},
  headers: {},
  user: { id: 1, name: 'Test User' },
  ...overrides
})

export const createMockResponse = () => {
  const mockJson = vi.fn()
  const mockStatus = vi.fn().mockReturnValue({ json: mockJson, send: vi.fn() })
  const mockSend = vi.fn()

  return {
    json: mockJson,
    status: mockStatus,
    send: mockSend,
    mockJson,
    mockStatus,
    mockSend
  }
}

export const createMockDatabase = () => ({
  query: vi.fn(),
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockResolvedValue([])
      })
    })
  }),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([])
    })
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([])
      })
    })
  }),
  delete: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue({ changes: 1 })
  })
})

export const createMockCache = () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  clear: vi.fn()
})

export const waitFor = async (condition: () => boolean, timeout = 5000) => {
  const start = Date.now()
  while (!condition() && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  if (!condition()) {
    throw new Error(`Condition not met within ${timeout}ms`)
  }
}

export const generateTestData = {
  product: (overrides: any = {}) => ({
    id: Math.floor(Math.random() * 1000) + 1,
    sku: `TEST-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    name: `Test Product ${Math.random().toString(36).substring(7)}`,
    description: 'Generated test product',
    weight: Math.random() * 10,
    dimensions: {
      length: Math.random() * 100,
      width: Math.random() * 100,
      height: Math.random() * 100
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  packaging: (overrides: any = {}) => ({
    id: Math.floor(Math.random() * 1000) + 1,
    productId: Math.floor(Math.random() * 100) + 1,
    name: `Package ${Math.random().toString(36).substring(7)}`,
    level: Math.floor(Math.random() * 5),
    baseUnitQuantity: Math.pow(2, Math.floor(Math.random() * 4)),
    barcode: `BC-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    isBaseUnit: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  pallet: (overrides: any = {}) => ({
    id: Math.floor(Math.random() * 1000) + 1,
    code: `PAL-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    maxWeight: 1000 + Math.random() * 1000,
    maxHeight: 200 + Math.random() * 100,
    currentWeight: Math.random() * 500,
    currentHeight: Math.random() * 100,
    status: 'active',
    location: `${String.fromCharCode(65 + Math.floor(Math.random() * 3))}-${String(Math.floor(Math.random() * 10) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 10) + 1).padStart(2, '0')}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  transfer: (overrides: any = {}) => ({
    id: Math.floor(Math.random() * 1000) + 1,
    transferId: `TR-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    fromLocation: 'A-01-01',
    toLocation: 'B-02-03',
    status: 'pending',
    priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
    requestedBy: Math.floor(Math.random() * 10) + 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  user: (overrides: any = {}) => ({
    id: Math.floor(Math.random() * 1000) + 1,
    name: `Test User ${Math.random().toString(36).substring(7)}`,
    email: `test-${Math.random().toString(36).substring(7)}@example.com`,
    role: 'operator',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  })
}

export const assertPerformance = (operation: () => Promise<any>, maxTime: number) => async () => {
  const start = performance.now()
  await operation()
  const duration = performance.now() - start
  expect(duration).toBeLessThan(maxTime)
  return duration
}

export const createPerformanceMonitor = () => {
  const metrics: Array<{ name: string; duration: number; timestamp: Date }> = []
  
  return {
    measure: async (name: string, operation: () => Promise<any>) => {
      const start = performance.now()
      const result = await operation()
      const duration = performance.now() - start
      
      metrics.push({ name, duration, timestamp: new Date() })
      
      return { result, duration }
    },
    
    getMetrics: () => [...metrics],
    
    getAverageTime: (name: string) => {
      const nameMetrics = metrics.filter(m => m.name === name)
      return nameMetrics.length > 0 
        ? nameMetrics.reduce((sum, m) => sum + m.duration, 0) / nameMetrics.length
        : 0
    },
    
    clear: () => metrics.length = 0
  }
}

export const mockConsole = () => {
  const originalConsole = { ...console }
  const logs: string[] = []
  
  console.log = vi.fn((...args) => logs.push(args.join(' ')))
  console.error = vi.fn((...args) => logs.push(`ERROR: ${args.join(' ')}`))
  console.warn = vi.fn((...args) => logs.push(`WARN: ${args.join(' ')}`))
  
  return {
    getLogs: () => [...logs],
    restore: () => Object.assign(console, originalConsole),
    clear: () => logs.length = 0
  }
}