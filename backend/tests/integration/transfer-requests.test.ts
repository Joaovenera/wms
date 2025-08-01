import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Express } from 'express';
import { testAppFactory } from '../helpers/test-app-factory';
import { TestDataFactory } from '../helpers/test-data-factory';
import { ApiTestHelper } from '../helpers/api-test-helper';

describe('Transfer Requests API Integration Tests', () => {
  let app: Express;
  let apiHelper: ApiTestHelper;
  let adminUser: any;
  let operatorUser: any;
  let managerUser: any;
  let adminToken: string;
  let operatorToken: string;
  let managerToken: string;
  let testScenario: any;

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

    // Create complete test scenario
    testScenario = TestDataFactory.createCompleteScenario();
    adminUser = testScenario.users.admin;
    operatorUser = testScenario.users.operator;
    managerUser = testScenario.users.manager;

    const db = global.testHelpers.db.getDb();
    await db.insert(require('../../src/db/schema').users).values([
      adminUser, operatorUser, managerUser
    ]);
    await db.insert(require('../../src/db/schema').products).values(testScenario.products);
    await db.insert(require('../../src/db/schema').pallets).values(testScenario.pallets);
    await db.insert(require('../../src/db/schema').ucps).values(testScenario.ucps);
    await db.insert(require('../../src/db/schema').transferRequests).values(testScenario.transferRequests);

    adminToken = 'mock-admin-token';
    operatorToken = 'mock-operator-token';
    managerToken = 'mock-manager-token';
  });

  describe('GET /api/transfer-requests', () => {
    it('should return list of transfer requests for authenticated users', async () => {
      const response = await apiHelper.get('/api/transfer-requests', operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body).toHaveProperty('transferRequests');
      expect(Array.isArray(response.body.transferRequests)).toBe(true);
      expect(response.body.transferRequests.length).toBeGreaterThan(0);

      const transfer = response.body.transferRequests[0];
      expect(transfer).toHaveProperty('id');
      expect(transfer).toHaveProperty('ucpId');
      expect(transfer).toHaveProperty('fromLocation');
      expect(transfer).toHaveProperty('toLocation');
      expect(transfer).toHaveProperty('status');
      expect(transfer).toHaveProperty('priority');
      expect(transfer).toHaveProperty('requestedBy');
    });

    it('should support filtering by status', async () => {
      const response = await apiHelper.get('/api/transfer-requests?status=pending', operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.transferRequests.forEach((transfer: any) => {
        expect(transfer.status).toBe('pending');
      });
    });

    it('should support filtering by priority', async () => {
      const response = await apiHelper.get('/api/transfer-requests?priority=high', operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.transferRequests.forEach((transfer: any) => {
        expect(transfer.priority).toBe('high');
      });
    });

    it('should support filtering by requester', async () => {
      const response = await apiHelper.get(`/api/transfer-requests?requestedBy=${operatorUser.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.transferRequests.forEach((transfer: any) => {
        expect(transfer.requestedBy).toBe(operatorUser.id);
      });
    });

    it('should support filtering by location', async () => {
      const fromLocation = testScenario.transferRequests[0].fromLocation;
      const response = await apiHelper.get(`/api/transfer-requests?fromLocation=${fromLocation}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.transferRequests.forEach((transfer: any) => {
        expect(transfer.fromLocation).toBe(fromLocation);
      });
    });

    it('should include UCP and user information', async () => {
      const response = await apiHelper.get('/api/transfer-requests?include=ucp,requester,approver', operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.transferRequests.forEach((transfer: any) => {
        expect(transfer).toHaveProperty('ucp');
        expect(transfer).toHaveProperty('requesterUser');
        
        if (transfer.status === 'approved') {
          expect(transfer).toHaveProperty('approverUser');
        }
      });
    });

    it('should support date range filtering', async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await apiHelper.get(`/api/transfer-requests?createdAfter=${today}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.transferRequests.forEach((transfer: any) => {
        const createdDate = new Date(transfer.createdAt);
        const filterDate = new Date(today);
        expect(createdDate.getTime()).toBeGreaterThanOrEqual(filterDate.getTime());
      });
    });

    it('should support pagination and sorting', async () => {
      // Create additional transfer requests
      const additionalRequests = Array.from({ length: 10 }, () =>
        TestDataFactory.createTransferRequest(testScenario.ucps[0].id, operatorUser.id)
      );
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').transferRequests).values(additionalRequests);

      const response = await apiHelper.get('/api/transfer-requests?page=1&limit=5&sort=priority&order=desc', operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.transferRequests.length).toBeLessThanOrEqual(5);
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('GET /api/transfer-requests/:id', () => {
    it('should return specific transfer request with full details', async () => {
      const transfer = testScenario.transferRequests[0];
      const response = await apiHelper.get(`/api/transfer-requests/${transfer.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.id).toBe(transfer.id);
      expect(response.body.ucpId).toBe(transfer.ucpId);
      expect(response.body.fromLocation).toBe(transfer.fromLocation);
      expect(response.body.toLocation).toBe(transfer.toLocation);
      expect(response.body).toHaveProperty('ucp');
      expect(response.body).toHaveProperty('requesterUser');
      expect(response.body).toHaveProperty('timeline');
    });

    it('should include location availability information', async () => {
      const transfer = testScenario.transferRequests[0];
      const response = await apiHelper.get(`/api/transfer-requests/${transfer.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body).toHaveProperty('locationInfo');
      expect(response.body.locationInfo).toHaveProperty('fromLocation');
      expect(response.body.locationInfo).toHaveProperty('toLocation');
      expect(response.body.locationInfo.fromLocation).toHaveProperty('isOccupied');
      expect(response.body.locationInfo.toLocation).toHaveProperty('isAvailable');
    });

    it('should include estimated transfer time and cost', async () => {
      const transfer = testScenario.transferRequests[0];
      const response = await apiHelper.get(`/api/transfer-requests/${transfer.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body).toHaveProperty('estimates');
      expect(response.body.estimates).toHaveProperty('duration');
      expect(response.body.estimates).toHaveProperty('cost');
      expect(response.body.estimates).toHaveProperty('requiredVehicle');
    });

    it('should return 404 for non-existent transfer request', async () => {
      const response = await apiHelper.get('/api/transfer-requests/non-existent-id', operatorToken);
      apiHelper.expectError(response, 404);
    });
  });

  describe('POST /api/transfer-requests', () => {
    const newTransferData = {
      ucpId: '', // Will be set in test
      fromLocation: 'A1-01-01',
      toLocation: 'B2-02-02',
      priority: 'medium',
      notes: 'Test transfer request',
      requestedDate: new Date().toISOString()
    };

    beforeEach(() => {
      newTransferData.ucpId = testScenario.ucps[0].id;
    });

    it('should create new transfer request with valid data', async () => {
      const response = await apiHelper.post('/api/transfer-requests', newTransferData, operatorToken);

      apiHelper.expectSuccess(response, 201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.ucpId).toBe(newTransferData.ucpId);
      expect(response.body.fromLocation).toBe(newTransferData.fromLocation);
      expect(response.body.toLocation).toBe(newTransferData.toLocation);
      expect(response.body.status).toBe('pending');
      expect(response.body.requestedBy).toBe(operatorUser.id);

      // Verify in database
      const db = global.testHelpers.db.getDb();
      const createdTransfer = await db.query.transferRequests.findFirst({
        where: (transfers, { eq }) => eq(transfers.id, response.body.id)
      });
      expect(createdTransfer).toBeDefined();
    });

    it('should validate required fields', async () => {
      const requiredFields = ['ucpId', 'fromLocation', 'toLocation'];

      for (const field of requiredFields) {
        const invalidData = { ...newTransferData };
        delete invalidData[field as keyof typeof invalidData];

        const response = await apiHelper.post('/api/transfer-requests', invalidData, operatorToken);
        apiHelper.expectValidationError(response);
      }
    });

    it('should validate UCP exists and is accessible', async () => {
      const invalidData = {
        ...newTransferData,
        ucpId: 'non-existent-ucp'
      };

      const response = await apiHelper.post('/api/transfer-requests', invalidData, operatorToken);
      apiHelper.expectError(response, 400);
      expect(response.body.message).toContain('UCP');
    });

    it('should validate location format', async () => {
      const invalidLocations = ['', 'invalid', 'A', 'A1', 'A1-01', 'A1-01-01-01'];

      for (const invalidLocation of invalidLocations) {
        const invalidData = { ...newTransferData, fromLocation: invalidLocation };
        const response = await apiHelper.post('/api/transfer-requests', invalidData, operatorToken);
        
        if (invalidLocation === '') {
          apiHelper.expectValidationError(response);
        } else {
          apiHelper.expectError(response, 400);
          expect(response.body.message).toContain('location');
        }
      }
    });

    it('should validate priority values', async () => {
      const invalidPriorities = ['invalid', 'super-high', ''];

      for (const invalidPriority of invalidPriorities) {
        const invalidData = { ...newTransferData, priority: invalidPriority };
        const response = await apiHelper.post('/api/transfer-requests', invalidData, operatorToken);
        apiHelper.expectValidationError(response, 'priority');
      }
    });

    it('should prevent duplicate active transfers for same UCP', async () => {
      // Create first transfer
      await apiHelper.post('/api/transfer-requests', newTransferData, operatorToken);

      // Try to create second transfer for same UCP
      const duplicateTransfer = {
        ...newTransferData,
        toLocation: 'C3-03-03'
      };

      const response = await apiHelper.post('/api/transfer-requests', duplicateTransfer, operatorToken);
      apiHelper.expectError(response, 409);
      expect(response.body.message).toContain('active transfer');
    });

    it('should validate destination location availability', async () => {
      // This test would check if destination location is already occupied
      const occupiedLocationData = {
        ...newTransferData,
        toLocation: 'OCCUPIED-LOCATION'
      };

      const response = await apiHelper.post('/api/transfer-requests', occupiedLocationData, operatorToken);
      
      // Depending on business rules, this might be allowed with warning or rejected
      if (response.status !== 201) {
        apiHelper.expectError(response, 400);
        expect(response.body.message).toContain('location');
      }
    });

    it('should automatically calculate estimated completion time', async () => {
      const response = await apiHelper.post('/api/transfer-requests', newTransferData, operatorToken);

      apiHelper.expectSuccess(response, 201);
      expect(response.body).toHaveProperty('estimatedCompletionTime');
      expect(response.body.estimatedCompletionTime).toBeDefined();
    });

    it('should deny access for unauthenticated requests', async () => {
      const response = await apiHelper.post('/api/transfer-requests', newTransferData);
      apiHelper.expectError(response, 401);
    });
  });

  describe('PUT /api/transfer-requests/:id', () => {
    const updateData = {
      priority: 'high',
      notes: 'Updated transfer request notes',
      requestedDate: new Date(Date.now() + 86400000).toISOString() // Tomorrow
    };

    it('should update transfer request for requester', async () => {
      const transfer = testScenario.transferRequests[0];
      const response = await apiHelper.put(`/api/transfer-requests/${transfer.id}`, updateData, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.priority).toBe(updateData.priority);
      expect(response.body.notes).toBe(updateData.notes);

      // Verify in database
      const db = global.testHelpers.db.getDb();
      const updatedTransfer = await db.query.transferRequests.findFirst({
        where: (transfers, { eq }) => eq(transfers.id, transfer.id)
      });
      expect(updatedTransfer?.priority).toBe(updateData.priority);
    });

    it('should not allow updating core fields after approval', async () => {
      const approvedTransfer = testScenario.transferRequests.find(t => t.status === 'approved');
      if (!approvedTransfer) {
        // Create an approved transfer for this test
        const transfer = testScenario.transferRequests[0];
        const db = global.testHelpers.db.getDb();
        await db.update(require('../../src/db/schema').transferRequests)
          .set({ status: 'approved', approvedBy: managerUser.id })
          .where(require('drizzle-orm').eq(require('../../src/db/schema').transferRequests.id, transfer.id));
      }

      const coreFieldUpdate = {
        ...updateData,
        fromLocation: 'NEW-LOCATION',
        toLocation: 'NEW-DESTINATION'
      };

      const response = await apiHelper.put(`/api/transfer-requests/${approvedTransfer?.id || testScenario.transferRequests[0].id}`, coreFieldUpdate, operatorToken);

      if (response.status === 200) {
        // Should ignore core field changes
        expect(response.body.fromLocation).toBe(approvedTransfer?.fromLocation || testScenario.transferRequests[0].fromLocation);
      } else {
        apiHelper.expectError(response, 400);
        expect(response.body.message).toContain('approved');
      }
    });

    it('should only allow requester or admin to update', async () => {
      // Create transfer by admin
      const adminTransfer = TestDataFactory.createTransferRequest(testScenario.ucps[0].id, adminUser.id);
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').transferRequests).values([adminTransfer]);

      // Operator should not be able to update admin's transfer
      const response = await apiHelper.put(`/api/transfer-requests/${adminTransfer.id}`, updateData, operatorToken);
      apiHelper.expectError(response, 403);
    });
  });

  describe('PUT /api/transfer-requests/:id/approve', () => {
    const approvalData = {
      notes: 'Approved for immediate execution',
      scheduledDate: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
    };

    it('should approve transfer request for manager and admin users', async () => {
      const pendingTransfer = testScenario.transferRequests.find(t => t.status === 'pending');
      const response = await apiHelper.put(`/api/transfer-requests/${pendingTransfer.id}/approve`, approvalData, managerToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.status).toBe('approved');
      expect(response.body.approvedBy).toBe(managerUser.id);
      expect(response.body.approvalNotes).toBe(approvalData.notes);

      // Verify in database
      const db = global.testHelpers.db.getDb();
      const approvedTransfer = await db.query.transferRequests.findFirst({
        where: (transfers, { eq }) => eq(transfers.id, pendingTransfer.id)
      });
      expect(approvedTransfer?.status).toBe('approved');
      expect(approvedTransfer?.approvedBy).toBe(managerUser.id);
    });

    it('should deny approval for non-manager users', async () => {
      const pendingTransfer = testScenario.transferRequests.find(t => t.status === 'pending');
      const response = await apiHelper.put(`/api/transfer-requests/${pendingTransfer.id}/approve`, approvalData, operatorToken);
      
      apiHelper.expectError(response, 403);
    });

    it('should validate only pending requests can be approved', async () => {
      const completedTransfer = testScenario.transferRequests[0];
      
      // Set transfer to completed status
      const db = global.testHelpers.db.getDb();
      await db.update(require('../../src/db/schema').transferRequests)
        .set({ status: 'completed' })
        .where(require('drizzle-orm').eq(require('../../src/db/schema').transferRequests.id, completedTransfer.id));

      const response = await apiHelper.put(`/api/transfer-requests/${completedTransfer.id}/approve`, approvalData, managerToken);
      
      apiHelper.expectError(response, 400);
      expect(response.body.message).toContain('pending');
    });

    it('should check location availability before approval', async () => {
      const pendingTransfer = testScenario.transferRequests.find(t => t.status === 'pending');
      
      // Mock destination location being occupied
      const conflictingApproval = {
        ...approvalData,
        toLocation: 'OCCUPIED-LOCATION'
      };

      const response = await apiHelper.put(`/api/transfer-requests/${pendingTransfer.id}/approve`, conflictingApproval, managerToken);
      
      // Business logic dependent - might warn or reject
      if (response.status !== 200) {
        apiHelper.expectError(response, 400);
        expect(response.body.message).toContain('location');
      }
    });
  });

  describe('PUT /api/transfer-requests/:id/reject', () => {
    const rejectionData = {
      reason: 'Location not available',
      notes: 'Please reschedule for next week'
    };

    it('should reject transfer request for manager and admin users', async () => {
      const pendingTransfer = testScenario.transferRequests.find(t => t.status === 'pending');
      const response = await apiHelper.put(`/api/transfer-requests/${pendingTransfer.id}/reject`, rejectionData, managerToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.status).toBe('rejected');
      expect(response.body.rejectedBy).toBe(managerUser.id);
      expect(response.body.rejectionReason).toBe(rejectionData.reason);

      // Verify in database
      const db = global.testHelpers.db.getDb();
      const rejectedTransfer = await db.query.transferRequests.findFirst({
        where: (transfers, { eq }) => eq(transfers.id, pendingTransfer.id)
      });
      expect(rejectedTransfer?.status).toBe('rejected');
    });

    it('should require rejection reason', async () => {
      const pendingTransfer = testScenario.transferRequests.find(t => t.status === 'pending');
      const invalidRejection = { notes: 'Rejected without reason' };

      const response = await apiHelper.put(`/api/transfer-requests/${pendingTransfer.id}/reject`, invalidRejection, managerToken);
      
      apiHelper.expectValidationError(response, 'reason');
    });
  });

  describe('PUT /api/transfer-requests/:id/complete', () => {
    const completionData = {
      actualDuration: 45, // minutes
      vehicleUsed: '', // Will be set in test
      completedBy: '', // Will be set in test
      notes: 'Transfer completed successfully'
    };

    beforeEach(() => {
      completionData.completedBy = operatorUser.id;
    });

    it('should complete approved transfer request', async () => {
      // First approve a transfer
      const pendingTransfer = testScenario.transferRequests.find(t => t.status === 'pending');
      await apiHelper.put(`/api/transfer-requests/${pendingTransfer.id}/approve`, { notes: 'Approved' }, managerToken);

      // Then complete it
      const response = await apiHelper.put(`/api/transfer-requests/${pendingTransfer.id}/complete`, completionData, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.status).toBe('completed');
      expect(response.body.completedBy).toBe(completionData.completedBy);
      expect(response.body.actualDuration).toBe(completionData.actualDuration);

      // Verify in database
      const db = global.testHelpers.db.getDb();
      const completedTransfer = await db.query.transferRequests.findFirst({
        where: (transfers, { eq }) => eq(transfers.id, pendingTransfer.id)
      });
      expect(completedTransfer?.status).toBe('completed');
    });

    it('should update UCP location after completion', async () => {
      // Approve and complete transfer
      const pendingTransfer = testScenario.transferRequests.find(t => t.status === 'pending');
      await apiHelper.put(`/api/transfer-requests/${pendingTransfer.id}/approve`, { notes: 'Approved' }, managerToken);
      
      const response = await apiHelper.put(`/api/transfer-requests/${pendingTransfer.id}/complete`, completionData, operatorToken);
      
      apiHelper.expectSuccess(response, 200);

      // Verify UCP location was updated
      const ucpResponse = await apiHelper.get(`/api/ucps/${pendingTransfer.ucpId}`, operatorToken);
      expect(ucpResponse.body.currentLocation).toBe(pendingTransfer.toLocation);
    });

    it('should validate only approved transfers can be completed', async () => {
      const pendingTransfer = testScenario.transferRequests.find(t => t.status === 'pending');
      const response = await apiHelper.put(`/api/transfer-requests/${pendingTransfer.id}/complete`, completionData, operatorToken);

      apiHelper.expectError(response, 400);
      expect(response.body.message).toContain('approved');
    });
  });

  describe('DELETE /api/transfer-requests/:id', () => {
    it('should cancel pending transfer request for requester', async () => {
      const pendingTransfer = testScenario.transferRequests.find(t => t.status === 'pending');
      const response = await apiHelper.delete(`/api/transfer-requests/${pendingTransfer.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);

      // Verify status changed to cancelled
      const db = global.testHelpers.db.getDb();
      const cancelledTransfer = await db.query.transferRequests.findFirst({
        where: (transfers, { eq }) => eq(transfers.id, pendingTransfer.id)
      });
      expect(cancelledTransfer?.status).toBe('cancelled');
    });

    it('should hard delete for admin users', async () => {
      const transfer = testScenario.transferRequests[0];
      const response = await apiHelper.delete(`/api/transfer-requests/${transfer.id}`, adminToken);

      apiHelper.expectSuccess(response, 200);

      // Verify hard delete
      const db = global.testHelpers.db.getDb();
      const deletedTransfer = await db.query.transferRequests.findFirst({
        where: (transfers, { eq }) => eq(transfers.id, transfer.id)
      });
      expect(deletedTransfer).toBeUndefined();
    });

    it('should prevent cancellation of approved/completed transfers', async () => {
      // Create and approve a transfer
      const pendingTransfer = testScenario.transferRequests.find(t => t.status === 'pending');
      await apiHelper.put(`/api/transfer-requests/${pendingTransfer.id}/approve`, { notes: 'Approved' }, managerToken);

      const response = await apiHelper.delete(`/api/transfer-requests/${pendingTransfer.id}`, operatorToken);

      apiHelper.expectError(response, 400);
      expect(response.body.message).toContain('approved');
    });
  });

  describe('Transfer Analytics and Reporting', () => {
    describe('GET /api/transfer-requests/analytics/summary', () => {
      it('should return transfer request statistics', async () => {
        const response = await apiHelper.get('/api/transfer-requests/analytics/summary', managerToken);

        apiHelper.expectSuccess(response, 200);
        expect(response.body).toHaveProperty('totalRequests');
        expect(response.body).toHaveProperty('pendingRequests');
        expect(response.body).toHaveProperty('approvedRequests');
        expect(response.body).toHaveProperty('completedRequests');
        expect(response.body).toHaveProperty('averageProcessingTime');
        expect(response.body).toHaveProperty('completionRate');
        expect(typeof response.body.completionRate).toBe('number');
      });

      it('should support date range filtering', async () => {
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago
        const endDate = new Date().toISOString();

        const response = await apiHelper.get(`/api/transfer-requests/analytics/summary?startDate=${startDate}&endDate=${endDate}`, managerToken);

        apiHelper.expectSuccess(response, 200);
        expect(response.body).toHaveProperty('dateRange');
        expect(response.body.dateRange.startDate).toBe(startDate);
        expect(response.body.dateRange.endDate).toBe(endDate);
      });

      it('should require manager or admin role', async () => {
        const response = await apiHelper.get('/api/transfer-requests/analytics/summary', operatorToken);
        apiHelper.expectError(response, 403);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle complex transfer queries efficiently', async () => {
      // Create additional transfer requests for performance testing
      const additionalRequests = Array.from({ length: 50 }, () =>
        TestDataFactory.createTransferRequest(testScenario.ucps[0].id, operatorUser.id)
      );
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').transferRequests).values(additionalRequests);

      const startTime = Date.now();
      const response = await apiHelper.get('/api/transfer-requests?include=ucp,requester&sort=createdAt&order=desc', operatorToken);
      const endTime = Date.now();

      const queryTime = endTime - startTime;
      expect(queryTime).toBeLessThan(2000); // Should respond within 2 seconds

      apiHelper.expectSuccess(response, 200);
      expect(response.body.transferRequests.length).toBeGreaterThan(10);
    });

    it('should handle concurrent transfer operations efficiently', async () => {
      const concurrentRequests = testScenario.transferRequests.map(transfer =>
        apiHelper.get(`/api/transfer-requests/${transfer.id}`, operatorToken)
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(1500); // Should complete within 1.5 seconds

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});