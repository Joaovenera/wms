/**
 * Cache Performance Regression Testing Suite
 * 
 * Automated performance regression detection and alerting:
 * - Historical performance baseline tracking
 * - Statistical analysis for performance degradation
 * - Automated CI/CD integration for performance gates
 * - Performance trend analysis and prediction
 * - Alerting system for performance anomalies
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { performance } from 'perf_hooks'
import { cacheService } from '../../infrastructure/cache/cache.service.js'
import { strategicCache, cacheStrategies } from '../../infrastructure/cache/strategies.js'
import { redisClient } from '../../infrastructure/cache/redis.client.js'
import fs from 'fs/promises'
import path from 'path'

interface PerformanceBaseline {
  testName: string
  operation: string
  timestamp: number
  metrics: {
    avgLatency: number
    p50Latency: number
    p95Latency: number
    p99Latency: number
    throughput: number
    memoryUsage: number
    errorRate: number
    successRate: number
  }
  environment: {
    nodeVersion: string
    platform: string
    cpuModel: string
    memoryTotal: number
  }
  gitCommit?: string
  buildNumber?: string
}

interface RegressionAnalysis {
  isRegression: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  degradationPercentage: number
  failedMetrics: string[]
  details: {
    metric: string
    baseline: number
    current: number
    degradation: number
    threshold: number
  }[]
  recommendation: string
}

class PerformanceRegressionDetector {
  private baselineDir = path.join(process.cwd(), 'performance-baselines')
  private regressionThresholds = {
    avgLatency: { warning: 20, error: 50, critical: 100 }, // % increase
    p95Latency: { warning: 25, error: 60, critical: 120 },
    throughput: { warning: 15, error: 30, critical: 50 }, // % decrease
    memoryUsage: { warning: 30, error: 60, critical: 100 }, // % increase
    errorRate: { warning: 2, error: 5, critical: 10 }, // % increase
    successRate: { warning: 5, error: 10, critical: 20 } // % decrease
  }

  async saveBaseline(baseline: PerformanceBaseline): Promise<void> {
    try {
      await fs.mkdir(this.baselineDir, { recursive: true })
      const filename = `${baseline.testName}-${baseline.operation}-${Date.now()}.json`
      const filepath = path.join(this.baselineDir, filename)
      await fs.writeFile(filepath, JSON.stringify(baseline, null, 2))
    } catch (error) {
      console.warn('Failed to save performance baseline:', error)
    }
  }

  async loadLatestBaseline(testName: string, operation: string): Promise<PerformanceBaseline | null> {
    try {
      const files = await fs.readdir(this.baselineDir)
      const matchingFiles = files
        .filter(file => file.startsWith(`${testName}-${operation}-`) && file.endsWith('.json'))
        .sort()
        .reverse() // Most recent first

      if (matchingFiles.length === 0) {
        return null
      }

      const latestFile = path.join(this.baselineDir, matchingFiles[0])
      const content = await fs.readFile(latestFile, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      console.warn('Failed to load performance baseline:', error)
      return null
    }
  }

  async loadHistoricalBaselines(testName: string, operation: string, limit: number = 10): Promise<PerformanceBaseline[]> {
    try {
      const files = await fs.readdir(this.baselineDir)
      const matchingFiles = files
        .filter(file => file.startsWith(`${testName}-${operation}-`) && file.endsWith('.json'))
        .sort()
        .reverse() // Most recent first
        .slice(0, limit)

      const baselines = await Promise.all(
        matchingFiles.map(async (file) => {
          const filepath = path.join(this.baselineDir, file)
          const content = await fs.readFile(filepath, 'utf-8')
          return JSON.parse(content) as PerformanceBaseline
        })
      )

      return baselines
    } catch (error) {
      console.warn('Failed to load historical baselines:', error)
      return []
    }
  }

  analyzeRegression(baseline: PerformanceBaseline, current: PerformanceBaseline): RegressionAnalysis {
    const analysis: RegressionAnalysis = {
      isRegression: false,
      severity: 'low',
      degradationPercentage: 0,
      failedMetrics: [],
      details: [],
      recommendation: 'Performance is within acceptable range.'
    }

    let maxDegradation = 0
    let highestSeverity: RegressionAnalysis['severity'] = 'low'

    // Analyze each metric
    Object.entries(this.regressionThresholds).forEach(([metric, thresholds]) => {
      const baselineValue = baseline.metrics[metric as keyof typeof baseline.metrics]
      const currentValue = current.metrics[metric as keyof typeof current.metrics]

      if (baselineValue === undefined || currentValue === undefined) return

      let degradation = 0
      
      // Calculate degradation based on metric type
      if (metric === 'throughput' || metric === 'successRate') {
        // Higher values are better - degradation is decrease
        degradation = ((baselineValue - currentValue) / baselineValue) * 100
      } else {
        // Lower values are better - degradation is increase
        degradation = ((currentValue - baselineValue) / baselineValue) * 100
      }

      if (degradation > 0) {
        let severity: RegressionAnalysis['severity'] = 'low'
        
        if (degradation >= thresholds.critical) {
          severity = 'critical'
        } else if (degradation >= thresholds.error) {
          severity = 'high'
        } else if (degradation >= thresholds.warning) {
          severity = 'medium'
        }

        if (degradation >= thresholds.warning) {
          analysis.isRegression = true
          analysis.failedMetrics.push(metric)
          analysis.details.push({
            metric,
            baseline: baselineValue,
            current: currentValue,
            degradation,
            threshold: thresholds.warning
          })

          if (degradation > maxDegradation) {
            maxDegradation = degradation
          }

          const severityLevels = ['low', 'medium', 'high', 'critical']
          if (severityLevels.indexOf(severity) > severityLevels.indexOf(highestSeverity)) {
            highestSeverity = severity
          }
        }
      }
    })

    analysis.degradationPercentage = maxDegradation
    analysis.severity = highestSeverity

    // Generate recommendations
    if (analysis.isRegression) {
      const recommendations = []
      
      if (analysis.failedMetrics.includes('avgLatency') || analysis.failedMetrics.includes('p95Latency')) {
        recommendations.push('Consider optimizing cache access patterns or Redis configuration')
      }
      
      if (analysis.failedMetrics.includes('throughput')) {
        recommendations.push('Investigate potential bottlenecks in concurrent operations')
      }
      
      if (analysis.failedMetrics.includes('memoryUsage')) {
        recommendations.push('Check for memory leaks or excessive cache size')
      }
      
      if (analysis.failedMetrics.includes('errorRate')) {
        recommendations.push('Investigate error sources and connection stability')
      }

      analysis.recommendation = recommendations.join('. ') || 'Review recent code changes that may impact cache performance.'
    }

    return analysis
  }

  generateTrendAnalysis(baselines: PerformanceBaseline[]): {
    trends: Record<string, { slope: number, direction: 'improving' | 'degrading' | 'stable' }>
    prediction: string
  } {
    if (baselines.length < 3) {
      return {
        trends: {},
        prediction: 'Insufficient data for trend analysis'
      }
    }

    const trends: Record<string, { slope: number, direction: 'improving' | 'degrading' | 'stable' }> = {}
    
    // Analyze trend for each metric
    Object.keys(this.regressionThresholds).forEach(metric => {
      const values = baselines.map(b => b.metrics[metric as keyof typeof b.metrics]).filter(v => v !== undefined)
      
      if (values.length < 3) return

      // Simple linear regression to find trend
      const n = values.length
      const x = Array.from({ length: n }, (_, i) => i)
      const sumX = x.reduce((sum, val) => sum + val, 0)
      const sumY = values.reduce((sum, val) => sum + val, 0)
      const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0)
      const sumXX = x.reduce((sum, val) => sum + val * val, 0)

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
      
      let direction: 'improving' | 'degrading' | 'stable' = 'stable'
      
      // Determine if trend is significant (arbitrary threshold of 5% change per measurement)
      const avgValue = sumY / n
      const relativeSlope = Math.abs(slope) / avgValue
      
      if (relativeSlope > 0.05) {
        if (metric === 'throughput' || metric === 'successRate') {
          direction = slope > 0 ? 'improving' : 'degrading'
        } else {
          direction = slope < 0 ? 'improving' : 'degrading'
        }
      }

      trends[metric] = { slope, direction }
    })

    // Generate prediction
    const degradingMetrics = Object.entries(trends)
      .filter(([_, trend]) => trend.direction === 'degrading')
      .map(([metric, _]) => metric)

    let prediction = 'Performance is stable'
    if (degradingMetrics.length > 0) {
      prediction = `Warning: Degrading trends detected in ${degradingMetrics.join(', ')}. Consider investigating recent changes.`
    } else {
      const improvingMetrics = Object.entries(trends)
        .filter(([_, trend]) => trend.direction === 'improving')
        .map(([metric, _]) => metric)
      
      if (improvingMetrics.length > 0) {
        prediction = `Performance improvements detected in ${improvingMetrics.join(', ')}`
      }
    }

    return { trends, prediction }
  }
}

describe('Cache Performance Regression Testing', () => {
  let detector: PerformanceRegressionDetector

  beforeAll(async () => {
    if (!redisClient.isReady) {
      await redisClient.connect()
    }
    detector = new PerformanceRegressionDetector()
    await cacheService.clear()
  })

  afterAll(async () => {
    await cacheService.clear()
  })

  describe('Performance Baseline Management', () => {
    it('should establish and save performance baselines', async () => {
      const testName = 'cache_baseline_test'
      const operation = 'set_get_operations'
      const iterations = 100

      console.log('Establishing performance baseline...')
      
      // Perform baseline performance test
      const latencies: number[] = []
      const startTime = performance.now()
      let errors = 0

      for (let i = 0; i < iterations; i++) {
        const opStart = performance.now()
        try {
          await cacheService.set(`baseline:${i}`, { id: i, data: `data-${i}`, timestamp: Date.now() })
          const result = await cacheService.get(`baseline:${i}`)
          expect(result).toBeDefined()
          latencies.push(performance.now() - opStart)
        } catch (error) {
          errors++
          latencies.push(performance.now() - opStart)
        }
      }

      const totalTime = performance.now() - startTime
      const sortedLatencies = latencies.sort((a, b) => a - b)
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024

      const baseline: PerformanceBaseline = {
        testName,
        operation,
        timestamp: Date.now(),
        metrics: {
          avgLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
          p50Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.5)],
          p95Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)],
          p99Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)],
          throughput: (iterations * 1000) / totalTime,
          memoryUsage,
          errorRate: (errors / iterations) * 100,
          successRate: ((iterations - errors) / iterations) * 100
        },
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          cpuModel: 'Unknown', // Would be populated from os.cpus() in real implementation
          memoryTotal: 0 // Would be populated from os.totalmem() in real implementation
        }
      }

      await detector.saveBaseline(baseline)

      expect(baseline.metrics.avgLatency).toBeLessThan(50)
      expect(baseline.metrics.successRate).toBeGreaterThan(95)
      expect(baseline.metrics.throughput).toBeGreaterThan(10)

      console.log('Baseline established:')
      console.log(`  Avg Latency: ${baseline.metrics.avgLatency.toFixed(2)}ms`)
      console.log(`  P95 Latency: ${baseline.metrics.p95Latency.toFixed(2)}ms`)
      console.log(`  Throughput: ${baseline.metrics.throughput.toFixed(1)} ops/sec`)
      console.log(`  Success Rate: ${baseline.metrics.successRate.toFixed(2)}%`)
    })

    it('should detect performance regressions against baseline', async () => {
      const testName = 'cache_regression_test'
      const operation = 'degraded_operations'

      // First establish a good baseline
      const goodBaseline = await createPerformanceBaseline(testName, operation, false)
      await detector.saveBaseline(goodBaseline)

      // Then simulate degraded performance
      const degradedBaseline = await createPerformanceBaseline(testName, operation, true)

      // Analyze for regression
      const analysis = detector.analyzeRegression(goodBaseline, degradedBaseline)

      expect(analysis.isRegression).toBe(true)
      expect(analysis.severity).toMatch(/medium|high|critical/)
      expect(analysis.degradationPercentage).toBeGreaterThan(20)
      expect(analysis.failedMetrics.length).toBeGreaterThan(0)

      console.log('Regression Analysis:')
      console.log(`  Regression Detected: ${analysis.isRegression}`)
      console.log(`  Severity: ${analysis.severity}`)
      console.log(`  Max Degradation: ${analysis.degradationPercentage.toFixed(1)}%`)
      console.log(`  Failed Metrics: ${analysis.failedMetrics.join(', ')}`)
      console.log(`  Recommendation: ${analysis.recommendation}`)

      analysis.details.forEach(detail => {
        console.log(`    ${detail.metric}: ${detail.baseline.toFixed(2)} -> ${detail.current.toFixed(2)} (${detail.degradation.toFixed(1)}% worse)`)
      })
    })
  })

  describe('Historical Trend Analysis', () => {
    it('should analyze performance trends over time', async () => {
      const testName = 'cache_trend_test'
      const operation = 'trend_analysis'
      const measurements = 8

      console.log('Generating historical performance data...')

      // Create a series of performance measurements with gradual degradation
      const baselines: PerformanceBaseline[] = []
      
      for (let i = 0; i < measurements; i++) {
        const degradationFactor = 1 + (i * 0.1) // Gradual 10% degradation per measurement
        const baseline = await createPerformanceBaseline(
          testName, 
          operation, 
          false, 
          degradationFactor
        )
        
        baselines.push(baseline)
        await detector.saveBaseline(baseline)
        
        // Add some delay to simulate different measurement times
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Analyze trends
      const trendAnalysis = detector.generateTrendAnalysis(baselines)

      expect(Object.keys(trendAnalysis.trends).length).toBeGreaterThan(0)
      
      const degradingTrends = Object.entries(trendAnalysis.trends)
        .filter(([_, trend]) => trend.direction === 'degrading')
      
      expect(degradingTrends.length).toBeGreaterThan(0) // Should detect degrading trends

      console.log('Trend Analysis:')
      Object.entries(trendAnalysis.trends).forEach(([metric, trend]) => {
        console.log(`  ${metric}: ${trend.direction} (slope: ${trend.slope.toFixed(4)})`)
      })
      console.log(`Prediction: ${trendAnalysis.prediction}`)
    })

    it('should compare current performance against historical range', async () => {
      const testName = 'cache_historical_test'
      const operation = 'historical_comparison'

      // Create historical baselines
      const historicalBaselines: PerformanceBaseline[] = []
      for (let i = 0; i < 10; i++) {
        const variationFactor = 0.9 + (Math.random() * 0.2) // 90-110% variation
        const baseline = await createPerformanceBaseline(
          testName,
          operation,
          false,
          variationFactor
        )
        historicalBaselines.push(baseline)
      }

      // Calculate historical statistics
      const avgLatencies = historicalBaselines.map(b => b.metrics.avgLatency)
      const throughputs = historicalBaselines.map(b => b.metrics.throughput)

      const latencyStats = {
        min: Math.min(...avgLatencies),
        max: Math.max(...avgLatencies),
        avg: avgLatencies.reduce((sum, val) => sum + val, 0) / avgLatencies.length,
        stdDev: Math.sqrt(avgLatencies.reduce((sum, val) => sum + Math.pow(val - avgLatencies.reduce((s, v) => s + v, 0) / avgLatencies.length, 2), 0) / avgLatencies.length)
      }

      const throughputStats = {
        min: Math.min(...throughputs),
        max: Math.max(...throughputs),
        avg: throughputs.reduce((sum, val) => sum + val, 0) / throughputs.length,
        stdDev: Math.sqrt(throughputs.reduce((sum, val) => sum + Math.pow(val - throughputs.reduce((s, v) => s + v, 0) / throughputs.length, 2), 0) / throughputs.length)
      }

      // Test current performance against historical range
      const currentBaseline = await createPerformanceBaseline(testName, operation, false)

      const latencyZScore = (currentBaseline.metrics.avgLatency - latencyStats.avg) / latencyStats.stdDev
      const throughputZScore = (currentBaseline.metrics.throughput - throughputStats.avg) / throughputStats.stdDev

      // Z-score > 2 indicates potential anomaly (2 standard deviations)
      const latencyAnomaly = Math.abs(latencyZScore) > 2
      const throughputAnomaly = Math.abs(throughputZScore) > 2

      console.log('Historical Comparison:')
      console.log(`Historical Latency Range: ${latencyStats.min.toFixed(2)}-${latencyStats.max.toFixed(2)}ms (avg: ${latencyStats.avg.toFixed(2)}ms)`)
      console.log(`Current Latency: ${currentBaseline.metrics.avgLatency.toFixed(2)}ms (z-score: ${latencyZScore.toFixed(2)})`)
      console.log(`Historical Throughput Range: ${throughputStats.min.toFixed(1)}-${throughputStats.max.toFixed(1)} ops/sec (avg: ${throughputStats.avg.toFixed(1)})`)
      console.log(`Current Throughput: ${currentBaseline.metrics.throughput.toFixed(1)} ops/sec (z-score: ${throughputZScore.toFixed(2)})`)
      console.log(`Anomalies: Latency ${latencyAnomaly ? 'YES' : 'NO'}, Throughput ${throughputAnomaly ? 'YES' : 'NO'}`)

      // Performance should be within reasonable range
      expect(Math.abs(latencyZScore)).toBeLessThan(3) // Within 3 standard deviations
      expect(Math.abs(throughputZScore)).toBeLessThan(3)
    })
  })

  describe('CI/CD Integration and Automated Gates', () => {
    it('should provide pass/fail decision for CI/CD pipeline', async () => {
      const testName = 'cache_cicd_gate'
      const operation = 'pipeline_test'

      // Establish baseline (simulate previous successful build)
      const goodBaseline = await createPerformanceBaseline(testName, operation, false)
      await detector.saveBaseline(goodBaseline)

      // Test scenarios
      const scenarios = [
        { name: 'acceptable_performance', shouldPass: true, degraded: false },
        { name: 'minor_degradation', shouldPass: true, degraded: false, degradationFactor: 1.1 },
        { name: 'significant_degradation', shouldPass: false, degraded: true },
        { name: 'critical_failure', shouldPass: false, degraded: true, degradationFactor: 2.0 }
      ]

      for (const scenario of scenarios) {
        console.log(`Testing CI/CD scenario: ${scenario.name}`)
        
        const currentBaseline = await createPerformanceBaseline(
          testName,
          `${operation}_${scenario.name}`,
          scenario.degraded,
          scenario.degradationFactor || 1.0
        )

        const analysis = detector.analyzeRegression(goodBaseline, currentBaseline)
        
        // CI/CD gate logic
        const shouldPass = !analysis.isRegression || analysis.severity === 'low'
        
        expect(shouldPass).toBe(scenario.shouldPass)
        
        console.log(`  Result: ${shouldPass ? 'PASS' : 'FAIL'}`)
        console.log(`  Severity: ${analysis.severity}`)
        console.log(`  Degradation: ${analysis.degradationPercentage.toFixed(1)}%`)
        
        if (!shouldPass) {
          console.log(`  Blocking deployment due to ${analysis.severity} performance regression`)
          console.log(`  Failed metrics: ${analysis.failedMetrics.join(', ')}`)
        }
      }
    })

    it('should generate performance report for CI/CD artifacts', async () => {
      const testName = 'cache_report_test'
      const operation = 'report_generation'

      const baseline = await createPerformanceBaseline(testName, operation, false)
      const historical = await detector.loadHistoricalBaselines(testName, operation, 5)
      
      // Generate comprehensive report
      const report = {
        timestamp: new Date().toISOString(),
        testName,
        operation,
        buildInfo: {
          commit: 'abc123def',
          branch: 'main',
          buildNumber: '1234'
        },
        currentMetrics: baseline.metrics,
        regressionAnalysis: historical.length > 0 ? 
          detector.analyzeRegression(historical[0], baseline) : null,
        trendAnalysis: historical.length >= 3 ? 
          detector.generateTrendAnalysis([baseline, ...historical]) : null,
        recommendations: [],
        status: 'pass' as 'pass' | 'fail' | 'warning'
      }

      // Determine overall status
      if (report.regressionAnalysis?.isRegression) {
        if (report.regressionAnalysis.severity === 'critical' || report.regressionAnalysis.severity === 'high') {
          report.status = 'fail'
        } else {
          report.status = 'warning'
        }
      }

      // Add recommendations
      if (report.currentMetrics.avgLatency > 20) {
        report.recommendations.push('Consider cache optimization - average latency is high')
      }
      
      if (report.currentMetrics.throughput < 50) {
        report.recommendations.push('Investigate throughput bottlenecks')
      }

      expect(report.currentMetrics).toBeDefined()
      expect(report.status).toMatch(/pass|warning|fail/)

      console.log('Performance Report Generated:')
      console.log(`  Status: ${report.status.toUpperCase()}`)
      console.log(`  Avg Latency: ${report.currentMetrics.avgLatency.toFixed(2)}ms`)
      console.log(`  Throughput: ${report.currentMetrics.throughput.toFixed(1)} ops/sec`)
      console.log(`  Success Rate: ${report.currentMetrics.successRate.toFixed(2)}%`)
      
      if (report.recommendations.length > 0) {
        console.log('  Recommendations:')
        report.recommendations.forEach(rec => console.log(`    - ${rec}`))
      }
    })
  })

  // Helper function to create performance baselines
  async function createPerformanceBaseline(
    testName: string, 
    operation: string, 
    degraded: boolean = false,
    degradationFactor: number = 1.0
  ): Promise<PerformanceBaseline> {
    const iterations = degraded ? 50 : 100 // Fewer iterations when degraded
    const latencies: number[] = []
    const startTime = performance.now()
    let errors = 0

    for (let i = 0; i < iterations; i++) {
      const opStart = performance.now()
      
      try {
        if (degraded) {
          // Add artificial delays and larger payloads to simulate degradation
          await new Promise(resolve => setTimeout(resolve, 5 * degradationFactor))
          const largePayload = { 
            id: i, 
            data: 'x'.repeat(Math.floor(1000 * degradationFactor)), 
            timestamp: Date.now() 
          }
          await cacheService.set(`${testName}:${operation}:${i}`, largePayload)
        } else {
          await cacheService.set(`${testName}:${operation}:${i}`, { id: i, data: `data-${i}` })
        }
        
        const result = await cacheService.get(`${testName}:${operation}:${i}`)
        expect(result).toBeDefined()
        
        latencies.push(performance.now() - opStart)
      } catch (error) {
        errors++
        latencies.push(performance.now() - opStart)
      }
    }

    const totalTime = performance.now() - startTime
    const sortedLatencies = latencies.sort((a, b) => a - b)
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024

    return {
      testName,
      operation,
      timestamp: Date.now(),
      metrics: {
        avgLatency: (latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length) * degradationFactor,
        p50Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] * degradationFactor,
        p95Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] * degradationFactor,
        p99Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] * degradationFactor,
        throughput: (iterations * 1000) / totalTime / degradationFactor,
        memoryUsage: memoryUsage * degradationFactor,
        errorRate: (errors / iterations) * 100 * (degraded ? 2 : 1),
        successRate: ((iterations - errors) / iterations) * 100 / (degraded ? 1.1 : 1)
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cpuModel: 'Test CPU',
        memoryTotal: 0
      }
    }
  }
})