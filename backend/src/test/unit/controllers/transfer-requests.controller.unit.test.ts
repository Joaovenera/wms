import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { transferRequestsController } from '../../../controllers/transfer-requests.controller.js';
import { db } from '../../../db.js';
import { transferRequests, transferRequestItems, vehicles, products, users } from '../../../db/schema.js';
import { AuthenticatedRequest } from '../../../middleware/auth.middleware.js';
import logger from '../../../utils/logger.js';
import { createMockRequest, createMockResponse, generateTransferRequestData, generateTransferRequestItemData } from '../../utils/test-helpers.js';

// Mock dependencies
vi.mock('../../../db.js');
vi.mock('../../../utils/logger.js');

const mockDb = vi.mocked(db);
const mockLogger = vi.mocked(logger);

describe('TransferRequestsController', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    
    // Setup authenticated user
    mockReq.user = {
      id: 1,
      email: 'admin@warehouse.com',
      role: 'admin'
    };
  });

  describe('getAllTransferRequests', () => {
    it('should retrieve all transfer requests successfully', async () => {
      const mockTransferRequests = [
        {
          id: 1,
          code: 'TR-20231201-1234',
          status: 'planejamento',
          fromLocation: 'A1',
          toLocation: 'B2',
          totalCubicVolume: '10.5',
          effectiveCapacity: '50.0',
          capacityUsagePercent: '21.0',
          createdAt: new Date('2023-12-01'),
          updatedAt: new Date('2023-12-01'),
          vehicleName: 'Vehicle 1',
          vehicleCode: 'V001',
          createdByName: 'Admin'
        },
        {
          id: 2,
          code: 'TR-20231202-5678',
          status: 'aprovado',
          fromLocation: 'C3',
          toLocation: 'D4',
          totalCubicVolume: '25.0',
          effectiveCapacity: '45.0',
          capacityUsagePercent: '55.6',
          createdAt: new Date('2023-12-02'),
          updatedAt: new Date('2023-12-02'),
          vehicleName: 'Vehicle 2',
          vehicleCode: 'V002',
          createdByName: 'Manager'
        }
      ];

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTransferRequests)
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferRequestsController.getAllTransferRequests(mockReq as Request, mockRes as Response);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockTransferRequests);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Retrieved 2 transfer requests',
        { userId: 1 }
      );
    });

    it('should filter transfer requests by status', async () => {
      mockReq.query = { status: 'aprovado' };
      const mockTransferRequests = [generateTransferRequestData({ status: 'aprovado' })];

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTransferRequests)
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferRequestsController.getAllTransferRequests(mockReq as Request, mockRes as Response);

      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockTransferRequests);
    });

    it('should filter transfer requests by vehicle ID', async () => {
      mockReq.query = { vehicleId: '1' };
      const mockTransferRequests = [generateTransferRequestData({ vehicleId: 1 })];

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTransferRequests)
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferRequestsController.getAllTransferRequests(mockReq as Request, mockRes as Response);

      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockTransferRequests);
    });

    it('should handle errors when fetching transfer requests', async () => {
      const error = new Error('Database error');
      mockDb.select.mockImplementation(() => {
        throw error;
      });

      await transferRequestsController.getAllTransferRequests(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching transfer requests:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Erro interno do servidor' });
    });
  });

  describe('getTransferRequestById', () => {
    it('should retrieve transfer request by ID with items', async () => {
      mockReq.params = { id: '1' };
      
      const mockTransferRequest = {
        id: 1,
        code: 'TR-20231201-1234',
        status: 'planejamento',
        fromLocation: 'A1',
        toLocation: 'B2',
        totalCubicVolume: '10.5',
        effectiveCapacity: '50.0',
        capacityUsagePercent: '21.0',
        notes: 'Test notes',
        createdAt: new Date('2023-12-01'),
        updatedAt: new Date('2023-12-01'),
        vehicleId: 1,
        vehicleName: 'Vehicle 1',
        vehicleCode: 'V001',
        vehicleCubicCapacity: '55.0',
        createdByName: 'Admin'
      };

      const mockItems = [
        {
          id: 1,
          productId: 1,
          quantity: '10',
          unitCubicVolume: '1.0',
          totalCubicVolume: '10.0',
          notes: 'Item notes',
          addedAt: new Date('2023-12-01'),
          productName: 'Product 1',
          productSku: 'SKU001',
          productDimensions: { length: 10, width: 10, height: 10 }
        }
      ];

      // Mock transfer request query
      const mockRequestQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockTransferRequest])
      };

      // Mock items query
      const mockItemsQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockItems)
      };

      mockDb.select.mockReturnValueOnce(mockRequestQuery as any)
                 .mockReturnValueOnce(mockItemsQuery as any);

      await transferRequestsController.getTransferRequestById(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        ...mockTransferRequest,
        items: mockItems
      });
    });

    it('should return 404 when transfer request not found', async () => {
      mockReq.params = { id: '999' };

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferRequestsController.getTransferRequestById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Pedido de transferência não encontrado' });
    });

    it('should handle errors when fetching transfer request by ID', async () => {
      mockReq.params = { id: '1' };
      const error = new Error('Database error');
      
      mockDb.select.mockImplementation(() => {
        throw error;
      });

      await transferRequestsController.getTransferRequestById(mockReq as Request, mockRes as Response);

      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching transfer request by ID:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Erro interno do servidor' });
    });
  });

  describe('createTransferRequest', () => {
    it('should create new transfer request successfully', async () => {
      const requestData = {
        vehicleId: 1,
        fromLocation: 'A1',
        toLocation: 'B2',
        notes: 'Test notes'
      };

      mockReq.body = requestData;

      const mockVehicle = [{ 
        id: 1, 
        cubicCapacity: '55.0',
        name: 'Vehicle 1',
        code: 'V001'
      }];

      const mockNewRequest = {
        id: 1,
        code: 'TR-20231201-1234',
        vehicleId: 1,
        fromLocation: 'A1',
        toLocation: 'B2',
        effectiveCapacity: '49.5',
        notes: 'Test notes',
        createdBy: 1,
        status: 'planejamento',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock vehicle query
      const mockVehicleQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockVehicle)
      };

      mockDb.select.mockReturnValue(mockVehicleQuery as any);

      // Mock insert
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockNewRequest])
      };

      mockDb.insert.mockReturnValue(mockInsert as any);

      await transferRequestsController.createTransferRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockNewRequest);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Transfer request created: ${mockNewRequest.code}`,
        { userId: 1, transferRequestId: 1 }
      );
    });

    it('should return 400 when vehicle not found', async () => {
      mockReq.body = {
        vehicleId: 999,
        fromLocation: 'A1',
        toLocation: 'B2'
      };

      const mockVehicleQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      };

      mockDb.select.mockReturnValue(mockVehicleQuery as any);

      await transferRequestsController.createTransferRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Veículo não encontrado' });
    });

    it('should handle validation errors', async () => {
      mockReq.body = {}; // Missing required fields

      const mockVehicleQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ cubicCapacity: '55.0' }])
      };

      mockDb.select.mockReturnValue(mockVehicleQuery as any);

      await transferRequestsController.createTransferRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Dados inválidos' })
      );
    });
  });

  describe('addItemToRequest', () => {
    it('should add item to transfer request successfully', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = {
        productId: 1,
        quantity: '10',
        notes: 'Item notes'
      };

      const mockRequest = [{
        id: 1,
        status: 'planejamento',
        code: 'TR-20231201-1234'
      }];

      const mockProduct = [{
        id: 1,
        name: 'Product 1',
        dimensions: { length: 10, width: 10, height: 10 }
      }];

      const mockNewItem = {
        id: 1,
        transferRequestId: 1,
        productId: 1,
        quantity: '10',
        unitCubicVolume: '0.001',
        totalCubicVolume: '0.01',
        notes: 'Item notes',
        addedBy: 1
      };

      // Mock queries
      const mockRequestQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockRequest)
      };

      const mockProductQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockProduct)
      };

      mockDb.select.mockReturnValueOnce(mockRequestQuery as any)
                 .mockReturnValueOnce(mockProductQuery as any);

      // Mock insert
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockNewItem])
      };

      mockDb.insert.mockReturnValue(mockInsert as any);

      // Mock recalculate method
      vi.spyOn(transferRequestsController, 'recalculateRequestTotals').mockResolvedValue();

      await transferRequestsController.addItemToRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockNewItem);
      expect(transferRequestsController.recalculateRequestTotals).toHaveBeenCalledWith(1);
    });

    it('should return 404 when transfer request not found', async () => {
      mockReq.params = { id: '999' };
      mockReq.body = { productId: 1, quantity: '10' };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferRequestsController.addItemToRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Pedido de transferência não encontrado' });
    });

    it('should return 400 when request status is not planejamento', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { productId: 1, quantity: '10' };

      const mockRequest = [{
        id: 1,
        status: 'aprovado',
        code: 'TR-20231201-1234'
      }];

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockRequest)
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      await transferRequestsController.addItemToRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: 'Só é possível adicionar itens em pedidos em planejamento' 
      });
    });
  });

  describe('removeItemFromRequest', () => {
    it('should remove item from transfer request successfully', async () => {
      mockReq.params = { id: '1', itemId: '1' };

      const mockRequest = [{
        id: 1,
        status: 'planejamento',
        code: 'TR-20231201-1234'
      }];

      const mockDeletedItem = [{
        id: 1,
        transferRequestId: 1,
        productId: 1
      }];

      // Mock request query
      const mockRequestQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockRequest)
      };

      mockDb.select.mockReturnValue(mockRequestQuery as any);

      // Mock delete
      const mockDelete = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(mockDeletedItem)
      };

      mockDb.delete.mockReturnValue(mockDelete as any);

      // Mock recalculate method
      vi.spyOn(transferRequestsController, 'recalculateRequestTotals').mockResolvedValue();

      await transferRequestsController.removeItemFromRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Item removido com sucesso' });
      expect(transferRequestsController.recalculateRequestTotals).toHaveBeenCalledWith(1);
    });

    it('should return 404 when item not found in request', async () => {
      mockReq.params = { id: '1', itemId: '999' };

      const mockRequest = [{
        id: 1,
        status: 'planejamento',
        code: 'TR-20231201-1234'
      }];

      const mockRequestQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockRequest)
      };

      mockDb.select.mockReturnValue(mockRequestQuery as any);

      const mockDelete = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([])
      };

      mockDb.delete.mockReturnValue(mockDelete as any);

      await transferRequestsController.removeItemFromRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Item não encontrado no pedido' });
    });
  });

  describe('updateRequestStatus', () => {
    it('should update transfer request status successfully', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { status: 'aprovado', notes: 'Approved by admin' };

      const mockUpdatedRequest = {
        id: 1,
        code: 'TR-20231201-1234',
        status: 'aprovado',
        notes: 'Approved by admin',
        updatedAt: new Date(),
        approvedBy: 1,
        approvedAt: new Date()
      };

      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockUpdatedRequest])
      };

      mockDb.update.mockReturnValue(mockUpdate as any);

      await transferRequestsController.updateRequestStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(mockUpdatedRequest);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Transfer request status updated: ${mockUpdatedRequest.code} -> aprovado`,
        { userId: 1, transferRequestId: 1 }
      );
    });

    it('should return 400 for invalid status', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { status: 'invalid_status' };

      await transferRequestsController.updateRequestStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Status inválido' });
    });

    it('should return 404 when transfer request not found', async () => {
      mockReq.params = { id: '999' };
      mockReq.body = { status: 'aprovado' };

      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([])
      };

      mockDb.update.mockReturnValue(mockUpdate as any);

      await transferRequestsController.updateRequestStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Pedido de transferência não encontrado' });
    });
  });

  describe('recalculateRequestTotals', () => {
    it('should recalculate request totals successfully', async () => {
      const mockItems = [
        { totalCubicVolume: '10.0' },
        { totalCubicVolume: '15.5' },
        { totalCubicVolume: '20.0' }
      ];

      const mockRequest = [{
        id: 1,
        effectiveCapacity: '50.0'
      }];

      // Mock items query
      const mockItemsQuery = {
        where: vi.fn().mockResolvedValue(mockItems)
      };

      // Mock request query
      const mockRequestQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockRequest)
      };

      mockDb.select.mockReturnValueOnce(mockItemsQuery as any)
                 .mockReturnValueOnce(mockRequestQuery as any);

      // Mock update
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined)
      };

      mockDb.update.mockReturnValue(mockUpdate as any);

      await transferRequestsController.recalculateRequestTotals(1);

      expect(mockUpdate.set).toHaveBeenCalledWith({
        totalCubicVolume: '45.5',
        capacityUsagePercent: '91',
        updatedAt: expect.any(Date)
      });
    });

    it('should handle errors during recalculation', async () => {
      const error = new Error('Database error');
      mockDb.select.mockImplementation(() => {
        throw error;
      });

      await transferRequestsController.recalculateRequestTotals(1);

      expect(mockLogger.error).toHaveBeenCalledWith('Error recalculating request totals:', error);
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle large number of transfer requests', async () => {
      const mockTransferRequests = Array.from({ length: 1000 }, (_, i) => 
        generateTransferRequestData({ id: i + 1 })
      );

      const mockQuery = {
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockTransferRequests)
      };

      mockDb.select.mockReturnValue(mockQuery as any);

      const startTime = performance.now();
      await transferRequestsController.getAllTransferRequests(mockReq as Request, mockRes as Response);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(mockRes.json).toHaveBeenCalledWith(mockTransferRequests);
    });

    it('should handle cubic volume calculation with null dimensions', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = {
        productId: 1,
        quantity: '10',
        notes: 'Item notes'
      };

      const mockRequest = [{
        id: 1,
        status: 'planejamento',
        code: 'TR-20231201-1234'
      }];

      const mockProduct = [{
        id: 1,
        name: 'Product 1',
        dimensions: null // No dimensions
      }];

      const mockRequestQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockRequest)
      };

      const mockProductQuery = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockProduct)
      };

      mockDb.select.mockReturnValueOnce(mockRequestQuery as any)
                 .mockReturnValueOnce(mockProductQuery as any);

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 1 }])
      };

      mockDb.insert.mockReturnValue(mockInsert as any);

      vi.spyOn(transferRequestsController, 'recalculateRequestTotals').mockResolvedValue();

      await transferRequestsController.addItemToRequest(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockInsert.values).toHaveBeenCalledWith(
        expect.objectContaining({
          unitCubicVolume: '0',
          totalCubicVolume: '0'
        })
      );
    });

    it('should handle concurrent status updates', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { status: 'aprovado' };

      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 1, code: 'TR-20231201-1234', status: 'aprovado' }])
      };

      mockDb.update.mockReturnValue(mockUpdate as any);

      // Simulate concurrent updates
      const promises = Array.from({ length: 5 }, () => 
        transferRequestsController.updateRequestStatus(mockReq as AuthenticatedRequest, mockRes as Response)
      );

      await Promise.all(promises);

      expect(mockDb.update).toHaveBeenCalledTimes(5);
    });
  });
});