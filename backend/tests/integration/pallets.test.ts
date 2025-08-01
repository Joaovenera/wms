import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { testAppFactory } from '../helpers/test-app-factory';
import { TestDataFactory } from '../helpers/test-data-factory';
import { ApiTestHelper } from '../helpers/api-test-helper';

describe('Pallets API Integration Tests', () => {
  let app: Express;
  let apiHelper: ApiTestHelper;
  let adminUser: any;
  let operatorUser: any;
  let adminToken: string;
  let operatorToken: string;
  let testPallets: any[];

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

    const db = global.testHelpers.db.getDb();
    await db.insert(require('../../src/db/schema').users).values([adminUser, operatorUser]);

    // Create test pallets
    testPallets = TestDataFactory.createPallets(3);
    await db.insert(require('../../src/db/schema').pallets).values(testPallets);

    adminToken = 'mock-admin-token';
    operatorToken = 'mock-operator-token';
  });

  describe('GET /api/pallets', () => {
    it('should return list of pallets for authenticated users', async () => {
      const response = await apiHelper.get('/api/pallets', operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body).toHaveProperty('pallets');
      expect(Array.isArray(response.body.pallets)).toBe(true);
      expect(response.body.pallets.length).toBe(3);

      const pallet = response.body.pallets[0];
      expect(pallet).toHaveProperty('id');
      expect(pallet).toHaveProperty('code');
      expect(pallet).toHaveProperty('type');
      expect(pallet).toHaveProperty('dimensions');
      expect(pallet).toHaveProperty('maxWeight');
      expect(pallet).toHaveProperty('maxHeight');
    });

    it('should support filtering by pallet type', async () => {
      const response = await apiHelper.get('/api/pallets?type=standard', operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.pallets.forEach((pallet: any) => {
        expect(pallet.type).toBe('standard');
      });
    });

    it('should support filtering by active status', async () => {
      // Create inactive pallet
      const inactivePallet = TestDataFactory.createPallet({ isActive: false });
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').pallets).values([inactivePallet]);

      const response = await apiHelper.get('/api/pallets?active=false', operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.pallets.forEach((pallet: any) => {
        expect(pallet.isActive).toBe(false);
      });
    });

    it('should support pagination', async () => {
      // Create additional pallets
      const additionalPallets = TestDataFactory.createPallets(10);
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').pallets).values(additionalPallets);

      const response = await apiHelper.get('/api/pallets?page=1&limit=5', operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.pallets.length).toBeLessThanOrEqual(5);
      expect(response.body).toHaveProperty('pagination');
    });

    it('should deny access for unauthenticated requests', async () => {
      const response = await apiHelper.get('/api/pallets');
      apiHelper.expectError(response, 401);
    });
  });

  describe('GET /api/pallets/:id', () => {
    it('should return specific pallet by ID', async () => {
      const pallet = testPallets[0];
      const response = await apiHelper.get(`/api/pallets/${pallet.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.id).toBe(pallet.id);
      expect(response.body.code).toBe(pallet.code);
      expect(response.body.type).toBe(pallet.type);
    });

    it('should return 404 for non-existent pallet', async () => {
      const response = await apiHelper.get('/api/pallets/non-existent-id', operatorToken);
      apiHelper.expectError(response, 404);
    });

    it('should include utilization statistics', async () => {
      const pallet = testPallets[0];
      const response = await apiHelper.get(`/api/pallets/${pallet.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body).toHaveProperty('utilization');
      expect(response.body.utilization).toHaveProperty('currentWeight');
      expect(response.body.utilization).toHaveProperty('weightPercentage');
      expect(response.body.utilization).toHaveProperty('activeUCPs');
    });
  });

  describe('POST /api/pallets', () => {
    const newPalletData = {
      code: 'NEWPAL001',
      type: 'custom',
      dimensions: { width: 150, height: 120 },
      maxWeight: 1500,
      maxHeight: 250
    };

    it('should create new pallet with valid data for admin users', async () => {
      const response = await apiHelper.post('/api/pallets', newPalletData, adminToken);

      apiHelper.expectSuccess(response, 201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.code).toBe(newPalletData.code);
      expect(response.body.type).toBe(newPalletData.type);
      expect(response.body.maxWeight).toBe(newPalletData.maxWeight);

      // Verify in database
      const db = global.testHelpers.db.getDb();
      const createdPallet = await db.query.pallets.findFirst({
        where: (pallets, { eq }) => eq(pallets.id, response.body.id)
      });
      expect(createdPallet).toBeDefined();
    });

    it('should deny access for non-admin users', async () => {
      const response = await apiHelper.post('/api/pallets', newPalletData, operatorToken);
      apiHelper.expectError(response, 403);
    });

    it('should validate required fields', async () => {
      const requiredFields = ['code', 'type', 'dimensions', 'maxWeight', 'maxHeight'];

      for (const field of requiredFields) {
        const invalidData = { ...newPalletData };
        delete invalidData[field as keyof typeof invalidData];

        const response = await apiHelper.post('/api/pallets', invalidData, adminToken);
        apiHelper.expectValidationError(response);
      }
    });

    it('should reject duplicate pallet codes', async () => {
      const duplicateData = {
        ...newPalletData,
        code: testPallets[0].code
      };

      const response = await apiHelper.post('/api/pallets', duplicateData, adminToken);
      apiHelper.expectError(response, 409);
    });

    it('should validate pallet type values', async () => {
      const invalidTypes = ['invalid', 'large', 'small'];

      for (const invalidType of invalidTypes) {
        const invalidData = { ...newPalletData, type: invalidType };
        const response = await apiHelper.post('/api/pallets', invalidData, adminToken);
        apiHelper.expectValidationError(response, 'type');
      }
    });

    it('should validate dimensions are positive numbers', async () => {
      const invalidDimensions = [
        { width: 0, height: 100 },
        { width: -10, height: 100 },
        { width: 100, height: 0 },
        { width: 100, height: -20 }
      ];

      for (const invalidDim of invalidDimensions) {
        const invalidData = { ...newPalletData, dimensions: invalidDim };
        const response = await apiHelper.post('/api/pallets', invalidData, adminToken);
        apiHelper.expectValidationError(response, 'dimensions');
      }
    });

    it('should validate weight and height are positive', async () => {
      const invalidWeights = [0, -100, -1];
      const invalidHeights = [0, -50, -1];

      for (const weight of invalidWeights) {
        const invalidData = { ...newPalletData, maxWeight: weight };
        const response = await apiHelper.post('/api/pallets', invalidData, adminToken);
        apiHelper.expectValidationError(response, 'maxWeight');
      }

      for (const height of invalidHeights) {
        const invalidData = { ...newPalletData, maxHeight: height };
        const response = await apiHelper.post('/api/pallets', invalidData, adminToken);
        apiHelper.expectValidationError(response, 'maxHeight');
      }
    });
  });

  describe('PUT /api/pallets/:id', () => {
    const updateData = {
      maxWeight: 1200,
      maxHeight: 220,
      dimensions: { width: 130, height: 110 }
    };

    it('should update pallet with valid data for admin users', async () => {
      const pallet = testPallets[0];
      const response = await apiHelper.put(`/api/pallets/${pallet.id}`, updateData, adminToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.maxWeight).toBe(updateData.maxWeight);
      expect(response.body.maxHeight).toBe(updateData.maxHeight);

      // Verify in database
      const db = global.testHelpers.db.getDb();
      const updatedPallet = await db.query.pallets.findFirst({
        where: (pallets, { eq }) => eq(pallets.id, pallet.id)
      });
      expect(updatedPallet?.maxWeight).toBe(updateData.maxWeight);
    });

    it('should deny access for non-admin users', async () => {
      const pallet = testPallets[0];
      const response = await apiHelper.put(`/api/pallets/${pallet.id}`, updateData, operatorToken);
      apiHelper.expectError(response, 403);
    });

    it('should return 404 for non-existent pallet', async () => {
      const response = await apiHelper.put('/api/pallets/non-existent-id', updateData, adminToken);
      apiHelper.expectError(response, 404);
    });

    it('should not allow updating code or type', async () => {
      const pallet = testPallets[0];
      const invalidUpdate = {
        ...updateData,
        code: 'NEWCODE',
        type: 'euro'
      };

      const response = await apiHelper.put(`/api/pallets/${pallet.id}`, invalidUpdate, adminToken);

      if (response.status === 200) {
        // Should ignore code and type changes
        expect(response.body.code).toBe(pallet.code);
        expect(response.body.type).toBe(pallet.type);
      } else {
        // Or return validation error
        apiHelper.expectValidationError(response);
      }
    });

    it('should prevent updates that would violate existing UCPs', async () => {
      const pallet = testPallets[0];
      
      // Create UCP that uses this pallet
      const testUcp = TestDataFactory.createUCP(pallet.id, operatorUser.id, {
        totalWeight: 800 // Heavy UCP
      });
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').ucps).values([testUcp]);

      // Try to reduce max weight below UCP weight
      const invalidUpdate = { maxWeight: 500 };
      const response = await apiHelper.put(`/api/pallets/${pallet.id}`, invalidUpdate, adminToken);

      apiHelper.expectError(response, 400);
      expect(response.body.message).toContain('UCP');
    });
  });

  describe('DELETE /api/pallets/:id', () => {
    it('should soft delete pallet for admin users', async () => {
      const pallet = testPallets[0];
      const response = await apiHelper.delete(`/api/pallets/${pallet.id}`, adminToken);

      apiHelper.expectSuccess(response, 200);

      // Verify soft delete in database
      const db = global.testHelpers.db.getDb();
      const deletedPallet = await db.query.pallets.findFirst({
        where: (pallets, { eq }) => eq(pallets.id, pallet.id)
      });
      expect(deletedPallet?.isActive).toBe(false);
    });

    it('should deny access for non-admin users', async () => {
      const pallet = testPallets[0];
      const response = await apiHelper.delete(`/api/pallets/${pallet.id}`, operatorToken);
      apiHelper.expectError(response, 403);
    });

    it('should return 404 for non-existent pallet', async () => {
      const response = await apiHelper.delete('/api/pallets/non-existent-id', adminToken);
      apiHelper.expectError(response, 404);
    });

    it('should prevent deletion of pallets with active UCPs', async () => {
      const pallet = testPallets[0];
      
      // Create active UCP
      const testUcp = TestDataFactory.createUCP(pallet.id, operatorUser.id, {
        status: 'in_progress'
      });
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').ucps).values([testUcp]);

      const response = await apiHelper.delete(`/api/pallets/${pallet.id}`, adminToken);

      apiHelper.expectError(response, 400);
      expect(response.body.message).toContain('active UCP');
    });
  });

  describe('Performance and Load Tests', () => {
    it('should handle concurrent pallet operations efficiently', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        apiHelper.get(`/api/pallets/${testPallets[i % testPallets.length].id}`, operatorToken)
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle large datasets efficiently', async () => {
      // Create large dataset
      const largePalletSet = TestDataFactory.createPallets(100);
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').pallets).values(largePalletSet);

      const startTime = Date.now();
      const response = await apiHelper.get('/api/pallets', operatorToken);
      const endTime = Date.now();

      const queryTime = endTime - startTime;
      expect(queryTime).toBeLessThan(1000); // Should respond within 1 second

      apiHelper.expectSuccess(response, 200);
      expect(response.body.pallets.length).toBeGreaterThan(50);
    });
  });
});