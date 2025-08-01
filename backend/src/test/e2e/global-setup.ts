import { chromium, FullConfig } from '@playwright/test'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global E2E test setup...')
  
  // Setup test database
  await setupTestDatabase()
  
  // Seed test data
  await seedTestData()
  
  // Perform authentication and save state
  await performAuthentication()
  
  // Wait for services to be ready
  await waitForServices()
  
  console.log('✅ Global E2E test setup completed')
}

async function setupTestDatabase() {
  console.log('📊 Setting up test database...')
  
  try {
    // Run database migrations for test environment
    execSync('NODE_ENV=test npm run db:migrate', { 
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../../../')
    })
    
    console.log('✅ Test database setup completed')
  } catch (error) {
    console.error('❌ Test database setup failed:', error)
    throw error
  }
}

async function seedTestData() {
  console.log('🌱 Seeding test data...')
  
  try {
    // Seed base test data
    execSync('NODE_ENV=test tsx src/test/e2e/seed-test-data.ts', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../../../')
    })
    
    console.log('✅ Test data seeding completed')
  } catch (error) {
    console.error('❌ Test data seeding failed:', error)
    throw error
  }
}

async function performAuthentication() {
  console.log('🔐 Performing authentication setup...')
  
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // Login as admin user
    await page.goto('/login')
    await page.fill('[data-testid=email-input]', 'admin@warehouse.com')
    await page.fill('[data-testid=password-input]', 'admin123')
    await page.click('[data-testid=login-button]')
    await page.waitForURL('/dashboard')
    
    // Save authentication state
    await context.storageState({ 
      path: path.resolve(__dirname, './auth/admin-auth.json')
    })
    
    // Login as regular user
    await page.goto('/login')
    await page.fill('[data-testid=email-input]', 'user@warehouse.com')
    await page.fill('[data-testid=password-input]', 'user123')
    await page.click('[data-testid=login-button]')
    await page.waitForURL('/dashboard')
    
    // Save user authentication state
    await context.storageState({ 
      path: path.resolve(__dirname, './auth/user-auth.json')
    })
    
    // Login as mobile user
    await page.goto('/login')
    await page.fill('[data-testid=email-input]', 'mobile@warehouse.com')
    await page.fill('[data-testid=password-input]', 'mobile123')
    await page.click('[data-testid=login-button]')
    await page.waitForURL('/dashboard')
    
    // Save mobile authentication state
    await context.storageState({ 
      path: path.resolve(__dirname, './auth/mobile-auth.json')
    })
    
    console.log('✅ Authentication setup completed')
  } catch (error) {
    console.error('❌ Authentication setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

async function waitForServices() {
  console.log('⏳ Waiting for services to be ready...')
  
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // Wait for backend API
    await page.goto('/api/health')
    await page.waitForSelector('text=OK', { timeout: 30000 })
    
    // Wait for frontend
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Wait for database connectivity
    await page.goto('/api/health/database')
    await page.waitForSelector('text=connected', { timeout: 30000 })
    
    // Wait for Redis connectivity
    await page.goto('/api/health/redis')
    await page.waitForSelector('text=connected', { timeout: 30000 })
    
    console.log('✅ All services are ready')
  } catch (error) {
    console.error('❌ Service readiness check failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup