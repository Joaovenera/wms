import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { performance } from 'perf_hooks'
import { testRequest, authenticateTestUser } from '../integration-setup'

describe('Performance and Load Testing', () => {
  let authUser: any
  const PERFORMANCE_THRESHOLDS = {
    API_RESPONSE_TIME: 500, // ms
    BULK_OPERATION_TIME: 2000, // ms
    CONCURRENT_REQUESTS: 10,
    DATABASE_QUERY_TIME: 100, // ms
    MEMORY_USAGE_MB: 100 // MB
  }

  beforeAll(async () => {
    authUser = await authenticateTestUser()
  })

  describe('API Response Time Performance', () => {
    it('should respond to product queries within performance threshold', async () => {
      const startTime = performance.now()
      
      const response = await testRequest()
        .get('/api/products')
        .set('Cookie', authUser.cookies)
        .expect(200)

      const endTime = performance.now()
      const responseTime = endTime - startTime

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME)
      expect(response.body).toBeDefined()
    })

    it('should handle single product lookup efficiently', async () => {
      // Create test product first
      const product = await testRequest()
        .post('/api/products')
        .set('Cookie', authUser.cookies)
        .send({
          sku: `PERF-${Date.now()}`,
          name: 'Performance Test Product',
          description: 'Product for performance testing'
        })
        .expect(201)

      const startTime = performance.now()
      
      const response = await testRequest()
        .get(`/api/products/${product.body.id}`)
        .set('Cookie', authUser.cookies)
        .expect(200)

      const endTime = performance.now()
      const responseTime = endTime - startTime

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME)
      expect(response.body.id).toBe(product.body.id)
    })

    it('should perform product search efficiently', async () => {
      const startTime = performance.now()
      
      const response = await testRequest()
        .get('/api/products/search?q=test&limit=50')
        .set('Cookie', authUser.cookies)
        .expect(200)

      const endTime = performance.now()
      const responseTime = endTime - startTime

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME)
      expect(Array.isArray(response.body)).toBe(true)
    })
  })

  describe('Bulk Operations Performance', () => {
    it('should handle bulk product creation efficiently', async () => {
      const bulkProducts = Array.from({ length: 50 }, (_, i) => ({
        sku: `BULK-${Date.now()}-${i}`,
        name: `Bulk Product ${i}`,
        description: `Bulk created product ${i}`,
        weight: Math.random() * 10
      }))

      const startTime = performance.now()
      
      // Create products concurrently
      const promises = bulkProducts.map(product =>
        testRequest()
          .post('/api/products')
          .set('Cookie', authUser.cookies)
          .send(product)
      )

      const results = await Promise.all(promises)
      
      const endTime = performance.now()
      const totalTime = endTime - startTime

      // All requests should succeed
      results.forEach(result => expect(result.status).toBe(201))
      
      // Total time should be within threshold
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_TIME)

      console.log(`Bulk creation: ${results.length} products in ${totalTime.toFixed(2)}ms`)
    })

    it('should handle bulk packaging creation efficiently', async () => {
      // Create test product
      const product = await testRequest()
        .post('/api/products')
        .set('Cookie', authUser.cookies)
        .send({
          sku: `PKG-PERF-${Date.now()}`,
          name: 'Packaging Performance Product'
        })
        .expect(201)

      const bulkPackaging = Array.from({ length: 20 }, (_, i) => ({
        name: `Package Type ${i}`,
        baseUnitQuantity: Math.pow(2, i),
        barcode: `PKG-${Date.now()}-${i}`,
        level: i
      }))

      const startTime = performance.now()
      
      const promises = bulkPackaging.map(pkg =>
        testRequest()
          .post(`/api/products/${product.body.id}/packaging`)
          .set('Cookie', authUser.cookies)
          .send(pkg)
      )

      const results = await Promise.all(promises)
      
      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Most requests should succeed (base unit constraint may cause some failures)
      const successCount = results.filter(r => r.status === 201).length
      expect(successCount).toBeGreaterThan(15)
      
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_TIME)

      console.log(`Bulk packaging: ${successCount} packages in ${totalTime.toFixed(2)}ms`)
    })
  })

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent product reads', async () => {
      const concurrentRequests = Array.from({ length: PERFORMANCE_THRESHOLDS.CONCURRENT_REQUESTS }, () =>
        testRequest()
          .get('/api/products')
          .set('Cookie', authUser.cookies)
      )

      const startTime = performance.now()
      const results = await Promise.all(concurrentRequests)
      const endTime = performance.now()
      
      const totalTime = endTime - startTime
      const avgTime = totalTime / results.length

      // All requests should succeed
      results.forEach(result => expect(result.status).toBe(200))
      
      // Average response time should be reasonable
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME)

      console.log(`Concurrent reads: ${results.length} requests, avg ${avgTime.toFixed(2)}ms`)
    })

    it('should handle concurrent product creation and updates', async () => {
      // Create test products for updates
      const testProducts = await Promise.all(
        Array.from({ length: 5 }, async (_, i) => {
          const response = await testRequest()
            .post('/api/products')
            .set('Cookie', authUser.cookies)
            .send({
              sku: `CONCURRENT-${Date.now()}-${i}`,
              name: `Concurrent Test Product ${i}`
            })
          return response.body
        })
      )

      // Mix of creates and updates
      const concurrentOperations = [
        // Create operations
        ...Array.from({ length: 5 }, (_, i) =>
          testRequest()
            .post('/api/products')
            .set('Cookie', authUser.cookies)
            .send({
              sku: `NEW-CONCURRENT-${Date.now()}-${i}`,
              name: `New Concurrent Product ${i}`
            })
        ),
        // Update operations
        ...testProducts.map((product, i) =>
          testRequest()
            .put(`/api/products/${product.id}`)
            .set('Cookie', authUser.cookies)
            .send({
              name: `Updated Concurrent Product ${i}`
            })
        )
      ]

      const startTime = performance.now()
      const results = await Promise.all(concurrentOperations)
      const endTime = performance.now()
      
      const totalTime = endTime - startTime

      // All operations should succeed
      results.forEach(result => {
        expect([200, 201]).toContain(result.status)
      })
      
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_TIME)

      console.log(`Concurrent operations: ${results.length} ops in ${totalTime.toFixed(2)}ms`)
    })
  })

  describe('Database Performance', () => {
    it('should perform complex queries efficiently', async () => {
      const startTime = performance.now()
      
      // Complex query with joins and filters
      const response = await testRequest()
        .get('/api/products?includeStock=true&category=electronics&minStock=10')
        .set('Cookie', authUser.cookies)
        .expect(200)

      const endTime = performance.now()
      const queryTime = endTime - startTime

      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DATABASE_QUERY_TIME * 5) // Allow more time for complex queries
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should handle pagination efficiently', async () => {
      const pageSize = 50
      const pagesToTest = 5

      const startTime = performance.now()
      
      const pagePromises = Array.from({ length: pagesToTest }, (_, i) =>
        testRequest()
          .get(`/api/products?page=${i + 1}&limit=${pageSize}`)
          .set('Cookie', authUser.cookies)
      )

      const results = await Promise.all(pagePromises)
      
      const endTime = performance.now()
      const totalTime = endTime - startTime
      const avgTimePerPage = totalTime / pagesToTest

      results.forEach(result => expect(result.status).toBe(200))
      expect(avgTimePerPage).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME)

      console.log(`Pagination: ${pagesToTest} pages, avg ${avgTimePerPage.toFixed(2)}ms per page`)
    })
  })

  describe('Photo Upload Performance', () => {
    it('should handle photo uploads efficiently', async () => {
      // Create test product
      const product = await testRequest()
        .post('/api/products')
        .set('Cookie', authUser.cookies)
        .send({
          sku: `PHOTO-PERF-${Date.now()}`,
          name: 'Photo Performance Product'
        })
        .expect(201)

      const photoData = {
        filename: 'performance-test.jpg',
        url: '/uploads/performance-test.jpg',
        fileSize: 1024000, // 1MB
        mimeType: 'image/jpeg',
        isPrimary: true
      }

      const startTime = performance.now()
      
      const response = await testRequest()
        .post(`/api/products/${product.body.id}/photos`)
        .set('Cookie', authUser.cookies)
        .send(photoData)
        .expect(201)

      const endTime = performance.now()
      const uploadTime = endTime - startTime

      expect(uploadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME * 2) // Allow more time for uploads
      expect(response.body.success).toBe(true)
    })

    it('should handle multiple photo uploads concurrently', async () => {
      // Create test product
      const product = await testRequest()
        .post('/api/products')
        .set('Cookie', authUser.cookies)
        .send({
          sku: `MULTI-PHOTO-${Date.now()}`,
          name: 'Multi Photo Product'
        })
        .expect(201)

      const photoUploads = Array.from({ length: 5 }, (_, i) => ({
        filename: `photo-${i}.jpg`,
        url: `/uploads/photo-${i}.jpg`,
        fileSize: 512000,
        mimeType: 'image/jpeg',
        isPrimary: i === 0
      }))

      const startTime = performance.now()
      
      const promises = photoUploads.map(photo =>
        testRequest()
          .post(`/api/products/${product.body.id}/photos`)
          .set('Cookie', authUser.cookies)
          .send(photo)
      )

      const results = await Promise.all(promises)
      
      const endTime = performance.now()
      const totalTime = endTime - startTime

      results.forEach(result => expect(result.status).toBe(201))
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_TIME)

      console.log(`Photo uploads: ${results.length} photos in ${totalTime.toFixed(2)}ms`)
    })
  })

  describe('Memory Usage Performance', () => {
    it('should maintain reasonable memory usage during bulk operations', async () => {
      const initialMemory = process.memoryUsage()

      // Perform memory-intensive operations
      const bulkProducts = Array.from({ length: 100 }, (_, i) => ({
        sku: `MEMORY-${Date.now()}-${i}`,
        name: `Memory Test Product ${i}`,
        description: 'A'.repeat(1000) // Large description
      }))

      const promises = bulkProducts.map(product =>
        testRequest()
          .post('/api/products')
          .set('Cookie', authUser.cookies)
          .send(product)
      )

      await Promise.all(promises)

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024 // MB

      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB)

      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`)
    })

    it('should clean up resources after operations', async () => {
      const measureMemory = () => process.memoryUsage().heapUsed

      const beforeMemory = measureMemory()

      // Perform operations that should clean up
      for (let i = 0; i < 50; i++) {
        await testRequest()
          .get('/api/products')
          .set('Cookie', authUser.cookies)
          .expect(200)
      }

      // Force garbage collection
      if (global.gc) {
        global.gc()
      }

      const afterMemory = measureMemory()
      const memoryDiff = (afterMemory - beforeMemory) / 1024 / 1024

      // Memory usage should not increase significantly
      expect(memoryDiff).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB / 2)

      console.log(`Memory difference after cleanup: ${memoryDiff.toFixed(2)}MB`)
    })
  })

  describe('Cache Performance', () => {
    it('should benefit from caching on repeated requests', async () => {
      const productId = 1 // Assuming product exists

      // First request (cache miss)
      const startTime1 = performance.now()
      await testRequest()
        .get(`/api/products/${productId}/photos/primary`)
        .set('Cookie', authUser.cookies)
      const firstRequestTime = performance.now() - startTime1

      // Second request (cache hit)
      const startTime2 = performance.now()
      await testRequest()
        .get(`/api/products/${productId}/photos/primary`)
        .set('Cookie', authUser.cookies)
      const secondRequestTime = performance.now() - startTime2

      // Cached request should be faster
      expect(secondRequestTime).toBeLessThan(firstRequestTime)
      
      console.log(`Cache performance: First ${firstRequestTime.toFixed(2)}ms, Second ${secondRequestTime.toFixed(2)}ms`)
    })

    it('should handle cache invalidation properly', async () => {
      // Create product with photo
      const product = await testRequest()
        .post('/api/products')
        .set('Cookie', authUser.cookies)
        .send({
          sku: `CACHE-${Date.now()}`,
          name: 'Cache Test Product'
        })
        .expect(201)

      const photoData = {
        filename: 'cache-test.jpg',
        url: '/uploads/cache-test.jpg',
        isPrimary: true
      }

      await testRequest()
        .post(`/api/products/${product.body.id}/photos`)
        .set('Cookie', authUser.cookies)
        .send(photoData)
        .expect(201)

      // First request to cache the result
      const startTime1 = performance.now()
      await testRequest()
        .get(`/api/products/${product.body.id}/photos/primary`)
        .set('Cookie', authUser.cookies)
        .expect(200)
      const firstTime = performance.now() - startTime1

      // Add another photo (should invalidate cache)
      await testRequest()
        .post(`/api/products/${product.body.id}/photos`)
        .set('Cookie', authUser.cookies)
        .send({
          filename: 'cache-test-2.jpg',
          url: '/uploads/cache-test-2.jpg',
          isPrimary: false
        })
        .expect(201)

      // Next request should rebuild cache
      const startTime2 = performance.now()
      await testRequest()
        .get(`/api/products/${product.body.id}/photos/primary`)
        .set('Cookie', authUser.cookies)
        .expect(200)
      const secondTime = performance.now() - startTime2

      // Both requests should complete within reasonable time
      expect(firstTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME)
      expect(secondTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME)

      console.log(`Cache invalidation: Before ${firstTime.toFixed(2)}ms, After ${secondTime.toFixed(2)}ms`)
    })
  })

  describe('Stress Testing', () => {
    it('should handle high load gracefully', async () => {
      const STRESS_REQUESTS = 50
      const CONCURRENT_BATCHES = 5

      const stressTest = async (batchIndex: number) => {
        const requests = Array.from({ length: STRESS_REQUESTS / CONCURRENT_BATCHES }, (_, i) =>
          testRequest()
            .get('/api/products')
            .set('Cookie', authUser.cookies)
        )

        const results = await Promise.all(requests)
        return results.filter(r => r.status === 200).length
      }

      const startTime = performance.now()
      
      const batchPromises = Array.from({ length: CONCURRENT_BATCHES }, (_, i) => stressTest(i))
      const batchResults = await Promise.all(batchPromises)
      
      const endTime = performance.now()
      const totalTime = endTime - startTime
      const totalSuccess = batchResults.reduce((sum, count) => sum + count, 0)

      // At least 80% of requests should succeed under load
      expect(totalSuccess).toBeGreaterThan(STRESS_REQUESTS * 0.8)
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_TIME * 3)

      console.log(`Stress test: ${totalSuccess}/${STRESS_REQUESTS} successful in ${totalTime.toFixed(2)}ms`)
    })
  })
})