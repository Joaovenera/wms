/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

// Unified Vitest configuration for WMS backend
// This replaces the separate unit/integration configs
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'src/test/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        'src/scripts/',
        'src/index.ts'
      ],
      thresholds: {
        global: {
          branches: 75,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    // Support both unit and integration tests
    include: [
      'tests/**/*.test.{js,ts}',
      'src/**/*.test.{js,ts}',
      'src/test/**/*.test.{js,ts}'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '**/*.d.ts'
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      'jsonwebtoken': 'jsonwebtoken'
    },
  },
  define: {
    'import.meta.vitest': 'undefined'
  },
})