import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { PackagingService } from '../../services/packaging.service';
import { db } from '../../db';
import { packagingTypes, ucpItems, products, users, ucps, pallets } from '../../db/schema';
import { TestDataFactory } from '../helpers/test-data-factory';

describe('Packaging Composition - Performance Tests', () => {
  let packagingService: PackagingService;
  let testUser: any;
  let testProducts: any[];
  let performanceMetrics: { [key: string]: number[] } = {};

  const recordMetric = (testName: string, duration: number) => {
    if (!performanceMetrics[testName]) {
      performanceMetrics[testName] = [];
    }
    performanceMetrics[testName].push(duration);
  };

  const getAverageTime = (testName: string): number => {
    const times = performanceMetrics[testName] || [];
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  };

  const getMaxTime = (testName: string): number => {
    const times = performanceMetrics[testName] || [];
    return Math.max(...times);
  };

  beforeAll(async () => {
    packagingService = new PackagingService();
    TestDataFactory.resetCounters();

    // Create test user
    testUser = TestDataFactory.createUser({ role: 'admin' });
    await db.insert(users).values({
      id: parseInt(testUser.id.replace('test-user-', '')),
      email: testUser.email,
      password: '$2b$10$hashedpassword',
      firstName: testUser.firstName,
      lastName: testUser.lastName,
      role: testUser.role
    });

    // Create multiple test products for performance testing
    const productData = Array.from({ length: 10 }, () => TestDataFactory.createProduct());
    const insertedProducts = await db.insert(products).values(
      productData.map(product => ({
        sku: product.code,
        name: product.name,
        description: product.description,
        unit: 'un',
        weight: product.weight.toString(),
        dimensions: product.dimensions,
        isActive: true,
        createdBy: parseInt(testUser.id.replace('test-user-', ''))
      }))
    ).returning();

    testProducts = insertedProducts;

    // Create packaging hierarchies for each product
    for (const product of testProducts) {
      const packagingData = [
        {
          productId: product.id,
          name: 'Unidade',
          baseUnitQuantity: '1.000',
          isBaseUnit: true,
          level: 1,
          createdBy: parseInt(testUser.id.replace('test-user-', ''))
        },
        {
          productId: product.id,
          name: 'Caixa 6un',
          baseUnitQuantity: '6.000',
          isBaseUnit: false,
          level: 2,
          createdBy: parseInt(testUser.id.replace('test-user-', ''))
        },
        {
          productId: product.id,
          name: 'Caixa 12un',
          baseUnitQuantity: '12.000',
          isBaseUnit: false,
          level: 2,
          createdBy: parseInt(testUser.id.replace('test-user-', ''))
        },
        {
          productId: product.id,
          name: 'Display 24un',
          baseUnitQuantity: '24.000',
          isBaseUnit: false,
          level: 3,
          createdBy: parseInt(testUser.id.replace('test-user-', ''))
        },
        {
          productId: product.id,
          name: 'Caixa Master 144un',
          baseUnitQuantity: '144.000',
          isBaseUnit: false,
          level: 4,
          createdBy: parseInt(testUser.id.replace('test-user-', ''))
        },
        {
          productId: product.id,
          name: 'Pallet 1440un',
          baseUnitQuantity: '1440.000',
          isBaseUnit: false,
          level: 5,
          createdBy: parseInt(testUser.id.replace('test-user-', ''))
        }
      ];

      await db.insert(packagingTypes).values(packagingData);
    }

    // Create stock data for performance testing
    const pallet = TestDataFactory.createPallet();
    const [insertedPallet] = await db.insert(pallets).values({
      code: pallet.code,
      type: pallet.type,
      material: 'Madeira',
      width: pallet.dimensions.width,
      length: pallet.dimensions.height,
      height: 20,
      maxWeight: pallet.maxWeight.toString(),
      status: 'disponivel',
      createdBy: parseInt(testUser.id.replace('test-user-', ''))
    }).returning();

    const ucp = TestDataFactory.createUCP(insertedPallet.id.toString(), testUser.id);
    const [insertedUcp] = await db.insert(ucps).values({
      code: ucp.code,
      palletId: insertedPallet.id,
      status: 'active',
      createdBy: parseInt(testUser.id.replace('test-user-', ''))
    }).returning();

    // Add significant stock for each product
    for (const product of testProducts) {
      const packagings = await packagingService.getPackagingsByProduct(product.id);
      
      for (const packaging of packagings) {
        await db.insert(ucpItems).values({
          ucpId: insertedUcp.id,
          productId: product.id,
          quantity: '1000.000', // Large quantity for each packaging
          packagingTypeId: packaging.id,
          addedBy: parseInt(testUser.id.replace('test-user-', ''))
        });
      }
    }
  });

  afterAll(async () => {
    // Clean up all test data
    await db.delete(ucpItems);
    await db.delete(packagingTypes);
    await db.delete(products);
    await db.delete(ucps);
    await db.delete(pallets);
    await db.delete(users).where(db.eq(users.email, testUser.email));

    // Print performance summary
    console.log('\n🚀 Performance Test Results Summary:');
    console.log('=' .repeat(50));
    
    Object.entries(performanceMetrics).forEach(([testName, times]) => {
      const avgTime = getAverageTime(testName);
      const maxTime = getMaxTime(testName);
      const minTime = Math.min(...times);
      
      console.log(`📊 ${testName}:`);
      console.log(`   Average: ${avgTime.toFixed(2)}ms`);
      console.log(`   Min/Max: ${minTime.toFixed(2)}ms / ${maxTime.toFixed(2)}ms`);
      console.log(`   Runs: ${times.length}`);
      console.log('');
    });
  });

  describe('Packaging Retrieval Performance', () => {
    it('should retrieve packagings for product under 50ms', async () => {
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const product = testProducts[i % testProducts.length];
        
        const startTime = performance.now();
        const result = await packagingService.getPackagingsByProduct(product.id);
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        recordMetric('getPackagingsByProduct', duration);
        
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
        expect(duration).toBeLessThan(50); // Should complete in under 50ms
      }
    });

    it('should retrieve stock by packaging under 100ms', async () => {
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const product = testProducts[i % testProducts.length];
        
        const startTime = performance.now();
        const result = await packagingService.getStockByPackaging(product.id);
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        recordMetric('getStockByPackaging', duration);
        
        expect(result).toBeDefined();
        expect(duration).toBeLessThan(100); // Should complete in under 100ms
      }
    });

    it('should retrieve consolidated stock under 30ms', async () => {
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const product = testProducts[i % testProducts.length];
        
        const startTime = performance.now();
        const result = await packagingService.getStockConsolidated(product.id);
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        recordMetric('getStockConsolidated', duration);
        
        expect(result).toBeDefined();
        expect(duration).toBeLessThan(30); // Should complete in under 30ms
      }
    });
  });

  describe('Unit Conversion Performance', () => {
    it('should perform unit conversions under 20ms', async () => {
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        const product = testProducts[i % testProducts.length];
        const packagings = await packagingService.getPackagingsByProduct(product.id);
        const packaging = packagings[i % packagings.length];
        
        const startTime = performance.now();
        const result = await packagingService.convertToBaseUnits(100, packaging.id);
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        recordMetric('convertToBaseUnits', duration);
        
        expect(result).toBeGreaterThan(0);
        expect(duration).toBeLessThan(20); // Should complete in under 20ms
      }
    });

    it('should calculate conversion factors under 25ms', async () => {
      const iterations = 50;
      
      for (let i = 0; i < iterations; i++) {
        const product = testProducts[i % testProducts.length];
        const packagings = await packagingService.getPackagingsByProduct(product.id);
        
        if (packagings.length >= 2) {
          const fromPackaging = packagings[0];
          const toPackaging = packagings[1];
          
          const startTime = performance.now();
          const result = await packagingService.calculateConversionFactor(fromPackaging.id, toPackaging.id);
          const endTime = performance.now();
          
          const duration = endTime - startTime;
          recordMetric('calculateConversionFactor', duration);
          
          expect(result).toBeGreaterThan(0);
          expect(duration).toBeLessThan(25); // Should complete in under 25ms
        }
      }
    });
  });

  describe('Picking Optimization Performance', () => {
    it('should optimize picking for small quantities under 100ms', async () => {
      const iterations = 20;
      
      for (let i = 0; i < iterations; i++) {
        const product = testProducts[i % testProducts.length];
        const requestedUnits = 50 + (i * 10); // 50-240 units
        
        const startTime = performance.now();
        const result = await packagingService.optimizePickingByPackaging(product.id, requestedUnits);
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        recordMetric('optimizePickingSmall', duration);
        
        expect(result).toBeDefined();
        expect(result.pickingPlan).toBeDefined();
        expect(duration).toBeLessThan(100); // Should complete in under 100ms
      }
    });

    it('should optimize picking for large quantities under 200ms', async () => {
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const product = testProducts[i % testProducts.length];
        const requestedUnits = 5000 + (i * 1000); // 5000-14000 units
        
        const startTime = performance.now();
        const result = await packagingService.optimizePickingByPackaging(product.id, requestedUnits);
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        recordMetric('optimizePickingLarge', duration);
        
        expect(result).toBeDefined();
        expect(result.pickingPlan).toBeDefined();
        expect(duration).toBeLessThan(200); // Should complete in under 200ms
      }
    });

    it('should handle complex packaging hierarchies efficiently', async () => {
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const product = testProducts[i % testProducts.length];
        
        const startTime = performance.now();
        const hierarchy = await packagingService.getPackagingHierarchy(product.id);
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        recordMetric('getPackagingHierarchy', duration);
        
        expect(hierarchy).toBeDefined();
        expect(Array.isArray(hierarchy)).toBe(true);
        expect(duration).toBeLessThan(75); // Should complete in under 75ms
      }
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle multiple concurrent packaging lookups', async () => {
      const concurrentRequests = 20;
      
      const startTime = performance.now();
      
      const promises = Array.from({ length: concurrentRequests }, (_, i) => {
        const product = testProducts[i % testProducts.length];
        return packagingService.getPackagingsByProduct(product.id);
      });
      
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      recordMetric('concurrentPackagingLookups', duration);
      
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      });
      
      expect(duration).toBeLessThan(500); // 20 concurrent requests in under 500ms
    });

    it('should handle multiple concurrent optimizations', async () => {
      const concurrentRequests = 10;
      
      const startTime = performance.now();
      
      const promises = Array.from({ length: concurrentRequests }, (_, i) => {
        const product = testProducts[i % testProducts.length];
        const requestedUnits = 100 + (i * 50);
        return packagingService.optimizePickingByPackaging(product.id, requestedUnits);
      });
      
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      recordMetric('concurrentOptimizations', duration);
      
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.pickingPlan).toBeDefined();
      });
      
      expect(duration).toBeLessThan(1000); // 10 concurrent optimizations in under 1 second
    });
  });

  describe('Memory Usage and Efficiency', () => {
    it('should not cause memory leaks during repeated operations', async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        const product = testProducts[i % testProducts.length];
        
        // Perform various operations
        await packagingService.getPackagingsByProduct(product.id);
        await packagingService.getStockConsolidated(product.id);
        await packagingService.getStockByPackaging(product.id);
        
        if (i % 10 === 0) {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should efficiently handle large datasets', async () => {
      // Test with a product that has many packaging types
      const product = testProducts[0];
      
      // Add more packaging types to simulate complex hierarchy
      const additionalPackagings = Array.from({ length: 50 }, (_, i) => ({
        productId: product.id,
        name: `Test Package ${i + 10}`,
        baseUnitQuantity: `${(i + 1) * 5}.000`,
        isBaseUnit: false,
        level: (i % 5) + 2,
        createdBy: parseInt(testUser.id.replace('test-user-', ''))
      }));
      
      await db.insert(packagingTypes).values(additionalPackagings);
      
      const startTime = performance.now();
      const packagings = await packagingService.getPackagingsByProduct(product.id);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      recordMetric('largeDatasetRetrieval', duration);
      
      expect(packagings.length).toBeGreaterThan(50);
      expect(duration).toBeLessThan(150); // Should handle large dataset in under 150ms
    });
  });

  describe('Database Query Optimization', () => {
    it('should minimize database queries in picking optimization', async () => {
      const product = testProducts[0];
      
      // Mock db to count queries (simplified approach)
      let queryCount = 0;
      const originalSelect = db.select;
      
      const mockSelect = (...args: any[]) => {
        queryCount++;
        return originalSelect.apply(db, args);
      };
      
      (db as any).select = mockSelect;
      
      const startTime = performance.now();
      await packagingService.optimizePickingByPackaging(product.id, 500);
      const endTime = performance.now();
      
      // Restore original method
      (db as any).select = originalSelect;
      
      const duration = endTime - startTime;
      recordMetric('queryOptimization', duration);
      
      // Should use minimal queries (ideally 2-3: get packagings, get stock)
      expect(queryCount).toBeLessThanOrEqual(5);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Stress Testing', () => {
    it('should maintain performance under heavy load', async () => {
      const heavyLoad = 200;
      const startTime = performance.now();
      
      const promises = [];
      for (let i = 0; i < heavyLoad; i++) {
        const product = testProducts[i % testProducts.length];
        const operation = i % 4;
        
        switch (operation) {
          case 0:
            promises.push(packagingService.getPackagingsByProduct(product.id));
            break;
          case 1:
            promises.push(packagingService.getStockConsolidated(product.id));
            break;
          case 2:
            promises.push(packagingService.getStockByPackaging(product.id));
            break;
          case 3:
            promises.push(packagingService.optimizePickingByPackaging(product.id, 100 + i));
            break;
        }
      }
      
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      recordMetric('stressTest', duration);
      
      expect(results).toHaveLength(heavyLoad);
      expect(duration).toBeLessThan(5000); // 200 operations in under 5 seconds
      
      // All operations should succeed
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });
});