import { performance } from 'perf_hooks';
import { PackagingCompositionService } from '../../services/packaging-composition.service';
import { db } from '../../db';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database-test-helper';
import { createTestData, TestDataFactory } from '../helpers/test-data-factory';

// Performance test configuration
interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
  };
  iterations: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  throughput: number; // operations per second
}

interface PerformanceThresholds {
  maxExecutionTime: number; // ms
  maxMemoryIncrease: number; // bytes
  minThroughput: number; // ops/sec
}

describe('PackagingComposition Performance Tests', () => {
  let service: PackagingCompositionService;
  let testData: TestDataFactory;

  // Performance thresholds
  const THRESHOLDS: Record<string, PerformanceThresholds> = {
    calculateOptimalComposition: {
      maxExecutionTime: 1000, // 1 second for single composition
      maxMemoryIncrease: 50 * 1024 * 1024, // 50MB
      minThroughput: 10 // 10 compositions per second
    },
    validateCompositionConstraints: {
      maxExecutionTime: 200, // 200ms for validation
      maxMemoryIncrease: 10 * 1024 * 1024, // 10MB
      minThroughput: 50 // 50 validations per second
    },
    layoutOptimization: {
      maxExecutionTime: 500, // 500ms for layout calculation
      maxMemoryIncrease: 20 * 1024 * 1024, // 20MB
      minThroughput: 20 // 20 layouts per second
    },
    batchProcessing: {
      maxExecutionTime: 5000, // 5 seconds for batch of 100
      maxMemoryIncrease: 100 * 1024 * 1024, // 100MB
      minThroughput: 100 // 100 compositions in 5 seconds
    }
  };

  beforeAll(async () => {
    await setupTestDatabase();
    testData = await createTestData();
    service = new PackagingCompositionService();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  async function measurePerformance<T>(
    testName: string,
    operation: () => Promise<T>,
    iterations: number = 1
  ): Promise<PerformanceMetrics> {
    const times: number[] = [];
    let memoryBefore: NodeJS.MemoryUsage;
    let memoryAfter: NodeJS.MemoryUsage;
    let memoryPeak: NodeJS.MemoryUsage = process.memoryUsage();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    memoryBefore = process.memoryUsage();

    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      const iterationStart = performance.now();
      
      try {
        await operation();
      } catch (error) {
        console.error(`Performance test ${testName} failed on iteration ${i}:`, error);
        throw error;
      }

      const iterationEnd = performance.now();
      times.push(iterationEnd - iterationStart);

      // Track peak memory usage
      const currentMemory = process.memoryUsage();
      if (currentMemory.heapUsed > memoryPeak.heapUsed) {
        memoryPeak = currentMemory;
      }
    }

    const endTime = performance.now();
    memoryAfter = process.memoryUsage();

    const totalTime = endTime - startTime;
    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const throughput = (iterations / totalTime) * 1000; // ops per second

    return {
      executionTime: totalTime,
      memoryUsage: {
        before: memoryBefore,
        after: memoryAfter,
        peak: memoryPeak
      },
      iterations,
      averageTime,
      minTime,
      maxTime,
      throughput
    };
  }

  function assertPerformanceThresholds(
    testName: string,
    metrics: PerformanceMetrics,
    thresholds: PerformanceThresholds
  ) {
    const memoryIncrease = metrics.memoryUsage.after.heapUsed - metrics.memoryUsage.before.heapUsed;

    console.log(`\n📊 Performance Metrics for ${testName}:`);
    console.log(`   ⏱️  Total Time: ${metrics.executionTime.toFixed(2)}ms`);
    console.log(`   📊 Average Time: ${metrics.averageTime.toFixed(2)}ms`);
    console.log(`   ⚡ Throughput: ${metrics.throughput.toFixed(2)} ops/sec`);
    console.log(`   💾 Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   🎯 Iterations: ${metrics.iterations}`);

    // Assert performance thresholds
    expect(metrics.executionTime).toBeLessThanOrEqual(thresholds.maxExecutionTime);
    expect(memoryIncrease).toBeLessThanOrEqual(thresholds.maxMemoryIncrease);
    expect(metrics.throughput).toBeGreaterThanOrEqual(thresholds.minThroughput);
  }

  describe('Single Operation Performance', () => {
    it('should calculate optimal composition within performance thresholds', async () => {
      const compositionRequest = {
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 25,
            packagingTypeId: testData.packaging.unit1.id
          },
          {
            productId: testData.products.testProduct2.id,
            quantity: 15,
            packagingTypeId: testData.packaging.unit2.id
          },
          {
            productId: testData.products.testProduct3.id,
            quantity: 10,
            packagingTypeId: testData.packaging.unit3.id
          }
        ],
        palletId: testData.pallets.standardPallet.id,
        constraints: {
          maxWeight: 800,
          maxHeight: 180,
          maxVolume: 2.0
        }
      };

      const metrics = await measurePerformance(
        'calculateOptimalComposition',
        () => service.calculateOptimalComposition(compositionRequest),
        10
      );

      assertPerformanceThresholds(
        'calculateOptimalComposition',
        metrics,
        THRESHOLDS.calculateOptimalComposition
      );
    });

    it('should validate composition constraints within performance thresholds', async () => {
      const validationRequest = {
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 20,
            packagingTypeId: testData.packaging.unit1.id
          }
        ],
        palletId: testData.pallets.standardPallet.id
      };

      const metrics = await measurePerformance(
        'validateCompositionConstraints',
        () => service.validateCompositionConstraints(validationRequest),
        25
      );

      assertPerformanceThresholds(
        'validateCompositionConstraints',
        metrics,
        THRESHOLDS.validateCompositionConstraints
      );
    });
  });

  describe('Scalability Performance Tests', () => {
    it('should handle increasing product counts efficiently', async () => {
      const productCounts = [5, 10, 25, 50, 100];
      const performanceData: Array<{ count: number; metrics: PerformanceMetrics }> = [];

      for (const count of productCounts) {
        const products = Array.from({ length: count }, (_, i) => ({
          productId: testData.products.testProduct1.id,
          quantity: 1 + (i % 10), // Varying quantities
          packagingTypeId: testData.packaging.unit1.id
        }));

        const compositionRequest = {
          products,
          palletId: testData.pallets.standardPallet.id
        };

        const metrics = await measurePerformance(
          `composition-${count}-products`,
          () => service.calculateOptimalComposition(compositionRequest),
          3
        );

        performanceData.push({ count, metrics });

        console.log(`\n📈 Products: ${count}, Time: ${metrics.averageTime.toFixed(2)}ms`);
      }

      // Verify scalability - time should not increase exponentially
      for (let i = 1; i < performanceData.length; i++) {
        const current = performanceData[i];
        const previous = performanceData[i - 1];
        
        const timeIncrease = current.metrics.averageTime / previous.metrics.averageTime;
        const productIncrease = current.count / previous.count;

        // Time increase should be roughly linear with product increase
        expect(timeIncrease).toBeLessThan(productIncrease * 2);
      }
    });

    it('should handle varying constraint complexity efficiently', async () => {
      const baseRequest = {
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 15,
            packagingTypeId: testData.packaging.unit1.id
          }
        ],
        palletId: testData.pallets.standardPallet.id
      };

      // Test without constraints
      const noConstraintsMetrics = await measurePerformance(
        'no-constraints',
        () => service.calculateOptimalComposition(baseRequest),
        10
      );

      // Test with simple constraints
      const simpleConstraintsMetrics = await measurePerformance(
        'simple-constraints',
        () => service.calculateOptimalComposition({
          ...baseRequest,
          constraints: { maxWeight: 1000 }
        }),
        10
      );

      // Test with complex constraints
      const complexConstraintsMetrics = await measurePerformance(
        'complex-constraints',
        () => service.calculateOptimalComposition({
          ...baseRequest,
          constraints: {
            maxWeight: 800,
            maxHeight: 180,
            maxVolume: 1.5
          }
        }),
        10
      );

      console.log('\n🎯 Constraint Complexity Performance:');
      console.log(`   No constraints: ${noConstraintsMetrics.averageTime.toFixed(2)}ms`);
      console.log(`   Simple: ${simpleConstraintsMetrics.averageTime.toFixed(2)}ms`);
      console.log(`   Complex: ${complexConstraintsMetrics.averageTime.toFixed(2)}ms`);

      // Complex constraints should not significantly impact performance
      expect(complexConstraintsMetrics.averageTime).toBeLessThan(
        noConstraintsMetrics.averageTime * 2
      );
    });
  });

  describe('Batch Processing Performance', () => {
    it('should process multiple compositions efficiently', async () => {
      const batchSize = 50;
      const compositions = Array.from({ length: batchSize }, (_, i) => ({
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 5 + (i % 15),
            packagingTypeId: testData.packaging.unit1.id
          }
        ],
        palletId: testData.pallets.standardPallet.id
      }));

      const metrics = await measurePerformance(
        'batch-processing',
        async () => {
          const promises = compositions.map(comp => 
            service.calculateOptimalComposition(comp)
          );
          await Promise.all(promises);
        },
        2
      );

      assertPerformanceThresholds(
        'batch-processing',
        metrics,
        THRESHOLDS.batchProcessing
      );
    });

    it('should handle concurrent validation requests efficiently', async () => {
      const concurrentRequests = 20;
      const validationRequest = {
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 10,
            packagingTypeId: testData.packaging.unit1.id
          }
        ],
        palletId: testData.pallets.standardPallet.id
      };

      const metrics = await measurePerformance(
        'concurrent-validations',
        async () => {
          const promises = Array.from({ length: concurrentRequests }, () =>
            service.validateCompositionConstraints(validationRequest)
          );
          await Promise.all(promises);
        },
        3
      );

      console.log(`\n🔄 Concurrent Validation Performance:`);
      console.log(`   ${concurrentRequests} concurrent requests`);
      console.log(`   Average time: ${metrics.averageTime.toFixed(2)}ms`);
      console.log(`   Throughput: ${(concurrentRequests / metrics.averageTime * 1000).toFixed(2)} ops/sec`);

      // Should handle concurrent requests efficiently
      expect(metrics.averageTime).toBeLessThan(2000); // 2 seconds for 20 concurrent requests
    });
  });

  describe('Memory Management Performance', () => {
    it('should not have memory leaks during repeated operations', async () => {
      const compositionRequest = {
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 10,
            packagingTypeId: testData.packaging.unit1.id
          }
        ],
        palletId: testData.pallets.standardPallet.id
      };

      // Measure memory usage over multiple iterations
      const iterations = 100;
      const memorySnapshots: number[] = [];

      for (let i = 0; i < iterations; i++) {
        await service.calculateOptimalComposition(compositionRequest);
        
        if (i % 10 === 0) {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
          memorySnapshots.push(process.memoryUsage().heapUsed);
        }
      }

      console.log('\n💾 Memory Usage Over Time:');
      memorySnapshots.forEach((mem, i) => {
        console.log(`   Iteration ${i * 10}: ${(mem / 1024 / 1024).toFixed(2)}MB`);
      });

      // Memory usage should not continuously increase (no major leaks)
      const firstSnapshot = memorySnapshots[0];
      const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
      const memoryIncrease = lastSnapshot - firstSnapshot;

      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });

    it('should handle large compositions without excessive memory usage', async () => {
      const largeCompositionRequest = {
        products: Array.from({ length: 200 }, (_, i) => ({
          productId: testData.products.testProduct1.id,
          quantity: 1 + (i % 5),
          packagingTypeId: testData.packaging.unit1.id
        })),
        palletId: testData.pallets.standardPallet.id
      };

      const memoryBefore = process.memoryUsage().heapUsed;
      
      await service.calculateOptimalComposition(largeCompositionRequest);

      if (global.gc) {
        global.gc();
      }
      
      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;

      console.log(`\n🏗️  Large Composition Memory Usage:`);
      console.log(`   Products: 200`);
      console.log(`   Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Should not use excessive memory for large compositions
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });
  });

  describe('Algorithm Complexity Analysis', () => {
    it('should demonstrate linear time complexity for product count increase', async () => {
      const testSizes = [10, 20, 40, 80];
      const timingData: Array<{ size: number; time: number }> = [];

      for (const size of testSizes) {
        const products = Array.from({ length: size }, (_, i) => ({
          productId: testData.products.testProduct1.id,
          quantity: 2,
          packagingTypeId: testData.packaging.unit1.id
        }));

        const compositionRequest = {
          products,
          palletId: testData.pallets.standardPallet.id
        };

        const metrics = await measurePerformance(
          `complexity-${size}`,
          () => service.calculateOptimalComposition(compositionRequest),
          5
        );

        timingData.push({ size, time: metrics.averageTime });
      }

      console.log('\n📊 Time Complexity Analysis:');
      timingData.forEach(({ size, time }) => {
        console.log(`   Size ${size}: ${time.toFixed(2)}ms`);
      });

      // Calculate time complexity ratios
      for (let i = 1; i < timingData.length; i++) {
        const current = timingData[i];
        const previous = timingData[i - 1];
        
        const timeRatio = current.time / previous.time;
        const sizeRatio = current.size / previous.size;
        
        console.log(`   Size ratio: ${sizeRatio}x, Time ratio: ${timeRatio.toFixed(2)}x`);
        
        // Time should not increase quadratically or worse
        expect(timeRatio).toBeLessThan(sizeRatio * sizeRatio);
      }
    });

    it('should handle edge cases efficiently', async () => {
      const edgeCases = [
        {
          name: 'single-product-large-quantity',
          request: {
            products: [
              {
                productId: testData.products.testProduct1.id,
                quantity: 1000,
                packagingTypeId: testData.packaging.unit1.id
              }
            ],
            palletId: testData.pallets.standardPallet.id
          }
        },
        {
          name: 'many-products-small-quantities',
          request: {
            products: Array.from({ length: 50 }, (_, i) => ({
              productId: testData.products.testProduct1.id,
              quantity: 1,
              packagingTypeId: testData.packaging.unit1.id
            })),
            palletId: testData.pallets.standardPallet.id
          }
        },
        {
          name: 'tight-constraints',
          request: {
            products: [
              {
                productId: testData.products.testProduct1.id,
                quantity: 50,
                packagingTypeId: testData.packaging.unit1.id
              }
            ],
            palletId: testData.pallets.standardPallet.id,
            constraints: {
              maxWeight: 100, // Very tight constraint
              maxHeight: 50,
              maxVolume: 0.1
            }
          }
        }
      ];

      for (const edgeCase of edgeCases) {
        const metrics = await measurePerformance(
          edgeCase.name,
          () => service.calculateOptimalComposition(edgeCase.request),
          3
        );

        console.log(`\n⚠️  Edge Case: ${edgeCase.name}`);
        console.log(`   Time: ${metrics.averageTime.toFixed(2)}ms`);
        console.log(`   Throughput: ${metrics.throughput.toFixed(2)} ops/sec`);

        // Edge cases should still complete within reasonable time
        expect(metrics.averageTime).toBeLessThan(2000); // 2 seconds max
      }
    });
  });

  describe('Performance Regression Tests', () => {
    it('should maintain performance after multiple sequential operations', async () => {
      const compositionRequest = {
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 15,
            packagingTypeId: testData.packaging.unit1.id
          }
        ],
        palletId: testData.pallets.standardPallet.id
      };

      // Measure performance at different stages
      const stages = [10, 50, 100, 200];
      const performanceHistory: Array<{ stage: number; metrics: PerformanceMetrics }> = [];

      for (const stage of stages) {
        // Perform operations leading up to this stage
        for (let i = 0; i < stage - (performanceHistory.length > 0 ? performanceHistory[performanceHistory.length - 1].stage : 0); i++) {
          await service.calculateOptimalComposition(compositionRequest);
        }

        // Measure current performance
        const metrics = await measurePerformance(
          `stage-${stage}`,
          () => service.calculateOptimalComposition(compositionRequest),
          5
        );

        performanceHistory.push({ stage, metrics });
      }

      console.log('\n📈 Performance Regression Analysis:');
      performanceHistory.forEach(({ stage, metrics }) => {
        console.log(`   After ${stage} ops: ${metrics.averageTime.toFixed(2)}ms`);
      });

      // Performance should not degrade significantly over time
      const firstStage = performanceHistory[0];
      const lastStage = performanceHistory[performanceHistory.length - 1];
      
      const performanceDegradation = lastStage.metrics.averageTime / firstStage.metrics.averageTime;
      
      expect(performanceDegradation).toBeLessThan(1.5); // No more than 50% degradation
    });
  });
});