/**
 * Cache Performance Testing Suite
 * 
 * Comprehensive cache performance tests covering:
 * - Redis throughput and latency benchmarks
 * - Cache hit ratio analysis
 * - Memory usage and leak detection
 * - Load testing for concurrent operations
 * - Performance regression detection
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { performance } from 'perf_hooks'
import { cacheService } from '../../infrastructure/cache/cache.service.js'
import { strategicCache, cacheStrategies } from '../../infrastructure/cache/strategies.js'
import { redisClient } from '../../infrastructure/cache/redis.client.js'

describe('Cache Performance Testing', () => {
  const PERFORMANCE_THRESHOLDS = {
    REDIS_SET_LATENCY: 5, // ms - Redis should be very fast
    REDIS_GET_LATENCY: 3, // ms
    CACHE_HIT_RATIO_MIN: 0.8, // 80% minimum hit ratio for repeated operations
    THROUGHPUT_MIN: 1000, // operations per second
    MEMORY_LEAK_THRESHOLD: 50, // MB - max memory increase after operations
    BULK_OPERATION_TIME: 1000, // ms for 1000 operations
    CONCURRENT_OPERATIONS: 100,
    STRESS_TEST_DURATION: 30000, // 30 seconds
  }

  const testData = {
    small: { size: 'small', data: 'x'.repeat(100) }, // 100 bytes
    medium: { size: 'medium', data: 'x'.repeat(10000) }, // 10KB
    large: { size: 'large', data: 'x'.repeat(100000) }, // 100KB
  }

  let performanceMetrics: {
    operations: Array<{
      operation: string
      latency: number
      success: boolean
      timestamp: number
      payloadSize?: number
    }>
    startTime: number
  } = {
    operations: [],
    startTime: 0
  }

  beforeAll(async () => {
    // Ensure Redis is connected and clean
    if (!redisClient.isReady) {
      await redisClient.connect()
    }
    await cacheService.clear()
    performanceMetrics.startTime = Date.now()
  })

  afterAll(async () => {
    await cacheService.clear()
    // Generate performance report
    generatePerformanceReport()
  })

  beforeEach(() => {
    performanceMetrics.operations = []
  })

  afterEach(async () => {
    // Clean up test data after each test
    await cacheService.clear()
  })

  describe('Redis Latency Benchmarks', () => {
    it('should achieve sub-5ms SET operations', async () => {
      const testKey = 'latency:set:test'
      const testValue = testData.small
      const iterations = 100

      const latencies: number[] = []
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        await cacheService.set(testKey + i, testValue)
        const latency = performance.now() - start
        
        latencies.push(latency)
        recordOperation('redis_set', latency, true, JSON.stringify(testValue).length)
      }

      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)]
      const maxLatency = Math.max(...latencies)

      expect(avgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.REDIS_SET_LATENCY)
      expect(p95Latency).toBeLessThan(PERFORMANCE_THRESHOLDS.REDIS_SET_LATENCY * 2)

      console.log(`SET Latency - Avg: ${avgLatency.toFixed(2)}ms, P95: ${p95Latency.toFixed(2)}ms, Max: ${maxLatency.toFixed(2)}ms`)
    })

    it('should achieve sub-3ms GET operations', async () => {
      const testKey = 'latency:get:test'
      const testValue = testData.small
      const iterations = 100

      // Pre-populate cache
      for (let i = 0; i < iterations; i++) {
        await cacheService.set(testKey + i, testValue)
      }

      const latencies: number[] = []
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        const result = await cacheService.get(testKey + i)
        const latency = performance.now() - start
        
        expect(result).toBeDefined()
        latencies.push(latency)
        recordOperation('redis_get', latency, true)
      }

      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)]

      expect(avgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.REDIS_GET_LATENCY)
      expect(p95Latency).toBeLessThan(PERFORMANCE_THRESHOLDS.REDIS_GET_LATENCY * 2)

      console.log(`GET Latency - Avg: ${avgLatency.toFixed(2)}ms, P95: ${p95Latency.toFixed(2)}ms`)
    })

    it('should handle different payload sizes efficiently', async () => {
      const payloadTests = [
        { name: 'small', data: testData.small, threshold: 2 },
        { name: 'medium', data: testData.medium, threshold: 5 },
        { name: 'large', data: testData.large, threshold: 10 },
      ]

      for (const { name, data, threshold } of payloadTests) {
        const iterations = 50
        const latencies: number[] = []

        for (let i = 0; i < iterations; i++) {
          const start = performance.now()
          await cacheService.set(`payload:${name}:${i}`, data)
          const setLatency = performance.now() - start

          const getStart = performance.now()
          await cacheService.get(`payload:${name}:${i}`)
          const getLatency = performance.now() - getStart

          latencies.push(setLatency, getLatency)
        }

        const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
        expect(avgLatency).toBeLessThan(threshold)

        console.log(`${name.toUpperCase()} payload - Avg latency: ${avgLatency.toFixed(2)}ms`)
      }
    })
  })

  describe('Cache Hit Ratio Analysis', () => {
    it('should achieve high hit ratio for repeated operations', async () => {
      const testKey = 'hitratio:test'
      const testValue = { id: 1, data: 'test data', timestamp: Date.now() }
      
      // Set initial data
      await cacheService.set(testKey, testValue)
      
      let hits = 0
      let misses = 0
      const iterations = 100

      for (let i = 0; i < iterations; i++) {
        const initialStats = cacheService.getStats()
        const result = await cacheService.get(testKey)
        const finalStats = cacheService.getStats()

        if (result !== null) {
          hits++
          recordOperation('cache_hit', 0, true)
        } else {
          misses++
          recordOperation('cache_miss', 0, false)
        }
      }

      const hitRatio = hits / (hits + misses)
      expect(hitRatio).toBeGreaterThan(PERFORMANCE_THRESHOLDS.CACHE_HIT_RATIO_MIN)

      console.log(`Hit Ratio: ${(hitRatio * 100).toFixed(2)}% (${hits} hits, ${misses} misses)`)
    })

    it('should track cache statistics accurately', async () => {
      await cacheService.clear() // Reset stats
      
      const testOperations = [
        { key: 'stats:1', value: 'data1' },
        { key: 'stats:2', value: 'data2' },
        { key: 'stats:3', value: 'data3' },
      ]

      // Perform SET operations
      for (const { key, value } of testOperations) {
        await cacheService.set(key, value)
      }

      // Perform GET operations (hits)
      for (const { key } of testOperations) {
        await cacheService.get(key)
      }

      // Perform GET operations on non-existent keys (misses)
      for (let i = 0; i < 5; i++) {
        await cacheService.get(`nonexistent:${i}`)
      }

      const stats = cacheService.getStats()
      
      expect(stats.sets).toBe(testOperations.length)
      expect(stats.hits).toBe(testOperations.length)
      expect(stats.misses).toBe(5)
      expect(stats.avgLatency).toBeGreaterThan(0)

      console.log('Cache Stats:', stats)
    })
  })

  describe('Throughput Benchmarks', () => {
    it('should handle high-throughput SET operations', async () => {
      const iterations = 1000
      const startTime = performance.now()

      const promises = Array.from({ length: iterations }, async (_, i) => {
        const opStart = performance.now()
        try {
          await cacheService.set(`throughput:set:${i}`, { id: i, data: `data-${i}` })
          recordOperation('throughput_set', performance.now() - opStart, true)
        } catch (error) {
          recordOperation('throughput_set', performance.now() - opStart, false)
        }
      })

      await Promise.all(promises)
      const totalTime = performance.now() - startTime
      const opsPerSecond = (iterations * 1000) / totalTime

      expect(opsPerSecond).toBeGreaterThan(PERFORMANCE_THRESHOLDS.THROUGHPUT_MIN)
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_TIME)

      console.log(`SET Throughput: ${opsPerSecond.toFixed(0)} ops/sec (${iterations} ops in ${totalTime.toFixed(2)}ms)`)
    })

    it('should handle high-throughput GET operations', async () => {
      const iterations = 1000

      // Pre-populate cache
      for (let i = 0; i < iterations; i++) {
        await cacheService.set(`throughput:get:${i}`, { id: i, data: `data-${i}` })
      }

      const startTime = performance.now()

      const promises = Array.from({ length: iterations }, async (_, i) => {
        const opStart = performance.now()
        try {
          const result = await cacheService.get(`throughput:get:${i}`)
          recordOperation('throughput_get', performance.now() - opStart, result !== null)
        } catch (error) {
          recordOperation('throughput_get', performance.now() - opStart, false)
        }
      })

      await Promise.all(promises)
      const totalTime = performance.now() - startTime
      const opsPerSecond = (iterations * 1000) / totalTime

      expect(opsPerSecond).toBeGreaterThan(PERFORMANCE_THRESHOLDS.THROUGHPUT_MIN)

      console.log(`GET Throughput: ${opsPerSecond.toFixed(0)} ops/sec (${iterations} ops in ${totalTime.toFixed(2)}ms)`)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent read/write operations', async () => {
      const concurrentOps = PERFORMANCE_THRESHOLDS.CONCURRENT_OPERATIONS
      const startTime = performance.now()

      // Mix of read and write operations
      const operations = Array.from({ length: concurrentOps }, (_, i) => {
        if (i % 2 === 0) {
          // Write operation
          return async () => {
            const opStart = performance.now()
            try {
              await cacheService.set(`concurrent:${i}`, { id: i, timestamp: Date.now() })
              recordOperation('concurrent_write', performance.now() - opStart, true)
            } catch (error) {
              recordOperation('concurrent_write', performance.now() - opStart, false)
            }
          }
        } else {
          // Read operation (may miss initially)
          return async () => {
            const opStart = performance.now()
            try {
              const result = await cacheService.get(`concurrent:${i - 1}`)
              recordOperation('concurrent_read', performance.now() - opStart, result !== null)
            } catch (error) {
              recordOperation('concurrent_read', performance.now() - opStart, false)
            }
          }
        }
      })

      const results = await Promise.allSettled(operations.map(op => op()))
      const totalTime = performance.now() - startTime
      
      const successful = results.filter(r => r.status === 'fulfilled').length
      const successRate = successful / results.length

      expect(successRate).toBeGreaterThan(0.95) // 95% success rate
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_TIME)

      console.log(`Concurrent Operations: ${successful}/${results.length} successful in ${totalTime.toFixed(2)}ms`)
    })

    it('should handle cache invalidation under load', async () => {
      const testKey = 'invalidation:test'
      const iterations = 50

      // Pre-populate cache
      await cacheService.set(testKey, { data: 'initial' }, { tags: ['test-tag'] })

      const operations = Array.from({ length: iterations }, async (_, i) => {
        if (i % 10 === 0) {
          // Invalidation operation
          const opStart = performance.now()
          try {
            await cacheService.invalidateByTags(['test-tag'])
            recordOperation('invalidation', performance.now() - opStart, true)
            // Repopulate
            await cacheService.set(testKey, { data: `updated-${i}` }, { tags: ['test-tag'] })
          } catch (error) {
            recordOperation('invalidation', performance.now() - opStart, false)
          }
        } else {
          // Read operation
          const opStart = performance.now()
          try {
            const result = await cacheService.get(testKey)
            recordOperation('read_during_invalidation', performance.now() - opStart, result !== null)
          } catch (error) {
            recordOperation('read_during_invalidation', performance.now() - opStart, false)
          }
        }
      })

      const startTime = performance.now()
      await Promise.all(operations)
      const totalTime = performance.now() - startTime

      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_TIME * 2)

      console.log(`Cache invalidation under load completed in ${totalTime.toFixed(2)}ms`)
    })
  })

  describe('Memory Usage and Leak Detection', () => {
    it('should not leak memory during extended operations', async () => {
      const initialMemory = process.memoryUsage()
      const iterations = 1000

      // Perform memory-intensive operations
      for (let i = 0; i < iterations; i++) {
        const largeData = {
          id: i,
          data: 'x'.repeat(10000), // 10KB per object
          timestamp: Date.now(),
          metadata: Array.from({ length: 100 }, (_, j) => ({ index: j, value: Math.random() }))
        }

        await cacheService.set(`memory:test:${i}`, largeData, { ttl: 10 }) // Short TTL

        // Periodic cleanup
        if (i % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10)) // Allow TTL expiration
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      await new Promise(resolve => setTimeout(resolve, 100)) // Allow cleanup

      const finalMemory = process.memoryUsage()
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024 // MB

      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD)

      console.log(`Memory Usage - Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB, Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB, Increase: ${memoryIncrease.toFixed(2)}MB`)
    })

    it('should efficiently handle large object serialization', async () => {
      const largeObject = {
        array: Array.from({ length: 10000 }, (_, i) => ({ id: i, value: Math.random() })),
        string: 'x'.repeat(100000),
        nested: {
          level1: {
            level2: {
              level3: Array.from({ length: 1000 }, (_, i) => `nested-${i}`)
            }
          }
        }
      }

      const testKey = 'serialization:large'
      
      const setStart = performance.now()
      await cacheService.set(testKey, largeObject)
      const setTime = performance.now() - setStart

      const getStart = performance.now()
      const retrieved = await cacheService.get(testKey)
      const getTime = performance.now() - getStart

      expect(retrieved).toBeDefined()
      expect(setTime).toBeLessThan(100) // Should serialize in under 100ms
      expect(getTime).toBeLessThan(50)  // Should deserialize in under 50ms

      console.log(`Large object serialization - Set: ${setTime.toFixed(2)}ms, Get: ${getTime.toFixed(2)}ms`)
    })
  })

  describe('Strategic Cache Performance', () => {
    it('should optimize performance based on cache strategies', async () => {
      const strategies = [
        { name: 'product:details', strategy: cacheStrategies.product.details },
        { name: 'product:stock', strategy: cacheStrategies.product.stock },
        { name: 'user:profile', strategy: cacheStrategies.user.profile },
        { name: 'system:config', strategy: cacheStrategies.system.config },
      ]

      for (const { name, strategy } of strategies) {
        const testData = { type: name, data: `data-for-${name}`, timestamp: Date.now() }
        const iterations = 50
        const latencies: number[] = []

        for (let i = 0; i < iterations; i++) {
          const start = performance.now()
          await strategicCache.set(strategy, `test:${i}`, testData)
          const setLatency = performance.now() - start

          const getStart = performance.now()
          await strategicCache.get(strategy, `test:${i}`)
          const getLatency = performance.now() - getStart

          latencies.push(setLatency, getLatency)
        }

        const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
        
        // Strategy-specific thresholds
        const threshold = strategy.defaultTtl < 600 ? 5 : 10 // Shorter TTL = more performance critical
        expect(avgLatency).toBeLessThan(threshold)

        console.log(`Strategy ${name} - Avg latency: ${avgLatency.toFixed(2)}ms`)
      }
    })

    it('should handle getOrSet pattern efficiently', async () => {
      const strategy = cacheStrategies.product.details
      const testKey = 'getOrSet:performance'
      let fetchCalls = 0

      const fetchFunction = async () => {
        fetchCalls++
        await new Promise(resolve => setTimeout(resolve, 50)) // Simulate DB call
        return { id: 1, data: 'fetched data', timestamp: Date.now() }
      }

      // First call - cache miss, should fetch
      const start1 = performance.now()
      const result1 = await strategicCache.getOrSet(strategy, testKey, fetchFunction)
      const time1 = performance.now() - start1

      // Second call - cache hit, should not fetch
      const start2 = performance.now()
      const result2 = await strategicCache.getOrSet(strategy, testKey, fetchFunction)
      const time2 = performance.now() - start2

      expect(fetchCalls).toBe(1) // Should only fetch once
      expect(result1).toEqual(result2)
      expect(time2).toBeLessThan(time1) // Cache hit should be faster
      expect(time2).toBeLessThan(10) // Cache hit should be very fast

      console.log(`GetOrSet pattern - First: ${time1.toFixed(2)}ms, Second: ${time2.toFixed(2)}ms`)
    })
  })

  describe('Distributed Lock Performance', () => {
    it('should handle lock acquisition efficiently', async () => {
      const resource = 'performance-test-resource'
      const iterations = 50
      const lockLatencies: number[] = []

      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        const lockValue = await cacheService.acquireLock(resource, 1000, 500)
        const lockTime = performance.now() - start

        expect(lockValue).toBeDefined()
        
        const releaseStart = performance.now()
        const released = await cacheService.releaseLock(resource, lockValue!)
        const releaseTime = performance.now() - releaseStart
        
        expect(released).toBe(true)
        
        lockLatencies.push(lockTime, releaseTime)
      }

      const avgLatency = lockLatencies.reduce((sum, lat) => sum + lat, 0) / lockLatencies.length
      expect(avgLatency).toBeLessThan(10) // Lock operations should be fast

      console.log(`Distributed lock - Avg latency: ${avgLatency.toFixed(2)}ms`)
    })

    it('should handle lock contention gracefully', async () => {
      const resource = 'contention-test-resource'
      const concurrentRequests = 20
      const lockDuration = 100

      const lockPromises = Array.from({ length: concurrentRequests }, async (_, i) => {
        const start = performance.now()
        try {
          const lockValue = await cacheService.acquireLock(resource, lockDuration, 1000)
          const acquiredTime = performance.now() - start
          
          if (lockValue) {
            // Hold lock briefly
            await new Promise(resolve => setTimeout(resolve, 50))
            
            const released = await cacheService.releaseLock(resource, lockValue)
            recordOperation('lock_acquired', acquiredTime, released)
            return { acquired: true, time: acquiredTime }
          } else {
            recordOperation('lock_timeout', acquiredTime, false)
            return { acquired: false, time: acquiredTime }
          }
        } catch (error) {
          const failedTime = performance.now() - start
          recordOperation('lock_error', failedTime, false)
          return { acquired: false, time: failedTime }
        }
      })

      const results = await Promise.all(lockPromises)
      const successful = results.filter(r => r.acquired).length
      const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length

      // At least some should succeed, but not all concurrently
      expect(successful).toBeGreaterThan(0)
      expect(successful).toBeLessThan(concurrentRequests)
      expect(avgTime).toBeLessThan(1000) // Should not take too long

      console.log(`Lock contention - ${successful}/${concurrentRequests} acquired, avg time: ${avgTime.toFixed(2)}ms`)
    })
  })

  describe('Health Check Performance', () => {
    it('should perform health checks quickly', async () => {
      const iterations = 20
      const healthLatencies: number[] = []

      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        const health = await cacheService.healthCheck()
        const latency = performance.now() - start

        expect(health.status).toBe('healthy')
        expect(health.latency).toBeDefined()
        
        healthLatencies.push(latency)
      }

      const avgLatency = healthLatencies.reduce((sum, lat) => sum + lat, 0) / healthLatencies.length
      expect(avgLatency).toBeLessThan(20) // Health checks should be fast

      console.log(`Health check - Avg latency: ${avgLatency.toFixed(2)}ms`)
    })
  })

  // Helper functions
  function recordOperation(operation: string, latency: number, success: boolean, payloadSize?: number): void {
    performanceMetrics.operations.push({
      operation,
      latency,
      success,
      timestamp: Date.now(),
      payloadSize
    })
  }

  function generatePerformanceReport(): void {
    const report = {
      testDuration: Date.now() - performanceMetrics.startTime,
      totalOperations: performanceMetrics.operations.length,
      operationsByType: {} as Record<string, {
        count: number
        avgLatency: number
        successRate: number
        totalPayloadSize?: number
      }>,
      overallStats: {
        avgLatency: 0,
        successRate: 0,
        operationsPerSecond: 0
      }
    }

    // Group operations by type
    const operationGroups = performanceMetrics.operations.reduce((groups, op) => {
      if (!groups[op.operation]) {
        groups[op.operation] = []
      }
      groups[op.operation].push(op)
      return groups
    }, {} as Record<string, typeof performanceMetrics.operations>)

    // Calculate stats for each operation type
    Object.entries(operationGroups).forEach(([type, operations]) => {
      const latencies = operations.map(op => op.latency)
      const successes = operations.filter(op => op.success).length
      const totalPayload = operations.reduce((sum, op) => sum + (op.payloadSize || 0), 0)

      report.operationsByType[type] = {
        count: operations.length,
        avgLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
        successRate: successes / operations.length,
        ...(totalPayload > 0 && { totalPayloadSize: totalPayload })
      }
    })

    // Calculate overall stats
    const allLatencies = performanceMetrics.operations.map(op => op.latency)
    const allSuccesses = performanceMetrics.operations.filter(op => op.success).length

    report.overallStats = {
      avgLatency: allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length,
      successRate: allSuccesses / performanceMetrics.operations.length,
      operationsPerSecond: (performanceMetrics.operations.length * 1000) / report.testDuration
    }

    console.log('\n=== CACHE PERFORMANCE REPORT ===')
    console.log(`Test Duration: ${report.testDuration}ms`)
    console.log(`Total Operations: ${report.totalOperations}`)
    console.log(`Operations/sec: ${report.overallStats.operationsPerSecond.toFixed(2)}`)
    console.log(`Overall Success Rate: ${(report.overallStats.successRate * 100).toFixed(2)}%`)
    console.log(`Overall Avg Latency: ${report.overallStats.avgLatency.toFixed(2)}ms`)
    
    console.log('\nOperation Breakdown:')
    Object.entries(report.operationsByType).forEach(([type, stats]) => {
      console.log(`  ${type}: ${stats.count} ops, ${stats.avgLatency.toFixed(2)}ms avg, ${(stats.successRate * 100).toFixed(2)}% success`)
    })
  }
})