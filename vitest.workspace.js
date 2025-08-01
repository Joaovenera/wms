// Vitest workspace configuration for unified WMS testing
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // Backend tests
  {
    test: {
      name: 'backend',
      root: './backend',
      environment: 'node',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.{js,ts}', 'src/**/*.test.{js,ts}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        reportsDirectory: '../coverage/backend'
      }
    },
    resolve: {
      alias: {
        '@': './backend/src',
        '@tests': './backend/tests'
      }
    }
  },
  
  // Frontend tests  
  {
    test: {
      name: 'frontend',
      root: './frontend',
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{js,ts,jsx,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        reportsDirectory: '../coverage/frontend'
      }
    },
    resolve: {
      alias: {
        '@': './frontend/src'
      }
    }
  }
])