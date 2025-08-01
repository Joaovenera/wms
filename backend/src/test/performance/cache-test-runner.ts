/**
 * Cache Performance Test Runner
 * 
 * Orchestrates the execution of all cache performance tests:
 * - Sequential and parallel test execution
 * - Performance report generation
 * - CI/CD integration
 * - Alerting and notifications
 */

import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

interface TestSuite {
  name: string
  file: string
  description: string
  estimatedDuration: number // seconds
  dependencies: string[]
  critical: boolean
}

interface TestResult {
  suite: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  metrics?: any
  errors?: string[]
}

interface PerformanceReport {
  timestamp: string
  environment: {
    nodeVersion: string
    platform: string
    memoryTotal: number
  }
  testResults: TestResult[]
  summary: {
    totalTests: number
    passed: number
    failed: number
    skipped: number
    totalDuration: number
    criticalFailures: number
  }
  performance: {
    avgLatency: number
    totalThroughput: number
    memoryUsage: number
    regressionCount: number
  }
  recommendations: string[]
  alerts: Array<{
    level: 'info' | 'warning' | 'error' | 'critical'
    message: string
    metric?: string
    value?: number
  }>
}

class CachePerformanceTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'basic-performance',
      file: 'cache-performance.spec.ts',
      description: 'Basic cache performance benchmarks and latency tests',
      estimatedDuration: 120,
      dependencies: [],
      critical: true
    },
    {
      name: 'monitoring-alerting',
      file: 'cache-monitoring.spec.ts',
      description: 'Cache monitoring, hit ratio analysis, and alerting tests',
      estimatedDuration: 90,
      dependencies: ['basic-performance'],
      critical: true
    },
    {
      name: 'load-testing',
      file: 'cache-load-testing.spec.ts',
      description: 'WMS-specific load testing scenarios',
      estimatedDuration: 180,
      dependencies: ['basic-performance'],
      critical: true
    },
    {
      name: 'postgres-integration',
      file: 'postgres-cache-integration.spec.ts',
      description: 'PostgreSQL and Redis cache integration performance',
      estimatedDuration: 150,
      dependencies: ['basic-performance'],
      critical: false
    },
    {
      name: 'regression-testing',
      file: 'cache-regression-testing.spec.ts',
      description: 'Performance regression detection and historical analysis',
      estimatedDuration: 60,
      dependencies: ['basic-performance', 'monitoring-alerting'],
      critical: true
    }
  ]

  private outputDir = path.join(process.cwd(), 'performance-reports')

  async runAllTests(options: {
    parallel?: boolean
    skipNonCritical?: boolean
    verbose?: boolean
    generateReport?: boolean
  } = {}): Promise<PerformanceReport> {
    const {
      parallel = false,
      skipNonCritical = false,
      verbose = true,
      generateReport = true
    } = options

    console.log('🚀 Starting Cache Performance Test Suite')
    console.log(`📊 Running ${this.testSuites.length} test suites`)
    console.log(`⚡ Parallel execution: ${parallel ? 'enabled' : 'disabled'}`)
    console.log(`🎯 Skip non-critical: ${skipNonCritical ? 'yes' : 'no'}`)

    const startTime = Date.now()
    let testResults: TestResult[] = []

    try {
      await fs.mkdir(this.outputDir, { recursive: true })

      const suitesToRun = skipNonCritical 
        ? this.testSuites.filter(suite => suite.critical)
        : this.testSuites

      if (parallel) {
        testResults = await this.runTestsInParallel(suitesToRun, verbose)
      } else {
        testResults = await this.runTestsSequentially(suitesToRun, verbose)
      }

      const totalDuration = Date.now() - startTime

      if (generateReport) {
        const report = await this.generatePerformanceReport(testResults, totalDuration)
        await this.saveReport(report)
        await this.printSummary(report)
        return report
      }

      return this.createBasicReport(testResults, totalDuration)

    } catch (error) {
      console.error('❌ Test execution failed:', error)
      throw error
    }
  }

  private async runTestsSequentially(suites: TestSuite[], verbose: boolean): Promise<TestResult[]> {
    const results: TestResult[] = []

    for (const suite of suites) {
      if (verbose) {
        console.log(`\n🧪 Running ${suite.name}: ${suite.description}`)
        console.log(`⏱️  Estimated duration: ${suite.estimatedDuration}s`)
      }

      const result = await this.runSingleTest(suite, verbose)
      results.push(result)

      if (result.status === 'failed' && suite.critical) {
        console.log(`❌ Critical test suite ${suite.name} failed, stopping execution`)
        break
      }
    }

    return results
  }

  private async runTestsInParallel(suites: TestSuite[], verbose: boolean): Promise<TestResult[]> {
    // Group tests by dependency levels
    const dependencyLevels = this.resolveDependencyLevels(suites)
    const results: TestResult[] = []

    for (const level of dependencyLevels) {
      if (verbose) {
        console.log(`\n🔄 Running level ${dependencyLevels.indexOf(level) + 1} tests in parallel`)
        level.forEach(suite => console.log(`  - ${suite.name}: ${suite.description}`))
      }

      const levelPromises = level.map(suite => this.runSingleTest(suite, verbose))
      const levelResults = await Promise.all(levelPromises)
      results.push(...levelResults)

      // Check for critical failures
      const criticalFailures = levelResults.filter(r => r.status === 'failed' && 
        suites.find(s => s.name === r.suite)?.critical)

      if (criticalFailures.length > 0) {
        console.log(`❌ Critical failures detected, stopping execution`)
        console.log(`Failed suites: ${criticalFailures.map(r => r.suite).join(', ')}`)
        break
      }
    }

    return results
  }

  private async runSingleTest(suite: TestSuite, verbose: boolean): Promise<TestResult> {
    const startTime = Date.now()
    const testFile = path.join(__dirname, suite.file)

    try {
      // Check if test file exists
      await fs.access(testFile)

      if (verbose) {
        console.log(`  ▶️  Starting ${suite.name}...`)
      }

      const result = await this.executeVitest(testFile, verbose)
      const duration = Date.now() - startTime

      if (verbose) {
        const status = result.success ? '✅' : '❌'
        console.log(`  ${status} ${suite.name} completed in ${(duration / 1000).toFixed(1)}s`)
      }

      return {
        suite: suite.name,
        status: result.success ? 'passed' : 'failed',
        duration: duration / 1000,
        metrics: result.metrics,
        errors: result.errors
      }

    } catch (error) {
      const duration = Date.now() - startTime
      
      if (verbose) {
        console.log(`  ❌ ${suite.name} failed: ${error}`)
      }

      return {
        suite: suite.name,
        status: 'failed',
        duration: duration / 1000,
        errors: [error instanceof Error ? error.message : String(error)]
      }
    }
  }

  private async executeVitest(testFile: string, verbose: boolean): Promise<{
    success: boolean
    metrics?: any
    errors?: string[]
  }> {
    return new Promise((resolve) => {
      const args = ['run', testFile, '--reporter=json']
      if (!verbose) {
        args.push('--silent')
      }

      const child = spawn('npx', ['vitest', ...args], {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        const success = code === 0
        const errors = stderr ? [stderr] : undefined

        // Try to parse metrics from stdout
        let metrics
        try {
          const jsonOutput = stdout.split('\n').find(line => line.trim().startsWith('{'))
          if (jsonOutput) {
            metrics = JSON.parse(jsonOutput)
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }

        resolve({ success, metrics, errors })
      })
    })
  }

  private resolveDependencyLevels(suites: TestSuite[]): TestSuite[][] {
    const levels: TestSuite[][] = []
    const processed = new Set<string>()

    while (processed.size < suites.length) {
      const currentLevel: TestSuite[] = []

      for (const suite of suites) {
        if (processed.has(suite.name)) continue

        const dependenciesMet = suite.dependencies.every(dep => processed.has(dep))
        if (dependenciesMet) {
          currentLevel.push(suite)
        }
      }

      if (currentLevel.length === 0) {
        throw new Error('Circular dependency detected in test suites')
      }

      currentLevel.forEach(suite => processed.add(suite.name))
      levels.push(currentLevel)
    }

    return levels
  }

  private async generatePerformanceReport(results: TestResult[], totalDuration: number): Promise<PerformanceReport> {
    const passed = results.filter(r => r.status === 'passed').length
    const failed = results.filter(r => r.status === 'failed').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const criticalFailures = results.filter(r => 
      r.status === 'failed' && this.testSuites.find(s => s.name === r.suite)?.critical
    ).length

    // Aggregate performance metrics
    const performanceMetrics = this.aggregatePerformanceMetrics(results)
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(results, performanceMetrics)
    
    // Generate alerts
    const alerts = this.generateAlerts(results, performanceMetrics)

    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryTotal: require('os').totalmem() / 1024 / 1024 // MB
      },
      testResults: results,
      summary: {
        totalTests: results.length,
        passed,
        failed,
        skipped,
        totalDuration: totalDuration / 1000,
        criticalFailures
      },
      performance: performanceMetrics,
      recommendations,
      alerts
    }

    return report
  }

  private aggregatePerformanceMetrics(results: TestResult[]): PerformanceReport['performance'] {
    // This would aggregate actual metrics from test results
    // For now, using placeholder values
    return {
      avgLatency: 0,
      totalThroughput: 0,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      regressionCount: results.filter(r => r.suite.includes('regression')).length
    }
  }

  private generateRecommendations(results: TestResult[], performance: PerformanceReport['performance']): string[] {
    const recommendations: string[] = []

    const failedCritical = results.filter(r => 
      r.status === 'failed' && this.testSuites.find(s => s.name === r.suite)?.critical
    )

    if (failedCritical.length > 0) {
      recommendations.push('Critical performance tests failed - investigate immediately')
    }

    if (performance.avgLatency > 50) {
      recommendations.push('High average latency detected - consider cache optimization')
    }

    if (performance.memoryUsage > 500) {
      recommendations.push('High memory usage - check for memory leaks')
    }

    if (performance.regressionCount > 0) {
      recommendations.push('Performance regressions detected - review recent changes')
    }

    if (recommendations.length === 0) {
      recommendations.push('All performance tests passed - system is performing well')
    }

    return recommendations
  }

  private generateAlerts(results: TestResult[], performance: PerformanceReport['performance']): PerformanceReport['alerts'] {
    const alerts: PerformanceReport['alerts'] = []

    const criticalFailures = results.filter(r => 
      r.status === 'failed' && this.testSuites.find(s => s.name === r.suite)?.critical
    )

    criticalFailures.forEach(result => {
      alerts.push({
        level: 'critical',
        message: `Critical performance test failed: ${result.suite}`,
        metric: 'test_failure'
      })
    })

    if (performance.avgLatency > 100) {
      alerts.push({
        level: 'error',
        message: 'Cache latency exceeds acceptable threshold',
        metric: 'avg_latency',
        value: performance.avgLatency
      })
    } else if (performance.avgLatency > 50) {
      alerts.push({
        level: 'warning',
        message: 'Cache latency is elevated',
        metric: 'avg_latency',
        value: performance.avgLatency
      })
    }

    if (performance.memoryUsage > 1000) {
      alerts.push({
        level: 'error',
        message: 'Memory usage is very high',
        metric: 'memory_usage',
        value: performance.memoryUsage
      })
    }

    return alerts
  }

  private async saveReport(report: PerformanceReport): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportFile = path.join(this.outputDir, `cache-performance-${timestamp}.json`)
    
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2))
    
    // Also save as latest
    const latestFile = path.join(this.outputDir, 'cache-performance-latest.json')
    await fs.writeFile(latestFile, JSON.stringify(report, null, 2))

    console.log(`📊 Performance report saved: ${reportFile}`)
  }

  private async printSummary(report: PerformanceReport): Promise<void> {
    console.log('\n' + '='.repeat(80))
    console.log('📊 CACHE PERFORMANCE TEST SUMMARY')
    console.log('='.repeat(80))
    
    console.log(`🕐 Timestamp: ${report.timestamp}`)
    console.log(`🖥️  Environment: ${report.environment.platform} ${report.environment.nodeVersion}`)
    console.log(`💾 Memory: ${(report.environment.memoryTotal / 1024).toFixed(1)} GB`)
    
    console.log('\n📈 Test Results:')
    console.log(`  Total Tests: ${report.summary.totalTests}`)
    console.log(`  ✅ Passed: ${report.summary.passed}`)
    console.log(`  ❌ Failed: ${report.summary.failed}`)
    console.log(`  ⏭️  Skipped: ${report.summary.skipped}`)
    console.log(`  🚨 Critical Failures: ${report.summary.criticalFailures}`)
    console.log(`  ⏱️  Total Duration: ${report.summary.totalDuration.toFixed(1)}s`)

    console.log('\n⚡ Performance Metrics:')
    console.log(`  Average Latency: ${report.performance.avgLatency.toFixed(2)}ms`)
    console.log(`  Total Throughput: ${report.performance.totalThroughput.toFixed(1)} ops/sec`)
    console.log(`  Memory Usage: ${report.performance.memoryUsage.toFixed(1)} MB`)
    console.log(`  Regressions: ${report.performance.regressionCount}`)

    if (report.alerts.length > 0) {
      console.log('\n🚨 Alerts:')
      report.alerts.forEach(alert => {
        const icon = { info: 'ℹ️', warning: '⚠️', error: '❌', critical: '🚨' }[alert.level]
        console.log(`  ${icon} ${alert.level.toUpperCase()}: ${alert.message}`)
        if (alert.metric && alert.value !== undefined) {
          console.log(`     ${alert.metric}: ${alert.value}`)
        }
      })
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:')
      report.recommendations.forEach(rec => {
        console.log(`  • ${rec}`)
      })
    }

    console.log('\n' + '='.repeat(80))
  }

  private createBasicReport(results: TestResult[], totalDuration: number): PerformanceReport {
    return {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryTotal: require('os').totalmem() / 1024 / 1024
      },
      testResults: results,
      summary: {
        totalTests: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        totalDuration: totalDuration / 1000,
        criticalFailures: 0
      },
      performance: {
        avgLatency: 0,
        totalThroughput: 0,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        regressionCount: 0
      },
      recommendations: [],
      alerts: []
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const options = {
    parallel: args.includes('--parallel') || args.includes('-p'),
    skipNonCritical: args.includes('--skip-non-critical') || args.includes('-s'),
    verbose: !args.includes('--quiet') && !args.includes('-q'),
    generateReport: !args.includes('--no-report')
  }

  const runner = new CachePerformanceTestRunner()
  
  try {
    const report = await runner.runAllTests(options)
    
    // Exit with error code if critical tests failed
    if (report.summary.criticalFailures > 0) {
      process.exit(1)
    }
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Test execution failed:', error)
    process.exit(1)
  }
}

// Export for programmatic use
export { CachePerformanceTestRunner }

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  })
}