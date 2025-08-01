/**
 * Cache Monitoring and Alerting Tests
 * 
 * Tests for cache performance monitoring, alerting, and metrics collection:
 * - Real-time hit ratio monitoring
 * - Performance degradation detection
 * - Memory usage alerts
 * - Automated performance regression detection
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { performance } from 'perf_hooks'
import { cacheService } from '../../infrastructure/cache/cache.service.js'
import { strategicCache, cacheStrategies } from '../../infrastructure/cache/strategies.js'
import { redisClient } from '../../infrastructure/cache/redis.client.js'

interface PerformanceBaseline {
  operation: string
  avgLatency: number
  p95Latency: number
  throughput: number
  hitRatio: number
  timestamp: number
}

interface AlertRule {
  metric: string
  operator: 'gt' | 'lt' | 'eq'
  threshold: number
  severity: 'warning' | 'error' | 'critical'
}

class CacheMonitor {
  private baselines: Map<string, PerformanceBaseline> = new Map()
  private alerts: Array<{
    rule: AlertRule
    value: number
    timestamp: number
    message: string
  }> = []

  private alertRules: AlertRule[] = [
    { metric: 'hit_ratio', operator: 'lt', threshold: 0.8, severity: 'warning' },
    { metric: 'hit_ratio', operator: 'lt', threshold: 0.6, severity: 'error' },
    { metric: 'avg_latency', operator: 'gt', threshold: 10, severity: 'warning' },
    { metric: 'avg_latency', operator: 'gt', threshold: 50, severity: 'error' },
    { metric: 'throughput', operator: 'lt', threshold: 500, severity: 'warning' },
    { metric: 'memory_usage', operator: 'gt', threshold: 100, severity: 'warning' },
  ]

  recordBaseline(operation: string, metrics: Omit<PerformanceBaseline, 'operation' | 'timestamp'>): void {
    this.baselines.set(operation, {
      operation,
      ...metrics,
      timestamp: Date.now()
    })
  }

  checkAlert(metric: string, value: number): void {
    const applicableRules = this.alertRules.filter(rule => rule.metric === metric)
    
    for (const rule of applicableRules) {
      let triggered = false
      
      switch (rule.operator) {
        case 'gt':
          triggered = value > rule.threshold
          break
        case 'lt':
          triggered = value < rule.threshold
          break
        case 'eq':
          triggered = value === rule.threshold
          break
      }
      
      if (triggered) {
        this.alerts.push({
          rule,
          value,
          timestamp: Date.now(),
          message: `${rule.severity.toUpperCase()}: ${metric} is ${value}, threshold: ${rule.operator} ${rule.threshold}`
        })
      }
    }
  }

  getAlerts(): typeof this.alerts {
    return [...this.alerts]
  }

  clearAlerts(): void {
    this.alerts = []
  }

  compareWithBaseline(operation: string, currentMetrics: Omit<PerformanceBaseline, 'operation' | 'timestamp'>): {
    regression: boolean
    degradationPercentage: number
    details: string[]
  } {
    const baseline = this.baselines.get(operation)
    if (!baseline) {
      return { regression: false, degradationPercentage: 0, details: ['No baseline available'] }
    }

    const details: string[] = []
    let maxDegradation = 0

    // Check latency regression (increase is bad)
    const latencyChange = ((currentMetrics.avgLatency - baseline.avgLatency) / baseline.avgLatency) * 100
    if (latencyChange > 20) {
      details.push(`Latency increased by ${latencyChange.toFixed(1)}%`)
      maxDegradation = Math.max(maxDegradation, latencyChange)
    }

    // Check throughput regression (decrease is bad)
    const throughputChange = ((baseline.throughput - currentMetrics.throughput) / baseline.throughput) * 100
    if (throughputChange > 20) {
      details.push(`Throughput decreased by ${throughputChange.toFixed(1)}%`)
      maxDegradation = Math.max(maxDegradation, throughputChange)
    }

    // Check hit ratio regression (decrease is bad)
    const hitRatioChange = ((baseline.hitRatio - currentMetrics.hitRatio) / baseline.hitRatio) * 100
    if (hitRatioChange > 10) {
      details.push(`Hit ratio decreased by ${hitRatioChange.toFixed(1)}%`)
      maxDegradation = Math.max(maxDegradation, hitRatioChange)
    }

    return {
      regression: details.length > 0,
      degradationPercentage: maxDegradation,
      details
    }
  }
}

describe('Cache Monitoring and Alerting', () => {
  let monitor: CacheMonitor

  beforeAll(async () => {
    if (!redisClient.isReady) {
      await redisClient.connect()
    }
    monitor = new CacheMonitor()
  })

  afterAll(async () => {
    await cacheService.clear()
  })

  beforeEach(async () => {
    await cacheService.clear()
    monitor.clearAlerts()
  })

  describe('Hit Ratio Monitoring', () => {
    it('should monitor and alert on low hit ratios', async () => {
      const testKeys = Array.from({ length: 100 }, (_, i) => `hitratio:${i}`)
      
      // Pre-populate only 60% of keys (expecting 60% hit ratio)
      for (let i = 0; i < 60; i++) {
        await cacheService.set(testKeys[i], { id: i, data: `data-${i}` })
      }

      let hits = 0
      let misses = 0

      // Access all keys
      for (const key of testKeys) {
        const result = await cacheService.get(key)
        if (result) {
          hits++
        } else {
          misses++
        }
      }

      const hitRatio = hits / (hits + misses)
      monitor.checkAlert('hit_ratio', hitRatio)

      const alerts = monitor.getAlerts()
      const hitRatioAlerts = alerts.filter(alert => alert.rule.metric === 'hit_ratio')

      expect(hitRatio).toBeCloseTo(0.6, 1)
      expect(hitRatioAlerts.length).toBeGreaterThan(0)
      
      const errorAlert = hitRatioAlerts.find(alert => alert.rule.severity === 'error')
      expect(errorAlert).toBeDefined()

      console.log(`Hit Ratio: ${(hitRatio * 100).toFixed(1)}% - Alerts triggered: ${hitRatioAlerts.length}`)
    })

    it('should track hit ratio trends over time', async () => {
      const measurements: Array<{ timestamp: number, hitRatio: number }> = []
      const testKey = 'trend:test'
      
      // Simulate degrading hit ratio over time
      for (let round = 0; round < 5; round++) {
        await cacheService.clear()
        
        // Populate cache with decreasing efficiency
        const populationRatio = 1 - (round * 0.15) // 100%, 85%, 70%, 55%, 40%
        const totalKeys = 50
        const keysToPopulate = Math.floor(totalKeys * populationRatio)
        
        for (let i = 0; i < keysToPopulate; i++) {
          await cacheService.set(`${testKey}:${i}`, { id: i })
        }

        // Measure hit ratio
        let hits = 0
        for (let i = 0; i < totalKeys; i++) {
          const result = await cacheService.get(`${testKey}:${i}`)
          if (result) hits++
        }

        const hitRatio = hits / totalKeys
        measurements.push({ timestamp: Date.now(), hitRatio })
        
        monitor.checkAlert('hit_ratio', hitRatio)
        
        await new Promise(resolve => setTimeout(resolve, 100)) // Brief delay
      }

      const alerts = monitor.getAlerts()
      const trendData = measurements.map(m => m.hitRatio)

      // Should show declining trend
      expect(trendData[0]).toBeGreaterThan(trendData[trendData.length - 1])
      
      // Should trigger alerts as hit ratio degrades
      expect(alerts.length).toBeGreaterThan(0)

      console.log('Hit Ratio Trend:', trendData.map(hr => `${(hr * 100).toFixed(1)}%`).join(' -> '))
      console.log(`Total Alerts: ${alerts.length}`)
    })
  })

  describe('Latency Monitoring', () => {
    it('should detect latency spikes and alert', async () => {
      const normalOperations = 50
      const spikeOperations = 10

      // Perform normal operations to establish baseline
      const normalLatencies: number[] = []
      for (let i = 0; i < normalOperations; i++) {
        const start = performance.now()
        await cacheService.set(`normal:${i}`, { data: `normal-${i}` })
        normalLatencies.push(performance.now() - start)
      }

      const normalAvgLatency = normalLatencies.reduce((sum, lat) => sum + lat, 0) / normalLatencies.length
      
      // Simulate latency spikes with large payloads and delays
      const spikeLatencies: number[] = []
      for (let i = 0; i < spikeOperations; i++) {
        const largePayload = {
          id: i,
          data: 'x'.repeat(100000), // 100KB
          array: Array.from({ length: 1000 }, (_, j) => ({ index: j, value: Math.random() }))
        }
        
        const start = performance.now()
        await cacheService.set(`spike:${i}`, largePayload)
        // Add artificial delay to simulate network issues
        await new Promise(resolve => setTimeout(resolve, 20))
        spikeLatencies.push(performance.now() - start)
      }

      const spikeAvgLatency = spikeLatencies.reduce((sum, lat) => sum + lat, 0) / spikeLatencies.length
      
      monitor.checkAlert('avg_latency', spikeAvgLatency)
      
      const alerts = monitor.getAlerts()
      const latencyAlerts = alerts.filter(alert => alert.rule.metric === 'avg_latency')

      expect(spikeAvgLatency).toBeGreaterThan(normalAvgLatency * 2)
      expect(latencyAlerts.length).toBeGreaterThan(0)

      console.log(`Normal Latency: ${normalAvgLatency.toFixed(2)}ms, Spike Latency: ${spikeAvgLatency.toFixed(2)}ms`)
      console.log(`Latency Alerts: ${latencyAlerts.length}`)
    })

    it('should monitor p95 latency for outlier detection', async () => {
      const operations = 100
      const latencies: number[] = []

      // Mix of normal and slow operations
      for (let i = 0; i < operations; i++) {
        const payload = i % 10 === 0 ? 
          { data: 'x'.repeat(50000) } : // 10% slow operations
          { data: `normal-${i}` }       // 90% normal operations

        const start = performance.now()
        await cacheService.set(`p95:${i}`, payload)
        const latency = performance.now() - start
        latencies.push(latency)
      }

      latencies.sort((a, b) => a - b)
      const p95Index = Math.floor(latencies.length * 0.95)
      const p95Latency = latencies[p95Index]
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length

      // P95 should be significantly higher than average when there are outliers
      const p95ToAvgRatio = p95Latency / avgLatency

      expect(p95ToAvgRatio).toBeGreaterThan(2) // P95 should be > 2x average
      
      console.log(`Avg Latency: ${avgLatency.toFixed(2)}ms, P95 Latency: ${p95Latency.toFixed(2)}ms, Ratio: ${p95ToAvgRatio.toFixed(2)}x`)
    })
  })

  describe('Throughput Monitoring', () => {
    it('should detect throughput degradation', async () => {
      const measureThroughput = async (operationCount: number, concurrency: number = 1): Promise<number> => {
        const startTime = performance.now()
        
        if (concurrency === 1) {
          // Sequential operations
          for (let i = 0; i < operationCount; i++) {
            await cacheService.set(`throughput:${i}`, { id: i })
          }
        } else {
          // Concurrent operations
          const batches = Math.ceil(operationCount / concurrency)
          for (let batch = 0; batch < batches; batch++) {
            const batchOps = Math.min(concurrency, operationCount - batch * concurrency)
            const promises = Array.from({ length: batchOps }, (_, i) => {
              const index = batch * concurrency + i
              return cacheService.set(`throughput:${index}`, { id: index })
            })
            await Promise.all(promises)
          }
        }
        
        const totalTime = performance.now() - startTime
        return (operationCount * 1000) / totalTime // ops/second
      }

      // Measure baseline throughput with optimal conditions
      await cacheService.clear()
      const baselineThroughput = await measureThroughput(200, 10)
      
      // Measure throughput with suboptimal conditions (sequential + large payloads)
      await cacheService.clear()
      const degradedStartTime = performance.now()
      for (let i = 0; i < 100; i++) {
        const largePayload = {
          id: i,
          data: 'x'.repeat(10000),
          timestamp: Date.now()
        }
        await cacheService.set(`degraded:${i}`, largePayload)
      }
      const degradedTime = performance.now() - degradedStartTime
      const degradedThroughput = (100 * 1000) / degradedTime

      monitor.checkAlert('throughput', degradedThroughput)
      
      const alerts = monitor.getAlerts()
      const throughputAlerts = alerts.filter(alert => alert.rule.metric === 'throughput')

      expect(baselineThroughput).toBeGreaterThan(degradedThroughput)
      
      console.log(`Baseline Throughput: ${baselineThroughput.toFixed(0)} ops/sec`)
      console.log(`Degraded Throughput: ${degradedThroughput.toFixed(0)} ops/sec`)
      console.log(`Throughput Alerts: ${throughputAlerts.length}`)
    })
  })

  describe('Memory Usage Monitoring', () => {
    it('should monitor Redis memory usage', async () => {
      const getMemoryUsage = async (): Promise<number> => {
        const info = await redisClient.info('memory')
        const memoryLine = info.split('\r\n').find(line => line.includes('used_memory:'))
        if (memoryLine) {
          const bytes = parseInt(memoryLine.split(':')[1])
          return bytes / 1024 / 1024 // Convert to MB
        }
        return 0
      }

      const initialMemory = await getMemoryUsage()
      
      // Add significant amount of data
      const largeDataItems = 500
      for (let i = 0; i < largeDataItems; i++) {
        const largeData = {
          id: i,
          payload: 'x'.repeat(10000), // 10KB each
          metadata: Array.from({ length: 100 }, (_, j) => ({ key: `meta-${j}`, value: Math.random() }))
        }
        await cacheService.set(`memory:${i}`, largeData)
      }

      const finalMemory = await getMemoryUsage()
      const memoryIncrease = finalMemory - initialMemory

      monitor.checkAlert('memory_usage', memoryIncrease)
      
      const alerts = monitor.getAlerts()
      const memoryAlerts = alerts.filter(alert => alert.rule.metric === 'memory_usage')

      expect(memoryIncrease).toBeGreaterThan(0)
      
      console.log(`Initial Memory: ${initialMemory.toFixed(2)}MB, Final: ${finalMemory.toFixed(2)}MB, Increase: ${memoryIncrease.toFixed(2)}MB`)
      console.log(`Memory Alerts: ${memoryAlerts.length}`)
    })

    it('should detect memory leaks in cache operations', async () => {
      const measureMemory = () => process.memoryUsage().heapUsed / 1024 / 1024

      const iterations = 10
      const memoryMeasurements: number[] = []

      for (let iteration = 0; iteration < iterations; iteration++) {
        const initialMemory = measureMemory()
        
        // Perform operations that should not leak memory
        for (let i = 0; i < 100; i++) {
          const data = { id: i, data: 'x'.repeat(1000) }
          await cacheService.set(`leak:${iteration}:${i}`, data, { ttl: 1 }) // Very short TTL
        }
        
        // Wait for TTL expiration
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
        
        const finalMemory = measureMemory()
        const memoryDelta = finalMemory - initialMemory
        memoryMeasurements.push(memoryDelta)
      }

      // Memory should not continuously increase
      const trend = memoryMeasurements.slice(-3).reduce((sum, delta) => sum + delta, 0) / 3
      const suspiciousGrowth = trend > 10 // More than 10MB average growth in last 3 iterations

      expect(suspiciousGrowth).toBe(false)
      
      console.log('Memory Deltas (MB):', memoryMeasurements.map(m => m.toFixed(2)).join(', '))
      console.log(`Average recent growth: ${trend.toFixed(2)}MB`)
    })
  })

  describe('Performance Regression Detection', () => {
    it('should establish and compare against performance baselines', async () => {
      const testOperation = 'baseline_test'

      // Establish baseline with optimal conditions
      await cacheService.clear()
      const baselineLatencies: number[] = []
      let baselineHits = 0
      const baselineOperations = 100

      // Pre-populate for hit ratio
      for (let i = 0; i < baselineOperations; i++) {
        await cacheService.set(`baseline:${i}`, { id: i })
      }

      const baselineStart = performance.now()
      for (let i = 0; i < baselineOperations; i++) {
        const opStart = performance.now()
        const result = await cacheService.get(`baseline:${i}`)
        const latency = performance.now() - opStart
        baselineLatencies.push(latency)
        if (result) baselineHits++
      }
      const baselineTime = performance.now() - baselineStart

      const baselineMetrics = {
        avgLatency: baselineLatencies.reduce((sum, lat) => sum + lat, 0) / baselineLatencies.length,
        p95Latency: baselineLatencies.sort((a, b) => a - b)[Math.floor(baselineLatencies.length * 0.95)],
        throughput: (baselineOperations * 1000) / baselineTime,
        hitRatio: baselineHits / baselineOperations
      }

      monitor.recordBaseline(testOperation, baselineMetrics)

      // Simulate degraded performance
      await cacheService.clear()
      const degradedLatencies: number[] = []
      let degradedHits = 0

      // Only populate 70% for lower hit ratio
      for (let i = 0; i < Math.floor(baselineOperations * 0.7); i++) {
        await cacheService.set(`degraded:${i}`, { id: i })
      }

      const degradedStart = performance.now()
      for (let i = 0; i < baselineOperations; i++) {
        const opStart = performance.now()
        
        // Add artificial delay to simulate network issues
        await new Promise(resolve => setTimeout(resolve, 2))
        
        const result = await cacheService.get(`degraded:${i}`)
        const latency = performance.now() - opStart
        degradedLatencies.push(latency)
        if (result) degradedHits++
      }
      const degradedTime = performance.now() - degradedStart

      const degradedMetrics = {
        avgLatency: degradedLatencies.reduce((sum, lat) => sum + lat, 0) / degradedLatencies.length,
        p95Latency: degradedLatencies.sort((a, b) => a - b)[Math.floor(degradedLatencies.length * 0.95)],
        throughput: (baselineOperations * 1000) / degradedTime,
        hitRatio: degradedHits / baselineOperations
      }

      const comparison = monitor.compareWithBaseline(testOperation, degradedMetrics)

      expect(comparison.regression).toBe(true)
      expect(comparison.degradationPercentage).toBeGreaterThan(20)
      expect(comparison.details.length).toBeGreaterThan(0)

      console.log('Baseline Metrics:', baselineMetrics)
      console.log('Degraded Metrics:', degradedMetrics)
      console.log('Regression Analysis:', comparison)
    })

    it('should detect performance regressions across cache strategies', async () => {
      const strategies = [
        { name: 'product:stock', strategy: cacheStrategies.product.stock },
        { name: 'user:session', strategy: cacheStrategies.user.session },
      ]

      for (const { name, strategy } of strategies) {
        // Establish baseline
        const baselineMetrics = await measureStrategyPerformance(strategy, 50, false)
        monitor.recordBaseline(name, baselineMetrics)

        // Measure with degraded conditions
        const degradedMetrics = await measureStrategyPerformance(strategy, 50, true)
        const comparison = monitor.compareWithBaseline(name, degradedMetrics)

        console.log(`Strategy ${name}:`)
        console.log(`  Baseline: ${baselineMetrics.avgLatency.toFixed(2)}ms avg, ${(baselineMetrics.hitRatio * 100).toFixed(1)}% hit rate`)
        console.log(`  Degraded: ${degradedMetrics.avgLatency.toFixed(2)}ms avg, ${(degradedMetrics.hitRatio * 100).toFixed(1)}% hit rate`)
        console.log(`  Regression: ${comparison.regression}, Degradation: ${comparison.degradationPercentage.toFixed(1)}%`)
      }
    })
  })

  // Helper function to measure strategy performance
  async function measureStrategyPerformance(
    strategy: any,
    operations: number,
    degraded: boolean = false
  ): Promise<Omit<PerformanceBaseline, 'operation' | 'timestamp'>> {
    const latencies: number[] = []
    let hits = 0

    // Pre-populate cache (less in degraded mode)
    const populationRatio = degraded ? 0.6 : 0.9
    const keysToPopulate = Math.floor(operations * populationRatio)
    
    for (let i = 0; i < keysToPopulate; i++) {
      await strategicCache.set(strategy, `perf:${i}`, { id: i, data: `data-${i}` })
    }

    const startTime = performance.now()
    
    for (let i = 0; i < operations; i++) {
      const opStart = performance.now()
      
      if (degraded) {
        // Add artificial delay
        await new Promise(resolve => setTimeout(resolve, 1))
      }
      
      const result = await strategicCache.get(strategy, `perf:${i}`)
      const latency = performance.now() - opStart
      
      latencies.push(latency)
      if (result) hits++
    }
    
    const totalTime = performance.now() - startTime

    return {
      avgLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
      p95Latency: latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)],
      throughput: (operations * 1000) / totalTime,
      hitRatio: hits / operations
    }
  }
})