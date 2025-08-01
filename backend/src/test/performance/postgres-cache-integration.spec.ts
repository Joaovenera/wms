/**
 * PostgreSQL Cache Integration Performance Tests
 * 
 * Tests the integration between PostgreSQL database queries and Redis cache:
 * - Query result caching performance
 * - Cache-aside pattern implementation
 * - Write-through vs write-behind strategies
 * - Database failover with cache fallback
 * - Complex query optimization with strategic caching
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { performance } from 'perf_hooks'
import { cacheService } from '../../infrastructure/cache/cache.service.js'
import { strategicCache, cacheStrategies } from '../../infrastructure/cache/strategies.js'
import { redisClient } from '../../infrastructure/cache/redis.client.js'

// Mock database operations to simulate realistic scenarios
class MockDatabaseOperations {
  private queryLatencies = {
    simple: { min: 5, max: 15 },      // Simple SELECT queries
    complex: { min: 50, max: 200 },   // Complex JOINs and aggregations
    heavy: { min: 500, max: 2000 },   // Heavy reporting queries
    write: { min: 10, max: 50 }       // INSERT/UPDATE queries
  }

  async executeQuery(type: keyof typeof this.queryLatencies, query: string, params?: any[]): Promise<any> {
    const latency = this.queryLatencies[type]
    const queryTime = latency.min + Math.random() * (latency.max - latency.min)
    
    // Simulate database query delay
    await new Promise(resolve => setTimeout(resolve, queryTime))
    
    // Generate mock result based on query type
    return this.generateMockResult(type, query, params)
  }

  private generateMockResult(type: string, query: string, params?: any[]): any {
    switch (type) {
      case 'simple':
        return { id: 1, name: 'Mock Result', timestamp: Date.now() }
      
      case 'complex':
        return {
          aggregates: { total: 1000, average: 25.5, count: 40 },
          items: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, value: Math.random() * 100 }))
        }
      
      case 'heavy':
        return {
          report: 'Monthly Report',
          data: Array.from({ length: 1000 }, (_, i) => ({
            id: i + 1,
            category: `Category ${Math.floor(i / 100) + 1}`,
            value: Math.random() * 1000,
            date: new Date(Date.now() - i * 86400000).toISOString()
          }))
        }
      
      case 'write':
        return { affected: 1, insertId: Date.now() }
      
      default:
        return null
    }
  }

  async getProduct(id: number): Promise<any> {
    return this.executeQuery('simple', 'SELECT * FROM products WHERE id = $1', [id])
  }

  async getProductsWithStock(): Promise<any> {
    return this.executeQuery('complex', 'SELECT p.*, s.quantity FROM products p JOIN stock s ON p.id = s.product_id')
  }

  async getInventoryReport(): Promise<any> {
    return this.executeQuery('heavy', 'SELECT * FROM inventory_report_view WHERE date >= $1', [new Date()])
  }

  async updateProductStock(id: number, quantity: number): Promise<any> {
    return this.executeQuery('write', 'UPDATE products SET stock = $1 WHERE id = $2', [quantity, id])
  }
}

describe('PostgreSQL Cache Integration Tests', () => {
  let mockDb: MockDatabaseOperations
  const PERFORMANCE_THRESHOLDS = {
    CACHE_HIT_SPEEDUP: 5, // Cache should be 5x faster than DB
    CACHE_MISS_PENALTY: 1.2, // Cache miss should add no more than 20% overhead
    WRITE_THROUGH_OVERHEAD: 2, // Write-through should be max 2x slower than DB write
    INVALIDATION_TIME: 100, // ms - cache invalidation should be fast
    COMPLEX_QUERY_CACHE_BENEFIT: 10, // Cache should provide 10x speedup for complex queries
  }

  let performanceMetrics: {
    cacheHits: { count: number, totalTime: number }
    cacheMisses: { count: number, totalTime: number }
    dbOnlyQueries: { count: number, totalTime: number }
    writeOperations: { count: number, totalTime: number }
    invalidations: { count: number, totalTime: number }
  } = {
    cacheHits: { count: 0, totalTime: 0 },
    cacheMisses: { count: 0, totalTime: 0 },
    dbOnlyQueries: { count: 0, totalTime: 0 },
    writeOperations: { count: 0, totalTime: 0 },
    invalidations: { count: 0, totalTime: 0 }
  }

  beforeAll(async () => {
    if (!redisClient.isReady) {
      await redisClient.connect()
    }
    mockDb = new MockDatabaseOperations()
    await cacheService.clear()
  })

  afterAll(async () => {
    await cacheService.clear()
    generateIntegrationReport()
  })

  beforeEach(async () => {
    await cacheService.clear()
    resetMetrics()
  })

  describe('Cache-Aside Pattern Performance', () => {
    it('should demonstrate significant speedup for cached queries', async () => {
      const productId = 123
      const iterations = 20

      // First query - cache miss (DB + cache write)
      console.log('Testing cache miss performance...')
      const cacheMissStart = performance.now()
      const dbResult = await mockDb.getProduct(productId)
      await strategicCache.set(cacheStrategies.product.details, `product:${productId}`, dbResult)
      const cacheMissTime = performance.now() - cacheMissStart
      
      recordCacheMiss(cacheMissTime)

      // Subsequent queries - cache hits
      console.log('Testing cache hit performance...')
      const cacheHitTimes: number[] = []
      
      for (let i = 0; i < iterations; i++) {
        const cacheHitStart = performance.now()
        const cachedResult = await strategicCache.get(cacheStrategies.product.details, `product:${productId}`)
        const cacheHitTime = performance.now() - cacheHitStart
        
        cacheHitTimes.push(cacheHitTime)
        recordCacheHit(cacheHitTime)
        
        expect(cachedResult).toEqual(dbResult)
      }

      // Direct DB queries for comparison
      console.log('Testing direct DB performance...')
      const dbQueryTimes: number[] = []
      
      for (let i = 0; i < 5; i++) {
        const dbStart = performance.now()
        await mockDb.getProduct(productId)
        const dbTime = performance.now() - dbStart
        
        dbQueryTimes.push(dbTime)
        recordDbQuery(dbTime)
      }

      const avgCacheHitTime = cacheHitTimes.reduce((sum, time) => sum + time, 0) / cacheHitTimes.length
      const avgDbTime = dbQueryTimes.reduce((sum, time) => sum + time, 0) / dbQueryTimes.length
      const speedupRatio = avgDbTime / avgCacheHitTime

      expect(speedupRatio).toBeGreaterThan(PERFORMANCE_THRESHOLDS.CACHE_HIT_SPEEDUP)
      expect(cacheMissTime).toBeLessThan(avgDbTime * PERFORMANCE_THRESHOLDS.CACHE_MISS_PENALTY)

      console.log(`Cache Hit Speedup: ${speedupRatio.toFixed(2)}x (${avgCacheHitTime.toFixed(2)}ms vs ${avgDbTime.toFixed(2)}ms)`)
      console.log(`Cache Miss Penalty: ${(cacheMissTime / avgDbTime).toFixed(2)}x`)
    })

    it('should handle cache-aside pattern under concurrent load', async () => {
      const productIds = Array.from({ length: 50 }, (_, i) => i + 1)
      const concurrentRequests = 20

      // Concurrent cache-aside operations
      const workers = Array.from({ length: concurrentRequests }, async (_, workerId) => {
        for (const productId of productIds) {
          const cacheKey = `concurrent:product:${productId}`
          const opStart = performance.now()
          
          try {
            // Try cache first
            let result = await strategicCache.get(cacheStrategies.product.details, cacheKey)
            
            if (result === null) {
              // Cache miss - fetch from DB and cache
              result = await mockDb.getProduct(productId)
              await strategicCache.set(cacheStrategies.product.details, cacheKey, result)
              recordCacheMiss(performance.now() - opStart)
            } else {
              recordCacheHit(performance.now() - opStart)
            }
            
            expect(result).toBeDefined()
          } catch (error) {
            console.error(`Worker ${workerId} failed for product ${productId}:`, error)
          }
        }
      })

      await Promise.all(workers)

      const totalRequests = performanceMetrics.cacheHits.count + performanceMetrics.cacheMisses.count
      const hitRatio = performanceMetrics.cacheHits.count / totalRequests
      const avgHitTime = performanceMetrics.cacheHits.totalTime / performanceMetrics.cacheHits.count
      const avgMissTime = performanceMetrics.cacheMisses.totalTime / performanceMetrics.cacheMisses.count

      expect(hitRatio).toBeGreaterThan(0.5) // At least 50% hit ratio under concurrent load
      expect(avgHitTime).toBeLessThan(avgMissTime / 3) // Cache hits should be much faster

      console.log(`Concurrent Cache-Aside: ${totalRequests} requests, ${(hitRatio * 100).toFixed(1)}% hit ratio`)
      console.log(`Hit: ${avgHitTime.toFixed(2)}ms, Miss: ${avgMissTime.toFixed(2)}ms`)
    })
  })

  describe('Write-Through vs Write-Behind Performance', () => {
    it('should compare write-through cache performance', async () => {
      const productUpdates = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        stock: Math.floor(Math.random() * 1000)
      }))

      console.log('Testing write-through pattern...')
      const writeThroughTimes: number[] = []

      for (const update of productUpdates) {
        const start = performance.now()
        
        // Write-through: update DB first, then cache
        await mockDb.updateProductStock(update.id, update.stock)
        await strategicCache.set(
          cacheStrategies.product.stock,
          `stock:${update.id}`,
          update.stock
        )
        
        const writeTime = performance.now() - start
        writeThroughTimes.push(writeTime)
        recordWriteOperation(writeTime)
      }

      // Compare with DB-only writes
      console.log('Testing DB-only writes for comparison...')
      const dbOnlyTimes: number[] = []

      for (const update of productUpdates) {
        const start = performance.now()
        await mockDb.updateProductStock(update.id + 100, update.stock) // Different IDs
        const dbTime = performance.now() - start
        dbOnlyTimes.push(dbTime)
        recordDbQuery(dbTime)
      }

      const avgWriteThroughTime = writeThroughTimes.reduce((sum, time) => sum + time, 0) / writeThroughTimes.length
      const avgDbTime = dbOnlyTimes.reduce((sum, time) => sum + time, 0) / dbOnlyTimes.length
      const overhead = avgWriteThroughTime / avgDbTime

      expect(overhead).toBeLessThan(PERFORMANCE_THRESHOLDS.WRITE_THROUGH_OVERHEAD)

      console.log(`Write-Through Overhead: ${overhead.toFixed(2)}x (${avgWriteThroughTime.toFixed(2)}ms vs ${avgDbTime.toFixed(2)}ms)`)
    })

    it('should test write-behind pattern with batch updates', async () => {
      const batchSize = 10
      const totalUpdates = 50

      // Simulate write-behind with batching
      const writeBehindQueue: Array<{ id: number, stock: number, timestamp: number }> = []
      const writeBehindTimes: number[] = []

      console.log('Testing write-behind pattern with batching...')

      for (let i = 0; i < totalUpdates; i++) {
        const update = { id: i + 1, stock: Math.floor(Math.random() * 1000), timestamp: Date.now() }
        const start = performance.now()

        // Write-behind: update cache immediately, queue for DB
        await strategicCache.set(
          cacheStrategies.product.stock,
          `stock:${update.id}`,
          update.stock
        )
        
        writeBehindQueue.push(update)
        const cacheTime = performance.now() - start
        writeBehindTimes.push(cacheTime)

        // Process batch when queue is full
        if (writeBehindQueue.length >= batchSize) {
          const batchStart = performance.now()
          
          // Simulate batch DB update
          const batch = writeBehindQueue.splice(0, batchSize)
          for (const item of batch) {
            await mockDb.updateProductStock(item.id, item.stock)
          }
          
          const batchTime = performance.now() - batchStart
          console.log(`Batch processed: ${batch.length} items in ${batchTime.toFixed(2)}ms`)
        }
      }

      // Process remaining items
      if (writeBehindQueue.length > 0) {
        for (const item of writeBehindQueue) {
          await mockDb.updateProductStock(item.id, item.stock)
        }
      }

      const avgWriteBehindTime = writeBehindTimes.reduce((sum, time) => sum + time, 0) / writeBehindTimes.length

      // Write-behind cache updates should be very fast
      expect(avgWriteBehindTime).toBeLessThan(5) // Under 5ms for cache-only writes

      console.log(`Write-Behind Cache Performance: ${avgWriteBehindTime.toFixed(2)}ms avg per operation`)
    })
  })

  describe('Complex Query Caching Performance', () => {
    it('should optimize complex aggregation queries with caching', async () => {
      const reportQueries = [
        'inventory_summary',
        'low_stock_alert',
        'movement_analysis',
        'location_utilization',
        'product_performance'
      ]

      console.log('Testing complex query caching...')

      for (const queryType of reportQueries) {
        // First execution - DB query + cache
        const coldStart = performance.now()
        const dbResult = await mockDb.getInventoryReport()
        await strategicCache.set(
          cacheStrategies.system.config,
          `report:${queryType}`,
          dbResult,
          3600 // 1 hour TTL for reports
        )
        const coldTime = performance.now() - coldStart
        recordCacheMiss(coldTime)

        // Subsequent executions - cache only
        const warmTimes: number[] = []
        for (let i = 0; i < 10; i++) {
          const warmStart = performance.now()
          const cachedResult = await strategicCache.get(
            cacheStrategies.system.config,
            `report:${queryType}`
          )
          const warmTime = performance.now() - warmStart
          warmTimes.push(warmTime)
          recordCacheHit(warmTime)

          expect(cachedResult).toEqual(dbResult)
        }

        const avgWarmTime = warmTimes.reduce((sum, time) => sum + time, 0) / warmTimes.length
        const speedup = coldTime / avgWarmTime

        expect(speedup).toBeGreaterThan(PERFORMANCE_THRESHOLDS.COMPLEX_QUERY_CACHE_BENEFIT)

        console.log(`${queryType}: ${speedup.toFixed(1)}x speedup (${coldTime.toFixed(2)}ms -> ${avgWarmTime.toFixed(2)}ms)`)
      }
    })

    it('should handle cache invalidation efficiently for complex queries', async () => {
      const dependentQueries = [
        'product_summary',
        'category_totals',
        'stock_levels',
        'recent_activity'
      ]

      // Cache multiple dependent queries
      for (const query of dependentQueries) {
        const result = await mockDb.getProductsWithStock()
        await strategicCache.set(
          cacheStrategies.product.details,
          `complex:${query}`,
          result,
          { tags: ['products', 'stock', 'reports'] }
        )
      }

      // Measure invalidation performance
      const invalidationStart = performance.now()
      const invalidatedCount = await cacheService.invalidateByTags(['products', 'stock'])
      const invalidationTime = performance.now() - invalidationStart
      
      recordInvalidation(invalidationTime)

      expect(invalidatedCount).toBeGreaterThan(0)
      expect(invalidationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.INVALIDATION_TIME)

      // Verify queries are invalidated
      for (const query of dependentQueries) {
        const cachedResult = await strategicCache.get(
          cacheStrategies.product.details,
          `complex:${query}`
        )
        expect(cachedResult).toBeNull()
      }

      console.log(`Cache Invalidation: ${invalidatedCount} entries in ${invalidationTime.toFixed(2)}ms`)
    })
  })

  describe('Database Failover with Cache Fallback', () => {
    it('should gracefully handle database unavailability', async () => {
      const productId = 999
      const fallbackData = { id: productId, name: 'Cached Product', stock: 100 }

      // Pre-populate cache
      await strategicCache.set(
        cacheStrategies.product.details,
        `failover:${productId}`,
        fallbackData
      )

      // Simulate database failure by using invalid query
      const mockFailedDb = {
        getProduct: async () => {
          throw new Error('Database connection failed')
        }
      }

      // Test failover logic
      const failoverStart = performance.now()
      let result = null
      let dbError = null

      try {
        result = await mockFailedDb.getProduct(productId)
      } catch (error) {
        dbError = error
        // Fallback to cache
        result = await strategicCache.get(
          cacheStrategies.product.details,
          `failover:${productId}`
        )
      }

      const failoverTime = performance.now() - failoverStart

      expect(dbError).toBeDefined()
      expect(result).toEqual(fallbackData)
      expect(failoverTime).toBeLessThan(50) // Failover should be fast

      console.log(`Database Failover: Retrieved from cache in ${failoverTime.toFixed(2)}ms`)
    })

    it('should handle partial database degradation', async () => {
      const criticalQueries = ['user_auth', 'active_sessions', 'security_config']
      const nonCriticalQueries = ['reports', 'analytics', 'suggestions']

      // Simulate degraded database (slow responses for non-critical)
      const degradedDb = {
        executeQuery: async (type: string) => {
          if (nonCriticalQueries.some(q => type.includes(q))) {
            // Simulate timeout for non-critical queries
            await new Promise(resolve => setTimeout(resolve, 5000))
            throw new Error('Query timeout')
          }
          return mockDb.executeQuery('simple', `SELECT * FROM ${type}`)
        }
      }

      const results = []
      
      // Test mixed critical and non-critical queries
      for (const queryType of [...criticalQueries, ...nonCriticalQueries]) {
        const start = performance.now()
        let result = null
        
        try {
          result = await degradedDb.executeQuery(queryType)
        } catch (error) {
          // Fallback to cache for failed queries
          result = await strategicCache.get(
            cacheStrategies.system.config,
            `degraded:${queryType}`
          ) || { type: queryType, cached: true, timestamp: Date.now() }
        }
        
        const queryTime = performance.now() - start
        results.push({ queryType, result, queryTime, cached: !result || result.cached })
      }

      // Critical queries should succeed quickly
      const criticalResults = results.filter(r => criticalQueries.includes(r.queryType))
      const nonCriticalResults = results.filter(r => nonCriticalQueries.includes(r.queryType))

      criticalResults.forEach(r => {
        expect(r.queryTime).toBeLessThan(100)
        expect(r.result).toBeDefined()
      })

      // Non-critical queries should fallback to cache quickly
      nonCriticalResults.forEach(r => {
        expect(r.cached).toBe(true)
        expect(r.queryTime).toBeLessThan(1000) // Much faster than 5s timeout
      })

      console.log('Database Degradation Test:')
      results.forEach(r => {
        console.log(`  ${r.queryType}: ${r.queryTime.toFixed(2)}ms ${r.cached ? '(cached)' : '(db)'}`)
      })
    })
  })

  describe('Cache Warming and Preloading', () => {
    it('should efficiently warm cache with frequently accessed data', async () => {
      const frequentlyAccessedIds = Array.from({ length: 100 }, (_, i) => i + 1)
      
      console.log('Testing cache warming performance...')
      const warmingStart = performance.now()

      // Parallel cache warming
      const warmingPromises = frequentlyAccessedIds.map(async (id) => {
        const opStart = performance.now()
        try {
          const data = await mockDb.getProduct(id)
          await strategicCache.set(
            cacheStrategies.product.details,
            `warm:${id}`,
            data
          )
          recordCacheMiss(performance.now() - opStart)
        } catch (error) {
          console.error(`Failed to warm cache for product ${id}:`, error)
        }
      })

      await Promise.all(warmingPromises)
      const warmingTime = performance.now() - warmingStart

      // Test the warmed cache performance
      console.log('Testing warmed cache access...')
      const accessStart = performance.now()
      
      const accessPromises = frequentlyAccessedIds.slice(0, 50).map(async (id) => {
        const opStart = performance.now()
        const result = await strategicCache.get(
          cacheStrategies.product.details,
          `warm:${id}`
        )
        recordCacheHit(performance.now() - opStart)
        return result
      })

      const results = await Promise.all(accessPromises)
      const accessTime = performance.now() - accessStart

      const successfulWarms = results.filter(r => r !== null).length
      const warmingRate = (frequentlyAccessedIds.length * 1000) / warmingTime
      const accessRate = (results.length * 1000) / accessTime

      expect(successfulWarms).toBeGreaterThan(frequentlyAccessedIds.length * 0.95) // 95% success
      expect(warmingRate).toBeGreaterThan(10) // At least 10 items/sec warming
      expect(accessRate).toBeGreaterThan(100) // At least 100 items/sec access

      console.log(`Cache Warming: ${frequentlyAccessedIds.length} items in ${warmingTime.toFixed(2)}ms (${warmingRate.toFixed(1)} items/sec)`)
      console.log(`Warmed Access: ${results.length} items in ${accessTime.toFixed(2)}ms (${accessRate.toFixed(1)} items/sec)`)
    })
  })

  // Helper functions
  function resetMetrics(): void {
    performanceMetrics = {
      cacheHits: { count: 0, totalTime: 0 },
      cacheMisses: { count: 0, totalTime: 0 },
      dbOnlyQueries: { count: 0, totalTime: 0 },
      writeOperations: { count: 0, totalTime: 0 },
      invalidations: { count: 0, totalTime: 0 }
    }
  }

  function recordCacheHit(time: number): void {
    performanceMetrics.cacheHits.count++
    performanceMetrics.cacheHits.totalTime += time
  }

  function recordCacheMiss(time: number): void {
    performanceMetrics.cacheMisses.count++
    performanceMetrics.cacheMisses.totalTime += time
  }

  function recordDbQuery(time: number): void {
    performanceMetrics.dbOnlyQueries.count++
    performanceMetrics.dbOnlyQueries.totalTime += time
  }

  function recordWriteOperation(time: number): void {
    performanceMetrics.writeOperations.count++
    performanceMetrics.writeOperations.totalTime += time
  }

  function recordInvalidation(time: number): void {
    performanceMetrics.invalidations.count++
    performanceMetrics.invalidations.totalTime += time
  }

  function generateIntegrationReport(): void {
    const report = {
      cachePerformance: {
        hitRatio: performanceMetrics.cacheHits.count / (performanceMetrics.cacheHits.count + performanceMetrics.cacheMisses.count),
        avgHitTime: performanceMetrics.cacheHits.totalTime / performanceMetrics.cacheHits.count,
        avgMissTime: performanceMetrics.cacheMisses.totalTime / performanceMetrics.cacheMisses.count,
        speedupRatio: (performanceMetrics.dbOnlyQueries.totalTime / performanceMetrics.dbOnlyQueries.count) / 
                     (performanceMetrics.cacheHits.totalTime / performanceMetrics.cacheHits.count)
      },
      writePerformance: {
        avgWriteTime: performanceMetrics.writeOperations.totalTime / performanceMetrics.writeOperations.count,
        avgDbTime: performanceMetrics.dbOnlyQueries.totalTime / performanceMetrics.dbOnlyQueries.count,
        writeOverhead: (performanceMetrics.writeOperations.totalTime / performanceMetrics.writeOperations.count) /
                      (performanceMetrics.dbOnlyQueries.totalTime / performanceMetrics.dbOnlyQueries.count)
      },
      invalidationPerformance: {
        avgInvalidationTime: performanceMetrics.invalidations.totalTime / performanceMetrics.invalidations.count,
        totalInvalidations: performanceMetrics.invalidations.count
      }
    }

    console.log('\n=== POSTGRESQL CACHE INTEGRATION REPORT ===')
    console.log(`Cache Hit Ratio: ${(report.cachePerformance.hitRatio * 100).toFixed(2)}%`)
    console.log(`Cache Speedup: ${report.cachePerformance.speedupRatio.toFixed(2)}x`)
    console.log(`Hit Time: ${report.cachePerformance.avgHitTime.toFixed(2)}ms`)
    console.log(`Miss Time: ${report.cachePerformance.avgMissTime.toFixed(2)}ms`)
    console.log(`Write Overhead: ${report.writePerformance.writeOverhead.toFixed(2)}x`)
    console.log(`Avg Invalidation: ${report.invalidationPerformance.avgInvalidationTime.toFixed(2)}ms`)
  }
})