import { beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { config } from 'dotenv'

// Load integration test environment
config({ path: '.env.integration' })

let testApp: any
let testDatabase: any

beforeAll(async () => {
  console.log('🔧 Setting up integration test environment...')
  
  // Setup test database
  testDatabase = await globalThis.testUtils.createTestDatabase()
  
  // Import and setup test app
  const { createApp } = await import('../index')
  testApp = createApp()
  
  console.log('✅ Integration test environment ready')
}, 30000)

afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...')
  
  if (testDatabase) {
    await testDatabase.close()
  }
  
  await globalThis.testUtils.cleanupTestDatabase()
  
  console.log('✅ Integration test cleanup completed')
}, 15000)

// Export test utilities for integration tests
export const testRequest = () => request(testApp)

export const createTestUser = async () => {
  const mockUser = globalThis.testUtils.generateMockUser()
  
  const response = await testRequest()
    .post('/api/users')
    .send(mockUser)
    .expect(201)
    
  return response.body
}

export const createTestProduct = async () => {
  const mockProduct = globalThis.testUtils.generateMockProduct()
  
  const response = await testRequest()
    .post('/api/products')
    .send(mockProduct)
    .expect(201)
    
  return response.body
}

export const authenticateTestUser = async () => {
  const user = await createTestUser()
  
  const response = await testRequest()
    .post('/api/auth/login')
    .send({
      email: user.email,
      password: 'testpassword'
    })
    .expect(200)
    
  return {
    user,
    token: response.body.token,
    cookies: response.headers['set-cookie']
  }
}