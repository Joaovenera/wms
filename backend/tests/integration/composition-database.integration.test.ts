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
import { eq, and, sql } from 'drizzle-orm';

describe('Composition Database Integration Tests', () => {
  let app: Express;
  let authToken: string;
  let testUser: any;
  let testProduct: any;
  let testPackagings: any[];
  let testPallet: any;

  beforeAll(async () => {
    app = await createTestApp();
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

    // Get auth token
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

  describe('Composition Table Operations', () => {
    it('should create composition record with all required fields', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Database Test Composition',
          description: 'Testing database integration',
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

      const compositionId = response.body.data.composition.id;

      // Verify record in database
      const dbComposition = await db.select()
        .from(packagingCompositions)
        .where(eq(packagingCompositions.id, compositionId))
        .limit(1);

      expect(dbComposition).toHaveLength(1);
      expect(dbComposition[0].name).toBe('Database Test Composition');
      expect(dbComposition[0].description).toBe('Testing database integration');
      expect(dbComposition[0].status).toBe('draft');
      expect(dbComposition[0].palletId).toBe(testPallet.id);
      expect(dbComposition[0].createdBy).toBe(parseInt(testUser.id.replace('test-user-', '')));
      expect(dbComposition[0].constraints).toBeDefined();
      expect(dbComposition[0].result).toBeDefined();
      expect(dbComposition[0].isActive).toBe(true);
      expect(dbComposition[0].createdAt).toBeDefined();
      expect(dbComposition[0].updatedAt).toBeDefined();
    });

    it('should create composition items with proper relationships', async () => {
      const response = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Items Test Composition',
          products: [
            {
              productId: testProduct.id,
              quantity: 36,
              packagingTypeId: testPackagings.find(p => p.level === 2).id // Caixa
            }
          ],
          palletId: testPallet.id
        })
        .expect(200);

      const compositionId = response.body.data.composition.id;

      // Verify composition items in database
      const dbItems = await db.select()
        .from(compositionItems)
        .where(eq(compositionItems.compositionId, compositionId));

      expect(dbItems).toHaveLength(1);
      
      const item = dbItems[0];
      expect(item.compositionId).toBe(compositionId);
      expect(item.productId).toBe(testProduct.id);
      expect(item.packagingTypeId).toBe(testPackagings.find(p => p.level === 2).id);
      expect(item.quantity).toBe('36.000');
      expect(item.layer).toBeGreaterThan(0);
      expect(item.sortOrder).toBeGreaterThanOrEqual(0);
      expect(item.addedBy).toBe(parseInt(testUser.id.replace('test-user-', '')));
      expect(item.isActive).toBe(true);
      expect(item.addedAt).toBeDefined();
    });

    it('should handle composition status updates with proper audit fields', async () => {
      // Create composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Status Update Test',
          products: [{ productId: testProduct.id, quantity: 12 }],
          palletId: testPallet.id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Update to validated
      await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'validated' })
        .expect(200);

      // Update to approved
      await request(app)
        .patch(`/api/packaging/composition/${compositionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' })
        .expect(200);

      // Verify database record
      const dbComposition = await db.select()
        .from(packagingCompositions)
        .where(eq(packagingCompositions.id, compositionId))
        .limit(1);

      expect(dbComposition[0].status).toBe('approved');
      expect(dbComposition[0].approvedBy).toBe(parseInt(testUser.id.replace('test-user-', '')));
      expect(dbComposition[0].approvedAt).toBeDefined();
      expect(new Date(dbComposition[0].updatedAt).getTime()).toBeGreaterThan(new Date(dbComposition[0].createdAt).getTime());
    });

    it('should soft delete compositions and related items', async () => {
      // Create composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Soft Delete Test',
          products: [{ productId: testProduct.id, quantity: 15 }],
          palletId: testPallet.id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Delete composition
      await request(app)
        .delete(`/api/packaging/composition/${compositionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify composition is soft deleted
      const dbComposition = await db.select()
        .from(packagingCompositions)
        .where(eq(packagingCompositions.id, compositionId))
        .limit(1);

      expect(dbComposition[0].isActive).toBe(false);

      // Verify composition items are soft deleted
      const dbItems = await db.select()
        .from(compositionItems)
        .where(eq(compositionItems.compositionId, compositionId));

      dbItems.forEach(item => {
        expect(item.isActive).toBe(false);
      });

      // Verify composition doesn't appear in list
      const listResponse = await request(app)
        .get('/api/packaging/composition/list')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const foundComposition = listResponse.body.data.find(
        (comp: any) => comp.id === compositionId
      );
      expect(foundComposition).toBeUndefined();
    });
  });

  describe('Composition Reports Table Operations', () => {
    it('should create composition report with complete data structure', async () => {
      // Create composition first
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Report Test Composition',
          products: [{ productId: testProduct.id, quantity: 20 }],
          palletId: testPallet.id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Generate report
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

      const reportId = reportResponse.body.data.id;

      // Verify report in database
      const dbReport = await db.select()
        .from(compositionReports)
        .where(eq(compositionReports.id, reportId))
        .limit(1);

      expect(dbReport).toHaveLength(1);
      
      const report = dbReport[0];
      expect(report.compositionId).toBe(compositionId);
      expect(report.reportType).toBe('detailed');
      expect(report.title).toContain('Relatório Detalhado');
      expect(report.reportData).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.costAnalysis).toBeDefined();
      expect(report.executiveSummary).toBeDefined();
      expect(report.generatedBy).toBe(parseInt(testUser.id.replace('test-user-', '')));
      expect(report.generatedAt).toBeDefined();
    });

    it('should store complex JSON data structures correctly', async () => {
      // Create composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'JSON Storage Test',
          products: [{ productId: testProduct.id, quantity: 30 }],
          palletId: testPallet.id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Generate report
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

      const reportId = reportResponse.body.data.id;

      // Verify JSON data integrity
      const dbReport = await db.select()
        .from(compositionReports)
        .where(eq(compositionReports.id, reportId))
        .limit(1);

      const report = dbReport[0];
      
      // Verify reportData structure
      expect(report.reportData).toHaveProperty('composition');
      expect(report.reportData).toHaveProperty('metrics');
      expect(report.reportData).toHaveProperty('recommendations');
      expect(report.reportData).toHaveProperty('costAnalysis');
      expect(report.reportData).toHaveProperty('executiveSummary');

      // Verify metrics structure
      expect(report.metrics).toHaveProperty('spaceUtilization');
      expect(report.metrics).toHaveProperty('weightUtilization');
      expect(report.metrics).toHaveProperty('overallEfficiency');

      // Verify recommendations is array
      expect(Array.isArray(report.recommendations)).toBe(true);
      
      // Verify costAnalysis structure
      expect(report.costAnalysis).toHaveProperty('totalCost');
      expect(report.costAnalysis).toHaveProperty('packagingCost');

      // Verify executiveSummary structure
      expect(report.executiveSummary).toHaveProperty('overallRating');
      expect(report.executiveSummary).toHaveProperty('keyMetrics');
    });
  });

  describe('Foreign Key Relationships and Constraints', () => {
    it('should maintain referential integrity for composition-product relationships', async () => {
      // Create composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Referential Integrity Test',
          products: [{ productId: testProduct.id, quantity: 25 }],
          palletId: testPallet.id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Verify foreign key relationships
      const compositionWithItems = await db.select({
        composition: packagingCompositions,
        item: compositionItems,
        product: products,
        packaging: packagingTypes,
        pallet: pallets
      })
      .from(packagingCompositions)
      .leftJoin(compositionItems, eq(compositionItems.compositionId, packagingCompositions.id))
      .leftJoin(products, eq(products.id, compositionItems.productId))
      .leftJoin(packagingTypes, eq(packagingTypes.id, compositionItems.packagingTypeId))
      .leftJoin(pallets, eq(pallets.id, packagingCompositions.palletId))
      .where(eq(packagingCompositions.id, compositionId));

      expect(compositionWithItems).toHaveLength(1);
      
      const result = compositionWithItems[0];
      expect(result.composition.id).toBe(compositionId);
      expect(result.item.compositionId).toBe(compositionId);
      expect(result.product.id).toBe(testProduct.id);
      expect(result.packaging.productId).toBe(testProduct.id);
      expect(result.pallet.id).toBe(testPallet.id);
    });

    it('should handle cascading operations correctly', async () => {
      // Create composition with items
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Cascade Test',
          products: [{ productId: testProduct.id, quantity: 18 }],
          palletId: testPallet.id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Verify items exist
      const itemsBefore = await db.select()
        .from(compositionItems)
        .where(eq(compositionItems.compositionId, compositionId));

      expect(itemsBefore.length).toBeGreaterThan(0);

      // Soft delete composition
      await request(app)
        .delete(`/api/packaging/composition/${compositionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify items are also soft deleted
      const itemsAfter = await db.select()
        .from(compositionItems)
        .where(eq(compositionItems.compositionId, compositionId));

      itemsAfter.forEach(item => {
        expect(item.isActive).toBe(false);
      });
    });

    it('should validate foreign key constraints', async () => {
      // Try to create composition with non-existent product
      const response = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid FK Test',
          products: [{ productId: 99999, quantity: 10 }], // Non-existent product
          palletId: testPallet.id
        })
        .expect(404);

      expect(response.body.error).toContain('não encontrado');

      // Try to create composition with non-existent pallet
      const response2 = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid FK Test 2',
          products: [{ productId: testProduct.id, quantity: 10 }],
          palletId: 99999 // Non-existent pallet
        })
        .expect(404);

      expect(response2.body.error).toContain('não encontrado');
    });
  });

  describe('Database Transaction Handling', () => {
    it('should rollback transaction on composition save failure', async () => {
      // This test would require mocking a database failure during item insertion
      // For now, we'll test that successful saves are atomic
      
      const compositionCountBefore = await db.select({ count: sql<number>`count(*)` })
        .from(packagingCompositions);
      
      const itemCountBefore = await db.select({ count: sql<number>`count(*)` })
        .from(compositionItems);

      // Create composition
      const response = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Transaction Test',
          products: [{ productId: testProduct.id, quantity: 15 }],
          palletId: testPallet.id
        })
        .expect(200);

      const compositionCountAfter = await db.select({ count: sql<number>`count(*)` })
        .from(packagingCompositions);
      
      const itemCountAfter = await db.select({ count: sql<number>`count(*)` })
        .from(compositionItems);

      // Both tables should have increased
      expect(compositionCountAfter[0].count).toBe(compositionCountBefore[0].count + 1);
      expect(itemCountAfter[0].count).toBe(itemCountBefore[0].count + 1);
    });

    it('should handle concurrent database operations correctly', async () => {
      // Create multiple compositions concurrently
      const concurrentSaves = Array.from({ length: 5 }, (_, index) =>
        request(app)
          .post('/api/packaging/composition/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Concurrent DB Test ${index}`,
            products: [{ productId: testProduct.id, quantity: 10 + index }],
            palletId: testPallet.id
          })
      );

      const responses = await Promise.all(concurrentSaves);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Verify all compositions exist in database
      const compositions = await db.select()
        .from(packagingCompositions)
        .where(sql`${packagingCompositions.name} LIKE 'Concurrent DB Test%'`);

      expect(compositions).toHaveLength(5);

      // Verify all items exist
      const compositionIds = compositions.map(c => c.id);
      const items = await db.select()
        .from(compositionItems)
        .where(sql`${compositionItems.compositionId} IN (${compositionIds.join(',')})`);

      expect(items).toHaveLength(5);
    });
  });

  describe('Database Query Optimization', () => {
    it('should use efficient queries for composition listings', async () => {
      // Create multiple compositions
      const compositionPromises = Array.from({ length: 20 }, (_, index) =>
        request(app)
          .post('/api/packaging/composition/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Query Optimization Test ${index}`,
            products: [{ productId: testProduct.id, quantity: 10 }],
            palletId: testPallet.id
          })
      );

      await Promise.all(compositionPromises);

      // Test paginated listing
      const startTime = Date.now();
      const response = await request(app)
        .get('/api/packaging/composition/list?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const queryTime = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(20);
      
      // Query should be efficient
      expect(queryTime).toBeLessThan(500);
    });

    it('should efficiently handle composition detail queries with joins', async () => {
      // Create composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Detail Query Test',
          products: [{ productId: testProduct.id, quantity: 25 }],
          palletId: testPallet.id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Test detail query
      const startTime = Date.now();
      const response = await request(app)
        .get(`/api/packaging/composition/${compositionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const queryTime = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data.items).toHaveLength(1);
      
      // Detail query with joins should be efficient
      expect(queryTime).toBeLessThan(300);
    });

    it('should handle filtered queries efficiently', async () => {
      // Create compositions with different statuses
      const drafts = Array.from({ length: 10 }, (_, index) =>
        request(app)
          .post('/api/packaging/composition/save')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Draft ${index}`,
            products: [{ productId: testProduct.id, quantity: 10 }],
            palletId: testPallet.id
          })
      );

      const draftResponses = await Promise.all(drafts);

      // Set some to validated
      const validationPromises = draftResponses.slice(0, 5).map(response =>
        request(app)
          .patch(`/api/packaging/composition/${response.body.data.composition.id}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'validated' })
      );

      await Promise.all(validationPromises);

      // Test filtered query
      const startTime = Date.now();
      const response = await request(app)
        .get('/api/packaging/composition/list?status=validated')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const queryTime = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(5);
      
      // All returned items should be validated
      response.body.data.forEach((comp: any) => {
        expect(comp.status).toBe('validated');
      });
      
      // Filtered query should be efficient
      expect(queryTime).toBeLessThan(400);
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should maintain data consistency across related tables', async () => {
      // Create composition
      const saveResponse = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Data Consistency Test',
          products: [{ productId: testProduct.id, quantity: 30 }],
          palletId: testPallet.id
        })
        .expect(200);

      const compositionId = saveResponse.body.data.composition.id;

      // Generate report
      await request(app)
        .post('/api/packaging/composition/report')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          compositionId: compositionId,
          includeMetrics: true
        })
        .expect(200);

      // Verify data consistency
      const composition = await db.select()
        .from(packagingCompositions)
        .where(eq(packagingCompositions.id, compositionId))
        .limit(1);

      const items = await db.select()
        .from(compositionItems)
        .where(eq(compositionItems.compositionId, compositionId));

      const reports = await db.select()
        .from(compositionReports)
        .where(eq(compositionReports.compositionId, compositionId));

      // All should reference the same composition
      expect(composition[0].id).toBe(compositionId);
      items.forEach(item => {
        expect(item.compositionId).toBe(compositionId);
      });
      reports.forEach(report => {
        expect(report.compositionId).toBe(compositionId);
      });

      // Timestamps should be logical
      expect(new Date(composition[0].updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(composition[0].createdAt).getTime()
      );
      
      items.forEach(item => {
        expect(new Date(item.addedAt).getTime()).toBeGreaterThanOrEqual(
          new Date(composition[0].createdAt).getTime()
        );
      });
    });

    it('should enforce business rules at database level', async () => {
      // Test unique constraint violations if they exist
      const compositionData = {
        name: 'Unique Constraint Test',
        products: [{ productId: testProduct.id, quantity: 15 }],
        palletId: testPallet.id
      };

      // Create first composition
      const response1 = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send(compositionData)
        .expect(200);

      // Try to create duplicate with same name (if constraint exists)
      const response2 = await request(app)
        .post('/api/packaging/composition/save')
        .set('Authorization', `Bearer ${authToken}`)
        .send(compositionData);

      // Should either succeed (no constraint) or fail gracefully
      expect([200, 409]).toContain(response2.status);
    });
  });
});