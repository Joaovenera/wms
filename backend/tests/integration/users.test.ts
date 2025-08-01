import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { testAppFactory } from '../helpers/test-app-factory';
import { TestDataFactory } from '../helpers/test-data-factory';
import { ApiTestHelper } from '../helpers/api-test-helper';

describe('Users API Integration Tests', () => {
  let app: Express;
  let apiHelper: ApiTestHelper;
  let adminUser: any;
  let managerUser: any;
  let operatorUser: any;
  let adminToken: string;
  let managerToken: string;
  let operatorToken: string;

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

    // Create test users with different roles
    adminUser = TestDataFactory.createUser({ 
      role: 'admin', 
      username: 'testadmin', 
      email: 'admin@test.com' 
    });
    managerUser = TestDataFactory.createUser({ 
      role: 'manager', 
      username: 'testmanager', 
      email: 'manager@test.com' 
    });
    operatorUser = TestDataFactory.createUser({ 
      role: 'operator', 
      username: 'testoperator', 
      email: 'operator@test.com' 
    });

    const db = global.testHelpers.db.getDb();
    await db.insert(require('../../src/db/schema').users).values([
      adminUser,
      managerUser,
      operatorUser
    ]);

    // Mock authentication tokens
    adminToken = 'mock-admin-token';
    managerToken = 'mock-manager-token';
    operatorToken = 'mock-operator-token';
  });

  describe('GET /api/users', () => {
    it('should return list of users for admin users', async () => {
      const response = await apiHelper.get('/api/users', adminToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThanOrEqual(3);
      
      // Verify user structure
      const user = response.body.users[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role');
      expect(user).not.toHaveProperty('password');
    });

    it('should return list of users for manager users', async () => {
      const response = await apiHelper.get('/api/users', managerToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it('should deny access for operator users', async () => {
      const response = await apiHelper.get('/api/users', operatorToken);

      apiHelper.expectError(response, 403);
    });

    it('should deny access for unauthenticated requests', async () => {
      const response = await apiHelper.get('/api/users');

      apiHelper.expectError(response, 401);
    });

    it('should support pagination parameters', async () => {
      // Create additional users for pagination testing
      const additionalUsers = TestDataFactory.createUsers(10);
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').users).values(additionalUsers);

      const response = await apiHelper.get('/api/users?page=1&limit=5', adminToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.users.length).toBeLessThanOrEqual(5);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
    });

    it('should support filtering by role', async () => {
      const response = await apiHelper.get('/api/users?role=admin', adminToken);

      apiHelper.expectSuccess(response, 200);
      response.body.users.forEach((user: any) => {
        expect(user.role).toBe('admin');
      });
    });

    it('should support filtering by active status', async () => {
      // Create inactive user
      const inactiveUser = TestDataFactory.createUser({ isActive: false });
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').users).values([inactiveUser]);

      const response = await apiHelper.get('/api/users?active=false', adminToken);

      apiHelper.expectSuccess(response, 200);
      response.body.users.forEach((user: any) => {
        expect(user.isActive).toBe(false);
      });
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return specific user by ID for any authenticated user', async () => {
      const response = await apiHelper.get(`/api/users/${adminUser.id}`, operatorToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.id).toBe(adminUser.id);
      expect(response.body.username).toBe(adminUser.username);
      expect(response.body.email).toBe(adminUser.email);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await apiHelper.get('/api/users/non-existent-id', adminToken);

      apiHelper.expectError(response, 404);
    });

    it('should deny access for unauthenticated requests', async () => {
      const response = await apiHelper.get(`/api/users/${adminUser.id}`);

      apiHelper.expectError(response, 401);
    });

    it('should handle invalid user ID format gracefully', async () => {
      const invalidIds = ['', 'invalid', '123', 'user@email.com'];

      for (const invalidId of invalidIds) {
        const response = await apiHelper.get(`/api/users/${invalidId}`, adminToken);
        expect([400, 404]).toContain(response.status);
      }
    });
  });

  describe('POST /api/users', () => {
    const newUserData = {
      username: 'newuser',
      email: 'newuser@test.com',
      firstName: 'New',
      lastName: 'User',
      role: 'operator',
      password: 'newuser123'
    };

    it('should create new user with valid data for admin users', async () => {
      const response = await apiHelper.post('/api/users', newUserData, adminToken);

      apiHelper.expectSuccess(response, 201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.username).toBe(newUserData.username);
      expect(response.body.email).toBe(newUserData.email);
      expect(response.body.role).toBe(newUserData.role);
      expect(response.body).not.toHaveProperty('password');

      // Verify user was actually created in database
      const db = global.testHelpers.db.getDb();
      const createdUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, response.body.id)
      });
      expect(createdUser).toBeDefined();
      expect(createdUser?.username).toBe(newUserData.username);
    });

    it('should deny access for non-admin users', async () => {
      const managerResponse = await apiHelper.post('/api/users', newUserData, managerToken);
      apiHelper.expectError(managerResponse, 403);

      const operatorResponse = await apiHelper.post('/api/users', newUserData, operatorToken);
      apiHelper.expectError(operatorResponse, 403);
    });

    it('should validate required fields', async () => {
      const requiredFields = ['username', 'email', 'firstName', 'lastName', 'role'];

      for (const field of requiredFields) {
        const invalidData = { ...newUserData };
        delete invalidData[field as keyof typeof invalidData];

        const response = await apiHelper.post('/api/users', invalidData, adminToken);
        apiHelper.expectValidationError(response, field);
      }
    });

    it('should reject duplicate usernames', async () => {
      const duplicateUser = {
        ...newUserData,
        username: adminUser.username, // Use existing username
        email: 'different@test.com'
      };

      const response = await apiHelper.post('/api/users', duplicateUser, adminToken);
      apiHelper.expectError(response, 409);
      expect(response.body.message).toContain('username');
    });

    it('should reject duplicate emails', async () => {
      const duplicateUser = {
        ...newUserData,
        username: 'differentuser',
        email: adminUser.email // Use existing email
      };

      const response = await apiHelper.post('/api/users', duplicateUser, adminToken);
      apiHelper.expectError(response, 409);
      expect(response.body.message).toContain('email');
    });

    it('should validate email format', async () => {
      const invalidEmails = ['invalid', 'invalid@', '@invalid.com', 'invalid.com'];

      for (const invalidEmail of invalidEmails) {
        const invalidData = { ...newUserData, email: invalidEmail };
        const response = await apiHelper.post('/api/users', invalidData, adminToken);
        apiHelper.expectValidationError(response, 'email');
      }
    });

    it('should validate role values', async () => {
      const invalidRoles = ['superadmin', 'guest', 'invalid', ''];

      for (const invalidRole of invalidRoles) {
        const invalidData = { ...newUserData, role: invalidRole };
        const response = await apiHelper.post('/api/users', invalidData, adminToken);
        apiHelper.expectValidationError(response, 'role');
      }
    });

    it('should hash password before storing', async () => {
      const response = await apiHelper.post('/api/users', newUserData, adminToken);
      apiHelper.expectSuccess(response, 201);

      // Verify password is hashed in database
      const db = global.testHelpers.db.getDb();
      const createdUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, response.body.id)
      });

      expect(createdUser?.password).toBeDefined();
      expect(createdUser?.password).not.toBe(newUserData.password);
      expect(createdUser?.password?.length).toBeGreaterThan(20); // Hashed password should be longer
    });
  });

  describe('PUT /api/users/:id', () => {
    const updateData = {
      firstName: 'Updated',
      lastName: 'Name',
      email: 'updated@test.com'
    };

    it('should update user with valid data for admin users', async () => {
      const response = await apiHelper.put(`/api/users/${operatorUser.id}`, updateData, adminToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.firstName).toBe(updateData.firstName);
      expect(response.body.lastName).toBe(updateData.lastName);
      expect(response.body.email).toBe(updateData.email);

      // Verify update in database
      const db = global.testHelpers.db.getDb();
      const updatedUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, operatorUser.id)
      });
      expect(updatedUser?.firstName).toBe(updateData.firstName);
    });

    it('should deny access for non-admin users', async () => {
      const response = await apiHelper.put(`/api/users/${operatorUser.id}`, updateData, operatorToken);
      apiHelper.expectError(response, 403);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await apiHelper.put('/api/users/non-existent-id', updateData, adminToken);
      apiHelper.expectError(response, 404);
    });

    it('should validate email format on update', async () => {
      const invalidUpdate = { ...updateData, email: 'invalid-email' };
      const response = await apiHelper.put(`/api/users/${operatorUser.id}`, invalidUpdate, adminToken);
      apiHelper.expectValidationError(response, 'email');
    });

    it('should not allow updating username', async () => {
      const updateWithUsername = { ...updateData, username: 'newusername' };
      const response = await apiHelper.put(`/api/users/${operatorUser.id}`, updateWithUsername, adminToken);

      // Should succeed but username should not change
      if (response.status === 200) {
        expect(response.body.username).toBe(operatorUser.username);
      } else {
        // Or should return validation error
        apiHelper.expectValidationError(response);
      }
    });
  });

  describe('PUT /api/users/:id/role', () => {
    it('should update user role for admin users', async () => {
      const roleUpdate = { role: 'manager' };
      const response = await apiHelper.put(`/api/users/${operatorUser.id}/role`, roleUpdate, adminToken);

      apiHelper.expectSuccess(response, 200);
      expect(response.body.role).toBe('manager');

      // Verify role update in database
      const db = global.testHelpers.db.getDb();
      const updatedUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, operatorUser.id)
      });
      expect(updatedUser?.role).toBe('manager');
    });

    it('should deny access for non-admin users', async () => {
      const roleUpdate = { role: 'admin' };
      const response = await apiHelper.put(`/api/users/${operatorUser.id}/role`, roleUpdate, managerToken);
      apiHelper.expectError(response, 403);
    });

    it('should validate role values', async () => {
      const invalidRoles = ['superadmin', 'guest', 'invalid'];

      for (const invalidRole of invalidRoles) {
        const roleUpdate = { role: invalidRole };
        const response = await apiHelper.put(`/api/users/${operatorUser.id}/role`, roleUpdate, adminToken);
        apiHelper.expectValidationError(response, 'role');
      }
    });

    it('should not allow admin to demote themselves', async () => {
      const roleUpdate = { role: 'operator' };
      const response = await apiHelper.put(`/api/users/${adminUser.id}/role`, roleUpdate, adminToken);
      
      // Should either deny the operation or maintain admin role
      if (response.status === 200) {
        expect(response.body.role).toBe('admin');
      } else {
        apiHelper.expectError(response, 403);
      }
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should soft delete user for admin users', async () => {
      const response = await apiHelper.delete(`/api/users/${operatorUser.id}`, adminToken);

      apiHelper.expectSuccess(response, 200);

      // Verify user is marked as inactive in database
      const db = global.testHelpers.db.getDb();
      const deletedUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, operatorUser.id)
      });
      expect(deletedUser?.isActive).toBe(false);
    });

    it('should deny access for non-admin users', async () => {
      const response = await apiHelper.delete(`/api/users/${operatorUser.id}`, managerToken);
      apiHelper.expectError(response, 403);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await apiHelper.delete('/api/users/non-existent-id', adminToken);
      apiHelper.expectError(response, 404);
    });

    it('should not allow admin to delete themselves', async () => {
      const response = await apiHelper.delete(`/api/users/${adminUser.id}`, adminToken);
      apiHelper.expectError(response, 403);
      expect(response.body.message).toContain('cannot delete yourself');
    });

    it('should handle cascading relationships properly', async () => {
      // Create UCP created by the user
      const testUcp = TestDataFactory.createUCP('test-pallet-id', operatorUser.id);
      const db = global.testHelpers.db.getDb();
      
      // This would normally require pallet to exist, but for this test we'll handle the constraint
      try {
        await db.insert(require('../../src/db/schema').ucps).values(testUcp);
      } catch (error) {
        // If foreign key constraint fails, that's expected for this test
      }

      const response = await apiHelper.delete(`/api/users/${operatorUser.id}`, adminToken);
      
      // Should still succeed (soft delete)
      apiHelper.expectSuccess(response, 200);
    });
  });
});