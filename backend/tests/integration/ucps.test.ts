import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Express } from 'express';
import { testAppFactory } from '../helpers/test-app-factory';
import { TestDataFactory } from '../helpers/test-data-factory';
import { ApiTestHelper } from '../helpers/api-test-helper';

describe('UCPs API Integration Tests', () => {
  let app: Express;
  let apiHelper: ApiTestHelper;
  let adminUser: any;
  let operatorUser: any;
  let adminToken: string;
  let operatorToken: string;
  let testPallets: any[];
  let testProducts: any[];
  let testUCPs: any[];

  beforeAll(async () => {
    app = await testAppFactory.createApp();
    apiHelper = new ApiTestHelper(app);
  });

  afterAll(async () => {
    await testAppFactory.cleanup();
  });

  beforeEach(async () => {
    TestDataFactory.resetCounters();
    await global.testHelpers.db.clearAllTables();

    // Create test users
    adminUser = TestDataFactory.createUser({ role: 'admin' });
    operatorUser = TestDataFactory.createUser({ role: 'operator' });

    // Create test products and pallets
    testProducts = TestDataFactory.createProducts(5);
    testPallets = TestDataFactory.createPallets(3);
    
    const db = global.testHelpers.db.getDb();
    await db.insert(require('../../src/db/schema').users).values([adminUser, operatorUser]);
    await db.insert(require('../../src/db/schema').products).values(testProducts);
    await db.insert(require('../../src/db/schema').pallets).values(testPallets);

    // Create test UCPs
    testUCPs = testPallets.map(pallet =>
      TestDataFactory.createUCP(pallet.id, operatorUser.id, {
        status: ['created', 'in_progress', 'completed'][Math.floor(Math.random() * 3)] as any
      })
    );
    await db.insert(require('../../src/db/schema').ucps).values(testUCPs);

    adminToken = 'mock-admin-token';
    operatorToken = 'mock-operator-token';
  });

  describe('GET /api/ucps', () => {
    it('should return list of UCPs for authenticated users', async () => {
      const response = await apiHelper.get('/api/ucps', operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body).toHaveProperty('ucps');
      expect(Array.isArray(response.body.ucps)).toBe(true);
      expect(response.body.ucps.length).toBe(3);

      const ucp = response.body.ucps[0];
      expect(ucp).toHaveProperty('id');
      expect(ucp).toHaveProperty('code');
      expect(ucp).toHaveProperty('palletId');
      expect(ucp).toHaveProperty('status');
      expect(ucp).toHaveProperty('totalWeight');
      expect(ucp).toHaveProperty('totalItems');
      expect(ucp).toHaveProperty('createdBy');
    });

    it('should support filtering by status', async () => {
      const response = await apiHelper.get('/api/ucps?status=in_progress', operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.ucps.forEach((ucp: any) => {
        expect(ucp.status).toBe('in_progress');
      });
    });

    it('should support filtering by created user', async () => {
      const response = await apiHelper.get(`/api/ucps?createdBy=${operatorUser.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.ucps.forEach((ucp: any) => {
        expect(ucp.createdBy).toBe(operatorUser.id);
      });
    });

    it('should support filtering by pallet', async () => {
      const pallet = testPallets[0];
      const response = await apiHelper.get(`/api/ucps?palletId=${pallet.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.ucps.forEach((ucp: any) => {
        expect(ucp.palletId).toBe(pallet.id);
      });
    });

    it('should include pallet information in response', async () => {
      const response = await apiHelper.get('/api/ucps?include=pallet', operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.ucps.forEach((ucp: any) => {
        expect(ucp).toHaveProperty('pallet');
        expect(ucp.pallet).toHaveProperty('code');
        expect(ucp.pallet).toHaveProperty('type');
      });
    });

    it('should support pagination and sorting', async () => {
      // Create additional UCPs
      const additionalUCPs = Array.from({ length: 10 }, () =>
        TestDataFactory.createUCP(testPallets[0].id, operatorUser.id)
      );
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').ucps).values(additionalUCPs);

      const response = await apiHelper.get('/api/ucps?page=1&limit=5&sort=createdAt&order=desc', operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.ucps.length).toBeLessThanOrEqual(5);
      expect(response.body).toHaveProperty('pagination');
      
      // Verify sorting
      const ucps = response.body.ucps;
      for (let i = 1; i < ucps.length; i++) {
        const current = new Date(ucps[i].createdAt);
        const previous = new Date(ucps[i - 1].createdAt);
        expect(current.getTime()).toBeLessThanOrEqual(previous.getTime());
      }
    });
  });

  describe('GET /api/ucps/:id', () => {
    it('should return specific UCP with full details', async () => {
      const ucp = testUCPs[0];
      const response = await apiHelper.get(`/api/ucps/${ucp.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.id).toBe(ucp.id);
      expect(response.body.code).toBe(ucp.code);
      expect(response.body.status).toBe(ucp.status);
      expect(response.body).toHaveProperty('pallet');
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('createdByUser');
    });

    it('should include UCP items with product details', async () => {
      const ucp = testUCPs[0];
      
      // Create UCP items
      const ucpItems = [
        {
          id: 'test-item-1',
          ucpId: ucp.id,
          productId: testProducts[0].id,
          quantity: 5,
          position: { x: 0, y: 0, z: 0, layer: 1 },
          weight: 2.5
        },
        {
          id: 'test-item-2',
          ucpId: ucp.id,
          productId: testProducts[1].id,
          quantity: 3,
          position: { x: 20, y: 0, z: 0, layer: 1 },
          weight: 1.5
        }
      ];

      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').ucpItems).values(ucpItems);

      const response = await apiHelper.get(`/api/ucps/${ucp.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.items).toHaveLength(2);
      
      const item = response.body.items[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('quantity');
      expect(item).toHaveProperty('position');
      expect(item).toHaveProperty('product');
      expect(item.product).toHaveProperty('code');
      expect(item.product).toHaveProperty('name');
    });

    it('should calculate accurate weight and volume utilization', async () => {
      const ucp = testUCPs[0];
      const response = await apiHelper.get(`/api/ucps/${ucp.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body).toHaveProperty('utilization');
      expect(response.body.utilization).toHaveProperty('weightPercentage');
      expect(response.body.utilization).toHaveProperty('volumePercentage');
      expect(response.body.utilization).toHaveProperty('itemCount');
      expect(typeof response.body.utilization.weightPercentage).toBe('number');
      expect(response.body.utilization.weightPercentage).toBeGreaterThanOrEqual(0);
      expect(response.body.utilization.weightPercentage).toBeLessThanOrEqual(100);
    });

    it('should return 404 for non-existent UCP', async () => {
      const response = await apiHelper.get('/api/ucps/non-existent-id', operatorToken);
      apiHelper.expectError(response, 404);
    });
  });

  describe('POST /api/ucps', () => {
    const newUCPData = {
      code: 'NEWUCP001',
      palletId: '', // Will be set in test
      notes: 'Test UCP creation'
    };

    beforeEach(() => {
      newUCPData.palletId = testPallets[0].id;
    });

    it('should create new UCP with valid data', async () => {
      const response = await apiHelper.post('/api/ucps', newUCPData, operatorToken);

      apiHelper.expectSuccess(response, 201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.code).toBe(newUCPData.code);
      expect(response.body.palletId).toBe(newUCPData.palletId);
      expect(response.body.status).toBe('created');
      expect(response.body.totalWeight).toBe(0);
      expect(response.body.totalItems).toBe(0);
      expect(response.body.createdBy).toBe(operatorUser.id);

      // Verify in database
      const db = global.testHelpers.db.getDb();
      const createdUCP = await db.query.ucps.findFirst({
        where: (ucps, { eq }) => eq(ucps.id, response.body.id)
      });
      expect(createdUCP).toBeDefined();
    });

    it('should validate required fields', async () => {
      const requiredFields = ['code', 'palletId'];

      for (const field of requiredFields) {
        const invalidData = { ...newUCPData };
        delete invalidData[field as keyof typeof invalidData];

        const response = await apiHelper.post('/api/ucps', invalidData, operatorToken);
        apiHelper.expectValidationError(response);
      }
    });

    it('should reject duplicate UCP codes', async () => {
      const duplicateData = {
        ...newUCPData,
        code: testUCPs[0].code
      };

      const response = await apiHelper.post('/api/ucps', duplicateData, operatorToken);
      apiHelper.expectError(response, 409);
    });

    it('should validate pallet exists and is active', async () => {
      const invalidData = {
        ...newUCPData,
        palletId: 'non-existent-pallet'
      };

      const response = await apiHelper.post('/api/ucps', invalidData, operatorToken);
      apiHelper.expectError(response, 400);
      expect(response.body.message).toContain('pallet');
    });

    it('should automatically assign creator from authenticated user', async () => {
      const response = await apiHelper.post('/api/ucps', newUCPData, operatorToken);

      apiHelper.expectSuccess(response, 201);
      expect(response.body.createdBy).toBe(operatorUser.id);
    });

    it('should deny access for unauthenticated requests', async () => {
      const response = await apiHelper.post('/api/ucps', newUCPData);
      apiHelper.expectError(response, 401);
    });
  });

  describe('PUT /api/ucps/:id', () => {
    const updateData = {
      notes: 'Updated UCP notes',
      priority: 'high'
    };

    it('should update UCP with valid data', async () => {
      const ucp = testUCPs[0];
      const response = await apiHelper.put(`/api/ucps/${ucp.id}`, updateData, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.notes).toBe(updateData.notes);

      // Verify in database
      const db = global.testHelpers.db.getDb();
      const updatedUCP = await db.query.ucps.findFirst({
        where: (ucps, { eq }) => eq(ucps.id, ucp.id)
      });
      expect(updatedUCP?.notes).toBe(updateData.notes);
    });

    it('should not allow updating code or palletId', async () => {
      const ucp = testUCPs[0];
      const invalidUpdate = {
        ...updateData,
        code: 'NEWCODE',
        palletId: testPallets[1].id
      };

      const response = await apiHelper.put(`/api/ucps/${ucp.id}`, invalidUpdate, operatorToken);

      if (response.status === 200) {
        expect(response.body.code).toBe(ucp.code);
        expect(response.body.palletId).toBe(ucp.palletId);
      } else {
        apiHelper.expectValidationError(response);
      }
    });

    it('should only allow creator or admin to update', async () => {
      // Create UCP by admin
      const adminUCP = TestDataFactory.createUCP(testPallets[0].id, adminUser.id);
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').ucps).values([adminUCP]);

      // Operator should not be able to update admin's UCP
      const response = await apiHelper.put(`/api/ucps/${adminUCP.id}`, updateData, operatorToken);
      apiHelper.expectError(response, 403);
    });
  });

  describe('PUT /api/ucps/:id/status', () => {
    it('should update UCP status through workflow', async () => {
      const ucp = testUCPs.find(u => u.status === 'created');
      const statusUpdate = { status: 'in_progress' };

      const response = await apiHelper.put(`/api/ucps/${ucp.id}/status`, statusUpdate, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.status).toBe('in_progress');

      // Verify status change in database
      const db = global.testHelpers.db.getDb();
      const updatedUCP = await db.query.ucps.findFirst({
        where: (ucps, { eq }) => eq(ucps.id, ucp.id)
      });
      expect(updatedUCP?.status).toBe('in_progress');
    });

    it('should validate status transitions', async () => {
      const completedUCP = testUCPs.find(u => u.status === 'completed');
      const invalidTransition = { status: 'created' };

      const response = await apiHelper.put(`/api/ucps/${completedUCP.id}/status`, invalidTransition, operatorToken);
      
      apiHelper.expectError(response, 400);
      expect(response.body.message).toContain('transition');
    });

    it('should require admin role for certain status changes', async () => {
      const ucp = testUCPs.find(u => u.status === 'in_progress');
      const adminOnlyStatus = { status: 'cancelled' };

      const operatorResponse = await apiHelper.put(`/api/ucps/${ucp.id}/status`, adminOnlyStatus, operatorToken);
      apiHelper.expectError(operatorResponse, 403);

      const adminResponse = await apiHelper.put(`/api/ucps/${ucp.id}/status`, adminOnlyStatus, adminToken);
      apiHelper.expectSuccess(adminResponse, 200);
    });
  });

  describe('DELETE /api/ucps/:id', () => {
    it('should soft delete UCP for admin users', async () => {
      const ucp = testUCPs[0];
      const response = await apiHelper.delete(`/api/ucps/${ucp.id}`, adminToken);

      apiHelper.expectSuccess(response, 200);

      // Verify soft delete
      const db = global.testHelpers.db.getDb();
      const deletedUCP = await db.query.ucps.findFirst({
        where: (ucps, { eq }) => eq(ucps.id, ucp.id)
      });
      expect(deletedUCP?.status).toBe('cancelled');
    });

    it('should deny access for non-admin users', async () => {
      const ucp = testUCPs[0];
      const response = await apiHelper.delete(`/api/ucps/${ucp.id}`, operatorToken);
      apiHelper.expectError(response, 403);
    });

    it('should prevent deletion of UCPs with active transfers', async () => {
      const ucp = testUCPs[0];
      
      // Create active transfer request
      const transferRequest = TestDataFactory.createTransferRequest(ucp.id, operatorUser.id, {
        status: 'approved'
      });
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').transferRequests).values([transferRequest]);

      const response = await apiHelper.delete(`/api/ucps/${ucp.id}`, adminToken);

      apiHelper.expectError(response, 400);
      expect(response.body.message).toContain('transfer');
    });
  });

  describe('UCP Items Management', () => {
    describe('POST /api/ucps/:id/items', () => {
      const newItemData = {
        productId: '', // Will be set in test
        quantity: 5,
        position: { x: 0, y: 0, z: 0, layer: 1 }
      };

      beforeEach(() => {
        newItemData.productId = testProducts[0].id;
      });

      it('should add item to UCP', async () => {
        const ucp = testUCPs.find(u => u.status === 'in_progress');
        const response = await apiHelper.post(`/api/ucps/${ucp.id}/items`, newItemData, operatorToken);

        apiHelper.expectSuccess(response, 201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.productId).toBe(newItemData.productId);
        expect(response.body.quantity).toBe(newItemData.quantity);
        expect(response.body.ucpId).toBe(ucp.id);
      });

      it('should update UCP totals when adding items', async () => {
        const ucp = testUCPs.find(u => u.status === 'in_progress');
        
        // Get UCP before adding item
        const beforeResponse = await apiHelper.get(`/api/ucps/${ucp.id}`, operatorToken);
        const beforeWeight = beforeResponse.body.totalWeight;
        const beforeItems = beforeResponse.body.totalItems;

        // Add item
        await apiHelper.post(`/api/ucps/${ucp.id}/items`, newItemData, operatorToken);

        // Check UCP after adding item
        const afterResponse = await apiHelper.get(`/api/ucps/${ucp.id}`, operatorToken);
        
        expect(afterResponse.body.totalItems).toBe(beforeItems + newItemData.quantity);
        expect(afterResponse.body.totalWeight).toBeGreaterThan(beforeWeight);
      });

      it('should validate weight limits', async () => {
        const ucp = testUCPs[0];
        const heavyItemData = {
          ...newItemData,
          quantity: 1000 // Very heavy item
        };

        const response = await apiHelper.post(`/api/ucps/${ucp.id}/items`, heavyItemData, operatorToken);
        
        apiHelper.expectError(response, 400);
        expect(response.body.message).toContain('weight');
      });

      it('should validate position conflicts', async () => {
        const ucp = testUCPs.find(u => u.status === 'in_progress');
        
        // Add first item
        await apiHelper.post(`/api/ucps/${ucp.id}/items`, newItemData, operatorToken);

        // Try to add second item at same position
        const conflictingItemData = {
          ...newItemData,
          productId: testProducts[1].id,
          position: newItemData.position // Same position
        };

        const response = await apiHelper.post(`/api/ucps/${ucp.id}/items`, conflictingItemData, operatorToken);
        
        apiHelper.expectError(response, 400);
        expect(response.body.message).toContain('position');
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle complex UCP queries efficiently', async () => {
      // Create complex scenario with many UCPs and items
      const complexScenario = TestDataFactory.createCompleteScenario();
      const db = global.testHelpers.db.getDb();
      
      await db.insert(require('../../src/db/schema').pallets).values(complexScenario.pallets);
      await db.insert(require('../../src/db/schema').ucps).values(complexScenario.ucps);

      const startTime = Date.now();
      const response = await apiHelper.get('/api/ucps?include=pallet,items,creator', operatorToken);
      const endTime = Date.now();

      const queryTime = endTime - startTime;
      expect(queryTime).toBeLessThan(1500); // Should respond within 1.5 seconds

      apiHelper.expectSuccess(response, 200);
    });
  });
});