/**
 * Cache Load Testing for WMS Operations
 * 
 * Realistic load testing scenarios for warehouse management operations:
 * - Product inventory cache under high read/write load
 * - Pallet location tracking with frequent updates
 * - User session management during peak hours
 * - Real-time stock updates and synchronization
 * - Batch operations and bulk data processing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { performance } from 'perf_hooks'
import { cacheService } from '../../infrastructure/cache/cache.service.js'
import { strategicCache, cacheStrategies } from '../../infrastructure/cache/strategies.js'
import { redisClient } from '../../infrastructure/cache/redis.client.js'

describe('Cache Load Testing - WMS Operations', () => {
  const LOAD_TEST_SCENARIOS = {
    // Peak warehouse hours simulation
    PEAK_USERS: 50,
    PEAK_OPERATIONS_PER_SECOND: 100,
    PEAK_DURATION_SECONDS: 60,
    
    // Inventory management load
    CONCURRENT_STOCK_UPDATES: 25,
    PRODUCT_CATALOG_SIZE: 10000,
    STOCK_UPDATE_FREQUENCY: 500, // ms
    
    // Pallet tracking load
    WAREHOUSE_PALLETS: 1000,
    PALLET_MOVEMENTS_PER_MINUTE: 200,
    LOCATION_UPDATES_BATCH_SIZE: 50,
    
    // Batch operations
    BULK_IMPORT_SIZE: 5000,
    BULK_EXPORT_SIZE: 2000,
    CONCURRENT_BATCH_JOBS: 5,
  }

  let loadTestMetrics: {
    totalOperations: number
    successfulOperations: number
    failedOperations: number
    avgLatency: number
    maxLatency: number
    operationsPerSecond: number
    memoryUsage: {
      initial: number
      peak: number
      final: number
    }
    errors: Array<{ operation: string, error: string, timestamp: number }>
  } = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    avgLatency: 0,
    maxLatency: 0,
    operationsPerSecond: 0,
    memoryUsage: { initial: 0, peak: 0, final: 0 },
    errors: []
  }

  beforeAll(async () => {
    if (!redisClient.isReady) {
      await redisClient.connect()
    }
    await cacheService.clear()
    loadTestMetrics.memoryUsage.initial = process.memoryUsage().heapUsed / 1024 / 1024
  })

  afterAll(async () => {
    await cacheService.clear()
    loadTestMetrics.memoryUsage.final = process.memoryUsage().heapUsed / 1024 / 1024
    generateLoadTestReport()
  })

  beforeEach(() => {
    resetMetrics()
  })

  describe('Product Inventory Cache Load Tests', () => {
    it('should handle high-frequency stock updates', async () => {
      const { CONCURRENT_STOCK_UPDATES, PRODUCT_CATALOG_SIZE, STOCK_UPDATE_FREQUENCY } = LOAD_TEST_SCENARIOS
      const testDuration = 30000 // 30 seconds
      const startTime = Date.now()

      // Pre-populate product catalog
      console.log(`Pre-populating ${PRODUCT_CATALOG_SIZE} products...`)
      const products = Array.from({ length: PRODUCT_CATALOG_SIZE }, (_, i) => ({
        id: i + 1,
        sku: `SKU-${String(i + 1).padStart(6, '0')}`,
        name: `Product ${i + 1}`,
        stock: Math.floor(Math.random() * 1000),
        location: `A-${Math.floor(i / 100) + 1}-${(i % 100) + 1}`,
        lastUpdated: Date.now()
      }))

      for (const product of products) {
        await strategicCache.set(
          cacheStrategies.product.stock,
          `stock:${product.id}`,
          product.stock
        )
      }

      console.log('Starting concurrent stock updates...')
      
      // Concurrent stock update workers
      const updateWorkers = Array.from({ length: CONCURRENT_STOCK_UPDATES }, async (_, workerId) => {
        while (Date.now() - startTime < testDuration) {
          const productId = Math.floor(Math.random() * PRODUCT_CATALOG_SIZE) + 1
          const stockChange = Math.floor(Math.random() * 20) - 10 // -10 to +10
          
          const opStart = performance.now()
          try {
            // Simulate atomic stock update with optimistic locking
            const lockResource = `stock:update:${productId}`
            const lockValue = await cacheService.acquireLock(lockResource, 1000, 500)
            
            if (lockValue) {
              const currentStock = await strategicCache.get(cacheStrategies.product.stock, `stock:${productId}`)
              const newStock = Math.max(0, (currentStock || 0) + stockChange)
              
              await strategicCache.set(
                cacheStrategies.product.stock,
                `stock:${productId}`,
                newStock
              )
              
              await cacheService.releaseLock(lockResource, lockValue)
              recordSuccessfulOperation(performance.now() - opStart)
            } else {
              recordFailedOperation('stock_update', 'Lock acquisition failed', performance.now() - opStart)
            }
          } catch (error) {
            recordFailedOperation('stock_update', error instanceof Error ? error.message : 'Unknown error', performance.now() - opStart)
          }
          
          await new Promise(resolve => setTimeout(resolve, STOCK_UPDATE_FREQUENCY))
        }
      })

      // Monitor memory usage during load test
      const memoryMonitor = setInterval(() => {
        const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024
        loadTestMetrics.memoryUsage.peak = Math.max(loadTestMetrics.memoryUsage.peak, currentMemory)
      }, 1000)

      await Promise.all(updateWorkers)
      clearInterval(memoryMonitor)

      const totalTime = Date.now() - startTime
      loadTestMetrics.operationsPerSecond = (loadTestMetrics.totalOperations * 1000) / totalTime

      // Verify final stock consistency (basic check)
      const sampleChecks = 10
      let consistentChecks = 0
      for (let i = 0; i < sampleChecks; i++) {
        const productId = Math.floor(Math.random() * PRODUCT_CATALOG_SIZE) + 1
        const stock = await strategicCache.get(cacheStrategies.product.stock, `stock:${productId}`)
        if (typeof stock === 'number' && stock >= 0) {
          consistentChecks++
        }
      }

      expect(loadTestMetrics.successfulOperations).toBeGreaterThan(0)
      expect(loadTestMetrics.operationsPerSecond).toBeGreaterThan(10) // Minimum throughput
      expect(consistentChecks / sampleChecks).toBeGreaterThan(0.9) // 90% consistency
      
      console.log(`Stock Updates Load Test: ${loadTestMetrics.successfulOperations} successful ops, ${loadTestMetrics.operationsPerSecond.toFixed(1)} ops/sec`)
    })

    it('should handle concurrent product searches during peak load', async () => {
      const searchTerms = ['widget', 'tool', 'box', 'cable', 'part', 'component', 'device', 'item']
      const concurrentSearches = 20
      const searchDuration = 20000 // 20 seconds

      // Pre-populate search cache with realistic data
      for (let i = 0; i < 1000; i++) {
        const product = {
          id: i + 1,
          sku: `SEARCH-${i + 1}`,
          name: `${searchTerms[i % searchTerms.length]} ${i + 1}`,
          category: `Category ${Math.floor(i / 100) + 1}`,
          description: `Description for product ${i + 1}`,
          searchKeywords: [searchTerms[i % searchTerms.length], `keyword${i}`]
        }

        await strategicCache.set(
          cacheStrategies.product.search,
          `search:${product.sku}`,
          product
        )
      }

      const startTime = Date.now()
      
      // Concurrent search workers
      const searchWorkers = Array.from({ length: concurrentSearches }, async (_, workerId) => {
        while (Date.now() - startTime < searchDuration) {
          const searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)]
          const opStart = performance.now()
          
          try {
            // Simulate search across multiple products
            const searchPromises = Array.from({ length: 10 }, (_, i) => {
              const sku = `SEARCH-${Math.floor(Math.random() * 1000) + 1}`
              return strategicCache.get(cacheStrategies.product.search, `search:${sku}`)
            })
            
            const results = await Promise.all(searchPromises)
            const foundResults = results.filter(result => result !== null)
            
            if (foundResults.length > 0) {
              recordSuccessfulOperation(performance.now() - opStart)
            } else {
              recordFailedOperation('product_search', 'No results found', performance.now() - opStart)
            }
          } catch (error) {
            recordFailedOperation('product_search', error instanceof Error ? error.message : 'Unknown error', performance.now() - opStart)
          }
          
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200)) // Variable delay
        }
      })

      await Promise.all(searchWorkers)

      const totalTime = Date.now() - startTime
      loadTestMetrics.operationsPerSecond = (loadTestMetrics.totalOperations * 1000) / totalTime

      expect(loadTestMetrics.successfulOperations).toBeGreaterThan(0)
      expect(loadTestMetrics.avgLatency).toBeLessThan(100) // Search should be fast with cache

      console.log(`Product Search Load Test: ${loadTestMetrics.successfulOperations} successful searches, avg ${loadTestMetrics.avgLatency.toFixed(2)}ms`)
    })
  })

  describe('Pallet Location Tracking Load Tests', () => {
    it('should handle frequent pallet movement updates', async () => {
      const { WAREHOUSE_PALLETS, PALLET_MOVEMENTS_PER_MINUTE, LOCATION_UPDATES_BATCH_SIZE } = LOAD_TEST_SCENARIOS
      const testDuration = 30000 // 30 seconds
      const startTime = Date.now()

      // Generate warehouse locations
      const locations = []
      for (let aisle = 1; aisle <= 20; aisle++) {
        for (let shelf = 1; shelf <= 10; shelf++) {
          for (let position = 1; position <= 5; position++) {
            locations.push(`${String.fromCharCode(64 + aisle)}-${shelf}-${position}`)
          }
        }
      }

      // Pre-populate pallets
      console.log(`Initializing ${WAREHOUSE_PALLETS} pallets...`)
      for (let i = 1; i <= WAREHOUSE_PALLETS; i++) {
        const pallet = {
          id: i,
          barcode: `PAL-${String(i).padStart(6, '0')}`,
          location: locations[Math.floor(Math.random() * locations.length)],
          status: 'active',
          lastMoved: Date.now(),
          items: Math.floor(Math.random() * 50) + 1
        }

        await strategicCache.set(
          cacheStrategies.pallet.position,
          `pallet:${i}`,
          pallet
        )
      }

      console.log('Starting pallet movement simulation...')

      // Simulate pallet movements
      const movementInterval = (60 * 1000) / PALLET_MOVEMENTS_PER_MINUTE // ms between movements
      let movementCount = 0

      const movementWorker = async () => {
        while (Date.now() - startTime < testDuration) {
          const batchSize = Math.min(LOCATION_UPDATES_BATCH_SIZE, PALLET_MOVEMENTS_PER_MINUTE)
          const batchPromises = []

          for (let i = 0; i < batchSize; i++) {
            const palletId = Math.floor(Math.random() * WAREHOUSE_PALLETS) + 1
            const newLocation = locations[Math.floor(Math.random() * locations.length)]
            
            const movePromise = (async () => {
              const opStart = performance.now()
              try {
                // Simulate atomic location update
                const lockResource = `pallet:move:${palletId}`
                const lockValue = await cacheService.acquireLock(lockResource, 2000, 1000)
                
                if (lockValue) {
                  const currentPallet = await strategicCache.get(cacheStrategies.pallet.position, `pallet:${palletId}`)
                  
                  if (currentPallet) {
                    await strategicCache.set(
                      cacheStrategies.pallet.position,
                      `pallet:${palletId}`,
                      { ...currentPallet, location: newLocation, lastMoved: Date.now() }
                    )

                    // Update location occupancy
                    await strategicCache.set(
                      cacheStrategies.position.occupancy,
                      `location:${newLocation}`,
                      { location: newLocation, palletId, occupiedAt: Date.now() }
                    )
                  }
                  
                  await cacheService.releaseLock(lockResource, lockValue)
                  recordSuccessfulOperation(performance.now() - opStart)
                } else {
                  recordFailedOperation('pallet_move', 'Lock acquisition failed', performance.now() - opStart)
                }
              } catch (error) {
                recordFailedOperation('pallet_move', error instanceof Error ? error.message : 'Unknown error', performance.now() - opStart)
              }
            })()

            batchPromises.push(movePromise)
          }

          await Promise.all(batchPromises)
          movementCount += batchSize

          await new Promise(resolve => setTimeout(resolve, movementInterval))
        }
      }

      await movementWorker()

      const totalTime = Date.now() - startTime
      loadTestMetrics.operationsPerSecond = (loadTestMetrics.totalOperations * 1000) / totalTime

      // Verify some pallets have been moved
      let movedPallets = 0
      for (let i = 1; i <= Math.min(100, WAREHOUSE_PALLETS); i++) {
        const pallet = await strategicCache.get(cacheStrategies.pallet.position, `pallet:${i}`)
        if (pallet && pallet.lastMoved > startTime) {
          movedPallets++
        }
      }

      expect(loadTestMetrics.successfulOperations).toBeGreaterThan(0)
      expect(movedPallets).toBeGreaterThan(0)
      expect(loadTestMetrics.operationsPerSecond).toBeGreaterThan(5)

      console.log(`Pallet Movement Load Test: ${movementCount} movements simulated, ${movedPallets} pallets moved, ${loadTestMetrics.operationsPerSecond.toFixed(1)} ops/sec`)
    })
  })

  describe('User Session Management Load Tests', () => {
    it('should handle peak user activity', async () => {
      const { PEAK_USERS, PEAK_DURATION_SECONDS } = LOAD_TEST_SCENARIOS
      const testDuration = PEAK_DURATION_SECONDS * 1000
      const startTime = Date.now()

      // Simulate peak user activity patterns
      const userSessions = Array.from({ length: PEAK_USERS }, (_, i) => ({
        userId: i + 1,
        sessionId: `session-${i + 1}-${Date.now()}`,
        loginTime: Date.now(),
        lastActivity: Date.now(),
        permissions: ['read', 'write'],
        warehouse: `WH-${Math.floor(i / 10) + 1}`
      }))

      console.log(`Simulating ${PEAK_USERS} concurrent users...`)

      // Concurrent user activity workers
      const userWorkers = userSessions.map(async (session) => {
        while (Date.now() - startTime < testDuration) {
          const activities = [
            'view_dashboard',
            'search_products',
            'update_stock',
            'move_pallet',
            'generate_report',
            'scan_barcode'
          ]
          
          const activity = activities[Math.floor(Math.random() * activities.length)]
          const opStart = performance.now()
          
          try {
            // Update session activity
            session.lastActivity = Date.now()
            await strategicCache.set(
              cacheStrategies.user.session,
              session.sessionId,
              session
            )

            // Cache user-specific data based on activity
            switch (activity) {
              case 'view_dashboard':
                await strategicCache.set(
                  cacheStrategies.user.preferences,
                  `dashboard:${session.userId}`,
                  { layout: 'default', widgets: ['stock', 'activity'] }
                )
                break
              
              case 'search_products':
                await strategicCache.get(cacheStrategies.product.search, `recent:${session.userId}`)
                break
              
              case 'update_stock':
                await strategicCache.get(cacheStrategies.product.stock, `stock:${Math.floor(Math.random() * 1000) + 1}`)
                break
            }

            recordSuccessfulOperation(performance.now() - opStart)
          } catch (error) {
            recordFailedOperation('user_activity', error instanceof Error ? error.message : 'Unknown error', performance.now() - opStart)
          }
          
          // Variable activity frequency
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 3000))
        }
      })

      await Promise.all(userWorkers)

      const totalTime = Date.now() - startTime
      loadTestMetrics.operationsPerSecond = (loadTestMetrics.totalOperations * 1000) / totalTime

      // Verify session integrity
      let activeSessions = 0
      for (const session of userSessions.slice(0, 10)) { // Check first 10 sessions
        const cachedSession = await strategicCache.get(cacheStrategies.user.session, session.sessionId)
        if (cachedSession && cachedSession.lastActivity > startTime) {
          activeSessions++
        }
      }

      expect(loadTestMetrics.successfulOperations).toBeGreaterThan(0)
      expect(activeSessions).toBeGreaterThan(0)
      expect(loadTestMetrics.operationsPerSecond).toBeGreaterThan(1)

      console.log(`Peak User Load Test: ${PEAK_USERS} users, ${loadTestMetrics.totalOperations} operations, ${loadTestMetrics.operationsPerSecond.toFixed(1)} ops/sec`)
    })
  })

  describe('Batch Operations Load Tests', () => {
    it('should handle bulk data import operations', async () => {
      const { BULK_IMPORT_SIZE, CONCURRENT_BATCH_JOBS } = LOAD_TEST_SCENARIOS
      const startTime = Date.now()

      console.log(`Starting ${CONCURRENT_BATCH_JOBS} concurrent bulk imports of ${BULK_IMPORT_SIZE} items each...`)

      // Concurrent bulk import workers
      const importWorkers = Array.from({ length: CONCURRENT_BATCH_JOBS }, async (_, jobId) => {
        const opStart = performance.now()
        
        try {
          // Simulate bulk product import
          const batchId = `batch-${jobId}-${Date.now()}`
          const products = Array.from({ length: BULK_IMPORT_SIZE }, (_, i) => ({
            id: jobId * BULK_IMPORT_SIZE + i + 1,
            sku: `BULK-${jobId}-${String(i + 1).padStart(6, '0')}`,
            name: `Bulk Product ${jobId}-${i + 1}`,
            stock: Math.floor(Math.random() * 500),
            category: `Category ${Math.floor(i / 100) + 1}`,
            importedAt: Date.now()
          }))

          // Process in smaller batches to avoid memory issues
          const batchSize = 100
          for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize)
            const batchPromises = batch.map(product =>
              strategicCache.set(
                cacheStrategies.product.details,
                `product:${product.id}`,
                product
              )
            )
            
            await Promise.all(batchPromises)
          }

          // Cache batch metadata
          await strategicCache.set(
            cacheStrategies.system.config,
            `import:${batchId}`,
            {
              batchId,
              jobId,
              itemCount: BULK_IMPORT_SIZE,
              status: 'completed',
              startTime: opStart,
              endTime: performance.now(),
              importedAt: Date.now()
            }
          )

          recordSuccessfulOperation(performance.now() - opStart)
        } catch (error) {
          recordFailedOperation('bulk_import', error instanceof Error ? error.message : 'Unknown error', performance.now() - opStart)
        }
      })

      await Promise.all(importWorkers)

      const totalTime = Date.now() - startTime
      const totalItems = CONCURRENT_BATCH_JOBS * BULK_IMPORT_SIZE
      const itemsPerSecond = (totalItems * 1000) / totalTime

      expect(loadTestMetrics.successfulOperations).toBe(CONCURRENT_BATCH_JOBS)
      expect(itemsPerSecond).toBeGreaterThan(100) // Minimum throughput for bulk operations

      console.log(`Bulk Import Load Test: ${totalItems} items imported in ${totalTime.toFixed(0)}ms, ${itemsPerSecond.toFixed(0)} items/sec`)
    })

    it('should handle bulk export operations under load', async () => {
      const { BULK_EXPORT_SIZE } = LOAD_TEST_SCENARIOS
      
      // Pre-populate data for export
      console.log(`Pre-populating ${BULK_EXPORT_SIZE} items for export...`)
      for (let i = 1; i <= BULK_EXPORT_SIZE; i++) {
        await strategicCache.set(
          cacheStrategies.product.details,
          `export:${i}`,
          {
            id: i,
            sku: `EXPORT-${String(i).padStart(6, '0')}`,
            name: `Export Product ${i}`,
            details: `Detailed information for product ${i}`,
            history: Array.from({ length: 10 }, (_, j) => ({
              action: `action_${j}`,
              timestamp: Date.now() - j * 86400000
            }))
          }
        )
      }

      const startTime = performance.now()
      const exportData = []

      // Batch export with concurrent reads
      const batchSize = 50
      for (let i = 1; i <= BULK_EXPORT_SIZE; i += batchSize) {
        const batchPromises = []
        
        for (let j = 0; j < batchSize && i + j <= BULK_EXPORT_SIZE; j++) {
          const id = i + j
          batchPromises.push(
            strategicCache.get(cacheStrategies.product.details, `export:${id}`)
          )
        }
        
        const batchResults = await Promise.all(batchPromises)
        exportData.push(...batchResults.filter(item => item !== null))
      }

      const totalTime = performance.now() - startTime
      const itemsPerSecond = (exportData.length * 1000) / totalTime

      expect(exportData.length).toBe(BULK_EXPORT_SIZE)
      expect(itemsPerSecond).toBeGreaterThan(500) // Export should be faster than import

      console.log(`Bulk Export Load Test: ${exportData.length} items exported in ${totalTime.toFixed(0)}ms, ${itemsPerSecond.toFixed(0)} items/sec`)
    })
  })

  // Helper functions
  function resetMetrics(): void {
    loadTestMetrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      avgLatency: 0,
      maxLatency: 0,
      operationsPerSecond: 0,
      memoryUsage: { 
        initial: loadTestMetrics.memoryUsage.initial, 
        peak: loadTestMetrics.memoryUsage.initial, 
        final: 0 
      },
      errors: []
    }
  }

  function recordSuccessfulOperation(latency: number): void {
    loadTestMetrics.totalOperations++
    loadTestMetrics.successfulOperations++
    loadTestMetrics.maxLatency = Math.max(loadTestMetrics.maxLatency, latency)
    
    // Update running average
    const total = loadTestMetrics.totalOperations
    loadTestMetrics.avgLatency = ((loadTestMetrics.avgLatency * (total - 1)) + latency) / total
  }

  function recordFailedOperation(operation: string, error: string, latency: number): void {
    loadTestMetrics.totalOperations++
    loadTestMetrics.failedOperations++
    loadTestMetrics.maxLatency = Math.max(loadTestMetrics.maxLatency, latency)
    loadTestMetrics.errors.push({ operation, error, timestamp: Date.now() })
    
    // Update running average
    const total = loadTestMetrics.totalOperations
    loadTestMetrics.avgLatency = ((loadTestMetrics.avgLatency * (total - 1)) + latency) / total
  }

  function generateLoadTestReport(): void {
    const report = {
      summary: {
        totalOperations: loadTestMetrics.totalOperations,
        successRate: (loadTestMetrics.successfulOperations / loadTestMetrics.totalOperations) * 100,
        avgLatency: loadTestMetrics.avgLatency,
        maxLatency: loadTestMetrics.maxLatency,
        operationsPerSecond: loadTestMetrics.operationsPerSecond
      },
      memory: {
        initialMB: loadTestMetrics.memoryUsage.initial,
        peakMB: loadTestMetrics.memoryUsage.peak,
        finalMB: loadTestMetrics.memoryUsage.final,
        increaseMB: loadTestMetrics.memoryUsage.final - loadTestMetrics.memoryUsage.initial
      },
      errors: loadTestMetrics.errors.reduce((grouped, error) => {
        grouped[error.operation] = (grouped[error.operation] || 0) + 1
        return grouped
      }, {} as Record<string, number>)
    }

    console.log('\n=== CACHE LOAD TEST REPORT ===')
    console.log(`Total Operations: ${report.summary.totalOperations}`)
    console.log(`Success Rate: ${report.summary.successRate.toFixed(2)}%`)
    console.log(`Average Latency: ${report.summary.avgLatency.toFixed(2)}ms`)
    console.log(`Max Latency: ${report.summary.maxLatency.toFixed(2)}ms`)
    console.log(`Operations/Second: ${report.summary.operationsPerSecond.toFixed(2)}`)
    console.log(`Memory Usage: ${report.memory.initialMB.toFixed(2)}MB -> ${report.memory.peakMB.toFixed(2)}MB (peak) -> ${report.memory.finalMB.toFixed(2)}MB`)
    
    if (Object.keys(report.errors).length > 0) {
      console.log('\nErrors by Operation:')
      Object.entries(report.errors).forEach(([operation, count]) => {
        console.log(`  ${operation}: ${count} errors`)
      })
    }
  }
})