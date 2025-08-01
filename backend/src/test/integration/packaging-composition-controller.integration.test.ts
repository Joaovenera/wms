import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/test-app-factory';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database-test-helper';
import { createTestData, TestDataFactory } from '../helpers/test-data-factory';
import { db } from '../../db';
import { packagingCompositions, compositionItems } from '../../db/schema';

describe('PackagingController - Composition Integration Tests', () => {
  let app: Express;
  let testData: TestDataFactory;
  let authToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await setupTestDatabase();
    testData = await createTestData();
    
    // Get auth token for authenticated requests
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testData.users.admin.email,
        password: 'admin123'
      });
    
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Clean up compositions between tests
    await db.delete(compositionItems);
    await db.delete(packagingCompositions);
  });

  describe('POST /api/packaging/composition/calculate', () => {
    it('should calculate optimal composition for valid request', async () => {
      const compositionRequest = {
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 10,
            packagingTypeId: testData.packaging.unit1.id
          },
          {
            productId: testData.products.testProduct2.id,
            quantity: 5,
            packagingTypeId: testData.packaging.unit2.id
          }
        ],
        palletId: testData.pallets.standardPallet.id
      };

      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .send(compositionRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isValid');
      expect(response.body.data).toHaveProperty('efficiency');
      expect(response.body.data).toHaveProperty('layout');
      expect(response.body.data).toHaveProperty('weight');
      expect(response.body.data).toHaveProperty('volume');
      expect(response.body.data).toHaveProperty('height');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data).toHaveProperty('warnings');
      expect(response.body.data).toHaveProperty('products');

      // Verify calculation results
      expect(response.body.data.products).toHaveLength(2);
      expect(response.body.data.efficiency).toBeGreaterThan(0);
      expect(response.body.data.layout.totalItems).toBe(15);
    });

    it('should calculate composition without specified pallet', async () => {
      const compositionRequest = {
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 5
          }
        ]
      };

      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .send(compositionRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBeDefined();
    });

    it('should apply custom constraints', async () => {
      const compositionRequest = {
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 20
          }
        ],
        palletId: testData.pallets.standardPallet.id,
        constraints: {
          maxWeight: 500,
          maxHeight: 100,
          maxVolume: 1.0
        }
      };

      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .send(compositionRequest)
        .expect(200);

      expect(response.body.data.weight.limit).toBe(500);
      expect(response.body.data.height.limit).toBe(100);
      expect(response.body.data.volume.limit).toBe(1.0);
    });

    it('should return validation errors for invalid request', async () => {
      const invalidRequest = {
        products: [] // Empty products array
      };

      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Dados inválidos');
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details).toBeDefined();
    });

    it('should handle non-existent product ID', async () => {
      const invalidRequest = {
        products: [
          {
            productId: 99999, // Non-existent product
            quantity: 10
          }
        ]
      };

      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .send(invalidRequest)
        .expect(500);

      expect(response.body.error).toBe('Erro interno do servidor');
    });

    it('should handle non-existent pallet ID', async () => {
      const invalidRequest = {
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 10
          }
        ],
        palletId: 99999 // Non-existent pallet
      };

      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .send(invalidRequest)
        .expect(500);

      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  describe('POST /api/packaging/composition/validate', () => {
    it('should validate composition constraints successfully', async () => {
      const validationRequest = {
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 5,
            packagingTypeId: testData.packaging.unit1.id
          }
        ],
        palletId: testData.pallets.standardPallet.id
      };

      const response = await request(app)
        .post('/api/packaging/composition/validate')
        .send(validationRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isValid');
      expect(response.body.data).toHaveProperty('violations');
      expect(response.body.data).toHaveProperty('warnings');
      expect(response.body.data).toHaveProperty('metrics');

      expect(response.body.data.metrics).toEqual(
        expect.objectContaining({
          totalWeight: expect.any(Number),
          totalVolume: expect.any(Number),
          totalHeight: expect.any(Number),
          efficiency: expect.any(Number)
        })
      );
    });

    it('should detect constraint violations', async () => {
      // Create a request that violates weight constraints by using heavy products
      const heavyRequest = {
        products: [
          {
            productId: testData.products.heavyProduct.id,
            quantity: 20, // Large quantity of heavy product
            packagingTypeId: testData.packaging.heavyUnit.id
          }
        ],
        palletId: testData.pallets.lightPallet.id // Light capacity pallet
      };

      const response = await request(app)
        .post('/api/packaging/composition/validate')
        .send(heavyRequest)
        .expect(200);

      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.violations.length).toBeGreaterThan(0);
      expect(response.body.data.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: expect.stringMatching(/weight|volume|height/),
            severity: 'error'
          })
        ])
      );
    });

    it('should return validation errors for missing required fields', async () => {
      const invalidRequest = {
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 5
            // Missing packagingTypeId (required for validation)
          }
        ]
        // Missing palletId (required for validation)
      };

      const response = await request(app)
        .post('/api/packaging/composition/validate')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Dados inválidos');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/packaging/composition/save', () => {
    it('should save composition with authentication', async () => {
      const saveRequest = {
        name: 'Test Composition',
        description: 'Integration test composition',
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 10,
            packagingTypeId: testData.packaging.unit1.id
          }
        ],
        palletId: testData.pallets.standardPallet.id
      };

      const response = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveRequest)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('composition');
      expect(response.body.data).toHaveProperty('result');
      expect(response.body.data.composition.name).toBe('Test Composition');
      expect(response.body.data.composition.description).toBe('Integration test composition');
    });

    it('should reject save without authentication', async () => {
      const saveRequest = {
        name: 'Unauthorized Composition',
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 5
          }
        ]
      };

      await request(app)
        .post('/api/packaging/composition/save')
        .send(saveRequest)
        .expect(401);
    });

    it('should validate required fields for save', async () => {
      const invalidSaveRequest = {
        // Missing name
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 5
          }
        ]
      };

      const response = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidSaveRequest)
        .expect(400);

      expect(response.body.error).toBe('Dados inválidos');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/packaging/composition/:id', () => {
    let savedCompositionId: number;

    beforeEach(async () => {
      // Create a test composition
      const saveRequest = {
        name: 'Test Composition for GET',
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 8,
            packagingTypeId: testData.packaging.unit1.id
          }
        ],
        palletId: testData.pallets.standardPallet.id
      };

      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveRequest);

      savedCompositionId = saveResponse.body.data.composition.id;
    });

    it('should retrieve composition by ID', async () => {
      const response = await request(app)
        .get(`/api/packaging/composition/${savedCompositionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', savedCompositionId);
      expect(response.body.data).toHaveProperty('name', 'Test Composition for GET');
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data.items).toHaveLength(1);
    });

    it('should return 404 for non-existent composition', async () => {
      const response = await request(app)
        .get('/api/packaging/composition/99999')
        .expect(404);

      expect(response.body.error).toBe('Composição não encontrada');
      expect(response.body.code).toBe('COMPOSITION_NOT_FOUND');
    });

    it('should return 400 for invalid ID format', async () => {
      const response = await request(app)
        .get('/api/packaging/composition/invalid-id')
        .expect(400);

      expect(response.body.error).toBe('ID da composição inválido');
      expect(response.body.code).toBe('INVALID_COMPOSITION_ID');
    });
  });

  describe('GET /api/packaging/composition', () => {
    beforeEach(async () => {
      // Create multiple test compositions with different statuses
      const compositions = [
        { name: 'Draft Composition', status: 'draft' },
        { name: 'Validated Composition', status: 'validated' },
        { name: 'Approved Composition', status: 'approved' }
      ];

      for (const comp of compositions) {
        const saveRequest = {
          name: comp.name,
          products: [
            {
              productId: testData.products.testProduct1.id,
              quantity: 5
            }
          ]
        };

        const saveResponse = await request(app)
          .post('/api/packaging/composition/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send(saveRequest);

        // Update status if needed
        if (comp.status !== 'draft') {
          await request(app)
            .put(`/api/packaging/composition/${saveResponse.body.data.composition.id}/status`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: comp.status });
        }
      }
    });

    it('should list all compositions with pagination', async () => {
      const response = await request(app)
        .get('/api/packaging/composition')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 20,
          total: expect.any(Number),
          totalPages: expect.any(Number)
        })
      );
    });

    it('should filter compositions by status', async () => {
      const response = await request(app)
        .get('/api/packaging/composition?status=validated')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      
      // All returned compositions should have validated status
      response.body.data.forEach((comp: any) => {
        expect(comp.status).toBe('validated');
      });
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/packaging/composition?page=1&limit=2')
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/packaging/composition?page=-1&limit=0')
        .expect(400);

      expect(response.body.error).toBe('Parâmetros inválidos');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/packaging/composition/:id/status', () => {
    let compositionId: number;

    beforeEach(async () => {
      const saveRequest = {
        name: 'Status Test Composition',
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 5
          }
        ]
      };

      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveRequest);

      compositionId = saveResponse.body.data.composition.id;
    });

    it('should update composition status with authentication', async () => {
      const response = await request(app)
        .put(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'validated' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('validated');
    });

    it('should reject status update without authentication', async () => {
      await request(app)
        .put(`/api/packaging/composition/${compositionId}/status`)
        .send({ status: 'validated' })
        .expect(401);
    });

    it('should validate status values', async () => {
      const response = await request(app)
        .put(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(response.body.error).toBe('Dados inválidos');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should handle non-existent composition', async () => {
      const response = await request(app)
        .put('/api/packaging/composition/99999/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'validated' })
        .expect(404);

      expect(response.body.code).toBe('COMPOSITION_NOT_FOUND');
    });
  });

  describe('POST /api/packaging/composition/:id/assemble', () => {
    let approvedCompositionId: number;

    beforeEach(async () => {
      // Create and approve a composition for assembly tests
      const saveRequest = {
        name: 'Assembly Test Composition',
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 3, // Small quantity to ensure stock availability
            packagingTypeId: testData.packaging.unit1.id
          }
        ],
        palletId: testData.pallets.standardPallet.id
      };

      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveRequest);

      approvedCompositionId = saveResponse.body.data.composition.id;

      // Update to approved status
      await request(app)
        .put(`/api/packaging/composition/${approvedCompositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' });
    });

    it('should assemble approved composition with sufficient stock', async () => {
      const assembleRequest = {
        compositionId: approvedCompositionId,
        targetUcpId: testData.ucps.testUcp1.id
      };

      const response = await request(app)
        .post(`/api/packaging/composition/${approvedCompositionId}/assemble`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(assembleRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.message).toContain('montada com sucesso');
    });

    it('should reject assembly without authentication', async () => {
      const assembleRequest = {
        compositionId: approvedCompositionId,
        targetUcpId: testData.ucps.testUcp1.id
      };

      await request(app)
        .post(`/api/packaging/composition/${approvedCompositionId}/assemble`)
        .send(assembleRequest)
        .expect(401);
    });

    it('should reject assembly of non-approved composition', async () => {
      // Create a draft composition
      const draftSaveRequest = {
        name: 'Draft Assembly Test',
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 2
          }
        ]
      };

      const draftResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send(draftSaveRequest);

      const draftCompositionId = draftResponse.body.data.composition.id;

      const assembleRequest = {
        compositionId: draftCompositionId,
        targetUcpId: testData.ucps.testUcp1.id
      };

      const response = await request(app)
        .post(`/api/packaging/composition/${draftCompositionId}/assemble`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(assembleRequest)
        .expect(400);

      expect(response.body.code).toBe('BUSINESS_RULE_VIOLATION');
    });
  });

  describe('POST /api/packaging/composition/:id/disassemble', () => {
    let executedCompositionId: number;

    beforeEach(async () => {
      // Create, approve, and execute a composition for disassembly tests
      const saveRequest = {
        name: 'Disassembly Test Composition',
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 5,
            packagingTypeId: testData.packaging.unit1.id
          },
          {
            productId: testData.products.testProduct2.id,
            quantity: 3,
            packagingTypeId: testData.packaging.unit2.id
          }
        ],
        palletId: testData.pallets.standardPallet.id
      };

      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveRequest);

      executedCompositionId = saveResponse.body.data.composition.id;

      // Approve composition
      await request(app)
        .put(`/api/packaging/composition/${executedCompositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' });

      // Execute composition
      await request(app)
        .post(`/api/packaging/composition/${executedCompositionId}/assemble`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: executedCompositionId,
          targetUcpId: testData.ucps.testUcp1.id
        });
    });

    it('should disassemble executed composition', async () => {
      const disassembleRequest = {
        compositionId: executedCompositionId,
        targetUcps: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 3,
            ucpId: testData.ucps.testUcp2.id
          },
          {
            productId: testData.products.testProduct2.id,
            quantity: 2,
            ucpId: testData.ucps.testUcp3.id
          }
        ]
      };

      const response = await request(app)
        .post(`/api/packaging/composition/${executedCompositionId}/disassemble`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(disassembleRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.message).toContain('desmontada com sucesso');
    });

    it('should reject disassembly with excessive quantities', async () => {
      const invalidDisassembleRequest = {
        compositionId: executedCompositionId,
        targetUcps: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 10, // More than available (5)
            ucpId: testData.ucps.testUcp2.id
          }
        ]
      };

      const response = await request(app)
        .post(`/api/packaging/composition/${executedCompositionId}/disassemble`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDisassembleRequest)
        .expect(400);

      expect(response.body.code).toBe('BUSINESS_RULE_VIOLATION');
    });
  });

  describe('POST /api/packaging/composition/:id/report', () => {
    let compositionId: number;

    beforeEach(async () => {
      const saveRequest = {
        name: 'Report Test Composition',
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 8
          }
        ]
      };

      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveRequest);

      compositionId = saveResponse.body.data.composition.id;
    });

    it('should generate comprehensive composition report', async () => {
      const reportRequest = {
        compositionId,
        includeMetrics: true,
        includeRecommendations: true
      };

      const response = await request(app)
        .post(`/api/packaging/composition/${compositionId}/report`)
        .send(reportRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('reportType', 'detailed');
    });

    it('should handle non-existent composition for report', async () => {
      const reportRequest = {
        compositionId: 99999,
        includeMetrics: true
      };

      const response = await request(app)
        .post('/api/packaging/composition/99999/report')
        .send(reportRequest)
        .expect(500);

      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  describe('DELETE /api/packaging/composition/:id', () => {
    let compositionId: number;

    beforeEach(async () => {
      const saveRequest = {
        name: 'Delete Test Composition',
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 5
          }
        ]
      };

      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveRequest);

      compositionId = saveResponse.body.data.composition.id;
    });

    it('should soft delete composition', async () => {
      await request(app)
        .delete(`/api/packaging/composition/${compositionId}`)
        .expect(204);

      // Verify composition is not accessible
      await request(app)
        .get(`/api/packaging/composition/${compositionId}`)
        .expect(404);
    });

    it('should prevent deletion of executed composition', async () => {
      // First approve and execute the composition
      await request(app)
        .put(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' });

      await request(app)
        .post(`/api/packaging/composition/${compositionId}/assemble`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId,
          targetUcpId: testData.ucps.testUcp1.id
        });

      // Now try to delete - should be prevented
      const response = await request(app)
        .delete(`/api/packaging/composition/${compositionId}`)
        .expect(409);

      expect(response.body.code).toBe('BUSINESS_RULE_VIOLATION');
    });

    it('should handle deletion of non-existent composition', async () => {
      const response = await request(app)
        .delete('/api/packaging/composition/99999')
        .expect(404);

      expect(response.body.code).toBe('COMPOSITION_NOT_FOUND');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection issues gracefully', async () => {
      // Simulate database error by providing invalid data
      const request_data = {
        products: [
          {
            productId: 'invalid', // Invalid type
            quantity: 10
          }
        ]
      };

      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .send(request_data)
        .expect(400);

      expect(response.body.error).toBe('Dados inválidos');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should handle concurrent composition operations', async () => {
      const compositionRequest = {
        name: 'Concurrent Test',
        products: [
          {
            productId: testData.products.testProduct1.id,
            quantity: 5
          }
        ]
      };

      // Create multiple concurrent requests
      const promises = Array(5).fill(null).map((_, index) => 
        request(app)
          .post('/api/packaging/composition/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...compositionRequest,
            name: `${compositionRequest.name} ${index}`
          })
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.composition.name).toBe(`Concurrent Test ${index}`);
      });
    });

    it('should handle large composition requests efficiently', async () => {
      const largeCompositionRequest = {
        products: Array.from({ length: 50 }, (_, index) => ({
          productId: testData.products.testProduct1.id,
          quantity: 1 + (index % 10) // Varying quantities
        }))
      };

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .send(largeCompositionRequest)
        .expect(200);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});