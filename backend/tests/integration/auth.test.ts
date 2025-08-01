import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { testAppFactory } from '../helpers/test-app-factory';
import { TestDataFactory } from '../helpers/test-data-factory';
import { ApiTestHelper } from '../helpers/api-test-helper';

describe('Authentication API Integration Tests', () => {
  let app: Express;
  let apiHelper: ApiTestHelper;

  beforeAll(async () => {
    app = await testAppFactory.createApp();
    apiHelper = new ApiTestHelper(app);
  });

  afterAll(async () => {
    await testAppFactory.cleanup();
  });

  beforeEach(async () => {
    // Reset test data factory counters
    TestDataFactory.resetCounters();
    
    // Clear database and seed fresh data
    await global.testHelpers.db.clearAllTables();
    await global.testHelpers.db.seedTestData();
  });

  describe('GET /api/user', () => {
    it('should return current user info for authenticated requests', async () => {
      // Create and authenticate a test user
      const testUser = TestDataFactory.createUser({ role: 'operator' });
      const db = global.testHelpers.db.getDb();
      
      // Insert test user into database
      await db.insert(require('../../src/db/schema').users).values(testUser);
      
      // Mock authentication (this would normally be done through login)
      const response = await request(app)
        .get('/api/user')
        .set('Cookie', 'sessionId=mock-session-id')
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('username');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('role');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/user')
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('authentication');
    });

    it('should return 401 for invalid session tokens', async () => {
      const response = await request(app)
        .get('/api/user')
        .set('Cookie', 'sessionId=invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/dashboard/stats', () => {
    it('should return dashboard statistics for authenticated users', async () => {
      // Create test data for statistics
      const scenario = TestDataFactory.createCompleteScenario();
      const db = global.testHelpers.db.getDb();
      
      // Insert test data
      await db.insert(require('../../src/db/schema').users).values([
        scenario.users.admin,
        scenario.users.operator,
        scenario.users.manager
      ]);
      await db.insert(require('../../src/db/schema').products).values(scenario.products);
      await db.insert(require('../../src/db/schema').pallets).values(scenario.pallets);

      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Cookie', 'sessionId=mock-session-id')
        .expect(200);

      expect(response.body).toHaveProperty('totalProducts');
      expect(response.body).toHaveProperty('totalPallets');
      expect(response.body).toHaveProperty('activeUCPs');
      expect(response.body).toHaveProperty('pendingTransfers');
      expect(typeof response.body.totalProducts).toBe('number');
      expect(typeof response.body.totalPallets).toBe('number');
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app)
        .get('/api/dashboard/stats')
        .expect(401);
    });

    it('should handle empty database gracefully', async () => {
      // Clear all data
      await global.testHelpers.db.clearAllTables();

      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Cookie', 'sessionId=mock-session-id')
        .expect(200);

      expect(response.body.totalProducts).toBe(0);
      expect(response.body.totalPallets).toBe(0);
      expect(response.body.activeUCPs).toBe(0);
      expect(response.body.pendingTransfers).toBe(0);
    });
  });

  describe('Authentication Flow Integration', () => {
    it('should maintain session state across multiple requests', async () => {
      const testUser = TestDataFactory.createUser({ role: 'admin' });
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').users).values(testUser);

      const sessionCookie = 'sessionId=test-session-123';

      // First request - get user info
      const userResponse = await request(app)
        .get('/api/user')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(userResponse.body).toHaveProperty('id');

      // Second request - get dashboard stats with same session
      const statsResponse = await request(app)
        .get('/api/dashboard/stats')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(statsResponse.body).toHaveProperty('totalProducts');
    });

    it('should handle concurrent authenticated requests properly', async () => {
      const testUser = TestDataFactory.createUser({ role: 'operator' });
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').users).values(testUser);

      const sessionCookie = 'sessionId=concurrent-test-session';

      // Make multiple concurrent requests
      const requests = [
        request(app).get('/api/user').set('Cookie', sessionCookie),
        request(app).get('/api/dashboard/stats').set('Cookie', sessionCookie),
        request(app).get('/api/user').set('Cookie', sessionCookie),
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Simulate database error by disconnecting
      await global.testHelpers.db.cleanup();

      const response = await request(app)
        .get('/api/user')
        .set('Cookie', 'sessionId=test-session')
        .expect(500);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Failed to fetch user');

      // Reconnect database for other tests
      await global.testHelpers.db.initialize();
    });

    it('should handle malformed session cookies', async () => {
      const malformedCookies = [
        'sessionId=',
        'sessionId',
        'invalid-cookie-format',
        'sessionId={}',
        'sessionId=[]',
      ];

      for (const cookie of malformedCookies) {
        const response = await request(app)
          .get('/api/user')
          .set('Cookie', cookie);

        expect(response.status).toBe(401);
      }
    });

    it('should handle extremely long session tokens', async () => {
      const longToken = 'a'.repeat(10000);
      
      const response = await request(app)
        .get('/api/user')
        .set('Cookie', `sessionId=${longToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Performance Tests', () => {
    it('should respond to authentication checks within reasonable time', async () => {
      const testUser = TestDataFactory.createUser();
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').users).values(testUser);

      const startTime = Date.now();
      
      await request(app)
        .get('/api/user')
        .set('Cookie', 'sessionId=performance-test')
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Should respond within 500ms under normal conditions
      expect(responseTime).toBeLessThan(500);
    });

    it('should handle burst authentication requests efficiently', async () => {
      const testUser = TestDataFactory.createUser();
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').users).values(testUser);

      const burstRequests = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .get('/api/user')
          .set('Cookie', `sessionId=burst-test-${i}`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(burstRequests);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      
      // All requests should complete within 2 seconds
      expect(totalTime).toBeLessThan(2000);
      
      // All responses should be valid (either 200 or 401)
      responses.forEach(response => {
        expect([200, 401]).toContain(response.status);
      });
    });
  });
});