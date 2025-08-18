import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '../db.js';
import { 
  loadingExecutions, 
  loadingItems, 
  transferRequests, 
  transferRequestItems,
  products,
  users 
} from '../db/schema.js';
import { eq } from 'drizzle-orm';

describe('Loading Executions Fix Validation', () => {
  let authToken: string;
  let testUserId: number;
  let testTransferRequestId: number;
  let testLoadingExecutionId: number;
  let testProductId1: number;
  let testProductId2: number;

  beforeEach(async () => {
    // Clean up existing test data
    await db.delete(loadingItems);
    await db.delete(loadingExecutions);
    await db.delete(transferRequestItems);
    await db.delete(transferRequests);
    await db.delete(products);
    await db.delete(users);

    // Create test user
    const [user] = await db.insert(users).values({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'hashedpassword',
      role: 'operador'
    }).returning();
    testUserId = user.id;

    // Create test products
    const [product1] = await db.insert(products).values({
      name: 'Test Product 1',
      sku: 'TEST001',
      description: 'Test product 1'
    }).returning();
    testProductId1 = product1.id;

    const [product2] = await db.insert(products).values({
      name: 'Test Product 2', 
      sku: 'TEST002',
      description: 'Test product 2'
    }).returning();
    testProductId2 = product2.id;

    // Create test transfer request
    const [transferRequest] = await db.insert(transferRequests).values({
      code: 'TR-TEST-001',
      status: 'aprovado',
      requesterId: testUserId,
      originLocation: 'Warehouse A',
      destinationLocation: 'Warehouse B',
      observations: 'Test transfer'
    }).returning();
    testTransferRequestId = transferRequest.id;

    // Create transfer request items
    await db.insert(transferRequestItems).values([
      {
        transferRequestId: testTransferRequestId,
        productId: testProductId1,
        quantity: '10.00'
      },
      {
        transferRequestId: testTransferRequestId,
        productId: testProductId2,
        quantity: '5.00'
      }
    ]);

    // Mock authentication token
    authToken = 'mock-jwt-token';
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(loadingItems);
    await db.delete(loadingExecutions);
    await db.delete(transferRequestItems);
    await db.delete(transferRequests);
    await db.delete(products);
    await db.delete(users);
  });

  describe('Quantity Update Logic Fix', () => {
    beforeEach(async () => {
      // Start loading execution
      const response = await request(app)
        .post('/api/loading-executions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transferRequestId: testTransferRequestId,
          observations: 'Test execution'
        });

      testLoadingExecutionId = response.body.id;
    });

    it('should set absolute quantity in scan mode (not additive)', async () => {
      // First scan - should set quantity to 3
      const firstScanResponse = await request(app)
        .post(`/api/loading-executions/${testLoadingExecutionId}/scan-item`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId1,
          quantity: '3.00',
          scannedCode: 'TEST001',
          isEdit: false
        });

      expect(firstScanResponse.status).toBe(200);
      expect(firstScanResponse.body.loadedQuantity).toBe('3');
      expect(firstScanResponse.body.notLoadedQuantity).toBe('7');

      // Second scan - should set quantity to 7 (not add to previous 3)
      const secondScanResponse = await request(app)
        .post(`/api/loading-executions/${testLoadingExecutionId}/scan-item`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId1,
          quantity: '7.00',
          scannedCode: 'TEST001',
          isEdit: false
        });

      expect(secondScanResponse.status).toBe(200);
      expect(secondScanResponse.body.loadedQuantity).toBe('7'); // Should be 7, not 10
      expect(secondScanResponse.body.notLoadedQuantity).toBe('3'); // Should be 3, not -3
    });

    it('should handle edit mode with absolute quantity', async () => {
      // Initial scan
      await request(app)
        .post(`/api/loading-executions/${testLoadingExecutionId}/scan-item`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId1,
          quantity: '5.00',
          scannedCode: 'TEST001',
          isEdit: false
        });

      // Edit with new quantity - should replace, not add
      const editResponse = await request(app)
        .post(`/api/loading-executions/${testLoadingExecutionId}/scan-item`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId1,
          quantity: '8.00',
          scannedCode: 'TEST001',
          isEdit: true
        });

      expect(editResponse.status).toBe(200);
      expect(editResponse.body.loadedQuantity).toBe('8');
      expect(editResponse.body.notLoadedQuantity).toBe('2');
    });

    it('should prevent quantity exceeding requested amount', async () => {
      const response = await request(app)
        .post(`/api/loading-executions/${testLoadingExecutionId}/scan-item`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId1,
          quantity: '15.00', // Exceeds requested 10.00
          scannedCode: 'TEST001',
          isEdit: false
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Quantidade excede o solicitado');
      expect(response.body.requested).toBe(10);
      expect(response.body.attempting).toBe(15);
    });

    it('should handle multiple product scans independently', async () => {
      // Scan product 1
      const product1Response = await request(app)
        .post(`/api/loading-executions/${testLoadingExecutionId}/scan-item`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId1,
          quantity: '6.00',
          scannedCode: 'TEST001',
          isEdit: false
        });

      expect(product1Response.status).toBe(200);
      expect(product1Response.body.loadedQuantity).toBe('6');

      // Scan product 2
      const product2Response = await request(app)
        .post(`/api/loading-executions/${testLoadingExecutionId}/scan-item`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId2,
          quantity: '3.00',
          scannedCode: 'TEST002',
          isEdit: false
        });

      expect(product2Response.status).toBe(200);
      expect(product2Response.body.loadedQuantity).toBe('3');

      // Verify products don't interfere with each other
      const executionResponse = await request(app)
        .get(`/api/loading-executions/${testLoadingExecutionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const items = executionResponse.body.items;
      const item1 = items.find((item: any) => item.productId === testProductId1);
      const item2 = items.find((item: any) => item.productId === testProductId2);

      expect(item1.loadedQuantity).toBe('6');
      expect(item1.notLoadedQuantity).toBe('4');
      expect(item2.loadedQuantity).toBe('3');
      expect(item2.notLoadedQuantity).toBe('2');
    });

    it('should handle zero quantity scans', async () => {
      const response = await request(app)
        .post(`/api/loading-executions/${testLoadingExecutionId}/scan-item`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId1,
          quantity: '0.00',
          scannedCode: 'TEST001',
          isEdit: false
        });

      expect(response.status).toBe(200);
      expect(response.body.loadedQuantity).toBe('0');
      expect(response.body.notLoadedQuantity).toBe('10');
    });

    it('should handle decimal quantities correctly', async () => {
      const response = await request(app)
        .post(`/api/loading-executions/${testLoadingExecutionId}/scan-item`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId1,
          quantity: '7.5',
          scannedCode: 'TEST001',
          isEdit: false
        });

      expect(response.status).toBe(200);
      expect(response.body.loadedQuantity).toBe('7.5');
      expect(response.body.notLoadedQuantity).toBe('2.5');
    });
  });

  describe('Database Consistency Validation', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post('/api/loading-executions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transferRequestId: testTransferRequestId,
          observations: 'Test execution'
        });

      testLoadingExecutionId = response.body.id;
    });

    it('should maintain database consistency after multiple scans', async () => {
      // Perform multiple scans
      await request(app)
        .post(`/api/loading-executions/${testLoadingExecutionId}/scan-item`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId1,
          quantity: '3.00',
          scannedCode: 'TEST001'
        });

      await request(app)
        .post(`/api/loading-executions/${testLoadingExecutionId}/scan-item`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId1,
          quantity: '8.00',
          scannedCode: 'TEST001'
        });

      // Verify database state
      const [loadingItem] = await db.select()
        .from(loadingItems)
        .where(eq(loadingItems.productId, testProductId1))
        .limit(1);

      expect(loadingItem.loadedQuantity).toBe('8');
      expect(loadingItem.notLoadedQuantity).toBe('2');
      expect(loadingItem.requestedQuantity).toBe('10.00');
    });

    it('should preserve timestamps and user references', async () => {
      const response = await request(app)
        .post(`/api/loading-executions/${testLoadingExecutionId}/scan-item`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId1,
          quantity: '5.00',
          scannedCode: 'TEST001'
        });

      expect(response.body.scannedAt).toBeTruthy();
      expect(response.body.confirmedAt).toBeTruthy();

      // Verify in database
      const [loadingItem] = await db.select()
        .from(loadingItems)
        .where(eq(loadingItems.productId, testProductId1))
        .limit(1);

      expect(loadingItem.scannedAt).toBeTruthy();
      expect(loadingItem.confirmedAt).toBeTruthy();
      expect(loadingItem.confirmedBy).toBe(testUserId);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent loading execution', async () => {
      const response = await request(app)
        .post('/api/loading-executions/99999/scan-item')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId1,
          quantity: '5.00',
          scannedCode: 'TEST001'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Execução de carregamento não encontrada');
    });

    it('should handle non-existent product in loading execution', async () => {
      const response = await request(app)
        .post('/api/loading-executions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transferRequestId: testTransferRequestId,
          observations: 'Test execution'
        });

      const loadingExecutionId = response.body.id;

      const scanResponse = await request(app)
        .post(`/api/loading-executions/${loadingExecutionId}/scan-item`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: 99999, // Non-existent product
          quantity: '5.00',
          scannedCode: 'NONEXISTENT'
        });

      expect(scanResponse.status).toBe(400);
      expect(scanResponse.body.error).toBe('Item não encontrado na lista de carregamento');
    });

    it('should handle invalid quantity formats', async () => {
      const response = await request(app)
        .post('/api/loading-executions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transferRequestId: testTransferRequestId,
          observations: 'Test execution'
        });

      const loadingExecutionId = response.body.id;

      const scanResponse = await request(app)
        .post(`/api/loading-executions/${loadingExecutionId}/scan-item`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId1,
          quantity: 'invalid',
          scannedCode: 'TEST001'
        });

      // Should handle parsing error gracefully
      expect(scanResponse.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle finished loading execution', async () => {
      // Create and finish execution
      const createResponse = await request(app)
        .post('/api/loading-executions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transferRequestId: testTransferRequestId,
          observations: 'Test execution'
        });

      const loadingExecutionId = createResponse.body.id;

      // Mark execution as finished
      await db.update(loadingExecutions)
        .set({ status: 'finalizado' })
        .where(eq(loadingExecutions.id, loadingExecutionId));

      const scanResponse = await request(app)
        .post(`/api/loading-executions/${loadingExecutionId}/scan-item`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProductId1,
          quantity: '5.00',
          scannedCode: 'TEST001'
        });

      expect(scanResponse.status).toBe(400);
      expect(scanResponse.body.error).toBe('Execução não está em andamento');
    });
  });
});