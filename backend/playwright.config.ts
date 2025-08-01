import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  // globalSetup: './src/test/e2e/global-setup.ts',
  // globalTeardown: './src/test/e2e/global-teardown.ts',
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['github']
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
    headless: true,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['camera', 'microphone', 'geolocation'],
    colorScheme: 'light',
    contextOptions: {
      ignoreHTTPSErrors: true,
    },
  },
  projects: [
    // Setup project for authentication and test data (disabled for now)
    // {
    //   name: 'setup',
    //   testMatch: /.*\.setup\.ts/,
    //   teardown: 'cleanup',
    // },
    // {
    //   name: 'cleanup',
    //   testMatch: /.*\.teardown\.ts/,
    // },
    
    // Desktop browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      // dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
      // dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
      // dependencies: ['setup'],
    },
    
    // Mobile devices
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        isMobile: true,
        hasTouch: true,
      },
      // dependencies: ['setup'],
    },
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        isMobile: true,
        hasTouch: true,
      },
      // dependencies: ['setup'],
    },
    {
      name: 'Mobile Chrome Landscape',
      use: { 
        ...devices['Pixel 5 landscape'],
        isMobile: true,
        hasTouch: true,
      },
      // dependencies: ['setup'],
    },
    
    // Tablet devices
    {
      name: 'iPad',
      use: { 
        ...devices['iPad Pro'],
        isMobile: true,
        hasTouch: true,
      },
      // dependencies: ['setup'],
    },
    
    // Performance and accessibility testing
    {
      name: 'performance',
      testMatch: /.*\.performance\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      // dependencies: ['setup'],
    },
    {
      name: 'accessibility',
      testMatch: /.*\.accessibility\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      // dependencies: ['setup'],
    },
    
    // Visual regression testing
    {
      name: 'visual',
      testMatch: /.*\.visual\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      // dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'cd ../frontend && npm run dev',
    url: 'https://localhost:5174',
    reuseExistingServer: true,
    timeout: 180000,
    stdout: 'pipe',
    stderr: 'pipe',
    ignoreHTTPSErrors: true,
  },
})