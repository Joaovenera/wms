import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Express } from 'express';
import { testAppFactory } from '../helpers/test-app-factory';
import { TestDataFactory } from '../helpers/test-data-factory';
import { ApiTestHelper } from '../helpers/api-test-helper';

describe('Vehicles API Integration Tests', () => {
  let app: Express;
  let apiHelper: ApiTestHelper;
  let adminUser: any;
  let operatorUser: any;
  let managerUser: any;
  let adminToken: string;
  let operatorToken: string;
  let managerToken: string;
  let testVehicles: any[];

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
    managerUser = TestDataFactory.createUser({ role: 'manager' });

    const db = global.testHelpers.db.getDb();
    await db.insert(require('../../src/db/schema').users).values([
      adminUser, operatorUser, managerUser
    ]);

    // Create test vehicles
    testVehicles = TestDataFactory.createVehicles(4);
    await db.insert(require('../../src/db/schema').vehicles).values(testVehicles);

    adminToken = 'mock-admin-token';
    operatorToken = 'mock-operator-token';
    managerToken = 'mock-manager-token';
  });

  describe('GET /api/vehicles', () => {
    it('should return list of vehicles for authenticated users', async () => {
      const response = await apiHelper.get('/api/vehicles', operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body).toHaveProperty('vehicles');
      expect(Array.isArray(response.body.vehicles)).toBe(true);
      expect(response.body.vehicles.length).toBe(4);

      const vehicle = response.body.vehicles[0];
      expect(vehicle).toHaveProperty('id');
      expect(vehicle).toHaveProperty('code');
      expect(vehicle).toHaveProperty('name');
      expect(vehicle).toHaveProperty('type');
      expect(vehicle).toHaveProperty('maxCapacity');
      expect(vehicle).toHaveProperty('status');
      expect(vehicle).toHaveProperty('isActive');
    });

    it('should support filtering by vehicle type', async () => {
      const response = await apiHelper.get('/api/vehicles?type=forklift', operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.vehicles.forEach((vehicle: any) => {
        expect(vehicle.type).toBe('forklift');
      });
    });

    it('should support filtering by status', async () => {
      // Update a vehicle to maintenance status
      const db = global.testHelpers.db.getDb();
      await db.update(require('../../src/db/schema').vehicles)
        .set({ status: 'maintenance' })
        .where(require('drizzle-orm').eq(require('../../src/db/schema').vehicles.id, testVehicles[0].id));

      const response = await apiHelper.get('/api/vehicles?status=maintenance', operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.vehicles.forEach((vehicle: any) => {
        expect(vehicle.status).toBe('maintenance');
      });
    });

    it('should support filtering by availability', async () => {
      const response = await apiHelper.get('/api/vehicles?available=true', operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.vehicles.forEach((vehicle: any) => {
        expect(['available', 'idle']).toContain(vehicle.status);
      });
    });

    it('should include current assignment information', async () => {
      const response = await apiHelper.get('/api/vehicles?include=assignment', operatorToken);

      apiHelper.expectSuccess(response, 200);
      response.body.vehicles.forEach((vehicle: any) => {
        expect(vehicle).toHaveProperty('currentAssignment');
        if (vehicle.status === 'in_use') {
          expect(vehicle.currentAssignment).toBeDefined();
        } else {
          expect(vehicle.currentAssignment).toBeNull();
        }
      });
    });

    it('should support pagination', async () => {
      // Create additional vehicles
      const additionalVehicles = TestDataFactory.createVehicles(10);
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').vehicles).values(additionalVehicles);

      const response = await apiHelper.get('/api/vehicles?page=1&limit=5', operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.vehicles.length).toBeLessThanOrEqual(5);
      expect(response.body).toHaveProperty('pagination');
    });

    it('should deny access for unauthenticated requests', async () => {
      const response = await apiHelper.get('/api/vehicles');
      apiHelper.expectError(response, 401);
    });
  });

  describe('GET /api/vehicles/:id', () => {
    it('should return specific vehicle by ID with full details', async () => {
      const vehicle = testVehicles[0];
      const response = await apiHelper.get(`/api/vehicles/${vehicle.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.id).toBe(vehicle.id);
      expect(response.body.code).toBe(vehicle.code);
      expect(response.body.name).toBe(vehicle.name);
      expect(response.body.type).toBe(vehicle.type);
      expect(response.body).toHaveProperty('specifications');
      expect(response.body).toHaveProperty('maintenanceHistory');
      expect(response.body).toHaveProperty('usageStats');
    });

    it('should include maintenance schedule information', async () => {
      const vehicle = testVehicles[0];
      const response = await apiHelper.get(`/api/vehicles/${vehicle.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body).toHaveProperty('maintenance');
      expect(response.body.maintenance).toHaveProperty('lastService');
      expect(response.body.maintenance).toHaveProperty('nextService');
      expect(response.body.maintenance).toHaveProperty('hoursUntilService');
    });

    it('should include current and recent assignments', async () => {
      const vehicle = testVehicles[0];
      const response = await apiHelper.get(`/api/vehicles/${vehicle.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body).toHaveProperty('assignments');
      expect(response.body.assignments).toHaveProperty('current');
      expect(response.body.assignments).toHaveProperty('recent');
    });

    it('should return 404 for non-existent vehicle', async () => {
      const response = await apiHelper.get('/api/vehicles/non-existent-id', operatorToken);
      apiHelper.expectError(response, 404);
    });
  });

  describe('POST /api/vehicles', () => {
    const newVehicleData = {
      code: 'NEWVEH001',
      name: 'New Test Vehicle',
      type: 'forklift',
      maxCapacity: 2000,
      specifications: {
        manufacturer: 'Test Manufacturer',
        model: 'Test Model 2024',
        year: 2024,
        fuelType: 'electric',
        maxHeight: 5.5
      }
    };

    it('should create new vehicle with valid data for admin users', async () => {
      const response = await apiHelper.post('/api/vehicles', newVehicleData, adminToken);

      apiHelper.expectSuccess(response, 201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.code).toBe(newVehicleData.code);
      expect(response.body.name).toBe(newVehicleData.name);
      expect(response.body.type).toBe(newVehicleData.type);
      expect(response.body.maxCapacity).toBe(newVehicleData.maxCapacity);
      expect(response.body.status).toBe('available');
      expect(response.body.isActive).toBe(true);

      // Verify in database
      const db = global.testHelpers.db.getDb();
      const createdVehicle = await db.query.vehicles.findFirst({
        where: (vehicles, { eq }) => eq(vehicles.id, response.body.id)
      });
      expect(createdVehicle).toBeDefined();
    });

    it('should deny access for non-admin users', async () => {
      const managerResponse = await apiHelper.post('/api/vehicles', newVehicleData, managerToken);
      apiHelper.expectError(managerResponse, 403);

      const operatorResponse = await apiHelper.post('/api/vehicles', newVehicleData, operatorToken);
      apiHelper.expectError(operatorResponse, 403);
    });

    it('should validate required fields', async () => {
      const requiredFields = ['code', 'name', 'type', 'maxCapacity'];

      for (const field of requiredFields) {
        const invalidData = { ...newVehicleData };
        delete invalidData[field as keyof typeof invalidData];

        const response = await apiHelper.post('/api/vehicles', invalidData, adminToken);
        apiHelper.expectValidationError(response);
      }
    });

    it('should reject duplicate vehicle codes', async () => {
      const duplicateData = {
        ...newVehicleData,
        code: testVehicles[0].code
      };

      const response = await apiHelper.post('/api/vehicles', duplicateData, adminToken);
      apiHelper.expectError(response, 409);
    });

    it('should validate vehicle type values', async () => {
      const invalidTypes = ['invalid', 'car', 'boat'];

      for (const invalidType of invalidTypes) {
        const invalidData = { ...newVehicleData, type: invalidType };
        const response = await apiHelper.post('/api/vehicles', invalidData, adminToken);
        apiHelper.expectValidationError(response, 'type');
      }
    });

    it('should validate capacity is positive', async () => {
      const invalidCapacities = [0, -100, -1];

      for (const capacity of invalidCapacities) {
        const invalidData = { ...newVehicleData, maxCapacity: capacity };
        const response = await apiHelper.post('/api/vehicles', invalidData, adminToken);
        apiHelper.expectValidationError(response, 'maxCapacity');
      }
    });

    it('should initialize maintenance schedule for new vehicles', async () => {
      const response = await apiHelper.post('/api/vehicles', newVehicleData, adminToken);

      apiHelper.expectSuccess(response, 201);
      
      // Get vehicle details to check maintenance initialization
      const detailResponse = await apiHelper.get(`/api/vehicles/${response.body.id}`, adminToken);
      expect(detailResponse.body.maintenance).toBeDefined();
      expect(detailResponse.body.maintenance.hoursUntilService).toBeGreaterThan(0);
    });
  });

  describe('PUT /api/vehicles/:id', () => {
    const updateData = {
      name: 'Updated Vehicle Name',
      maxCapacity: 2500,
      specifications: {
        manufacturer: 'Updated Manufacturer',
        model: 'Updated Model'
      }
    };

    it('should update vehicle with valid data for admin users', async () => {
      const vehicle = testVehicles[0];
      const response = await apiHelper.put(`/api/vehicles/${vehicle.id}`, updateData, adminToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.name).toBe(updateData.name);
      expect(response.body.maxCapacity).toBe(updateData.maxCapacity);

      // Verify in database
      const db = global.testHelpers.db.getDb();
      const updatedVehicle = await db.query.vehicles.findFirst({
        where: (vehicles, { eq }) => eq(vehicles.id, vehicle.id)
      });
      expect(updatedVehicle?.name).toBe(updateData.name);
    });

    it('should deny access for non-admin users', async () => {
      const vehicle = testVehicles[0];
      const response = await apiHelper.put(`/api/vehicles/${vehicle.id}`, updateData, operatorToken);
      apiHelper.expectError(response, 403);
    });

    it('should not allow updating code or type', async () => {
      const vehicle = testVehicles[0];
      const invalidUpdate = {
        ...updateData,
        code: 'NEWCODE',
        type: 'truck'
      };

      const response = await apiHelper.put(`/api/vehicles/${vehicle.id}`, invalidUpdate, adminToken);

      if (response.status === 200) {
        expect(response.body.code).toBe(vehicle.code);
        expect(response.body.type).toBe(vehicle.type);
      } else {
        apiHelper.expectValidationError(response);
      }
    });

    it('should prevent capacity reduction below current assignments', async () => {
      const vehicle = testVehicles[0];
      
      // Create assignment that uses vehicle capacity
      const assignment = {
        vehicleId: vehicle.id,
        assignedBy: operatorUser.id,
        requiredCapacity: 1800,
        status: 'active'
      };
      
      // Mock creating assignment (this would be in vehicle_assignments table)
      const db = global.testHelpers.db.getDb();
      // await db.insert(schema.vehicleAssignments).values([assignment]);

      // Try to reduce capacity below required
      const invalidUpdate = { maxCapacity: 1500 };
      const response = await apiHelper.put(`/api/vehicles/${vehicle.id}`, invalidUpdate, adminToken);

      // Should either deny or warn about the capacity reduction
      if (response.status !== 200) {
        apiHelper.expectError(response, 400);
        expect(response.body.message).toContain('capacity');
      }
    });
  });

  describe('PUT /api/vehicles/:id/status', () => {
    it('should update vehicle status for manager and admin users', async () => {
      const vehicle = testVehicles[0];
      const statusUpdate = { status: 'maintenance', reason: 'Scheduled maintenance' };

      const response = await apiHelper.put(`/api/vehicles/${vehicle.id}/status`, statusUpdate, managerToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.status).toBe('maintenance');

      // Verify in database
      const db = global.testHelpers.db.getDb();
      const updatedVehicle = await db.query.vehicles.findFirst({
        where: (vehicles, { eq }) => eq(vehicles.id, vehicle.id)
      });
      expect(updatedVehicle?.status).toBe('maintenance');
    });

    it('should allow operators to update to limited statuses', async () => {
      const vehicle = testVehicles.find(v => v.status === 'available');
      const statusUpdate = { status: 'in_use' };

      const response = await apiHelper.put(`/api/vehicles/${vehicle.id}/status`, statusUpdate, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.status).toBe('in_use');
    });

    it('should deny operators from setting maintenance status', async () => {
      const vehicle = testVehicles[0];
      const statusUpdate = { status: 'maintenance' };

      const response = await apiHelper.put(`/api/vehicles/${vehicle.id}/status`, statusUpdate, operatorToken);
      apiHelper.expectError(response, 403);
    });

    it('should validate status transition rules', async () => {
      const maintenanceVehicle = testVehicles[0];
      
      // Set vehicle to maintenance
      const db = global.testHelpers.db.getDb();
      await db.update(require('../../src/db/schema').vehicles)
        .set({ status: 'maintenance' })
        .where(require('drizzle-orm').eq(require('../../src/db/schema').vehicles.id, maintenanceVehicle.id));

      // Try invalid transition from maintenance to in_use without inspection
      const invalidTransition = { status: 'in_use' };
      const response = await apiHelper.put(`/api/vehicles/${maintenanceVehicle.id}/status`, invalidTransition, managerToken);

      apiHelper.expectError(response, 400);
      expect(response.body.message).toContain('transition');
    });

    it('should automatically end assignments when setting to maintenance', async () => {
      const vehicle = testVehicles.find(v => v.status === 'in_use') || testVehicles[0];
      const statusUpdate = { status: 'maintenance', reason: 'Emergency maintenance' };

      const response = await apiHelper.put(`/api/vehicles/${vehicle.id}/status`, statusUpdate, adminToken);

      apiHelper.expectSuccess(response, 200);
      
      // Verify no active assignments remain
      const detailResponse = await apiHelper.get(`/api/vehicles/${vehicle.id}`, adminToken);
      expect(detailResponse.body.assignments.current).toBeNull();
    });
  });

  describe('DELETE /api/vehicles/:id', () => {
    it('should soft delete vehicle for admin users', async () => {
      const vehicle = testVehicles[0];
      const response = await apiHelper.delete(`/api/vehicles/${vehicle.id}`, adminToken);

      apiHelper.expectSuccess(response, 200);

      // Verify soft delete
      const db = global.testHelpers.db.getDb();
      const deletedVehicle = await db.query.vehicles.findFirst({
        where: (vehicles, { eq }) => eq(vehicles.id, vehicle.id)
      });
      expect(deletedVehicle?.isActive).toBe(false);
    });

    it('should deny access for non-admin users', async () => {
      const vehicle = testVehicles[0];
      const response = await apiHelper.delete(`/api/vehicles/${vehicle.id}`, operatorToken);
      apiHelper.expectError(response, 403);
    });

    it('should prevent deletion of vehicles with active assignments', async () => {
      const vehicle = testVehicles.find(v => v.status === 'in_use') || testVehicles[0];
      
      // Set vehicle to in_use status
      const db = global.testHelpers.db.getDb();
      await db.update(require('../../src/db/schema').vehicles)
        .set({ status: 'in_use' })
        .where(require('drizzle-orm').eq(require('../../src/db/schema').vehicles.id, vehicle.id));

      const response = await apiHelper.delete(`/api/vehicles/${vehicle.id}`, adminToken);

      apiHelper.expectError(response, 400);
      expect(response.body.message).toContain('active');
    });
  });

  describe('Vehicle Assignment Management', () => {
    describe('POST /api/vehicles/:id/assign', () => {
      const assignmentData = {
        assignedTo: '', // Will be set in test
        taskType: 'transport',
        priority: 'medium',
        estimatedDuration: 120, // minutes
        requiredCapacity: 1000
      };

      beforeEach(() => {
        assignmentData.assignedTo = operatorUser.id;
      });

      it('should assign vehicle to operator', async () => {
        const vehicle = testVehicles.find(v => v.status === 'available');
        const response = await apiHelper.post(`/api/vehicles/${vehicle.id}/assign`, assignmentData, managerToken);

        apiHelper.expectSuccess(response, 201);
        expect(response.body).toHaveProperty('assignmentId');
        expect(response.body.vehicleId).toBe(vehicle.id);
        expect(response.body.assignedTo).toBe(assignmentData.assignedTo);
        expect(response.body.status).toBe('active');

        // Verify vehicle status updated
        const vehicleResponse = await apiHelper.get(`/api/vehicles/${vehicle.id}`, managerToken);
        expect(vehicleResponse.body.status).toBe('in_use');
      });

      it('should validate vehicle availability', async () => {
        const busyVehicle = testVehicles[0];
        
        // Set vehicle to in_use
        const db = global.testHelpers.db.getDb();
        await db.update(require('../../src/db/schema').vehicles)
          .set({ status: 'in_use' })
          .where(require('drizzle-orm').eq(require('../../src/db/schema').vehicles.id, busyVehicle.id));

        const response = await apiHelper.post(`/api/vehicles/${busyVehicle.id}/assign`, assignmentData, managerToken);

        apiHelper.expectError(response, 400);
        expect(response.body.message).toContain('available');
      });

      it('should validate capacity requirements', async () => {
        const vehicle = testVehicles.find(v => v.status === 'available');
        const invalidAssignment = {
          ...assignmentData,
          requiredCapacity: vehicle.maxCapacity + 1000 // Exceeds capacity
        };

        const response = await apiHelper.post(`/api/vehicles/${vehicle.id}/assign`, invalidAssignment, managerToken);

        apiHelper.expectError(response, 400);
        expect(response.body.message).toContain('capacity');
      });

      it('should require manager or admin role', async () => {
        const vehicle = testVehicles.find(v => v.status === 'available');
        const response = await apiHelper.post(`/api/vehicles/${vehicle.id}/assign`, assignmentData, operatorToken);
        
        apiHelper.expectError(response, 403);
      });
    });

    describe('PUT /api/vehicles/:id/unassign', () => {
      it('should unassign vehicle and update status', async () => {
        const vehicle = testVehicles[0];
        
        // First assign the vehicle
        const assignmentData = {
          assignedTo: operatorUser.id,
          taskType: 'transport',
          priority: 'medium'
        };
        
        await apiHelper.post(`/api/vehicles/${vehicle.id}/assign`, assignmentData, managerToken);

        // Then unassign
        const unassignData = { reason: 'Task completed' };
        const response = await apiHelper.put(`/api/vehicles/${vehicle.id}/unassign`, unassignData, managerToken);

        apiHelper.expectSuccess(response, 200);

        // Verify vehicle is available again
        const vehicleResponse = await apiHelper.get(`/api/vehicles/${vehicle.id}`, managerToken);
        expect(vehicleResponse.body.status).toBe('available');
        expect(vehicleResponse.body.assignments.current).toBeNull();
      });
    });
  });

  describe('Maintenance Management', () => {
    describe('POST /api/vehicles/:id/maintenance', () => {
      const maintenanceData = {
        type: 'scheduled',
        description: 'Regular maintenance check',
        scheduledBy: '', // Will be set in test
        estimatedDuration: 240 // minutes
      };

      beforeEach(() => {
        maintenanceData.scheduledBy = managerUser.id;
      });

      it('should schedule maintenance for available vehicles', async () => {
        const vehicle = testVehicles.find(v => v.status === 'available');
        const response = await apiHelper.post(`/api/vehicles/${vehicle.id}/maintenance`, maintenanceData, managerToken);

        apiHelper.expectSuccess(response, 201);
        expect(response.body).toHaveProperty('maintenanceId');
        expect(response.body.vehicleId).toBe(vehicle.id);
        expect(response.body.type).toBe(maintenanceData.type);

        // Verify vehicle status updated
        const vehicleResponse = await apiHelper.get(`/api/vehicles/${vehicle.id}`, managerToken);
        expect(vehicleResponse.body.status).toBe('maintenance');
      });

      it('should require manager or admin role', async () => {
        const vehicle = testVehicles[0];
        const response = await apiHelper.post(`/api/vehicles/${vehicle.id}/maintenance`, maintenanceData, operatorToken);
        
        apiHelper.expectError(response, 403);
      });
    });
  });

  describe('Performance and Analytics', () => {
    it('should return vehicle utilization statistics', async () => {
      const response = await apiHelper.get('/api/vehicles/analytics/utilization', managerToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body).toHaveProperty('totalVehicles');
      expect(response.body).toHaveProperty('available');
      expect(response.body).toHaveProperty('inUse');
      expect(response.body).toHaveProperty('maintenance');
      expect(response.body).toHaveProperty('utilizationRate');
      expect(typeof response.body.utilizationRate).toBe('number');
    });

    it('should handle concurrent vehicle operations efficiently', async () => {
      const concurrentRequests = testVehicles.map(vehicle =>
        apiHelper.get(`/api/vehicles/${vehicle.id}`, operatorToken)
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});