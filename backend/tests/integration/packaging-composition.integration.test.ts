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

describe('Packaging Composition - Full Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let testUser: any;
  let testProduct: any;
  let testProduct2: any;
  let testPackagings: any[];
  let testPackagings2: any[];
  let testPallet: any;
  let savedCompositionId: number;

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
    // Create test pallet first
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

    // Create test products
    const productData1 = TestDataFactory.createProduct();
    const [insertedProduct1] = await db.insert(products).values({
      sku: productData1.code,
      name: productData1.name,
      description: productData1.description,
      unit: 'un',
      weight: '2.5',
      dimensions: { width: 10, length: 15, height: 5 },
      isActive: true,
      createdBy: parseInt(testUser.id.replace('test-user-', ''))
    }).returning();
    testProduct = insertedProduct1;

    const productData2 = TestDataFactory.createProduct();
    const [insertedProduct2] = await db.insert(products).values({
      sku: productData2.code,
      name: productData2.name,
      description: productData2.description,
      unit: 'un',
      weight: '1.8',
      dimensions: { width: 8, length: 12, height: 4 },
      isActive: true,
      createdBy: parseInt(testUser.id.replace('test-user-', ''))
    }).returning();
    testProduct2 = insertedProduct2;

    // Create packaging hierarchies for both products
    const packagingData1 = [
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

    const packagingData2 = [
      {
        productId: testProduct2.id,
        name: 'Unidade',
        baseUnitQuantity: '1.000',
        isBaseUnit: true,
        level: 1,
        createdBy: parseInt(testUser.id.replace('test-user-', ''))
      },
      {
        productId: testProduct2.id,
        name: 'Pacote 6un',
        barcode: '2345678901234',
        baseUnitQuantity: '6.000',
        isBaseUnit: false,
        level: 2,
        createdBy: parseInt(testUser.id.replace('test-user-', ''))
      }
    ];

    testPackagings = await db.insert(packagingTypes).values(packagingData1).returning();
    testPackagings2 = await db.insert(packagingTypes).values(packagingData2).returning();
  });

  afterEach(async () => {
    // Clean up test data in proper order
    await db.delete(compositionReports);
    await db.delete(compositionItems);
    await db.delete(packagingCompositions);
    await db.delete(ucpItems).where(eq(ucpItems.productId, testProduct.id));
    await db.delete(ucpItems).where(eq(ucpItems.productId, testProduct2.id));
    await db.delete(packagingTypes).where(eq(packagingTypes.productId, testProduct.id));
    await db.delete(packagingTypes).where(eq(packagingTypes.productId, testProduct2.id));
    await db.delete(products).where(eq(products.id, testProduct.id));
    await db.delete(products).where(eq(products.id, testProduct2.id));
    await db.delete(pallets).where(eq(pallets.id, testPallet.id));
  });

  afterAll(async () => {
    // Clean up test user
    await db.delete(users).where(eq(users.email, testUser.email));
  });

  describe('1. POST /api/packaging/composition/calculate', () => {
    it('should calculate optimal composition for single product', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProduct.id,
              quantity: 24,
              packagingTypeId: testPackagings.find(p => p.isBaseUnit).id
            }
          ],
          palletId: testPallet.id,
          constraints: {
            maxWeight: 500,
            maxHeight: 180,
            maxVolume: 1.5
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isValid');
      expect(response.body.data).toHaveProperty('efficiency');
      expect(response.body.data).toHaveProperty('layout');
      expect(response.body.data).toHaveProperty('weight');
      expect(response.body.data).toHaveProperty('volume');
      expect(response.body.data).toHaveProperty('height');
      expect(response.body.data.products).toHaveLength(1);
      expect(response.body.data.products[0].productId).toBe(testProduct.id);
    });

    it('should calculate composition for multiple products', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProduct.id,
              quantity: 12,
              packagingTypeId: testPackagings.find(p => p.isBaseUnit).id
            },
            {
              productId: testProduct2.id,
              quantity: 18,
              packagingTypeId: testPackagings2.find(p => p.isBaseUnit).id
            }
          ],
          palletId: testPallet.id
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toHaveLength(2);
      expect(response.body.data.layout.totalItems).toBe(30); // 12 + 18
    });

    it('should handle weight constraint violations', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProduct.id,
              quantity: 1000, // Very large quantity
              packagingTypeId: testPackagings.find(p => p.isBaseUnit).id
            }
          ],
          palletId: testPallet.id,
          constraints: {
            maxWeight: 50 // Very low weight limit
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.weight.total).toBeGreaterThan(response.body.data.weight.limit);
    });

    it('should validate request parameters', async () => {
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

    it('should require authentication', async () => {
      await request(app)
        .post('/api/packaging/composition/calculate')
        .send({
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        })
        .expect(401);
    });
  });

  describe('2. POST /api/packaging/composition/validate', () => {
    it('should validate composition constraints successfully', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProduct.id,
              quantity: 10,
              packagingTypeId: testPackagings.find(p => p.isBaseUnit).id
            }
          ],
          palletId: testPallet.id
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isValid');
      expect(response.body.data).toHaveProperty('violations');
      expect(response.body.data).toHaveProperty('warnings');
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data.metrics).toHaveProperty('totalWeight');
      expect(response.body.data.metrics).toHaveProperty('totalVolume');
      expect(response.body.data.metrics).toHaveProperty('efficiency');
    });

    it('should detect constraint violations', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          products: [
            {
              productId: testProduct.id,
              quantity: 2000, // Very large quantity to trigger violations
              packagingTypeId: testPackagings.find(p => p.isBaseUnit).id
            }
          ],
          palletId: testPallet.id
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.violations.length).toBeGreaterThan(0);
    });
  });

  describe('3. POST /api/packaging/composition/save', () => {
    it('should save composition successfully', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Composition',
          description: 'Integration test composition',
          products: [
            {
              productId: testProduct.id,
              quantity: 24,
              packagingTypeId: testPackagings.find(p => p.isBaseUnit).id
            }
          ],
          palletId: testPallet.id,
          constraints: {
            maxWeight: 500,
            maxHeight: 180
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.composition).toHaveProperty('id');
      expect(response.body.data.composition.name).toBe('Test Composition');
      expect(response.body.data.composition.status).toBe('draft');
      
      savedCompositionId = response.body.data.composition.id;
    });

    it('should prevent saving composition with invalid data', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '', // Empty name
          products: [
            {
              productId: testProduct.id,
              quantity: 0 // Invalid quantity
            }
          ]
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('4. GET /api/packaging/composition/list', () => {
    beforeEach(async () => {
      // Create test compositions for listing
      await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Listed Composition 1',
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        });

      await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Listed Composition 2',
          products: [{ productId: testProduct2.id, quantity: 15 }],
          palletId: testPallet.id
        });
    });

    it('should list compositions with pagination', async () => {
      const response = await request(app)
        .get('/api/packaging/composition/list?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter compositions by status', async () => {
      const response = await request(app)
        .get('/api/packaging/composition/list?status=draft')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((composition: any) => {
        expect(composition.status).toBe('draft');
      });
    });

    it('should filter compositions by user', async () => {
      const userId = parseInt(testUser.id.replace('test-user-', ''));
      const response = await request(app)
        .get(`/api/packaging/composition/list?userId=${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((composition: any) => {
        expect(composition.createdBy).toBe(userId);
      });
    });
  });

  describe('5. GET /api/packaging/composition/:id', () => {
    let compositionId: number;

    beforeEach(async () => {
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Detailed Composition',
          description: 'For detail testing',
          products: [
            {
              productId: testProduct.id,
              quantity: 12,
              packagingTypeId: testPackagings.find(p => p.isBaseUnit).id
            }
          ],
          palletId: testPallet.id
        });
      
      compositionId = saveResponse.body.data.composition.id;
    });

    it('should get composition details with items', async () => {
      const response = await request(app)
        .get(`/api/packaging/composition/${compositionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', compositionId);
      expect(response.body.data).toHaveProperty('name', 'Detailed Composition');
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.items.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent composition', async () => {
      const response = await request(app)
        .get('/api/packaging/composition/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toContain('não encontrada');
    });

    it('should validate composition ID parameter', async () => {
      const response = await request(app)
        .get('/api/packaging/composition/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('6. PATCH /api/packaging/composition/:id/status', () => {
    let compositionId: number;

    beforeEach(async () => {
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Status Test Composition',
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        });
      
      compositionId = saveResponse.body.data.composition.id;
    });

    it('should update composition status from draft to validated', async () => {
      const response = await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'validated' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('validated');
      expect(response.body.data.id).toBe(compositionId);
    });

    it('should update status from validated to approved', async () => {
      // First set to validated
      await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'validated' });

      // Then approve
      const response = await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('approved');
      expect(response.body.data.approvedBy).toBeDefined();
      expect(response.body.data.approvedAt).toBeDefined();
    });

    it('should validate status values', async () => {
      const response = await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 404 for non-existent composition', async () => {
      const response = await request(app)
        .patch('/api/packaging/composition/99999/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'validated' })
        .expect(404);

      expect(response.body.error).toContain('não encontrada');
    });
  });

  describe('7. POST /api/packaging/composition/report', () => {
    let compositionId: number;

    beforeEach(async () => {
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Report Test Composition',
          products: [{ productId: testProduct.id, quantity: 20 }],
          palletId: testPallet.id
        });
      
      compositionId = saveResponse.body.data.composition.id;
    });

    it('should generate basic composition report', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          includeMetrics: true,
          includeRecommendations: true,
          includeCostAnalysis: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('compositionId', compositionId);
      expect(response.body.data).toHaveProperty('reportType', 'detailed');
      expect(response.body.data).toHaveProperty('reportData');
      expect(response.body.data.reportData).toHaveProperty('metrics');
      expect(response.body.data.reportData).toHaveProperty('recommendations');
      expect(response.body.data.reportData).toHaveProperty('executiveSummary');
    });

    it('should generate report with cost analysis', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          includeMetrics: true,
          includeRecommendations: true,
          includeCostAnalysis: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reportData).toHaveProperty('costAnalysis');
      expect(response.body.data.reportData.costAnalysis).toHaveProperty('totalCost');
      expect(response.body.data.reportData.costAnalysis).toHaveProperty('packagingCost');
      expect(response.body.data.reportData.costAnalysis).toHaveProperty('handlingCost');
    });

    it('should validate report generation parameters', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: 'invalid', // Invalid ID
          includeMetrics: true
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 404 for non-existent composition', async () => {
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

  describe('8. POST /api/packaging/composition/assemble', () => {
    let approvedCompositionId: number;
    let testUcp: any;

    beforeEach(async () => {
      // Create test UCP
      const ucp = TestDataFactory.createUCP(testPallet.id.toString(), testUser.id);
      const [insertedUcp] = await db.insert(ucps).values({
        code: ucp.code,
        palletId: testPallet.id,
        status: 'active',
        createdBy: parseInt(testUser.id.replace('test-user-', ''))
      }).returning();
      testUcp = insertedUcp;

      // Create and approve composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Assembly Test Composition',
          products: [{ productId: testProduct.id, quantity: 5 }],
          palletId: testPallet.id
        });
      
      approvedCompositionId = saveResponse.body.data.composition.id;

      // Update to approved status
      await request(app)
        .patch(`/api/packaging/composition/${approvedCompositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'validated' });

      await request(app)
        .patch(`/api/packaging/composition/${approvedCompositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' });

      // Add sufficient stock for assembly
      const basePackaging = testPackagings.find(p => p.isBaseUnit);
      await db.insert(ucpItems).values({
        ucpId: testUcp.id,
        productId: testProduct.id,
        quantity: '100.000', // Sufficient stock
        packagingTypeId: basePackaging.id,
        addedBy: parseInt(testUser.id.replace('test-user-', ''))
      });
    });

    it('should assemble approved composition successfully', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/assemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: approvedCompositionId,
          targetUcpId: testUcp.id
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.message).toContain('montada com sucesso');
    });

    it('should prevent assembly of non-approved composition', async () => {
      // Create draft composition
      const draftResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Draft Composition',
          products: [{ productId: testProduct.id, quantity: 5 }],
          palletId: testPallet.id
        });

      const response = await request(app)
        .post('/api/packaging/composition/assemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: draftResponse.body.data.composition.id,
          targetUcpId: testUcp.id
        })
        .expect(400);

      expect(response.body.error).toContain('aprovadas');
    });

    it('should detect insufficient stock for assembly', async () => {
      // Create composition requiring more stock than available
      const largeResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Large Composition',
          products: [{ productId: testProduct.id, quantity: 500 }], // More than stock
          palletId: testPallet.id
        });

      const largeCompositionId = largeResponse.body.data.composition.id;

      // Approve the composition
      await request(app)
        .patch(`/api/packaging/composition/${largeCompositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'validated' });

      await request(app)
        .patch(`/api/packaging/composition/${largeCompositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' });

      const response = await request(app)
        .post('/api/packaging/composition/assemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: largeCompositionId,
          targetUcpId: testUcp.id
        })
        .expect(400);

      expect(response.body.error).toContain('Estoque insuficiente');
    });
  });

  describe('9. POST /api/packaging/composition/disassemble', () => {
    let executedCompositionId: number;
    let testUcp1: any;
    let testUcp2: any;

    beforeEach(async () => {
      // Create test UCPs
      const ucp1 = TestDataFactory.createUCP(testPallet.id.toString(), testUser.id);
      const [insertedUcp1] = await db.insert(ucps).values({
        code: ucp1.code,
        palletId: testPallet.id,
        status: 'active',
        createdBy: parseInt(testUser.id.replace('test-user-', ''))
      }).returning();
      testUcp1 = insertedUcp1;

      const ucp2 = TestDataFactory.createUCP(testPallet.id.toString(), testUser.id);
      const [insertedUcp2] = await db.insert(ucps).values({
        code: ucp2.code,
        palletId: testPallet.id,
        status: 'active',
        createdBy: parseInt(testUser.id.replace('test-user-', ''))
      }).returning();
      testUcp2 = insertedUcp2;

      // Create, approve, and execute composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Disassembly Test',
          products: [{ productId: testProduct.id, quantity: 20 }],
          palletId: testPallet.id
        });
      
      executedCompositionId = saveResponse.body.data.composition.id;

      // Progress through statuses to executed
      await request(app)
        .patch(`/api/packaging/composition/${executedCompositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'validated' });

      await request(app)
        .patch(`/api/packaging/composition/${executedCompositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' });

      await request(app)
        .patch(`/api/packaging/composition/${executedCompositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'executed' });
    });

    it('should disassemble executed composition successfully', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/disassemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: executedCompositionId,
          targetUcps: [
            {
              productId: testProduct.id,
              quantity: 12,
              ucpId: testUcp1.id
            },
            {
              productId: testProduct.id,
              quantity: 8,
              ucpId: testUcp2.id
            }
          ]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.message).toContain('desmontada com sucesso');
    });

    it('should prevent disassembly of non-executed composition', async () => {
      // Create approved but not executed composition
      const approvedResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Approved Only',
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        });

      const approvedId = approvedResponse.body.data.composition.id;
      
      await request(app)
        .patch(`/api/packaging/composition/${approvedId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' });

      const response = await request(app)
        .post('/api/packaging/composition/disassemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: approvedId,
          targetUcps: [
            { productId: testProduct.id, quantity: 5, ucpId: testUcp1.id }
          ]
        })
        .expect(400);

      expect(response.body.error).toContain('executadas');
    });

    it('should validate disassembly quantities', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/disassemble')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: executedCompositionId,
          targetUcps: [
            {
              productId: testProduct.id,
              quantity: 50, // More than composition has (20)
              ucpId: testUcp1.id
            }
          ]
        })
        .expect(400);

      expect(response.body.error).toContain('maior que a disponível');
    });
  });

  describe('10. DELETE /api/packaging/composition/:id', () => {
    let compositionId: number;

    beforeEach(async () => {
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Delete Test Composition',
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        });
      
      compositionId = saveResponse.body.data.composition.id;
    });

    it('should soft delete composition successfully', async () => {
      const response = await request(app)
        .delete(`/api/packaging/composition/${compositionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      expect(response.body).toEqual({});

      // Verify composition is not returned in list
      const listResponse = await request(app)
        .get('/api/packaging/composition/list')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const deletedComposition = listResponse.body.data.find(
        (comp: any) => comp.id === compositionId
      );
      expect(deletedComposition).toBeUndefined();
    });

    it('should return 404 for non-existent composition', async () => {
      const response = await request(app)
        .delete('/api/packaging/composition/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toContain('não encontrada');
    });

    it('should validate composition ID parameter', async () => {
      const response = await request(app)
        .delete('/api/packaging/composition/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should enforce rate limits on calculation endpoint', async () => {
      const requests = Array.from({ length: 7 }, () =>
        request(app)
          .post('/api/packaging/composition/calculate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            products: [{ productId: testProduct.id, quantity: 5 }],
            palletId: testPallet.id
          })
      );

      const responses = await Promise.all(requests);
      
      // First 5 should succeed, remaining should be rate limited
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      expect(successCount).toBeLessThanOrEqual(5);
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should enforce rate limits on assembly operations', async () => {
      // Create multiple approved compositions first
      const compositions = [];
      for (let i = 0; i < 7; i++) {
        const saveResponse = await request(app)
          .post('/api/packaging/composition/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Rate Limit Test ${i}`,
            products: [{ productId: testProduct.id, quantity: 1 }],
            palletId: testPallet.id
          });
        
        const compId = saveResponse.body.data.composition.id;
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

      // Add stock
      await db.insert(ucpItems).values({
        ucpId: insertedUcp.id,
        productId: testProduct.id,
        quantity: '100.000',
        packagingTypeId: testPackagings.find(p => p.isBaseUnit).id,
        addedBy: parseInt(testUser.id.replace('test-user-', ''))
      });

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
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should sanitize input data', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '<script>alert("xss")</script>Test',
          description: '<img src=x onerror=alert("xss")>',
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        })
        .expect(200);

      expect(response.body.data.composition.name).not.toContain('<script>');
      expect(response.body.data.composition.description).not.toContain('<img');
    });
  });

  describe('Performance and Concurrent Access', () => {
    it('should handle concurrent composition calculations', async () => {
      const concurrentRequests = 10;
      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .post('/api/packaging/composition/calculate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            products: [{ productId: testProduct.id, quantity: 10 }],
            palletId: testPallet.id
          })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should maintain data consistency under concurrent access', async () => {
      // Create composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Concurrent Test',
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: testPallet.id
        });
      
      const compositionId = saveResponse.body.data.composition.id;

      // Concurrent status updates (should handle gracefully)
      const statusRequests = Array.from({ length: 5 }, () =>
        request(app)
          .patch(`/api/packaging/composition/${compositionId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'validated' })
      );

      const responses = await Promise.all(statusRequests);
      
      // All should either succeed or fail gracefully
      responses.forEach(response => {
        expect([200, 400, 409]).toContain(response.status);
      });

      // Final state should be consistent
      const finalResponse = await request(app)
        .get(`/api/packaging/composition/${compositionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(['draft', 'validated']).toContain(finalResponse.body.data.status);
    });
  });
});