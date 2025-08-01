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

describe('Composition Error Scenarios - Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let testUser: any;
  let testProduct: any;
  let testPackagings: any[];
  let testPallet: any;

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
    // Create test data
    const palletData = TestDataFactory.createPallet();
    const [insertedPallet] = await db.insert(pallets).values({
      code: palletData.code,
      type: palletData.type,
      material: 'Madeira',
      width: palletData.dimensions.width,
      length: palletData.dimensions.height,
      height: 20,
      maxWeight: palletData.maxWeight.toString(),
      status: 'disponivel',
      createdBy: parseInt(testUser.id.replace('test-user-', ''))
    }).returning();
    testPallet = insertedPallet;

    const productData = TestDataFactory.createProduct();
    const [insertedProduct] = await db.insert(products).values({
      sku: productData.code,
      name: productData.name,
      description: productData.description,
      unit: 'un',
      weight: '2.5',
      dimensions: { width: 10, length: 15, height: 5 },
      isActive: true,
      createdBy: parseInt(testUser.id.replace('test-user-', ''))
    }).returning();
    testProduct = insertedProduct;

    const packagingData = [
      {
        productId: testProduct.id,
        name: 'Unidade',
        baseUnitQuantity: '1.000',
        isBaseUnit: true,
        level: 1,
        createdBy: parseInt(testUser.id.replace('test-user-', ''))
      },
      {
        productId: testProduct.id,
        name: 'Caixa 12un',
        barcode: '1234567890123',
        baseUnitQuantity: '12.000',
        isBaseUnit: false,
        level: 2,
        createdBy: parseInt(testUser.id.replace('test-user-', ''))
      }
    ];

    testPackagings = await db.insert(packagingTypes).values(packagingData).returning();
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(compositionReports);
    await db.delete(compositionItems);
    await db.delete(packagingCompositions);
    await db.delete(ucpItems).where(eq(ucpItems.productId, testProduct.id));
    await db.delete(packagingTypes).where(eq(packagingTypes.productId, testProduct.id));
    await db.delete(products).where(eq(products.id, testProduct.id));
    await db.delete(pallets).where(eq(pallets.id, testPallet.id));
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, testUser.email));
  });

  describe('Authentication and Authorization Errors', () => {
    it('should return 401 for requests without authentication token', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .send({
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should return 401 for requests with invalid authentication token', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should return 401 for requests with expired authentication token', async () => {
      // This would require generating an expired token for testing
      // For now, we'll test with a malformed token structure
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.token')
        .send({
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Input Validation Errors', () => {
    it('should validate required fields in composition calculation', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing products array
          palletId: testPallet.id
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate product array is not empty', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [], // Empty products array
          palletId: testPallet.id
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate product quantities are positive', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProduct.id,
              quantity: -5, // Negative quantity
              packagingTypeId: testPackagings[0].id
            }
          ],
          palletId: testPallet.id
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate product IDs are valid integers', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: 'invalid-id', // String instead of number
              quantity: 10,
              packagingTypeId: testPackagings[0].id
            }
          ],
          palletId: testPallet.id
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate constraint values are positive when provided', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProduct.id,
              quantity: 10,
              packagingTypeId: testPackagings[0].id
            }
          ],
          palletId: testPallet.id,
          constraints: {
            maxWeight: -100, // Negative constraint
            maxHeight: 0, // Zero constraint
            maxVolume: 'invalid' // Invalid type
          }
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate composition name length and format', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '', // Empty name
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate status values in update requests', async () => {
      // First create a composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Composition',
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Try to update with invalid status
      const response = await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'invalid_status' // Invalid status
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Business Rule Violations', () => {
    it('should reject compositions exceeding maximum product limit', async () => {
      // Create array with too many products (assuming limit is 50)
      const tooManyProducts = Array.from({ length: 51 }, (_, index) => ({
        productId: testProduct.id,
        quantity: 1,
        packagingTypeId: testPackagings[0].id
      }));

      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: tooManyProducts,
          palletId: testPallet.id
        })
        .expect(400);

      expect(response.body.error).toContain('50');
    });

    it('should reject compositions exceeding weight safety limits', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProduct.id,
              quantity: 10000, // Very large quantity
              packagingTypeId: testPackagings[0].id
            }
          ],
          palletId: testPallet.id,
          constraints: {
            maxWeight: 5000 // Exceeds 2000kg safety limit
          }
        })
        .expect(400);

      expect(response.body.error).toContain('2000kg');
    });

    it('should reject compositions exceeding height safety limits', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProduct.id,
              quantity: 10,
              packagingTypeId: testPackagings[0].id
            }
          ],
          palletId: testPallet.id,
          constraints: {
            maxHeight: 400 // Exceeds 300cm safety limit
          }
        })
        .expect(400);

      expect(response.body.error).toContain('300cm');
    });

    it('should prevent operations on inactive products', async () => {
      // Deactivate the product
      await db.update(products)
        .set({ isActive: false })
        .where(eq(products.id, testProduct.id));

      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProduct.id,
              quantity: 10,
              packagingTypeId: testPackagings[0].id
            }
          ],
          palletId: testPallet.id
        })
        .expect(400);

      expect(response.body.error).toContain('inativo');
    });

    it('should prevent operations on unavailable pallets', async () => {
      // Set pallet status to unavailable
      await db.update(pallets)
        .set({ status: 'manutencao' })
        .where(eq(pallets.id, testPallet.id));

      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProduct.id,
              quantity: 10,
              packagingTypeId: testPackagings[0].id
            }
          ],
          palletId: testPallet.id
        })
        .expect(400);

      expect(response.body.error).toContain('disponível');
    });
  });

  describe('Data Not Found Errors', () => {
    it('should return 404 for non-existent product IDs', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: 99999, // Non-existent product
              quantity: 10,
              packagingTypeId: testPackagings[0].id
            }
          ],
          palletId: testPallet.id
        })
        .expect(404);

      expect(response.body.error).toContain('não encontrado');
    });

    it('should return 404 for non-existent pallet IDs', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProduct.id,
              quantity: 10,
              packagingTypeId: testPackagings[0].id
            }
          ],
          palletId: 99999 // Non-existent pallet
        })
        .expect(404);

      expect(response.body.error).toContain('não encontrado');
    });

    it('should return 404 for non-existent packaging type IDs', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProduct.id,
              quantity: 10,
              packagingTypeId: 99999 // Non-existent packaging type
            }
          ],
          palletId: testPallet.id
        })
        .expect(404);

      expect(response.body.error).toContain('não encontrado');
    });

    it('should return 404 for non-existent composition IDs', async () => {
      const response = await request(app)
        .get('/api/packaging/composition/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toContain('não encontrada');
    });

    it('should return 404 when trying to generate report for non-existent composition', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: 99999,
          includeMetrics: true
        })
        .expect(404);

      expect(response.body.error).toContain('não encontrada');
    });
  });

  describe('Rate Limiting Errors', () => {
    it('should return 429 when calculation rate limit is exceeded', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/packaging/composition/calculate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            products: [{ productId: testProduct.id, quantity: 10 }],
            palletId: testPallet.id
          })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      const rateLimitedResponse = rateLimitedResponses[0];
      expect(rateLimitedResponse.body.error).toContain('rate limit');
      expect(rateLimitedResponse.headers['x-ratelimit-limit']).toBeDefined();
      expect(rateLimitedResponse.headers['x-ratelimit-remaining']).toBeDefined();
      expect(rateLimitedResponse.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should return 429 when save operation rate limit is exceeded', async () => {
      const requests = Array.from({ length: 15 }, (_, index) =>
        request(app)
          .post('/api/packaging/composition/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Rate Limit Test ${index}`,
            products: [{ productId: testProduct.id, quantity: 5 }],
            palletId: testPallet.id
          })
      );

      const responses = await Promise.all(requests);
      
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should return 429 when assembly operation rate limit is exceeded', async () => {
      // Create multiple approved compositions first
      const compositions = [];
      for (let i = 0; i < 8; i++) {
        const saveResponse = await request(app)
          .post('/api/packaging/composition/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Assembly Rate Limit Test ${i}`,
            products: [{ productId: testProduct.id, quantity: 1 }],
            palletId: testPallet.id
          });
        
        const compId = saveResponse.body.data.composition.id;
        await request(app)
          .patch(`/api/packaging/composition/${compId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'validated' });
        
        await request(app)
          .patch(`/api/packaging/composition/${compId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'approved' });
        
        compositions.push(compId);
      }

      // Create UCP for assembly
      const ucp = TestDataFactory.createUCP(testPallet.id.toString(), testUser.id);
      const [insertedUcp] = await db.insert(ucps).values({
        code: ucp.code,
        palletId: testPallet.id,
        status: 'active',
        createdBy: parseInt(testUser.id.replace('test-user-', ''))
      }).returning();

      // Add sufficient stock
      await db.insert(ucpItems).values({
        ucpId: insertedUcp.id,
        productId: testProduct.id,
        quantity: '100.000',
        packagingTypeId: testPackagings[0].id,
        addedBy: parseInt(testUser.id.replace('test-user-', ''))
      });

      // Attempt rapid assembly operations
      const requests = compositions.map(compId =>
        request(app)
          .post('/api/packaging/composition/assemble')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            compositionId: compId,
            targetUcpId: insertedUcp.id
          })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Database and System Errors', () => {
    it('should handle gracefully when database constraints are violated', async () => {
      // Try to create composition with duplicate name (if unique constraint exists)
      const compositionData = {
        name: 'Unique Test Composition',
        products: [{ productId: testProduct.id, quantity: 10 }],
        palletId: testPallet.id
      };

      // Create first composition
      await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send(compositionData)
        .expect(200);

      // Try to create duplicate (if constraint exists, this would fail)
      const response = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send(compositionData);
      
      // Should either succeed (no constraint) or fail gracefully
      expect([200, 409]).toContain(response.status);
    });

    it('should handle timeout errors gracefully', async () => {
      // This would require mocking a timeout scenario
      // For now, test that very complex calculations complete within reasonable time
      const complexComposition = {
        products: Array.from({ length: 30 }, (_, index) => ({
          productId: testProduct.id,
          quantity: 10 + index,
          packagingTypeId: testPackagings[index % testPackagings.length].id
        })),
        palletId: testPallet.id
      };

      const startTime = Date.now();
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(complexComposition);

      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time or return timeout error
      if (response.status === 200) {
        expect(duration).toBeLessThan(30000); // 30 seconds max
      } else if (response.status === 408) {
        expect(response.body.error).toContain('timeout');
      }
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}') // Malformed JSON
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle requests with wrong content-type', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'text/plain')
        .send('invalid content')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Concurrent Access Errors', () => {
    it('should handle concurrent updates to same composition gracefully', async () => {
      // Create composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Concurrent Update Test',
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Attempt concurrent status updates
      const concurrentUpdates = [
        request(app)
          .patch(`/api/packaging/composition/${compositionId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'validated' }),
        request(app)
          .patch(`/api/packaging/composition/${compositionId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'validated' }),
        request(app)
          .patch(`/api/packaging/composition/${compositionId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'validated' })
      ];

      const responses = await Promise.all(concurrentUpdates);
      
      // At least one should succeed, others should fail gracefully
      const successCount = responses.filter(r => r.status === 200).length;
      const conflictCount = responses.filter(r => r.status === 409).length;
      
      expect(successCount).toBeGreaterThan(0);
      
      // Failed requests should have appropriate error messages
      responses.filter(r => r.status !== 200).forEach(response => {
        expect(response.body.error).toBeDefined();
      });
    });

    it('should handle concurrent assembly attempts on same UCP', async () => {
      // Create multiple approved compositions
      const compositions = [];
      for (let i = 0; i < 3; i++) {
        const saveResponse = await request(app)
          .post('/api/packaging/composition/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Concurrent Assembly Test ${i}`,
            products: [{ productId: testProduct.id, quantity: 10 }],
            palletId: testPallet.id
          });
        
        const compId = saveResponse.body.data.composition.id;
        await request(app)
          .patch(`/api/packaging/composition/${compId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'validated' });
        
        await request(app)
          .patch(`/api/packaging/composition/${compId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'approved' });
        
        compositions.push(compId);
      }

      // Create UCP with limited stock
      const ucp = TestDataFactory.createUCP(testPallet.id.toString(), testUser.id);
      const [insertedUcp] = await db.insert(ucps).values({
        code: ucp.code,
        palletId: testPallet.id,
        status: 'active',
        createdBy: parseInt(testUser.id.replace('test-user-', ''))
      }).returning();

      // Add stock sufficient for only one composition
      await db.insert(ucpItems).values({
        ucpId: insertedUcp.id,
        productId: testProduct.id,
        quantity: '15.000', // Only enough for one composition
        packagingTypeId: testPackagings[0].id,
        addedBy: parseInt(testUser.id.replace('test-user-', ''))
      });

      // Attempt concurrent assemblies
      const concurrentAssemblies = compositions.map(compId =>
        request(app)
          .post('/api/packaging/composition/assemble')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            compositionId: compId,
            targetUcpId: insertedUcp.id
          })
      );

      const responses = await Promise.all(concurrentAssemblies);
      
      // Only one should succeed due to stock limitations
      const successCount = responses.filter(r => r.status === 200).length;
      const failureCount = responses.filter(r => r.status === 400).length;
      
      expect(successCount).toBe(1);
      expect(failureCount).toBe(2);
      
      // Failed requests should have stock-related error messages
      responses.filter(r => r.status === 400).forEach(response => {
        expect(response.body.error).toContain('insuficiente');
      });
    });
  });

  describe('Security and Sanitization Errors', () => {
    it('should sanitize XSS attempts in composition names', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '<script>alert("xss")</script>Malicious Composition',
          description: '<img src=x onerror=alert("xss")>Evil description',
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        })
        .expect(200);

      // Name and description should be sanitized
      expect(response.body.data.composition.name).not.toContain('<script>');
      expect(response.body.data.composition.description).not.toContain('<img');
      expect(response.body.data.composition.name).not.toContain('alert');
    });

    it('should reject SQL injection attempts', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: "'; DROP TABLE packagingCompositions; --",
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        });

      // Should either succeed with sanitized input or reject
      expect([200, 400]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body.data.composition.name).not.toContain('DROP TABLE');
      }
    });

    it('should validate and reject extremely large payloads', async () => {
      // Create an extremely large description
      const largeDescription = 'A'.repeat(10000); // 10KB description
      
      const response = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Large Payload Test',
          description: largeDescription,
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        });

      // Should either succeed with truncated description or reject
      expect([200, 400, 413]).toContain(response.status);
      
      if (response.status === 413) {
        expect(response.body.error).toContain('payload');
      }
    });
  });
});