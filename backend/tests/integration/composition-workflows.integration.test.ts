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
import { eq, and } from 'drizzle-orm';

describe('Composition Workflows - End-to-End Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let testUser: any;
  let testProducts: any[];
  let testPackagings: any[][];
  let testPallets: any[];
  let testUcps: any[];

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
    expect(authToken).toBeDefined();
  });

  beforeEach(async () => {
    // Create multiple test pallets
    const palletData = [
      { ...TestDataFactory.createPallet(), type: 'EUR' },
      { ...TestDataFactory.createPallet(), type: 'AMERICANA' },
      { ...TestDataFactory.createPallet(), type: 'BRASILEIRA' }
    ];

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

    // Create multiple test products with different characteristics
    const productData = [
      { ...TestDataFactory.createProduct(), weight: '2.5', dimensions: { width: 10, length: 15, height: 5 } },
      { ...TestDataFactory.createProduct(), weight: '1.8', dimensions: { width: 8, length: 12, height: 4 } },
      { ...TestDataFactory.createProduct(), weight: '5.2', dimensions: { width: 20, length: 25, height: 8 } }
    ];

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

    // Create test UCPs for assembly/disassembly operations
    testUcps = await Promise.all(
      testPallets.map(async (pallet) => {
        const ucp = TestDataFactory.createUCP(pallet.id.toString(), testUser.id);
        const [inserted] = await db.insert(ucps).values({
          code: ucp.code,
          palletId: pallet.id,
          status: 'active',
          createdBy: parseInt(testUser.id.replace('test-user-', ''))
        }).returning();
        return inserted;
      })
    );

    // Add stock to UCPs for assembly operations
    for (let i = 0; i < testProducts.length; i++) {
      const product = testProducts[i];
      const packagings = testPackagings[i];
      const basePackaging = packagings.find(p => p.isBaseUnit);

      await db.insert(ucpItems).values({
        ucpId: testUcps[0].id, // Use first UCP for all stock
        productId: product.id,
        quantity: '1000.000', // Sufficient stock for testing
        packagingTypeId: basePackaging.id,
        addedBy: parseInt(testUser.id.replace('test-user-', ''))
      });
    }
  });

  afterEach(async () => {
    // Clean up test data in proper order
    await db.delete(compositionReports);
    await db.delete(compositionItems);
    await db.delete(packagingCompositions);
    
    for (const product of testProducts) {
      await db.delete(ucpItems).where(eq(ucpItems.productId, product.id));
      await db.delete(packagingTypes).where(eq(packagingTypes.productId, product.id));
      await db.delete(products).where(eq(products.id, product.id));
    }
    
    for (const ucp of testUcps) {
      await db.delete(ucps).where(eq(ucps.id, ucp.id));
    }
    
    for (const pallet of testPallets) {
      await db.delete(pallets).where(eq(pallets.id, pallet.id));
    }
  });

  afterAll(async () => {
    // Clean up test user
    await db.delete(users).where(eq(users.email, testUser.email));
  });

  describe('Complete Composition Lifecycle Workflow', () => {
    it('should execute full composition lifecycle: draft → validated → approved → executed', async () => {
      // Step 1: Calculate optimal composition
      const calculateResponse = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProducts[0].id,
              quantity: 24,
              packagingTypeId: testPackagings[0].find(p => p.isBaseUnit).id
            },
            {
              productId: testProducts[1].id,
              quantity: 18,
              packagingTypeId: testPackagings[1].find(p => p.isBaseUnit).id
            }
          ],
          palletId: testPallets[0].id,
          constraints: {
            maxWeight: 500,
            maxHeight: 180
          }
        })
        .expect(200);

      expect(calculateResponse.body.success).toBe(true);
      expect(calculateResponse.body.data.isValid).toBe(true);
      const calculationResult = calculateResponse.body.data;

      // Step 2: Save composition as draft
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Full Lifecycle Test Composition',
          description: 'Testing complete workflow from draft to executed',
          products: [
            {
              productId: testProducts[0].id,
              quantity: 24,
              packagingTypeId: testPackagings[0].find(p => p.isBaseUnit).id
            },
            {
              productId: testProducts[1].id,
              quantity: 18,
              packagingTypeId: testPackagings[1].find(p => p.isBaseUnit).id
            }
          ],
          palletId: testPallets[0].id,
          constraints: {
            maxWeight: 500,
            maxHeight: 180
          }
        })
        .expect(200);

      expect(saveResponse.body.success).toBe(true);
      expect(saveResponse.body.data.composition.status).toBe('draft');
      const compositionId = saveResponse.body.data.composition.id;

      // Step 3: Validate composition
      const validateResponse = await request(app)
        .post('/api/packaging/composition/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProducts[0].id,
              quantity: 24,
              packagingTypeId: testPackagings[0].find(p => p.isBaseUnit).id
            },
            {
              productId: testProducts[1].id,
              quantity: 18,
              packagingTypeId: testPackagings[1].find(p => p.isBaseUnit).id
            }
          ],
          palletId: testPallets[0].id
        })
        .expect(200);

      expect(validateResponse.body.success).toBe(true);
      expect(validateResponse.body.data.isValid).toBe(true);

      // Step 4: Update status to validated
      const validatedStatusResponse = await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'validated' })
        .expect(200);

      expect(validatedStatusResponse.body.data.status).toBe('validated');

      // Step 5: Generate comprehensive report
      const reportResponse = await request(app)
        .post('/api/packaging/composition/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          includeMetrics: true,
          includeRecommendations: true,
          includeCostAnalysis: true
        })
        .expect(200);

      expect(reportResponse.body.success).toBe(true);
      expect(reportResponse.body.data.reportData).toHaveProperty('metrics');
      expect(reportResponse.body.data.reportData).toHaveProperty('costAnalysis');

      // Step 6: Approve composition
      const approvedStatusResponse = await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' })
        .expect(200);

      expect(approvedStatusResponse.body.data.status).toBe('approved');
      expect(approvedStatusResponse.body.data.approvedBy).toBeDefined();
      expect(approvedStatusResponse.body.data.approvedAt).toBeDefined();

      // Step 7: Assemble composition
      const assembleResponse = await request(app)
        .post('/api/packaging/composition/assemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          targetUcpId: testUcps[1].id
        })
        .expect(200);

      expect(assembleResponse.body.success).toBe(true);
      expect(assembleResponse.body.data.success).toBe(true);
      expect(assembleResponse.body.data.message).toContain('montada com sucesso');

      // Step 8: Verify composition is now executed
      const executedCompositionResponse = await request(app)
        .get(`/api/packaging/composition/${compositionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(executedCompositionResponse.body.data.status).toBe('executed');

      // Step 9: Disassemble composition
      const disassembleResponse = await request(app)
        .post('/api/packaging/composition/disassemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          targetUcps: [
            {
              productId: testProducts[0].id,
              quantity: 12,
              ucpId: testUcps[2].id
            },
            {
              productId: testProducts[0].id,
              quantity: 12,
              ucpId: testUcps[1].id
            },
            {
              productId: testProducts[1].id,
              quantity: 18,
              ucpId: testUcps[2].id
            }
          ]
        })
        .expect(200);

      expect(disassembleResponse.body.success).toBe(true);
      expect(disassembleResponse.body.data.success).toBe(true);

      // Step 10: Verify composition can be reassembled (status should be approved again)
      const finalCompositionResponse = await request(app)
        .get(`/api/packaging/composition/${compositionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalCompositionResponse.body.data.status).toBe('approved');
    });

    it('should handle complex multi-product composition workflow', async () => {
      // Create composition with all three products
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Multi-Product Complex Composition',
          description: 'Testing complex workflow with multiple products',
          products: [
            {
              productId: testProducts[0].id,
              quantity: 36,
              packagingTypeId: testPackagings[0].find(p => p.level === 2).id // Caixa
            },
            {
              productId: testProducts[1].id,
              quantity: 24,
              packagingTypeId: testPackagings[1].find(p => p.level === 2).id // Pacote
            },
            {
              productId: testProducts[2].id,
              quantity: 15,
              packagingTypeId: testPackagings[2].find(p => p.isBaseUnit).id // Unidade
            }
          ],
          palletId: testPallets[1].id // Use different pallet
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Progress through statuses
      await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'validated' })
        .expect(200);

      await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' })
        .expect(200);

      // Generate detailed report
      const reportResponse = await request(app)
        .post('/api/packaging/composition/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          includeMetrics: true,
          includeRecommendations: true,
          includeCostAnalysis: true
        })
        .expect(200);

      // Verify report contains analysis for all products
      expect(reportResponse.body.data.reportData.composition.products).toHaveLength(3);
      
      // Assemble with multiple UCPs
      const assembleResponse = await request(app)
        .post('/api/packaging/composition/assemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          targetUcpId: testUcps[0].id
        })
        .expect(200);

      expect(assembleResponse.body.data.success).toBe(true);
    });

    it('should prevent invalid workflow transitions', async () => {
      // Create draft composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Transition Test',
          products: [{ productId: testProducts[0].id, quantity: 10 }],
          palletId: testPallets[0].id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Try to jump directly from draft to approved (should fail)
      const invalidTransitionResponse = await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' })
        .expect(400);

      expect(invalidTransitionResponse.body.error).toBeDefined();

      // Try to assemble draft composition (should fail)
      const invalidAssemblyResponse = await request(app)
        .post('/api/packaging/composition/assemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          targetUcpId: testUcps[0].id
        })
        .expect(400);

      expect(invalidAssemblyResponse.body.error).toContain('aprovadas');

      // Try to disassemble draft composition (should fail)
      const invalidDisassemblyResponse = await request(app)
        .post('/api/packaging/composition/disassemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          targetUcps: [
            { productId: testProducts[0].id, quantity: 5, ucpId: testUcps[0].id }
          ]
        })
        .expect(400);

      expect(invalidDisassemblyResponse.body.error).toContain('executadas');
    });
  });

  describe('Business Logic Validation Workflows', () => {
    it('should enforce composition constraints throughout workflow', async () => {
      // Create composition that violates weight constraints
      const violationResponse = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProducts[2].id, // Heaviest product
              quantity: 500, // Large quantity
              packagingTypeId: testPackagings[2].find(p => p.isBaseUnit).id
            }
          ],
          palletId: testPallets[0].id,
          constraints: {
            maxWeight: 100 // Very low weight limit
          }
        })
        .expect(200);

      expect(violationResponse.body.data.isValid).toBe(false);
      expect(violationResponse.body.data.weight.total).toBeGreaterThan(
        violationResponse.body.data.weight.limit
      );

      // Try to save the violating composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Violating Composition',
          products: [
            {
              productId: testProducts[2].id,
              quantity: 500,
              packagingTypeId: testPackagings[2].find(p => p.isBaseUnit).id
            }
          ],
          palletId: testPallets[0].id,
          constraints: {
            maxWeight: 100
          }
        })
        .expect(400); // Should reject due to business rules

      expect(saveResponse.body.error).toBeDefined();
    });

    it('should validate stock availability during assembly workflow', async () => {
      // Create composition requiring more stock than available
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Insufficient Stock Test',
          products: [
            {
              productId: testProducts[0].id,
              quantity: 2000, // More than the 1000 we have in stock
              packagingTypeId: testPackagings[0].find(p => p.isBaseUnit).id
            }
          ],
          palletId: testPallets[0].id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Progress to approved
      await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'validated' })
        .expect(200);

      await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' })
        .expect(200);

      // Try to assemble (should fail due to insufficient stock)
      const assembleResponse = await request(app)
        .post('/api/packaging/composition/assemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          targetUcpId: testUcps[0].id
        })
        .expect(400);

      expect(assembleResponse.body.error).toContain('Estoque insuficiente');
    });

    it('should enforce proper disassembly quantity validation', async () => {
      // Create and execute a composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Disassembly Validation Test',
          products: [
            { productId: testProducts[0].id, quantity: 30 },
            { productId: testProducts[1].id, quantity: 20 }
          ],
          palletId: testPallets[0].id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Progress to executed
      await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'validated' });

      await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' });

      await request(app)
        .post('/api/packaging/composition/assemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          targetUcpId: testUcps[0].id
        });

      await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'executed' });

      // Try to disassemble more than what's in the composition
      const invalidDisassemblyResponse = await request(app)
        .post('/api/packaging/composition/disassemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          targetUcps: [
            {
              productId: testProducts[0].id,
              quantity: 50, // More than the 30 in composition
              ucpId: testUcps[1].id
            }
          ]
        })
        .expect(400);

      expect(invalidDisassemblyResponse.body.error).toContain('maior que a disponível');

      // Try to disassemble non-existent product
      const nonExistentProductResponse = await request(app)
        .post('/api/packaging/composition/disassemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          targetUcps: [
            {
              productId: testProducts[2].id, // Not in this composition
              quantity: 5,
              ucpId: testUcps[1].id
            }
          ]
        })
        .expect(400);

      expect(nonExistentProductResponse.body.error).toContain('não encontrado na composição');
    });
  });

  describe('Data Consistency and Transaction Workflows', () => {
    it('should maintain data consistency during concurrent operations', async () => {
      // Create composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Concurrency Test',
          products: [{ productId: testProducts[0].id, quantity: 50 }],
          palletId: testPallets[0].id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Simulate concurrent status updates
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
      
      // At least one should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(0);

      // Final state should be consistent
      const finalState = await request(app)
        .get(`/api/packaging/composition/${compositionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalState.body.data.status).toBe('validated');
    });

    it('should rollback changes on assembly failure', async () => {
      // Create composition that will fail assembly due to UCP capacity
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Assembly Rollback Test',
          products: [{ productId: testProducts[0].id, quantity: 10 }],
          palletId: testPallets[0].id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Progress to approved
      await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'validated' });

      await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' });

      // Create UCP with insufficient capacity (delete stock)
      await db.delete(ucpItems).where(eq(ucpItems.ucpId, testUcps[0].id));

      // Try to assemble (should fail)
      const assembleResponse = await request(app)
        .post('/api/packaging/composition/assemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          targetUcpId: testUcps[0].id
        })
        .expect(400);

      expect(assembleResponse.body.error).toContain('insuficiente');

      // Verify composition status hasn't changed
      const statusCheck = await request(app)
        .get(`/api/packaging/composition/${compositionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusCheck.body.data.status).toBe('approved'); // Should still be approved
    });
  });

  describe('Performance and Scalability Workflows', () => {
    it('should handle large composition workflows efficiently', async () => {
      // Create composition with many products
      const manyProducts = testProducts.map((product, index) => ({
        productId: product.id,
        quantity: 50 + (index * 10),
        packagingTypeId: testPackagings[index].find(p => p.isBaseUnit).id
      }));

      const startTime = Date.now();

      const calculateResponse = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: manyProducts,
          palletId: testPallets[0].id
        })
        .expect(200);

      const calculationTime = Date.now() - startTime;
      expect(calculationTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(calculateResponse.body.data.products).toHaveLength(testProducts.length);

      // Save and process the large composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Large Composition Performance Test',
          products: manyProducts,
          palletId: testPallets[0].id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Generate report for large composition
      const reportStartTime = Date.now();
      const reportResponse = await request(app)
        .post('/api/packaging/composition/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          includeMetrics: true,
          includeRecommendations: true,
          includeCostAnalysis: true
        })
        .expect(200);

      const reportTime = Date.now() - reportStartTime;
      expect(reportTime).toBeLessThan(3000); // Report generation within 3 seconds
      expect(reportResponse.body.data.reportData.composition.products).toHaveLength(testProducts.length);
    });

    it('should handle multiple concurrent workflows', async () => {
      // Create multiple compositions concurrently
      const concurrentSaves = Array.from({ length: 5 }, (_, index) =>
        request(app)
          .post('/api/packaging/composition/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Concurrent Workflow ${index}`,
            products: [{ productId: testProducts[index % testProducts.length].id, quantity: 10 + index }],
            palletId: testPallets[index % testPallets.length].id
          })
      );

      const responses = await Promise.all(concurrentSaves);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      const compositionIds = responses.map(r => r.body.data.composition.id);

      // Progress all through workflow concurrently
      const concurrentValidations = compositionIds.map(id =>
        request(app)
          .patch(`/api/packaging/composition/${id}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'validated' })
      );

      const validationResponses = await Promise.all(concurrentValidations);
      validationResponses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Generate reports concurrently
      const concurrentReports = compositionIds.map(id =>
        request(app)
          .post('/api/packaging/composition/report')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            compositionId: id,
            includeMetrics: true,
            includeRecommendations: true
          })
      );

      const reportResponses = await Promise.all(concurrentReports);
      reportResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});