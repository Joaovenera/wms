/**
 * Test Setup and Configuration
 * Global test setup, mocks, and utilities for the loading execution test suite
 */

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock global APIs that are not available in test environment
beforeAll(() => {
  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: []
  }));

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }));

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock requestAnimationFrame
  global.requestAnimationFrame = vi.fn((callback) => {
    return setTimeout(callback, 0);
  });

  global.cancelAnimationFrame = vi.fn((id) => {
    clearTimeout(id);
  });

  // Mock scrollTo
  window.scrollTo = vi.fn();

  // Mock performance.now for consistent testing
  Object.defineProperty(window.performance, 'now', {
    writable: true,
    value: vi.fn(() => Date.now())
  });

  // Mock Navigator APIs
  Object.defineProperty(navigator, 'vibrate', {
    writable: true,
    value: vi.fn()
  });

  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
        getVideoTracks: () => [{
          getCapabilities: () => ({ torch: true }),
          getSettings: () => ({ facingMode: 'environment' }),
          applyConstraints: vi.fn().mockResolvedValue(undefined),
          stop: vi.fn()
        }]
      })
    }
  });

  // Mock Notification API
  Object.defineProperty(window, 'Notification', {
    writable: true,
    value: class MockNotification {
      constructor(title: string, options?: NotificationOptions) {
        this.title = title;
        this.options = options;
      }
      static permission = 'granted';
      static requestPermission = vi.fn().mockResolvedValue('granted');
      title: string;
      options?: NotificationOptions;
    }
  });

  // Mock Service Worker
  Object.defineProperty(navigator, 'serviceWorker', {
    writable: true,
    value: {
      register: vi.fn().mockResolvedValue({}),
      ready: Promise.resolve({})
    }
  });

  // Mock Touch Events
  if (!window.TouchEvent) {
    window.TouchEvent = class TouchEvent extends Event {
      constructor(type: string, eventInitDict?: TouchEventInit) {
        super(type, eventInitDict);
        this.touches = eventInitDict?.touches || [];
        this.targetTouches = eventInitDict?.targetTouches || [];
        this.changedTouches = eventInitDict?.changedTouches || [];
      }
      touches: TouchList;
      targetTouches: TouchList;
      changedTouches: TouchList;
    } as any;
  }

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn((key: string) => {
      return localStorage.getItem(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      localStorage.setItem(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      localStorage.removeItem(key);
    }),
    clear: vi.fn(() => {
      localStorage.clear();
    })
  };

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  });

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: vi.fn((key: string) => {
      return sessionStorage.getItem(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      sessionStorage.setItem(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      sessionStorage.removeItem(key);
    }),
    clear: vi.fn(() => {
      sessionStorage.clear();
    })
  };

  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock
  });

  // Mock console methods for cleaner test output
  global.console = {
    ...console,
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    info: vi.fn()
  };

  // Mock URL.createObjectURL
  global.URL.createObjectURL = vi.fn(() => 'mock-url');
  global.URL.revokeObjectURL = vi.fn();

  // Mock Blob
  global.Blob = vi.fn().mockImplementation((content, options) => ({
    content,
    options,
    size: content?.[0]?.length || 0,
    type: options?.type || 'text/plain'
  })) as any;

  // Mock File
  global.File = vi.fn().mockImplementation((content, name, options) => ({
    content,
    name,
    options,
    size: content?.[0]?.length || 0,
    type: options?.type || 'text/plain',
    lastModified: Date.now()
  })) as any;

  // Mock crypto for UUID generation (if needed)
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: vi.fn(() => '123e4567-e89b-12d3-a456-426614174000'),
      getRandomValues: vi.fn((array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      })
    }
  });
});

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.clearAllTimers();
  
  // Reset any modified globals
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true
  });
  
  Object.defineProperty(window, 'innerWidth', {
    value: 1024,
    writable: true
  });
  
  Object.defineProperty(window, 'innerHeight', {
    value: 768,
    writable: true
  });
});

// Global test utilities
export const TestUtils = {
  // Create touch event
  createTouchEvent: (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
    const event = new Event(type, { bubbles: true, cancelable: true }) as any;
    event.touches = touches;
    event.changedTouches = touches;
    event.targetTouches = touches;
    return event;
  },

  // Wait for next tick
  nextTick: () => new Promise(resolve => setTimeout(resolve, 0)),

  // Simulate user agent
  mockUserAgent: (userAgent: string) => {
    Object.defineProperty(navigator, 'userAgent', {
      value: userAgent,
      writable: true
    });
  },

  // Simulate viewport size
  mockViewport: (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: height, writable: true });
    window.dispatchEvent(new Event('resize'));
  },

  // Simulate network conditions
  mockNetworkCondition: (condition: 'online' | 'offline' | 'slow') => {
    switch (condition) {
      case 'offline':
        Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
        break;
      case 'slow':
        Object.defineProperty(navigator, 'connection', {
          value: {
            effectiveType: '2g',
            downlink: 0.5,
            rtt: 2000
          },
          writable: true
        });
        break;
      default:
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    }
  },

  // Mock API responses
  mockApiResponse: (url: string, response: any) => {
    return vi.fn().mockImplementation((method, requestUrl) => {
      if (requestUrl.includes(url)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response)
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  },

  // Performance measurement
  measurePerformance: async (fn: () => Promise<void> | void): Promise<number> => {
    const start = performance.now();
    await fn();
    const end = performance.now();
    return end - start;
  },

  // Memory usage simulation
  simulateMemoryPressure: () => {
    // Simulate low memory conditions
    Object.defineProperty(performance, 'memory', {
      value: {
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB
        totalJSHeapSize: 60 * 1024 * 1024, // 60MB
        jsHeapSizeLimit: 64 * 1024 * 1024  // 64MB limit
      }
    });
  },

  // Accessibility testing helpers
  checkAriaLabels: (container: HTMLElement) => {
    const interactive = container.querySelectorAll('button, input, select, textarea, [role="button"], [role="tab"]');
    const issues: string[] = [];
    
    interactive.forEach((element, index) => {
      const hasLabel = element.hasAttribute('aria-label') || 
                      element.hasAttribute('aria-labelledby') ||
                      element.textContent?.trim() ||
                      element.getAttribute('title');
      
      if (!hasLabel) {
        issues.push(`Interactive element ${index} missing accessible name`);
      }
    });
    
    return issues;
  },

  // Keyboard navigation testing
  simulateKeyboardNavigation: async (user: any, container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const navigationResults = [];
    
    for (let i = 0; i < focusableElements.length; i++) {
      await user.tab();
      const focused = document.activeElement;
      navigationResults.push({
        index: i,
        element: focused,
        accessible: focused === focusableElements[i]
      });
    }
    
    return navigationResults;
  }
};

// Performance thresholds for testing
export const PerformanceThresholds = {
  RENDER_TIME: 1000,      // 1 second max render time
  INTERACTION_TIME: 100,   // 100ms max interaction response
  MEMORY_USAGE: 100 * 1024 * 1024, // 100MB max memory usage
  SEARCH_TIME: 500,        // 500ms max search time
  LOAD_TIME: 2000         // 2 seconds max load time
};

// Accessibility standards
export const AccessibilityStandards = {
  MIN_TOUCH_TARGET: 44,    // 44px minimum touch target
  MIN_CONTRAST_RATIO: 4.5, // WCAG AA contrast ratio
  MAX_TAB_STOPS: 10        // Reasonable tab stop limit
};

// Browser compatibility matrix
export const BrowserMatrix = {
  Chrome: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    features: ['getUserMedia', 'vibrate', 'touchstart', 'serviceWorker']
  },
  Safari: {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
    features: ['getUserMedia', 'touchstart'] // More limited features
  },
  Firefox: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
    features: ['getUserMedia', 'vibrate', 'touchstart', 'serviceWorker']
  },
  Edge: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    features: ['getUserMedia', 'vibrate', 'touchstart', 'serviceWorker']
  },
  SafariMobile: {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    features: ['getUserMedia', 'touchstart'] // Limited mobile Safari
  }
};

export default TestUtils;