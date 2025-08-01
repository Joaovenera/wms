import '@testing-library/jest-dom';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './mocks/server';

// Setup MSW (Mock Service Worker)
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'error',
  });
});

afterEach(() => {
  // Clean up DOM after each test
  cleanup();
  
  // Reset MSW handlers
  server.resetHandlers();
  
  // Clear all mocks
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.location
const mockLocation = {
  href: 'http://localhost:3000/',
  protocol: 'http:',
  host: 'localhost:3000',
  hostname: 'localhost',
  port: '3000',
  pathname: '/',
  search: '',
  hash: '',
  origin: 'http://localhost:3000',
  reload: vi.fn(),
  replace: vi.fn(),
  assign: vi.fn(),
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
});

// Mock fetch (if not using MSW for some requests)
global.fetch = vi.fn();

// Mock getUserMedia for camera tests
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: vi.fn().mockReturnValue([
        {
          stop: vi.fn(),
          getSettings: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
        },
      ]),
    }),
    enumerateDevices: vi.fn().mockResolvedValue([
      {
        deviceId: 'default',
        kind: 'videoinput',
        label: 'Default Camera',
        groupId: 'group1',
      },
    ]),
  },
  writable: true,
});

// Mock QR code scanner
vi.mock('qrcode', () => ({
  default: {
    toCanvas: vi.fn(),
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
  },
}));

// Console overrides for cleaner test output
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args: any[]) => {
  // Suppress known warnings in tests
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: ReactDOM.render is deprecated') ||
     args[0].includes('Warning: componentWillReceiveProps') ||
     args[0].includes('act(...) is not supported'))
  ) {
    return;
  }
  originalError.call(console, ...args);
};

console.warn = (...args: any[]) => {
  // Suppress known warnings in tests
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('componentWillReceiveProps') ||
     args[0].includes('act(...) is not supported'))
  ) {
    return;
  }
  originalWarn.call(console, ...args);
};

// Global test utilities
export const createMockFile = (
  name: string = 'test.jpg',
  size: number = 1024,
  type: string = 'image/jpeg'
): File => {
  const file = new File(['mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

export const createMockFileList = (files: File[]): FileList => {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    *[Symbol.iterator]() {
      for (let i = 0; i < files.length; i++) {
        yield files[i];
      }
    },
  };
  
  files.forEach((file, index) => {
    Object.defineProperty(fileList, index, { value: file });
  });
  
  return fileList as FileList;
};

export const simulateFileUpload = (
  input: HTMLInputElement,
  files: File[]
) => {
  const fileList = createMockFileList(files);
  Object.defineProperty(input, 'files', { value: fileList });
  
  const event = new Event('change', { bubbles: true });
  input.dispatchEvent(event);
};

// Make utilities available globally
declare global {
  var testUtils: {
    createMockFile: typeof createMockFile;
    createMockFileList: typeof createMockFileList;
    simulateFileUpload: typeof simulateFileUpload;
  };
}

global.testUtils = {
  createMockFile,
  createMockFileList,
  simulateFileUpload,
};