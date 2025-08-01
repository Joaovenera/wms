import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Global test configuration
    globals: true,
    environment: 'node',
    
    // Test file patterns
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    
    exclude: [
      ...configDefaults.exclude,
      'src/test/helpers/**',
      'src/test/mocks/**',
      'src/test/fixtures/**',
      'dist/**',
      'node_modules/**'
    ],

    // Setup files
    setupFiles: ['src/test/setup.ts'],
    
    // Timeout configuration
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Coverage configuration
    coverage: {
      // Coverage provider
      provider: 'v8', // or 'istanbul'
      
      // Report formats
      reporter: ['text', 'json', 'html', 'lcov', 'text-summary'],
      
      // Output directories
      reportsDirectory: './coverage',
      
      // Files to include in coverage
      include: [
        'src/**/*.{js,ts}',
        '!src/**/*.d.ts',
        '!src/test/**',
        '!src/scripts/**',
        '!src/index.ts',
        '!src/db/migrations/**',
        '!src/db/seeds/**'
      ],
      
      // Files to exclude from coverage
      exclude: [
        ...configDefaults.coverage.exclude || [],
        'src/test/**',
        'src/**/*.test.{js,ts}',
        'src/**/*.spec.{js,ts}',
        'src/scripts/**',
        'src/db/migrations/**',
        'src/db/seeds/**',
        'src/**/*.d.ts',
        'src/types/**',
        'src/constants/**',
        'node_modules/**'
      ],
      
      // Coverage thresholds - enforce minimum coverage
      thresholds: {
        // Global thresholds
        global: {
          branches: 75,
          functions: 80,
          lines: 80,
          statements: 80
        },
        
        // Per-file thresholds (more strict for critical files)
        perFile: {
          branches: 70,
          functions: 75,
          lines: 75,
          statements: 75
        },
        
        // Directory-specific thresholds
        'src/services/packaging-composition.service.ts': {
          branches: 85,
          functions: 90,
          lines: 85,
          statements: 85
        },
        
        'src/controllers/packaging.controller.ts': {
          branches: 80,
          functions: 85,
          lines: 80,
          statements: 80
        }
      },
      
      // Coverage collection options
      all: true, // Include all files in coverage, even if not tested
      skipFull: false, // Don't skip files with 100% coverage
      clean: true, // Clean coverage directory before each run
      cleanOnRerun: true,
      
      // Source maps
      sourcemap: true,
      
      // Coverage watermarks for color coding
      watermarks: {
        statements: [75, 90],
        functions: [75, 90],
        branches: [70, 85],
        lines: [75, 90]
      }
    },
    
    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },
    
    // Watch mode configuration
    watch: true,
    watchExclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.git/**'
    ],
    
    // Reporter configuration
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/test-results.json',
      html: './test-results/test-report.html'
    },
    
    // Mock configuration
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    
    // Environment variables for testing
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/wms_test',
      JWT_SECRET: 'test-secret-key',
      REDIS_URL: 'redis://localhost:6379/1'
    }
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './src/test')
    }
  },
  
  // Define custom test categories
  define: {
    __TEST_CATEGORIES__: JSON.stringify({
      unit: 'src/**/*.unit.test.ts',
      integration: 'src/**/*.integration.test.ts',
      performance: 'src/**/*.performance.test.ts',
      e2e: 'src/**/*.e2e.test.ts'
    })
  }
});

// Configuration for different test types
export const unitTestConfig = defineConfig({
  ...defineConfig().test,
  test: {
    ...defineConfig().test?.test,
    include: ['src/**/*.unit.test.ts'],
    coverage: {
      ...defineConfig().test?.test?.coverage,
      thresholds: {
        global: {
          branches: 85,
          functions: 90,
          lines: 85,
          statements: 85
        }
      }
    }
  }
});

export const integrationTestConfig = defineConfig({
  ...defineConfig().test,
  test: {
    ...defineConfig().test?.test,
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 30000, // Longer timeout for integration tests
    coverage: {
      ...defineConfig().test?.test?.coverage,
      thresholds: {
        global: {
          branches: 70,
          functions: 75,
          lines: 75,
          statements: 75
        }
      }
    }
  }
});

export const performanceTestConfig = defineConfig({
  ...defineConfig().test,
  test: {
    ...defineConfig().test?.test,
    include: ['src/**/*.performance.test.ts'],
    testTimeout: 60000, // Very long timeout for performance tests
    coverage: {
      enabled: false // Don't collect coverage for performance tests
    }
  }
});

export const e2eTestConfig = defineConfig({
  ...defineConfig().test,
  test: {
    ...defineConfig().test?.test,
    include: ['src/**/*.e2e.test.ts'],
    testTimeout: 120000, // Very long timeout for E2E tests
    coverage: {
      enabled: false // Don't collect coverage for E2E tests
    }
  }
});