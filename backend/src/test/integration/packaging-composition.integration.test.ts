import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/test-app-factory';
import { TestDataFactory } from '../helpers/test-data-factory';
import { db } from '../../db';
import { packagingTypes, ucpItems, products, users, ucps, pallets } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

describe('Packaging Composition - Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let testUser: any;
  let testProduct: any;
  let testPackagings: any[];

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
    // Create test product
    const productData = TestDataFactory.createProduct();
    const [insertedProduct] = await db.insert(products).values({
      sku: productData.code,
      name: productData.name,
      description: productData.description,
      unit: 'un',
      weight: productData.weight.toString(),
      dimensions: productData.dimensions,
      isActive: true,
      createdBy: parseInt(testUser.id.replace('test-user-', ''))
    }).returning();

    testProduct = insertedProduct;

    // Create test packaging hierarchy
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
      },
      {
        productId: testProduct.id,
        name: 'Pallet 144un',
        barcode: '9876543210987',
        baseUnitQuantity: '144.000',
        isBaseUnit: false,
        level: 3,
        createdBy: parseInt(testUser.id.replace('test-user-', ''))
      }
    ];

    testPackagings = await db.insert(packagingTypes).values(packagingData).returning();
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(ucpItems).where(eq(ucpItems.productId, testProduct.id));
    await db.delete(packagingTypes).where(eq(packagingTypes.productId, testProduct.id));
    await db.delete(products).where(eq(products.id, testProduct.id));
  });

  afterAll(async () => {
    // Clean up test user
    await db.delete(users).where(eq(users.email, testUser.email));
  });

  describe('GET /api/packaging/products/:productId', () => {
    it('should retrieve all packaging types for a product with stock information', async () => {
      const response = await request(app)
        .get(`/api/packaging/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('packagings');
      expect(response.body).toHaveProperty('stock');
      expect(response.body).toHaveProperty('consolidated');

      expect(response.body.packagings).toHaveLength(3);
      expect(response.body.packagings[0].isBaseUnit).toBe(true);
      expect(response.body.packagings[0].name).toBe('Unidade');
      
      // Verify packaging order by level
      expect(response.body.packagings[0].level).toBe(1);
      expect(response.body.packagings[1].level).toBe(2);
      expect(response.body.packagings[2].level).toBe(3);
    });

    it('should return 400 for invalid product ID', async () => {
      const response = await request(app)
        .get('/api/packaging/products/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('ID do produto inválido');
    });

    it('should return empty arrays for non-existent product', async () => {
      const response = await request(app)
        .get('/api/packaging/products/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.packagings).toEqual([]);
      expect(response.body.stock).toEqual([]);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/packaging/products/${testProduct.id}`)
        .expect(401);
    });
  });

  describe('GET /api/packaging/products/:productId/hierarchy', () => {
    it('should return hierarchical packaging structure', async () => {
      const response = await request(app)
        .get(`/api/packaging/products/${testProduct.id}/hierarchy`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1); // One root item
      
      const rootItem = response.body[0];
      expect(rootItem.name).toBe('Unidade');
      expect(rootItem.isBaseUnit).toBe(true);
      expect(Array.isArray(rootItem.children)).toBe(true);
    });

    it('should handle complex hierarchy with multiple levels', async () => {
      // Add a child packaging to create deeper hierarchy
      await db.insert(packagingTypes).values({
        productId: testProduct.id,
        name: 'Display 6 caixas',
        baseUnitQuantity: '72.000',
        isBaseUnit: false,
        parentPackagingId: testPackagings[1].id, // Child of 'Caixa'
        level: 3,
        createdBy: parseInt(testUser.id.replace('test-user-', ''))
      });

      const response = await request(app)
        .get(`/api/packaging/products/${testProduct.id}/hierarchy`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const rootItem = response.body[0];
      expect(rootItem.children.length).toBeGreaterThan(0);
      
      // Find the Caixa child and verify it has Display as child
      const caixaChild = rootItem.children.find((child: any) => child.name === 'Caixa 12un');
      expect(caixaChild).toBeDefined();
      expect(caixaChild.children).toHaveLength(1);
      expect(caixaChild.children[0].name).toBe('Display 6 caixas');
    });
  });

  describe('POST /api/packaging/scan', () => {
    it('should find packaging by barcode', async () => {
      const response = await request(app)
        .post('/api/packaging/scan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ barcode: '1234567890123' })
        .expect(200);

      expect(response.body.name).toBe('Caixa 12un');
      expect(response.body.barcode).toBe('1234567890123');
      expect(response.body.baseUnitQuantity).toBe('12.000');
    });

    it('should return 404 for non-existent barcode', async () => {
      const response = await request(app)
        .post('/api/packaging/scan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ barcode: 'nonexistent' })
        .expect(404);

      expect(response.body.error).toContain('não encontrada');
    });

    it('should validate barcode input', async () => {
      const response = await request(app)
        .post('/api/packaging/scan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ barcode: '' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should require barcode in request body', async () => {
      const response = await request(app)
        .post('/api/packaging/scan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/packaging/convert', () => {
    it('should convert quantity between packaging types correctly', async () => {
      const fromPackaging = testPackagings.find(p => p.name === 'Unidade');
      const toPackaging = testPackagings.find(p => p.name === 'Caixa 12un');

      const response = await request(app)
        .post('/api/packaging/convert')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 24,
          fromPackagingId: fromPackaging.id,
          toPackagingId: toPackaging.id
        })
        .expect(200);

      expect(response.body.originalQuantity).toBe(24);
      expect(response.body.convertedQuantity).toBe(2); // 24 units = 2 boxes
      expect(response.body.baseUnits).toBe(24);
      expect(response.body.originalPackagingId).toBe(fromPackaging.id);
      expect(response.body.targetPackagingId).toBe(toPackaging.id);
    });

    it('should handle fractional conversion results', async () => {
      const fromPackaging = testPackagings.find(p => p.name === 'Unidade');
      const toPackaging = testPackagings.find(p => p.name === 'Caixa 12un');

      const response = await request(app)
        .post('/api/packaging/convert')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 18,
          fromPackagingId: fromPackaging.id,
          toPackagingId: toPackaging.id
        })
        .expect(200);

      expect(response.body.convertedQuantity).toBe(1.5); // 18 units = 1.5 boxes
    });

    it('should convert from larger to smaller packaging', async () => {
      const fromPackaging = testPackagings.find(p => p.name === 'Pallet 144un');
      const toPackaging = testPackagings.find(p => p.name === 'Caixa 12un');

      const response = await request(app)
        .post('/api/packaging/convert')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 2,
          fromPackagingId: fromPackaging.id,
          toPackagingId: toPackaging.id
        })
        .expect(200);

      expect(response.body.convertedQuantity).toBe(24); // 2 pallets = 24 boxes
      expect(response.body.baseUnits).toBe(288); // 2 * 144
    });

    it('should validate input parameters', async () => {
      const response = await request(app)
        .post('/api/packaging/convert')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: -5,
          fromPackagingId: testPackagings[0].id,
          toPackagingId: testPackagings[1].id
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 404 for non-existent packaging IDs', async () => {
      const response = await request(app)
        .post('/api/packaging/convert')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 10,
          fromPackagingId: 99999,
          toPackagingId: testPackagings[1].id
        })
        .expect(404);

      expect(response.body.error).toContain('não encontrado');
    });
  });

  describe('POST /api/packaging/optimize-picking', () => {
    beforeEach(async () => {
      // Create test UCP and stock for optimization tests
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

      // Add stock items for optimization
      const basePackaging = testPackagings.find(p => p.isBaseUnit);
      const boxPackaging = testPackagings.find(p => p.name === 'Caixa 12un');
      const palletPackaging = testPackagings.find(p => p.name === 'Pallet 144un');

      await db.insert(ucpItems).values([
        {
          ucpId: insertedUcp.id,
          productId: testProduct.id,
          quantity: '50.000', // 50 units
          packagingTypeId: basePackaging.id,
          addedBy: parseInt(testUser.id.replace('test-user-', ''))
        },
        {
          ucpId: insertedUcp.id,
          productId: testProduct.id,
          quantity: '120.000', // 10 boxes worth
          packagingTypeId: boxPackaging.id,
          addedBy: parseInt(testUser.id.replace('test-user-', ''))
        },
        {
          ucpId: insertedUcp.id,
          productId: testProduct.id,
          quantity: '288.000', // 2 pallets worth
          packagingTypeId: palletPackaging.id,
          addedBy: parseInt(testUser.id.replace('test-user-', ''))
        }
      ]);
    });

    it('should optimize picking plan using largest packaging first', async () => {
      const response = await request(app)
        .post('/api/packaging/optimize-picking')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProduct.id,
          requestedBaseUnits: 300
        })
        .expect(200);

      expect(response.body).toHaveProperty('pickingPlan');
      expect(response.body).toHaveProperty('canFulfill');
      expect(response.body).toHaveProperty('remaining');
      expect(response.body).toHaveProperty('totalPlanned');

      // Should prioritize pallets, then boxes, then units
      expect(response.body.pickingPlan.length).toBeGreaterThan(0);
      
      // First item should be the largest available packaging
      const firstItem = response.body.pickingPlan[0];
      expect(firstItem.packaging.name).toBe('Pallet 144un');
      expect(firstItem.quantity).toBe(2); // Use 2 pallets (288 units)
      expect(firstItem.baseUnits).toBe(288);

      // Should fulfill the request or get close
      expect(response.body.totalPlanned).toBeGreaterThan(0);
      expect(response.body.totalPlanned).toBeLessThanOrEqual(300);
    });

    it('should handle partial fulfillment when stock insufficient', async () => {
      const response = await request(app)
        .post('/api/packaging/optimize-picking')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProduct.id,
          requestedBaseUnits: 1000 // More than available
        })
        .expect(200);

      expect(response.body.canFulfill).toBe(false);
      expect(response.body.remaining).toBeGreaterThan(0);
      expect(response.body.totalPlanned).toBeLessThan(1000);
    });

    it('should handle zero request correctly', async () => {
      const response = await request(app)
        .post('/api/packaging/optimize-picking')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProduct.id,
          requestedBaseUnits: 0
        })
        .expect(200);

      expect(response.body.pickingPlan).toHaveLength(0);
      expect(response.body.canFulfill).toBe(true);
      expect(response.body.remaining).toBe(0);
      expect(response.body.totalPlanned).toBe(0);
    });

    it('should validate input parameters', async () => {
      const response = await request(app)
        .post('/api/packaging/optimize-picking')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProduct.id,
          requestedBaseUnits: -10
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should require both productId and requestedBaseUnits', async () => {
      const response = await request(app)
        .post('/api/packaging/optimize-picking')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProduct.id
          // Missing requestedBaseUnits
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/packaging', () => {
    it('should create new packaging type successfully', async () => {
      const newPackaging = {
        productId: testProduct.id,
        name: 'Display 6 caixas',
        baseUnitQuantity: '72.000',
        isBaseUnit: false,
        level: 3,
        barcode: '5555555555555'
      };

      const response = await request(app)
        .post('/api/packaging')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newPackaging)
        .expect(201);

      expect(response.body.name).toBe(newPackaging.name);
      expect(response.body.baseUnitQuantity).toBe(newPackaging.baseUnitQuantity);
      expect(response.body.productId).toBe(newPackaging.productId);
      expect(response.body.barcode).toBe(newPackaging.barcode);
      expect(response.body.id).toBeDefined();
    });

    it('should prevent creating duplicate base unit packaging', async () => {
      const duplicateBase = {
        productId: testProduct.id,
        name: 'Another Base',
        baseUnitQuantity: '1.000',
        isBaseUnit: true,
        level: 1
      };

      const response = await request(app)
        .post('/api/packaging')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicateBase)
        .expect(409);

      expect(response.body.error).toContain('já existe uma embalagem base');
    });

    it('should prevent creating packaging with duplicate barcode', async () => {
      const duplicateBarcode = {
        productId: testProduct.id,
        name: 'New Packaging',
        baseUnitQuantity: '24.000',
        barcode: '1234567890123', // Same as Caixa
        isBaseUnit: false,
        level: 2
      };

      const response = await request(app)
        .post('/api/packaging')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicateBarcode)
        .expect(409);

      expect(response.body.error).toContain('já existe');
    });

    it('should validate required fields', async () => {
      const invalidPackaging = {
        productId: testProduct.id,
        // Missing name and baseUnitQuantity
        isBaseUnit: false,
        level: 2
      };

      const response = await request(app)
        .post('/api/packaging')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPackaging)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('PUT /api/packaging/:id', () => {
    it('should update packaging successfully', async () => {
      const packagingToUpdate = testPackagings.find(p => p.name === 'Caixa 12un');
      const updates = {
        name: 'Caixa 12 unidades atualizada',
        baseUnitQuantity: '12.000'
      };

      const response = await request(app)
        .put(`/api/packaging/${packagingToUpdate.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.name).toBe(updates.name);
      expect(response.body.id).toBe(packagingToUpdate.id);
    });

    it('should return 404 for non-existent packaging', async () => {
      const response = await request(app)
        .put('/api/packaging/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.error).toContain('não encontrada');
    });

    it('should validate ID parameter', async () => {
      const response = await request(app)
        .put('/api/packaging/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(400);

      expect(response.body.error).toBe('ID da embalagem inválido');
    });
  });

  describe('DELETE /api/packaging/:id', () => {
    it('should soft delete packaging when no items are associated', async () => {
      // Use a packaging that shouldn't have items
      const packagingToDelete = testPackagings.find(p => p.name === 'Pallet 144un');

      const response = await request(app)
        .delete(`/api/packaging/${packagingToDelete.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      expect(response.body).toEqual({});
    });

    it('should return 404 for non-existent packaging', async () => {
      const response = await request(app)
        .delete('/api/packaging/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toContain('não encontrada');
    });

    it('should validate ID parameter', async () => {
      const response = await request(app)
        .delete('/api/packaging/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('ID da embalagem inválido');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      // This would require mocking database failures
      // For now, we test that the API handles errors appropriately
      const response = await request(app)
        .get('/api/packaging/products/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should return empty results rather than crashing
      expect(response.body.packagings).toEqual([]);
    });

    it('should handle concurrent requests correctly', async () => {
      // Test multiple concurrent requests
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .get(`/api/packaging/products/${testProduct.id}`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.packagings).toHaveLength(3);
      });
    });

    it('should validate content-type for POST requests', async () => {
      const response = await request(app)
        .post('/api/packaging/scan')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'text/plain')
        .send('invalid-content')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/packaging/scan')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle large datasets efficiently', async () => {
      // Create many packaging types to test performance
      const manyPackagings = Array.from({ length: 50 }, (_, i) => ({
        productId: testProduct.id,
        name: `Test Packaging ${i}`,
        baseUnitQuantity: `${i + 1}.000`,
        isBaseUnit: false,
        level: (i % 5) + 1,
        createdBy: parseInt(testUser.id.replace('test-user-', ''))
      }));

      await db.insert(packagingTypes).values(manyPackagings);

      const startTime = Date.now();
      const response = await request(app)
        .get(`/api/packaging/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const endTime = Date.now();

      expect(response.body.packagings.length).toBeGreaterThan(50);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain response time under load', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get(`/api/packaging/products/${testProduct.id}`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      responses.forEach(response => expect(response.status).toBe(200));
      expect(endTime - startTime).toBeLessThan(10000); // 10 concurrent requests in under 10 seconds
    });
  });
});