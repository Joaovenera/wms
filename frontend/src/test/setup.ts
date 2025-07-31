import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { server } from './mocks/server'
import { customMatchers } from './utils'

// Extend expect with custom matchers
expect.extend(customMatchers)

// Mock server setup
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
  console.log('🔧 Mock server started')
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
  console.log('🔧 Mock server stopped')
})

// Global test setup
beforeAll(() => {
  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
  }))

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // Mock scrollTo
  window.scrollTo = vi.fn()

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  }
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  })

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  }
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
  })

  // Mock fetch if not already mocked by MSW
  if (!global.fetch) {
    global.fetch = vi.fn()
  }

  // Mock Canvas API (for QR codes, charts, etc.)
  HTMLCanvasElement.prototype.getContext = vi.fn()

  // Mock URL.createObjectURL
  URL.createObjectURL = vi.fn(() => 'mock-url')
  URL.revokeObjectURL = vi.fn()

  // Mock FileReader
  global.FileReader = vi.fn().mockImplementation(() => ({
    readAsDataURL: vi.fn(),
    readAsText: vi.fn(),
    readAsArrayBuffer: vi.fn(),
    onload: null,
    onerror: null,
    result: null,
  }))

  // Mock navigator.clipboard
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
    },
  })

  // Mock geolocation
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    },
  })

  console.log('🧪 Global test environment initialized')
})

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks()
  
  // Clear storage mocks
  vi.mocked(localStorage.getItem).mockClear()
  vi.mocked(localStorage.setItem).mockClear()
  vi.mocked(localStorage.removeItem).mockClear()
  vi.mocked(localStorage.clear).mockClear()
  
  vi.mocked(sessionStorage.getItem).mockClear()
  vi.mocked(sessionStorage.setItem).mockClear()
  vi.mocked(sessionStorage.removeItem).mockClear()
  vi.mocked(sessionStorage.clear).mockClear()
})

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks()
  
  // Clear DOM
  document.body.innerHTML = ''
  
  // Clear timers
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

// Console suppression for tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
       args[0].includes('Warning: An invalid form control') ||
       args[0].includes('validateDOMNesting'))
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

// Global error handling for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// Extend global types for custom matchers
declare global {
  namespace Vi {
    interface Assertion<T = any> {
      toBeWithinRange(floor: number, ceiling: number): T
      toHaveValidSku(): T
      toHaveValidPalletCode(): T
    }
  }
}

// Performance monitoring for tests
let testStartTime: number

beforeEach(() => {
  testStartTime = performance.now()
})

afterEach(() => {
  const testDuration = performance.now() - testStartTime
  if (testDuration > 5000) { // Warn if test takes more than 5 seconds
    console.warn(`⚠️ Slow test detected: ${testDuration.toFixed(2)}ms`)
  }
})