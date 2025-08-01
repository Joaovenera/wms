import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../index';
import { db } from '../../db';
import { 
  users, 
  products, 
  pallets, 
  packagingTypes,
  packagingCompositions,
  compositionItems,
  compositionReports
} from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('Packaging Composition Workflows - Integration Tests', () => {
  let authToken: string;
  let testUser: any;
  let testProduct: any;
  let testPallet: any;
  let testPackagingType: any;
  let testComposition: any;

  beforeAll(async () => {
    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Get fresh auth token for each test
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpass123'
      });

    authToken = loginResponse.body.token;
  });

  describe('Complete Composition Workflow', () => {
    it('should handle full composition lifecycle: create -> validate -> approve -> assemble -> disassemble', async () => {
      // Step 1: Calculate optimal composition
      const calculateResponse = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProduct.id,
              quantity: 10,
              packagingTypeId: testPackagingType.id
            }
          ],
          palletId: testPallet.id,
          constraints: {
            maxWeight: 500,
            maxHeight: 180
          }
        });

      expect(calculateResponse.status).toBe(200);
      expect(calculateResponse.body.success).toBe(true);
      expect(calculateResponse.body.data).toHaveProperty('isValid');
      expect(calculateResponse.body.data).toHaveProperty('efficiency');

      // Step 2: Save composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Workflow Composition',
          description: 'Integration test composition',
          products: [
            {
              productId: testProduct.id,
              quantity: 10,
              packagingTypeId: testPackagingType.id
            }
          ],
          palletId: testPallet.id,
          constraints: {
            maxWeight: 500,
            maxHeight: 180
          }
        });

      expect(saveResponse.status).toBe(201);
      expect(saveResponse.body.success).toBe(true);
      const savedComposition = saveResponse.body.data.composition;
      expect(savedComposition).toHaveProperty('id');
      expect(savedComposition.name).toBe('Test Workflow Composition');

      // Step 3: Validate composition
      const validateResponse = await request(app)
        .post('/api/packaging/composition/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProduct.id,
              quantity: 10,
              packagingTypeId: testPackagingType.id
            }
          ],
          palletId: testPallet.id
        });

      expect(validateResponse.status).toBe(200);
      expect(validateResponse.body.success).toBe(true);
      expect(validateResponse.body.data.isValid).toBe(true);

      // Step 4: Update status to validated
      const updateStatusResponse = await request(app)
        .patch(`/api/packaging/composition/${savedComposition.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'validated' });

      expect(updateStatusResponse.status).toBe(200);
      expect(updateStatusResponse.body.data.status).toBe('validated');

      // Step 5: Approve composition
      const approveResponse = await request(app)
        .patch(`/api/packaging/composition/${savedComposition.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' });

      expect(approveResponse.status).toBe(200);
      expect(approveResponse.body.data.status).toBe('approved');
      expect(approveResponse.body.data.approvedBy).toBe(testUser.id);

      // Step 6: Generate comprehensive report
      const reportResponse = await request(app)
        .post('/api/packaging/composition/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: savedComposition.id,
          includeMetrics: true,
          includeRecommendations: true,
          includeCostAnalysis: true
        });

      expect(reportResponse.status).toBe(200);
      expect(reportResponse.body.success).toBe(true);
      expect(reportResponse.body.data).toHaveProperty('id');
      expect(reportResponse.body.data.reportType).toBe('detailed');

      // Step 7: Assemble composition (simulate creating UCP)
      const assembleResponse = await request(app)
        .post('/api/packaging/composition/assemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: savedComposition.id,
          targetUcpId: 1 // Assume UCP exists
        });

      expect(assembleResponse.status).toBe(200);
      expect(assembleResponse.body.success).toBe(true);
      expect(assembleResponse.body.data.success).toBe(true);
      expect(assembleResponse.body.data.message).toContain('montada com sucesso');

      // Step 8: Disassemble composition
      const disassembleResponse = await request(app)
        .post('/api/packaging/composition/disassemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: savedComposition.id,
          targetUcps: [
            {
              productId: testProduct.id,
              quantity: 5,
              ucpId: 1
            }
          ]
        });

      expect(disassembleResponse.status).toBe(200);
      expect(disassembleResponse.body.success).toBe(true);
      expect(disassembleResponse.body.data.success).toBe(true);
      expect(disassembleResponse.body.data.message).toContain('desmontada com sucesso');

      // Cleanup: Delete the test composition
      const deleteResponse = await request(app)
        .delete(`/api/packaging/composition/${savedComposition.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteResponse.status).toBe(204);
    });
  });

  describe('Composition Listing and Filtering', () => {
    it('should list compositions with pagination and filters', async () => {
      // Create multiple test compositions
      const compositions = [];
      for (let i = 0; i < 5; i++) {
        const saveResponse = await request(app)
          .post('/api/packaging/composition/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Test Composition ${i + 1}`,
            products: [{
              productId: testProduct.id,
              quantity: 5 + i,
              packagingTypeId: testPackagingType.id
            }],
            palletId: testPallet.id
          });

        compositions.push(saveResponse.body.data.composition);
      }

      // Test basic listing
      const listResponse = await request(app)
        .get('/api/packaging/composition/list')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.success).toBe(true);
      expect(listResponse.body.data).toBeInstanceOf(Array);
      expect(listResponse.body.pagination).toHaveProperty('total');

      // Test pagination
      const paginatedResponse = await request(app)
        .get('/api/packaging/composition/list?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(paginatedResponse.status).toBe(200);
      expect(paginatedResponse.body.data.length).toBeLessThanOrEqual(2);
      expect(paginatedResponse.body.pagination.limit).toBe(2);

      // Test status filter
      const statusFilterResponse = await request(app)
        .get('/api/packaging/composition/list?status=draft')
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusFilterResponse.status).toBe(200);
      statusFilterResponse.body.data.forEach((comp: any) => {
        expect(comp.status).toBe('draft');
      });

      // Cleanup
      for (const comp of compositions) {
        await request(app)
          .delete(`/api/packaging/composition/${comp.id}`)
          .set('Authorization', `Bearer ${authToken}`);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid composition data gracefully', async () => {
      // Test with missing required fields
      const response1 = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing name
          products: [{
            productId: testProduct.id,
            quantity: 10
          }]
        });

      expect(response1.status).toBe(400);
      expect(response1.body.code).toBe('VALIDATION_ERROR');

      // Test with invalid product ID
      const response2 = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [{
            productId: 99999, // Non-existent product
            quantity: 10
          }]
        });

      expect(response2.status).toBe(500); // Should handle gracefully

      // Test with invalid pallet ID
      const response3 = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [{
            productId: testProduct.id,
            quantity: 10
          }],
          palletId: 99999 // Non-existent pallet
        });

      expect(response3.status).toBe(500); // Should handle gracefully
    });

    it('should handle business rule violations', async () => {
      // Test with too many products
      const manyProducts = Array.from({ length: 51 }, (_, i) => ({
        productId: testProduct.id,
        quantity: 1,
        packagingTypeId: testPackagingType.id
      }));

      const response1 = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: manyProducts
        });

      expect(response1.status).toBe(400);
      expect(response1.body.code).toBe('TOO_MANY_PRODUCTS');

      // Test with excessive weight constraint
      const response2 = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [{
            productId: testProduct.id,
            quantity: 10
          }],
          constraints: {
            maxWeight: 3000 // Exceeds 2000kg limit
          }
        });

      expect(response2.status).toBe(400);
      expect(response2.body.code).toBe('WEIGHT_LIMIT_EXCEEDED');

      // Test with excessive height constraint
      const response3 = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [{
            productId: testProduct.id,
            quantity: 10
          }],
          constraints: {
            maxHeight: 400 // Exceeds 300cm limit
          }
        });

      expect(response3.status).toBe(400);
      expect(response3.body.code).toBe('HEIGHT_LIMIT_EXCEEDED');
    });

    it('should handle rate limiting correctly', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array.from({ length: 6 }, () => 
        request(app)
          .post('/api/packaging/composition/calculate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            products: [{
              productId: testProduct.id,
              quantity: 1
            }]
          })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      rateLimitedResponses.forEach(response => {
        expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(response.body).toHaveProperty('retryAfter');
      });
    });
  });

  describe('Performance and Caching', () => {
    it('should cache composition calculations for repeated requests', async () => {
      const compositionRequest = {
        products: [{
          productId: testProduct.id,
          quantity: 10,
          packagingTypeId: testPackagingType.id
        }],
        palletId: testPallet.id
      };

      // First request - should calculate and cache
      const startTime1 = Date.now();
      const response1 = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(compositionRequest);

      const duration1 = Date.now() - startTime1;
      expect(response1.status).toBe(200);

      // Second identical request - should use cache (faster)
      const startTime2 = Date.now();
      const response2 = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(compositionRequest);

      const duration2 = Date.now() - startTime2;
      expect(response2.status).toBe(200);
      
      // Results should be identical
      expect(response1.body.data).toEqual(response2.body.data);
      
      // Second request should be faster (cached)
      expect(duration2).toBeLessThan(duration1);
    });
  });

  // Helper functions
  async function setupTestData() {
    // Create test user
    const userResult = await db.insert(users).values({
      email: 'test@example.com',
      password: 'hashedpassword',
      firstName: 'Test',
      lastName: 'User',
      role: 'admin'
    }).returning();
    testUser = userResult[0];

    // Create test product
    const productResult = await db.insert(products).values({
      sku: 'TEST-PROD-001',
      name: 'Test Product',
      description: 'Test product for integration tests',
      category: 'Test',
      unit: 'un',
      weight: '5.5',
      dimensions: { width: 30, length: 20, height: 15 },
      createdBy: testUser.id
    }).returning();
    testProduct = productResult[0];

    // Create test pallet
    const palletResult = await db.insert(pallets).values({
      code: 'TEST-PALLET-001',
      type: 'PBR',
      material: 'Madeira',
      width: 120,
      length: 80,
      height: 200,
      maxWeight: '1000.00',
      status: 'disponivel',
      createdBy: testUser.id
    }).returning();
    testPallet = palletResult[0];

    // Create test packaging type
    const packagingResult = await db.insert(packagingTypes).values({
      productId: testProduct.id,
      name: 'Unidade',
      baseUnitQuantity: '1.000',
      isBaseUnit: true,
      level: 1,
      createdBy: testUser.id
    }).returning();
    testPackagingType = packagingResult[0];
  }

  async function cleanupTestData() {
    // Clean up in reverse order due to foreign key constraints
    await db.delete(compositionReports);
    await db.delete(compositionItems);
    await db.delete(packagingCompositions);
    await db.delete(packagingTypes).where(eq(packagingTypes.productId, testProduct.id));
    await db.delete(pallets).where(eq(pallets.id, testPallet.id));
    await db.delete(products).where(eq(products.id, testProduct.id));
    await db.delete(users).where(eq(users.id, testUser.id));
  }
});