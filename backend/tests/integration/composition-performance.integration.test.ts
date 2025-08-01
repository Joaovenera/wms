import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/test-app-factory';
import { TestDataFactory } from '../helpers/test-data-factory';
import { db } from '../../src/db';
import { 
  packagingTypes, 
  ucpItems, 
  products, 
  users, 
  ucps, 
  pallets,
  packagingCompositions,
  compositionItems,
  compositionReports
} from '../../src/db/schema';
import { eq } from 'drizzle-orm';

describe('Composition Performance and Caching - Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let testUser: any;
  let testProducts: any[];
  let testPackagings: any[][];
  let testPallets: any[];

  beforeAll(async () => {
    app = await createTestApp();
    TestDataFactory.resetCounters();

    // Create test user for authentication
    testUser = TestDataFactory.createUser({ role: 'admin' });
    await db.insert(users).values({
      id: parseInt(testUser.id.replace('test-user-', '')),
      email: testUser.email,
      password: '$2b$10$hashedpassword',
      firstName: testUser.firstName,
      lastName: testUser.lastName,
      role: testUser.role
    });

    // Get auth token for requests
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'test123'
      });
    
    authToken = loginResponse.body.token;
  });

  beforeEach(async () => {
    // Create multiple test pallets for performance testing
    const palletData = Array.from({ length: 5 }, () => TestDataFactory.createPallet());
    testPallets = await Promise.all(
      palletData.map(async (pallet) => {
        const [inserted] = await db.insert(pallets).values({
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
        return inserted;
      })
    );

    // Create multiple test products with varying characteristics
    const productData = Array.from({ length: 10 }, (_, index) => ({
      ...TestDataFactory.createProduct(),
      weight: (1.5 + index * 0.3).toString(),
      dimensions: { 
        width: 8 + index, 
        length: 10 + index, 
        height: 4 + Math.floor(index / 2) 
      }
    }));

    testProducts = await Promise.all(
      productData.map(async (product) => {
        const [inserted] = await db.insert(products).values({
          sku: product.code,
          name: product.name,
          description: product.description,
          unit: 'un',
          weight: product.weight,
          dimensions: product.dimensions,
          isActive: true,
          createdBy: parseInt(testUser.id.replace('test-user-', ''))
        }).returning();
        return inserted;
      })
    );

    // Create packaging hierarchies for each product
    testPackagings = await Promise.all(
      testProducts.map(async (product, index) => {
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
            name: `Caixa ${(index + 1) * 6}un`,
            barcode: `${1000000000000 + index}`,
            baseUnitQuantity: `${(index + 1) * 6}.000`,
            isBaseUnit: false,
            level: 2,
            createdBy: parseInt(testUser.id.replace('test-user-', ''))
          },
          {
            productId: product.id,
            name: `Pallet ${(index + 1) * 60}un`,
            barcode: `${2000000000000 + index}`,
            baseUnitQuantity: `${(index + 1) * 60}.000`,
            isBaseUnit: false,
            level: 3,
            createdBy: parseInt(testUser.id.replace('test-user-', ''))
          }
        ];

        return await db.insert(packagingTypes).values(packagingData).returning();
      })
    );
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(compositionReports);
    await db.delete(compositionItems);
    await db.delete(packagingCompositions);
    
    for (const product of testProducts) {
      await db.delete(ucpItems).where(eq(ucpItems.productId, product.id));
      await db.delete(packagingTypes).where(eq(packagingTypes.productId, product.id));
      await db.delete(products).where(eq(products.id, product.id));
    }
    
    for (const pallet of testPallets) {
      await db.delete(pallets).where(eq(pallets.id, pallet.id));
    }
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, testUser.email));
  });

  describe('Calculation Performance Tests', () => {
    it('should handle single product composition calculations within performance thresholds', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProducts[0].id,
              quantity: 100,
              packagingTypeId: testPackagings[0].find(p => p.isBaseUnit).id
            }
          ],
          palletId: testPallets[0].id
        })
        .expect(200);

      const duration = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      
      // Verify response time header if set
      if (response.headers['x-response-time']) {
        const responseTime = parseInt(response.headers['x-response-time']);
        expect(responseTime).toBeLessThan(1000);
      }
    });

    it('should handle multi-product compositions within performance thresholds', async () => {
      const products = testProducts.slice(0, 5).map((product, index) => ({
        productId: product.id,
        quantity: 20 + (index * 5),
        packagingTypeId: testPackagings[index].find(p => p.isBaseUnit).id
      }));

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: products,
          palletId: testPallets[0].id
        })
        .expect(200);

      const duration = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(5);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds for multi-product
    });

    it('should handle complex compositions with many products efficiently', async () => {
      const products = testProducts.map((product, index) => ({
        productId: product.id,
        quantity: 10 + (index * 2),
        packagingTypeId: testPackagings[index].find(p => p.isBaseUnit).id
      }));

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: products,
          palletId: testPallets[0].id,
          constraints: {
            maxWeight: 1000,
            maxHeight: 200,
            maxVolume: 2.0
          }
        })
        .expect(200);

      const duration = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(testProducts.length);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds for complex composition
    });

    it('should scale calculation time appropriately with product count', async () => {
      const smallProducts = testProducts.slice(0, 2).map((product, index) => ({
        productId: product.id,
        quantity: 20,
        packagingTypeId: testPackagings[index].find(p => p.isBaseUnit).id
      }));

      const largeProducts = testProducts.slice(0, 8).map((product, index) => ({
        productId: product.id,
        quantity: 20,
        packagingTypeId: testPackagings[index].find(p => p.isBaseUnit).id
      }));

      // Test small composition
      const smallStart = Date.now();
      const smallResponse = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: smallProducts,
          palletId: testPallets[0].id
        })
        .expect(200);
      const smallDuration = Date.now() - smallStart;

      // Test large composition
      const largeStart = Date.now();
      const largeResponse = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: largeProducts,
          palletId: testPallets[0].id
        })
        .expect(200);
      const largeDuration = Date.now() - largeStart;

      expect(smallResponse.body.success).toBe(true);
      expect(largeResponse.body.success).toBe(true);
      
      // Large composition should take longer but not exponentially so
      const scalingFactor = largeDuration / smallDuration;
      expect(scalingFactor).toBeLessThan(10); // Should scale reasonably
    });
  });

  describe('Caching Performance Tests', () => {
    it('should cache identical calculation requests for improved performance', async () => {
      const requestPayload = {
        products: [
          {
            productId: testProducts[0].id,
            quantity: 50,
            packagingTypeId: testPackagings[0].find(p => p.isBaseUnit).id
          }
        ],
        palletId: testPallets[0].id
      };

      // First request (cache miss)
      const firstStart = Date.now();
      const firstResponse = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestPayload)
        .expect(200);
      const firstDuration = Date.now() - firstStart;

      // Second identical request (cache hit)
      const secondStart = Date.now();
      const secondResponse = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestPayload)
        .expect(200);
      const secondDuration = Date.now() - secondStart;

      expect(firstResponse.body.success).toBe(true);
      expect(secondResponse.body.success).toBe(true);
      
      // Results should be identical
      expect(secondResponse.body.data.efficiency).toBe(firstResponse.body.data.efficiency);
      expect(secondResponse.body.data.weight.total).toBe(firstResponse.body.data.weight.total);
      
      // Second request should be significantly faster if cached
      if (secondDuration < firstDuration) {
        const speedup = firstDuration / secondDuration;
        expect(speedup).toBeGreaterThan(1.5); // At least 50% faster
      }
    });

    it('should cache validation requests appropriately', async () => {
      const requestPayload = {
        products: [
          {
            productId: testProducts[1].id,
            quantity: 25,
            packagingTypeId: testPackagings[1].find(p => p.isBaseUnit).id
          }
        ],
        palletId: testPallets[1].id
      };

      // First validation request
      const firstStart = Date.now();
      const firstResponse = await request(app)
        .post('/api/packaging/composition/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestPayload)
        .expect(200);
      const firstDuration = Date.now() - firstStart;

      // Second identical validation request
      const secondStart = Date.now();
      const secondResponse = await request(app)
        .post('/api/packaging/composition/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestPayload)
        .expect(200);
      const secondDuration = Date.now() - secondStart;

      expect(firstResponse.body.success).toBe(true);
      expect(secondResponse.body.success).toBe(true);
      
      // Results should be identical
      expect(secondResponse.body.data.isValid).toBe(firstResponse.body.data.isValid);
      expect(secondResponse.body.data.metrics.totalWeight).toBe(firstResponse.body.data.metrics.totalWeight);
      
      // Check for cache indicators in headers
      if (secondResponse.headers['x-cache']) {
        expect(secondResponse.headers['x-cache']).toContain('HIT');
      }
    });

    it('should invalidate cache when product data changes', async () => {
      const requestPayload = {
        products: [
          {
            productId: testProducts[2].id,
            quantity: 30,
            packagingTypeId: testPackagings[2].find(p => p.isBaseUnit).id
          }
        ],
        palletId: testPallets[0].id
      };

      // First request
      const firstResponse = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestPayload)
        .expect(200);

      // Modify product weight
      await db.update(products)
        .set({ weight: '5.0' }) // Changed from original weight
        .where(eq(products.id, testProducts[2].id));

      // Request with same parameters should return different results
      const secondResponse = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestPayload)
        .expect(200);

      expect(firstResponse.body.success).toBe(true);
      expect(secondResponse.body.success).toBe(true);
      
      // Results should be different due to weight change
      expect(secondResponse.body.data.weight.total).not.toBe(firstResponse.body.data.weight.total);
    });

    it('should handle cache performance under load', async () => {
      const baseRequestPayload = {
        products: [
          {
            productId: testProducts[0].id,
            quantity: 20,
            packagingTypeId: testPackagings[0].find(p => p.isBaseUnit).id
          }
        ],
        palletId: testPallets[0].id
      };

      // Create multiple similar but different requests
      const requests = Array.from({ length: 20 }, (_, index) => ({
        ...baseRequestPayload,
        products: [
          {
            ...baseRequestPayload.products[0],
            quantity: 20 + index // Slightly different quantities
          }
        ]
      }));

      const startTime = Date.now();

      // Execute all requests concurrently
      const responses = await Promise.all(
        requests.map(payload =>
          request(app)
            .post('/api/packaging/composition/calculate')
            .set('Authorization', `Bearer ${authToken}`)
            .send(payload)
        )
      );

      const totalDuration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Total time should be reasonable for 20 concurrent requests
      expect(totalDuration).toBeLessThan(10000); // 10 seconds for 20 requests

      // Average response time should be acceptable
      const averageTime = totalDuration / requests.length;
      expect(averageTime).toBeLessThan(1000); // 1 second average
    });
  });

  describe('Database Query Performance Tests', () => {
    it('should efficiently query product and packaging data', async () => {
      // Create request with many products to test query optimization
      const manyProducts = testProducts.slice(0, 8).map((product, index) => ({
        productId: product.id,
        quantity: 15,
        packagingTypeId: testPackagings[index].find(p => p.isBaseUnit).id
      }));

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: manyProducts,
          palletId: testPallets[0].id
        })
        .expect(200);

      const duration = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(8);
      
      // Should complete efficiently even with many products
      expect(duration).toBeLessThan(3000);
    });

    it('should handle composition list queries efficiently', async () => {
      // Create multiple compositions for listing performance test
      const compositionPromises = Array.from({ length: 50 }, (_, index) =>
        request(app)
          .post('/api/packaging/composition/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Performance Test Composition ${index}`,
            products: [{ 
              productId: testProducts[index % testProducts.length].id, 
              quantity: 10 + index 
            }],
            palletId: testPallets[index % testPallets.length].id
          })
      );

      await Promise.all(compositionPromises);

      // Test listing performance
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/packaging/composition/list?page=1&limit=20')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const duration = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeLessThanOrEqual(20);
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(50);
      
      // List query should be fast
      expect(duration).toBeLessThan(500);
    });

    it('should handle filtered composition queries efficiently', async () => {
      // Create compositions with different statuses
      const statusTypes = ['draft', 'validated', 'approved'];
      const compositionPromises = [];

      for (let i = 0; i < 30; i++) {
        const savePromise = request(app)
          .post('/api/packaging/composition/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Filter Test Composition ${i}`,
            products: [{ 
              productId: testProducts[i % testProducts.length].id, 
              quantity: 10 
            }],
            palletId: testPallets[0].id
          });
        
        compositionPromises.push(savePromise);
      }

      const saveResponses = await Promise.all(compositionPromises);

      // Update some compositions to different statuses
      const updatePromises = saveResponses.slice(0, 20).map((response, index) => {
        const compositionId = response.body.data.composition.id;
        const status = statusTypes[index % statusTypes.length];
        
        if (status !== 'draft') {
          return request(app)
            .patch(`/api/packaging/composition/${compositionId}/status`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status });
        }
        return Promise.resolve();
      });

      await Promise.all(updatePromises);

      // Test filtered queries
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/packaging/composition/list?status=validated&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const duration = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(duration).toBeLessThan(500); // Filtered query should be fast
      
      // All returned compositions should have validated status
      response.body.data.forEach((comp: any) => {
        expect(comp.status).toBe('validated');
      });
    });
  });

  describe('Memory Usage and Resource Management Tests', () => {
    it('should handle large compositions without excessive memory usage', async () => {
      const initialMemory = process.memoryUsage();

      // Create large composition
      const largeProducts = testProducts.map((product, index) => ({
        productId: product.id,
        quantity: 100 + (index * 10),
        packagingTypeId: testPackagings[index].find(p => p.isBaseUnit).id
      }));

      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: largeProducts,
          palletId: testPallets[0].id
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB for large composition)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should release resources after batch operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many calculations in sequence
      for (let i = 0; i < 20; i++) {
        const response = await request(app)
          .post('/api/packaging/composition/calculate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            products: [
              {
                productId: testProducts[i % testProducts.length].id,
                quantity: 20 + i,
                packagingTypeId: testPackagings[i % testProducts.length].find(p => p.isBaseUnit).id
              }
            ],
            palletId: testPallets[i % testPallets.length].id
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory should not have grown excessively
      expect(memoryIncrease).toBeLessThan(30 * 1024 * 1024);
    });
  });

  describe('Concurrent Performance Tests', () => {
    it('should handle concurrent calculations efficiently', async () => {
      const concurrentRequests = 15;
      const basePayload = {
        products: [
          {
            productId: testProducts[0].id,
            quantity: 25,
            packagingTypeId: testPackagings[0].find(p => p.isBaseUnit).id
          }
        ],
        palletId: testPallets[0].id
      };

      // Create slightly different requests to avoid excessive caching
      const requests = Array.from({ length: concurrentRequests }, (_, index) => ({
        ...basePayload,
        products: [
          {
            ...basePayload.products[0],
            quantity: 25 + index
          }
        ]
      }));

      const startTime = Date.now();

      const responses = await Promise.all(
        requests.map(payload =>
          request(app)
            .post('/api/packaging/composition/calculate')
            .set('Authorization', `Bearer ${authToken}`)
            .send(payload)
        )
      );

      const totalDuration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Total time should be reasonable for concurrent execution
      expect(totalDuration).toBeLessThan(8000); // 8 seconds for 15 concurrent requests
      
      // Average time per request should benefit from concurrency
      const averageTime = totalDuration / concurrentRequests;
      expect(averageTime).toBeLessThan(1000);
    });

    it('should maintain performance under mixed operation load', async () => {
      // Create some base compositions first
      const compositions = [];
      for (let i = 0; i < 5; i++) {
        const saveResponse = await request(app)
          .post('/api/packaging/composition/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Mixed Load Test ${i}`,
            products: [{ 
              productId: testProducts[i % testProducts.length].id, 
              quantity: 15 
            }],
            palletId: testPallets[0].id
          });
        compositions.push(saveResponse.body.data.composition.id);
      }

      // Mix of different operations
      const mixedRequests = [
        // Calculations
        ...Array.from({ length: 5 }, (_, index) =>
          request(app)
            .post('/api/packaging/composition/calculate')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              products: [{ 
                productId: testProducts[index % testProducts.length].id, 
                quantity: 20 + index 
              }],
              palletId: testPallets[0].id
            })
        ),
        // Validations
        ...Array.from({ length: 3 }, (_, index) =>
          request(app)
            .post('/api/packaging/composition/validate')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              products: [{ 
                productId: testProducts[index % testProducts.length].id, 
                quantity: 15 + index 
              }],
              palletId: testPallets[0].id
            })
        ),
        // List operations
        ...Array.from({ length: 3 }, () =>
          request(app)
            .get('/api/packaging/composition/list?limit=10')
            .set('Authorization', `Bearer ${authToken}`)
        ),
        // Detail retrieval
        ...compositions.slice(0, 3).map(id =>
          request(app)
            .get(`/api/packaging/composition/${id}`)
            .set('Authorization', `Bearer ${authToken}`)
        )
      ];

      const startTime = Date.now();
      const responses = await Promise.all(mixedRequests);
      const totalDuration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Total time should be reasonable for mixed load
      expect(totalDuration).toBeLessThan(10000); // 10 seconds for mixed operations
    });
  });

  describe('Optimization and Complexity Analysis', () => {
    it('should classify and handle different complexity levels appropriately', async () => {
      // Low complexity: few products, low quantities
      const lowComplexity = {
        products: testProducts.slice(0, 2).map(product => ({
          productId: product.id,
          quantity: 5,
          packagingTypeId: testPackagings[testProducts.indexOf(product)].find(p => p.isBaseUnit).id
        })),
        palletId: testPallets[0].id
      };

      // Medium complexity: moderate products and quantities
      const mediumComplexity = {
        products: testProducts.slice(0, 6).map(product => ({
          productId: product.id,
          quantity: 25,
          packagingTypeId: testPackagings[testProducts.indexOf(product)].find(p => p.isBaseUnit).id
        })),
        palletId: testPallets[0].id
      };

      // High complexity: many products and high quantities
      const highComplexity = {
        products: testProducts.map(product => ({
          productId: product.id,
          quantity: 50,
          packagingTypeId: testPackagings[testProducts.indexOf(product)].find(p => p.isBaseUnit).id
        })),
        palletId: testPallets[0].id
      };

      // Test low complexity
      const lowStart = Date.now();
      const lowResponse = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(lowComplexity)
        .expect(200);
      const lowDuration = Date.now() - lowStart;

      // Test medium complexity
      const mediumStart = Date.now();
      const mediumResponse = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mediumComplexity)
        .expect(200);
      const mediumDuration = Date.now() - mediumStart;

      // Test high complexity
      const highStart = Date.now();
      const highResponse = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(highComplexity)
        .expect(200);
      const highDuration = Date.now() - highStart;

      expect(lowResponse.body.success).toBe(true);
      expect(mediumResponse.body.success).toBe(true);
      expect(highResponse.body.success).toBe(true);

      // Performance should scale appropriately with complexity
      expect(lowDuration).toBeLessThan(500);
      expect(mediumDuration).toBeLessThan(2000);
      expect(highDuration).toBeLessThan(5000);

      // Verify complexity scaling is reasonable
      expect(mediumDuration / lowDuration).toBeLessThan(10);
      expect(highDuration / mediumDuration).toBeLessThan(5);
    });
  });
});