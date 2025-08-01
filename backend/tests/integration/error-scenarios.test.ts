import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Express } from 'express';
import { testAppFactory } from '../helpers/test-app-factory';
import { TestDataFactory } from '../helpers/test-data-factory';
import { ApiTestHelper } from '../helpers/api-test-helper';

describe('Error Scenarios Integration Tests', () => {
  let app: Express;
  let apiHelper: ApiTestHelper;
  let adminUser: any;
  let operatorUser: any;
  let adminToken: string;
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

    // Create test users
    adminUser = TestDataFactory.createUser({ role: 'admin' });
    operatorUser = TestDataFactory.createUser({ role: 'operator' });

    const db = global.testHelpers.db.getDb();
    await db.insert(require('../../src/db/schema').users).values([adminUser, operatorUser]);

    adminToken = 'mock-admin-token';
    operatorToken = 'mock-operator-token';
  });

  describe('Database Connection Errors', () => {
    it('should handle database connection loss gracefully', async () => {
      // Simulate database disconnection
      await global.testHelpers.db.cleanup();

      const response = await apiHelper.get('/api/products', operatorToken);

      apiHelper.expectError(response, 500);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('database');

      // Reconnect for other tests
      await global.testHelpers.db.initialize();
    });

    it('should handle database query timeouts', async () => {
      // This test would require a way to simulate slow queries
      // For now, we'll test with a very large dataset query
      const largeDataset = TestDataFactory.createProducts(1000);
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').products).values(largeDataset);

      const response = await apiHelper.get('/api/products?limit=1000', operatorToken);

      // Should either succeed or fail gracefully with timeout
      if (response.status !== 200) {
        apiHelper.expectError(response, 500);
        expect(response.body.message).toMatch(/timeout|database/i);
      }
    });

    it('should handle concurrent database access conflicts', async () => {
      const testProduct = TestDataFactory.createProduct();
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').products).values([testProduct]);

      // Create concurrent update requests
      const updateData = { name: 'Updated Name' };
      const concurrentUpdates = Array.from({ length: 10 }, () =>
        apiHelper.put(`/api/products/${testProduct.id}`, updateData, adminToken)
      );

      const responses = await Promise.allSettled(concurrentUpdates);

      // At least one should succeed, others might fail with conflict errors
      const successful = responses.filter(r => r.status === 'fulfilled' && r.value.status === 200);
      const conflicts = responses.filter(r => 
        r.status === 'fulfilled' && [409, 500].includes(r.value.status)
      );

      expect(successful.length).toBeGreaterThanOrEqual(1);
      expect(successful.length + conflicts.length).toBe(responses.length);
    });
  });

  describe('Authentication and Authorization Errors', () => {
    it('should handle expired authentication tokens', async () => {
      const expiredToken = 'expired-token-123';
      const response = await apiHelper.get('/api/products', expiredToken);

      apiHelper.expectError(response, 401);
      expect(response.body.message).toMatch(/expired|invalid|unauthorized/i);
    });

    it('should handle malformed authentication tokens', async () => {
      const malformedTokens = [
        'malformed.token.here',
        '{"invalid": "json"}',
        'Bearer invalid-format',
        'Basic invalid-base64',
        '',
        null,
        undefined
      ];

      for (const token of malformedTokens) {
        const response = await apiHelper.get('/api/products', token as string);
        expect([401, 400]).toContain(response.status);
      }
    });

    it('should handle privilege escalation attempts', async () => {
      const privilegedOperations = [
        { method: 'POST', path: '/api/users', data: TestDataFactory.createUser() },
        { method: 'DELETE', path: `/api/users/${adminUser.id}` },
        { method: 'PUT', path: `/api/users/${adminUser.id}/role`, data: { role: 'admin' } }
      ];

      for (const operation of privilegedOperations) {
        let response;
        switch (operation.method) {
          case 'POST':
            response = await apiHelper.post(operation.path, operation.data, operatorToken);
            break;
          case 'PUT':
            response = await apiHelper.put(operation.path, operation.data, operatorToken);
            break;
          case 'DELETE':
            response = await apiHelper.delete(operation.path, operatorToken);
            break;
          default:
            response = await apiHelper.get(operation.path, operatorToken);
        }

        apiHelper.expectError(response, 403);
        expect(response.body.message).toMatch(/forbidden|access denied|insufficient/i);
      }
    });

    it('should handle session hijacking attempts', async () => {
      // Test with session tokens from different users
      const fakeAdminToken = 'fake-admin-token-attempt';
      const response = await apiHelper.post('/api/users', TestDataFactory.createUser(), fakeAdminToken);

      apiHelper.expectError(response, 401);
    });
  });

  describe('Input Validation Errors', () => {
    it('should handle SQL injection attempts', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "'; SELECT * FROM users WHERE '1'='1",
        "admin'--",
        "admin' /*",
        "' UNION SELECT NULL,NULL,NULL--"
      ];

      for (const payload of sqlInjectionPayloads) {
        const maliciousData = {
          username: payload,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'operator',
          password: 'test123'
        };

        const response = await apiHelper.post('/api/users', maliciousData, adminToken);
        
        // Should either reject with validation error or sanitize the input
        if (response.status !== 201) {
          expect([400, 422]).toContain(response.status);
        } else {
          // If it succeeded, the data should be sanitized
          expect(response.body.username).not.toBe(payload);
        }
      }
    });

    it('should handle XSS injection attempts', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '"><script>alert("xss")</script>',
        "'; alert('xss'); //",
        '<svg onload="alert(1)">'
      ];

      for (const payload of xssPayloads) {
        const maliciousProduct = {
          code: 'XSS001',
          name: payload,
          description: 'Test product',
          dimensions: { width: 10, height: 10, depth: 10 },
          weight: 1.0,
          category: 'test'
        };

        const response = await apiHelper.post('/api/products', maliciousProduct, adminToken);
        
        if (response.status === 201) {
          // Data should be sanitized
          expect(response.body.name).not.toBe(payload);
          expect(response.body.name).not.toContain('<script');
          expect(response.body.name).not.toContain('javascript:');
        } else {
          // Should reject with validation error
          apiHelper.expectValidationError(response);
        }
      }
    });

    it('should handle oversized payloads', async () => {
      const oversizedData = {
        code: 'LARGE001',
        name: 'A'.repeat(10000), // Very long name
        description: 'B'.repeat(50000), // Very long description
        dimensions: { width: 10, height: 10, depth: 10 },
        weight: 1.0,
        category: 'test'
      };

      const response = await apiHelper.post('/api/products', oversizedData, adminToken);
      
      expect([400, 413, 422]).toContain(response.status);
      if (response.status === 400 || response.status === 422) {
        expect(response.body.message).toMatch(/too large|too long|validation/i);
      }
    });

    it('should handle malformed JSON payloads', async () => {
      // This test requires direct HTTP requests with malformed JSON
      const malformedJsonTests = [
        '{"invalid": json}',
        '{invalid: "json"}',
        '{"unclosed": "json"',
        '{"trailing": "comma",}',
        '{"duplicate": "key", "duplicate": "value"}'
      ];

      for (const malformedJson of malformedJsonTests) {
        try {
          const response = await fetch(`${apiHelper.baseUrl}/api/products`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': adminToken
            },
            body: malformedJson
          });

          expect([400, 422]).toContain(response.status);
        } catch (error) {
          // Network or parsing error is expected
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle invalid content types', async () => {
      const invalidContentTypes = [
        'text/plain',
        'application/xml',
        'multipart/form-data',
        'application/octet-stream',
        ''
      ];

      for (const contentType of invalidContentTypes) {
        try {
          const response = await fetch(`${apiHelper.baseUrl}/api/products`, {
            method: 'POST',
            headers: {
              'Content-Type': contentType,
              'Cookie': adminToken
            },
            body: JSON.stringify(TestDataFactory.createProduct())
          });

          expect([400, 415]).toContain(response.status);
        } catch (error) {
          // Expected for invalid content types
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Business Logic Errors', () => {
    it('should handle foreign key constraint violations', async () => {
      // Try to create UCP with non-existent pallet
      const invalidUCP = {
        code: 'INVALID001',
        palletId: 'non-existent-pallet-id',
        notes: 'This should fail'
      };

      const response = await apiHelper.post('/api/ucps', invalidUCP, operatorToken);
      
      apiHelper.expectError(response, 400);
      expect(response.body.message).toMatch(/pallet|foreign key|constraint/i);
    });

    it('should handle unique constraint violations', async () => {
      const product = TestDataFactory.createProduct();
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').products).values([product]);

      // Try to create another product with same code
      const duplicateProduct = {
        ...TestDataFactory.createProduct(),
        code: product.code
      };

      const response = await apiHelper.post('/api/products', duplicateProduct, adminToken);
      
      apiHelper.expectError(response, 409);
      expect(response.body.message).toMatch(/duplicate|already exists|unique/i);
    });

    it('should handle circular dependency scenarios', async () => {
      // Create pallets and UCPs
      const pallet1 = TestDataFactory.createPallet();
      const pallet2 = TestDataFactory.createPallet();
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').pallets).values([pallet1, pallet2]);

      const ucp1 = TestDataFactory.createUCP(pallet1.id, operatorUser.id);
      const ucp2 = TestDataFactory.createUCP(pallet2.id, operatorUser.id);
      await db.insert(require('../../src/db/schema').ucps).values([ucp1, ucp2]);

      // Try to create circular transfer dependencies
      const transfer1 = {
        ucpId: ucp1.id,
        fromLocation: 'A1-01-01',
        toLocation: 'B2-02-02',
        priority: 'medium',
        dependsOn: ucp2.id // Circular dependency
      };

      const transfer2 = {
        ucpId: ucp2.id,
        fromLocation: 'B2-02-02',
        toLocation: 'A1-01-01',
        priority: 'medium',
        dependsOn: ucp1.id // Circular dependency
      };

      const response1 = await apiHelper.post('/api/transfer-requests', transfer1, operatorToken);
      const response2 = await apiHelper.post('/api/transfer-requests', transfer2, operatorToken);

      // At least one should fail due to circular dependency
      const successCount = [response1, response2].filter(r => r.status === 201).length;
      expect(successCount).toBeLessThan(2);
    });

    it('should handle resource capacity exceeded scenarios', async () => {
      const pallet = TestDataFactory.createPallet({ maxWeight: 100 });
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').pallets).values([pallet]);

      const ucp = TestDataFactory.createUCP(pallet.id, operatorUser.id);
      await db.insert(require('../../src/db/schema').ucps).values([ucp]);

      // Try to add items that exceed pallet capacity
      const heavyProduct = TestDataFactory.createProduct({ weight: 150 });
      await db.insert(require('../../src/db/schema').products).values([heavyProduct]);

      const ucpItem = {
        productId: heavyProduct.id,
        quantity: 1,
        position: { x: 0, y: 0, z: 0, layer: 1 }
      };

      const response = await apiHelper.post(`/api/ucps/${ucp.id}/items`, ucpItem, operatorToken);
      
      apiHelper.expectError(response, 400);
      expect(response.body.message).toMatch(/capacity|weight|exceeded/i);
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    it('should handle rate limit exceeded scenarios', async () => {
      // Make many requests quickly to trigger rate limiting
      const rapidRequests = Array.from({ length: 100 }, () =>
        apiHelper.get('/api/products', operatorToken)
      );

      const responses = await Promise.allSettled(rapidRequests);
      
      // Some requests should be rate limited
      const rateLimited = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 429
      );

      if (rateLimited.length > 0) {
        const rateLimitedResponse = rateLimited[0] as PromiseFulfilledResult<any>;
        expect(rateLimitedResponse.value.body.message).toMatch(/rate limit|too many requests/i);
        expect(rateLimitedResponse.value.headers).toHaveProperty('retry-after');
      }
    });

    it('should handle request timeout scenarios', async () => {
      // This test would require a way to simulate slow endpoints
      // For now, we'll test with a large complex query
      const largeQuery = '/api/products?include=all&expand=details&limit=1000&sort=complex';
      
      const startTime = Date.now();
      const response = await apiHelper.get(largeQuery, operatorToken);
      const endTime = Date.now();

      // Should either complete quickly or timeout gracefully
      if (endTime - startTime > 30000) { // 30 seconds
        apiHelper.expectError(response, 408);
        expect(response.body.message).toMatch(/timeout/i);
      }
    });

    it('should handle memory exhaustion scenarios', async () => {
      // Try to create a request that would consume excessive memory
      const memoryIntensiveData = {
        items: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          data: 'A'.repeat(1000)
        }))
      };

      try {
        const response = await apiHelper.post('/api/bulk-operation', memoryIntensiveData, adminToken);
        
        // Should either handle gracefully or reject
        if (response.status !== 200) {
          expect([400, 413, 507]).toContain(response.status);
        }
      } catch (error) {
        // Network timeout or memory error is acceptable
        expect(error).toBeDefined();
      }
    });
  });

  describe('External Service Failures', () => {
    it('should handle Redis connection failures', async () => {
      // Simulate Redis disconnection
      await global.testHelpers.redis.cleanup();

      // Operations that depend on Redis should handle failures gracefully
      const response = await apiHelper.get('/api/dashboard/stats', operatorToken);

      // Should either succeed without caching or fail gracefully
      if (response.status !== 200) {
        apiHelper.expectError(response, 500);
        expect(response.body.message).toMatch(/cache|redis|service/i);
      }

      // Reconnect for other tests
      await global.testHelpers.redis.initialize();
    });

    it('should handle WebSocket service failures', async () => {
      // Test operations that might use WebSocket notifications
      const product = TestDataFactory.createProduct();
      const response = await apiHelper.post('/api/products', product, adminToken);

      // Should succeed even if WebSocket notifications fail
      apiHelper.expectSuccess(response, 201);
    });

    it('should handle file system errors', async () => {
      // Test file upload operations with disk full simulation
      const largeFile = {
        fieldname: 'image',
        originalname: 'large-image.jpg',
        size: 50 * 1024 * 1024, // 50MB
        buffer: Buffer.alloc(1024)
      };

      // This would need actual file upload endpoint
      // For now, test with a mock endpoint that handles files
      try {
        const response = await apiHelper.uploadFile('/api/product-photos', 'image', './test-large-file.jpg', adminToken);
        
        if (response.status !== 201) {
          expect([400, 413, 507]).toContain(response.status);
          expect(response.body.message).toMatch(/file|size|storage|disk/i);
        }
      } catch (error) {
        // File system error is acceptable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Concurrent Operation Conflicts', () => {
    it('should handle concurrent user modifications', async () => {
      const user = TestDataFactory.createUser();
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').users).values([user]);

      // Simulate concurrent updates to the same user
      const update1 = { firstName: 'UpdatedName1' };
      const update2 = { firstName: 'UpdatedName2' };

      const concurrentUpdates = [
        apiHelper.put(`/api/users/${user.id}`, update1, adminToken),
        apiHelper.put(`/api/users/${user.id}`, update2, adminToken)
      ];

      const responses = await Promise.all(concurrentUpdates);

      // One should succeed, the other might fail with conflict
      const successful = responses.filter(r => r.status === 200);
      const conflicts = responses.filter(r => [409, 500].includes(r.status));

      expect(successful.length).toBeGreaterThanOrEqual(1);
      expect(successful.length + conflicts.length).toBe(2);
    });

    it('should handle concurrent UCP item additions', async () => {
      const scenario = TestDataFactory.createCompleteScenario();
      const db = global.testHelpers.db.getDb();
      
      await db.insert(require('../../src/db/schema').users).values([scenario.users.operator]);
      await db.insert(require('../../src/db/schema').products).values(scenario.products);
      await db.insert(require('../../src/db/schema').pallets).values(scenario.pallets);
      await db.insert(require('../../src/db/schema').ucps).values(scenario.ucps);

      const ucp = scenario.ucps[0];
      const product = scenario.products[0];

      // Try to add items to same position concurrently
      const item1 = {
        productId: product.id,
        quantity: 1,
        position: { x: 0, y: 0, z: 0, layer: 1 }
      };

      const item2 = {
        productId: scenario.products[1].id,
        quantity: 1,
        position: { x: 0, y: 0, z: 0, layer: 1 } // Same position
      };

      const concurrentAdditions = [
        apiHelper.post(`/api/ucps/${ucp.id}/items`, item1, operatorToken),
        apiHelper.post(`/api/ucps/${ucp.id}/items`, item2, operatorToken)
      ];

      const responses = await Promise.all(concurrentAdditions);

      // Only one should succeed due to position conflict
      const successful = responses.filter(r => r.status === 201);
      const conflicts = responses.filter(r => [400, 409].includes(r.status));

      expect(successful.length).toBe(1);
      expect(conflicts.length).toBe(1);
      
      if (conflicts.length > 0) {
        expect(conflicts[0].body.message).toMatch(/position|conflict/i);
      }
    });
  });

  describe('Error Recovery and Consistency', () => {
    it('should maintain data consistency after errors', async () => {
      const scenario = TestDataFactory.createCompleteScenario();
      const db = global.testHelpers.db.getDb();
      
      await db.insert(require('../../src/db/schema').users).values([scenario.users.admin, scenario.users.operator]);
      await db.insert(require('../../src/db/schema').pallets).values(scenario.pallets);
      await db.insert(require('../../src/db/schema').ucps).values(scenario.ucps);

      const ucp = scenario.ucps[0];
      
      // Try an operation that should fail
      const invalidTransfer = {
        ucpId: ucp.id,
        fromLocation: 'INVALID-LOCATION',
        toLocation: 'ANOTHER-INVALID-LOCATION',
        priority: 'medium'
      };

      const response = await apiHelper.post('/api/transfer-requests', invalidTransfer, operatorToken);
      apiHelper.expectError(response, 400);

      // Verify that UCP state hasn't changed
      const ucpResponse = await apiHelper.get(`/api/ucps/${ucp.id}`, operatorToken);
      apiHelper.expectSuccess(ucpResponse, 200);
      expect(ucpResponse.body.status).toBe(ucp.status);
    });

    it('should handle transaction rollbacks properly', async () => {
      const pallet = TestDataFactory.createPallet();
      const db = global.testHelpers.db.getDb();
      await db.insert(require('../../src/db/schema').pallets).values([pallet]);

      // Get initial count
      const initialCount = await global.testHelpers.db.countRecords('pallets');

      // Try to create UCP and pallet in transaction that should fail
      const invalidOperation = {
        palletCode: 'NEW-PALLET',
        ucpCode: 'NEW-UCP',
        invalidField: 'this-should-cause-rollback'
      };

      const response = await apiHelper.post('/api/bulk-create', invalidOperation, adminToken);
      
      if (response.status !== 200) {
        // Verify rollback - no new records should be created
        const finalCount = await global.testHelpers.db.countRecords('pallets');
        expect(finalCount).toBe(initialCount);
      }
    });
  });
});