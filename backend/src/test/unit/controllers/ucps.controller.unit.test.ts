import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { UCPsController } from '../../../controllers/ucps.controller';
import { createMockRequest, createMockResponse, generateMockUCP } from '../../utils/test-helpers';

// Mock dependencies
vi.mock('../../../storage');
vi.mock('../../../utils/logger');
vi.mock('../../../config/redis');

describe('UCPsController Unit Tests', () => {
  let controller: UCPsController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;

  const mockStorage = {
    getUCPs: vi.fn(),
    getUCP: vi.fn(),
    createUCP: vi.fn(),
    updateUCP: vi.fn(),
    deleteUCP: vi.fn(),
    getUCPItems: vi.fn(),
    addUCPItem: vi.fn(),
    updateUCPItem: vi.fn(),
    removeUCPItem: vi.fn(),
    getUCPHistory: vi.fn(),
    calculateUCPMetrics: vi.fn(),
  };

  beforeEach(() => {
    controller = new UCPsController();
    
    // Setup response mocks
    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnValue({ json: mockJson, send: vi.fn() });
    
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
    mockResponse.json = mockJson;
    mockResponse.status = mockStatus;

    // Mock storage methods
    Object.keys(mockStorage).forEach(key => {
      vi.doMock('../../../storage', () => ({
        [key]: mockStorage[key as keyof typeof mockStorage],
      }));
    });
    
    vi.clearAllMocks();
  });

  describe('getUCPs', () => {
    it('should return all UCPs when no filters applied', async () => {
      const mockUCPs = [
        generateMockUCP(),
        generateMockUCP(),
        generateMockUCP(),
      ];
      
      mockStorage.getUCPs.mockResolvedValue(mockUCPs);
      
      await controller.getUCPs(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.getUCPs).toHaveBeenCalledWith({});
      expect(mockJson).toHaveBeenCalledWith(mockUCPs);
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should filter UCPs by status', async () => {
      const activeUCPs = [
        generateMockUCP({ status: 'ativo' }),
        generateMockUCP({ status: 'ativo' }),
      ];
      
      mockStorage.getUCPs.mockResolvedValue(activeUCPs);
      mockRequest.query = { status: 'ativo' };
      
      await controller.getUCPs(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.getUCPs).toHaveBeenCalledWith({ status: 'ativo' });
      expect(mockJson).toHaveBeenCalledWith(activeUCPs);
    });

    it('should filter UCPs by pallet ID', async () => {
      const palletUCPs = [generateMockUCP({ palletId: 123 })];
      
      mockStorage.getUCPs.mockResolvedValue(palletUCPs);
      mockRequest.query = { palletId: '123' };
      
      await controller.getUCPs(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.getUCPs).toHaveBeenCalledWith({ palletId: 123 });
      expect(mockJson).toHaveBeenCalledWith(palletUCPs);
    });

    it('should include items when requested', async () => {
      const ucpsWithItems = [
        { 
          ...generateMockUCP(),
          items: [
            { id: 1, productId: 1, quantity: 10, packagingId: 1 },
            { id: 2, productId: 2, quantity: 5, packagingId: 2 },
          ]
        }
      ];
      
      mockStorage.getUCPs.mockResolvedValue(ucpsWithItems);
      mockRequest.query = { includeItems: 'true' };
      
      await controller.getUCPs(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.getUCPs).toHaveBeenCalledWith({ includeItems: true });
      expect(mockJson).toHaveBeenCalledWith(ucpsWithItems);
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database connection failed');
      mockStorage.getUCPs.mockRejectedValue(error);
      
      await controller.getUCPs(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({ 
        message: 'Failed to fetch UCPs',
        error: 'Database connection failed'
      });
    });
  });

  describe('getUCPById', () => {
    it('should return UCP by valid ID', async () => {
      const mockUCP = generateMockUCP({ id: 123 });
      
      mockStorage.getUCP.mockResolvedValue(mockUCP);
      mockRequest.params = { id: '123' };
      
      await controller.getUCPById(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.getUCP).toHaveBeenCalledWith(123, false);
      expect(mockJson).toHaveBeenCalledWith(mockUCP);
    });

    it('should return UCP with items when requested', async () => {
      const ucpWithItems = {
        ...generateMockUCP({ id: 123 }),
        items: [
          { id: 1, productId: 1, quantity: 10 },
          { id: 2, productId: 2, quantity: 5 },
        ]
      };
      
      mockStorage.getUCP.mockResolvedValue(ucpWithItems);
      mockRequest.params = { id: '123' };
      mockRequest.query = { includeItems: 'true' };
      
      await controller.getUCPById(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.getUCP).toHaveBeenCalledWith(123, true);
      expect(mockJson).toHaveBeenCalledWith(ucpWithItems);
    });

    it('should return 404 when UCP not found', async () => {
      mockStorage.getUCP.mockResolvedValue(null);
      mockRequest.params = { id: '999' };
      
      await controller.getUCPById(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ message: 'UCP not found' });
    });

    it('should handle invalid ID parameter', async () => {
      mockRequest.params = { id: 'invalid' };
      
      await controller.getUCPById(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Invalid UCP ID' });
    });
  });

  describe('createUCP', () => {
    it('should create UCP with valid data', async () => {
      const ucpData = {
        palletId: 1,
        code: 'UCP001',
        status: 'ativo',
      };
      
      const createdUCP = { id: 1, ...ucpData, createdBy: 1 };
      
      mockStorage.createUCP.mockResolvedValue(createdUCP);
      mockRequest.body = ucpData;
      
      await controller.createUCP(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.createUCP).toHaveBeenCalledWith({
        ...ucpData,
        createdBy: 1,
      });
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith(createdUCP);
    });

    it('should auto-generate code if not provided', async () => {
      const ucpData = {
        palletId: 1,
        status: 'ativo',
      };
      
      const createdUCP = { 
        id: 1, 
        ...ucpData, 
        code: 'UCP0001',
        createdBy: 1 
      };
      
      mockStorage.createUCP.mockResolvedValue(createdUCP);
      mockRequest.body = ucpData;
      
      await controller.createUCP(mockRequest as Request, mockResponse as Response);
      
      expect(createdUCP.code).toMatch(/^UCP\d{4}$/);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        // Missing palletId
        status: 'ativo',
      };
      
      mockRequest.body = invalidData;
      
      await controller.createUCP(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.createUCP).not.toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: 'palletId',
            message: 'Pallet ID is required'
          })
        ])
      });
    });

    it('should handle duplicate code error', async () => {
      const ucpData = {
        palletId: 1,
        code: 'UCP001',
        status: 'ativo',
      };
      
      const error = new Error('Duplicate code');
      error.name = 'DuplicateError';
      mockStorage.createUCP.mockRejectedValue(error);
      mockRequest.body = ucpData;
      
      await controller.createUCP(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(409);
      expect(mockJson).toHaveBeenCalledWith({ 
        message: 'UCP code already exists' 
      });
    });
  });

  describe('updateUCP', () => {
    it('should update UCP with valid data', async () => {
      const updateData = {
        status: 'finalizado',
        observations: 'Transfer completed',
      };
      
      const updatedUCP = { 
        id: 123, 
        ...generateMockUCP(), 
        ...updateData,
        updatedAt: new Date().toISOString(),
      };
      
      mockStorage.updateUCP.mockResolvedValue(updatedUCP);
      mockRequest.params = { id: '123' };
      mockRequest.body = updateData;
      
      await controller.updateUCP(mockRequest as Request, mockResponse as Response);
      
      expect(mockStorage.updateUCP).toHaveBeenCalledWith(123, updateData);
      expect(mockJson).toHaveBeenCalledWith(updatedUCP);
    });

    it('should return 404 when UCP not found for update', async () => {
      const updateData = { status: 'finalizado' };
      
      mockStorage.updateUCP.mockResolvedValue(null);
      mockRequest.params = { id: '999' };
      mockRequest.body = updateData;
      
      await controller.updateUCP(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ message: 'UCP not found' });
    });

    it('should validate status transitions', async () => {
      const invalidTransition = { status: 'ativo' }; // From finalizado to ativo
      
      mockRequest.params = { id: '123' };
      mockRequest.body = invalidTransition;
      
      // Mock current UCP status
      const currentUCP = generateMockUCP({ status: 'finalizado' });
      mockStorage.getUCP.mockResolvedValue(currentUCP);
      
      await controller.updateUCP(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Invalid status transition',
        current: 'finalizado',
        requested: 'ativo'
      });
    });
  });

  describe('UCP Items Management', () => {
    describe('getUCPItems', () => {
      it('should return items for valid UCP', async () => {
        const mockItems = [
          { id: 1, ucpId: 123, productId: 1, quantity: 10, packagingId: 1 },
          { id: 2, ucpId: 123, productId: 2, quantity: 5, packagingId: 2 },
        ];
        
        mockStorage.getUCPItems.mockResolvedValue(mockItems);
        mockRequest.params = { id: '123' };
        
        await controller.getUCPItems(mockRequest as Request, mockResponse as Response);
        
        expect(mockStorage.getUCPItems).toHaveBeenCalledWith(123);
        expect(mockJson).toHaveBeenCalledWith(mockItems);
      });

      it('should return empty array for UCP with no items', async () => {
        mockStorage.getUCPItems.mockResolvedValue([]);
        mockRequest.params = { id: '123' };
        
        await controller.getUCPItems(mockRequest as Request, mockResponse as Response);
        
        expect(mockJson).toHaveBeenCalledWith([]);
      });
    });

    describe('addUCPItem', () => {
      it('should add item to UCP', async () => {
        const itemData = {
          productId: 1,
          quantity: 10,
          packagingId: 1,
        };
        
        const addedItem = { id: 1, ucpId: 123, ...itemData };
        
        mockStorage.addUCPItem.mockResolvedValue(addedItem);
        mockRequest.params = { id: '123' };
        mockRequest.body = itemData;
        
        await controller.addUCPItem(mockRequest as Request, mockResponse as Response);
        
        expect(mockStorage.addUCPItem).toHaveBeenCalledWith(123, itemData);
        expect(mockStatus).toHaveBeenCalledWith(201);
        expect(mockJson).toHaveBeenCalledWith(addedItem);
      });

      it('should validate item data', async () => {
        const invalidItemData = {
          // Missing productId and quantity
          packagingId: 1,
        };
        
        mockRequest.params = { id: '123' };
        mockRequest.body = invalidItemData;
        
        await controller.addUCPItem(mockRequest as Request, mockResponse as Response);
        
        expect(mockStorage.addUCPItem).not.toHaveBeenCalled();
        expect(mockStatus).toHaveBeenCalledWith(400);
      });
    });

    describe('updateUCPItem', () => {
      it('should update UCP item', async () => {
        const updateData = { quantity: 15 };
        const updatedItem = { 
          id: 1, 
          ucpId: 123, 
          productId: 1, 
          quantity: 15, 
          packagingId: 1 
        };
        
        mockStorage.updateUCPItem.mockResolvedValue(updatedItem);
        mockRequest.params = { id: '123', itemId: '1' };
        mockRequest.body = updateData;
        
        await controller.updateUCPItem(mockRequest as Request, mockResponse as Response);
        
        expect(mockStorage.updateUCPItem).toHaveBeenCalledWith(123, 1, updateData);
        expect(mockJson).toHaveBeenCalledWith(updatedItem);
      });

      it('should return 404 for non-existent item', async () => {
        mockStorage.updateUCPItem.mockResolvedValue(null);
        mockRequest.params = { id: '123', itemId: '999' };
        mockRequest.body = { quantity: 15 };
        
        await controller.updateUCPItem(mockRequest as Request, mockResponse as Response);
        
        expect(mockStatus).toHaveBeenCalledWith(404);
        expect(mockJson).toHaveBeenCalledWith({ message: 'UCP item not found' });
      });
    });

    describe('removeUCPItem', () => {
      it('should remove UCP item', async () => {
        mockStorage.removeUCPItem.mockResolvedValue(true);
        mockRequest.params = { id: '123', itemId: '1' };
        
        await controller.removeUCPItem(mockRequest as Request, mockResponse as Response);
        
        expect(mockStorage.removeUCPItem).toHaveBeenCalledWith(123, 1);
        expect(mockStatus).toHaveBeenCalledWith(204);
      });

      it('should return 404 for non-existent item', async () => {
        mockStorage.removeUCPItem.mockResolvedValue(false);
        mockRequest.params = { id: '123', itemId: '999' };
        
        await controller.removeUCPItem(mockRequest as Request, mockResponse as Response);
        
        expect(mockStatus).toHaveBeenCalledWith(404);
        expect(mockJson).toHaveBeenCalledWith({ message: 'UCP item not found' });
      });
    });
  });

  describe('UCP Analytics and Reporting', () => {
    describe('getUCPHistory', () => {
      it('should return UCP history with default pagination', async () => {
        const mockHistory = {
          events: [
            { id: 1, ucpId: 123, event: 'created', timestamp: new Date().toISOString() },
            { id: 2, ucpId: 123, event: 'item_added', timestamp: new Date().toISOString() },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: 2,
            totalPages: 1,
          }
        };
        
        mockStorage.getUCPHistory.mockResolvedValue(mockHistory);
        mockRequest.params = { id: '123' };
        
        await controller.getUCPHistory(mockRequest as Request, mockResponse as Response);
        
        expect(mockStorage.getUCPHistory).toHaveBeenCalledWith(123, {
          page: 1,
          limit: 20,
        });
        expect(mockJson).toHaveBeenCalledWith(mockHistory);
      });

      it('should handle custom pagination parameters', async () => {
        const mockHistory = {
          events: [],
          pagination: { page: 2, limit: 10, total: 0, totalPages: 0 }
        };
        
        mockStorage.getUCPHistory.mockResolvedValue(mockHistory);
        mockRequest.params = { id: '123' };
        mockRequest.query = { page: '2', limit: '10' };
        
        await controller.getUCPHistory(mockRequest as Request, mockResponse as Response);
        
        expect(mockStorage.getUCPHistory).toHaveBeenCalledWith(123, {
          page: 2,
          limit: 10,
        });
      });
    });

    describe('getUCPMetrics', () => {
      it('should calculate and return UCP metrics', async () => {
        const mockMetrics = {
          totalItems: 25,
          totalWeight: 150.5,
          averageItemWeight: 6.02,
          packagingBreakdown: {
            'Unit': 10,
            'Box': 15,
          },
          statusHistory: [
            { status: 'ativo', duration: 3600000 }, // 1 hour
            { status: 'finalizado', duration: 0 },
          ],
          efficiency: {
            itemsPerHour: 25,
            weightPerHour: 150.5,
          }
        };
        
        mockStorage.calculateUCPMetrics.mockResolvedValue(mockMetrics);
        mockRequest.params = { id: '123' };
        
        await controller.getUCPMetrics(mockRequest as Request, mockResponse as Response);
        
        expect(mockStorage.calculateUCPMetrics).toHaveBeenCalledWith(123);
        expect(mockJson).toHaveBeenCalledWith(mockMetrics);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database timeout errors', async () => {
      const timeoutError = new Error('Connection timeout');
      timeoutError.name = 'TimeoutError';
      
      mockStorage.getUCPs.mockRejectedValue(timeoutError);
      
      await controller.getUCPs(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(504);
      expect(mockJson).toHaveBeenCalledWith({ 
        message: 'Database timeout', 
        error: 'Connection timeout' 
      });
    });

    it('should handle validation errors', async () => {
      const validationError = new Error('Invalid data');
      validationError.name = 'ValidationError';
      
      mockStorage.createUCP.mockRejectedValue(validationError);
      mockRequest.body = { palletId: 1 };
      
      await controller.createUCP(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ 
        message: 'Validation failed', 
        error: 'Invalid data' 
      });
    });

    it('should handle missing user context gracefully', async () => {
      mockRequest.user = undefined;
      
      const ucpData = { palletId: 1, status: 'ativo' };
      mockRequest.body = ucpData;
      
      await controller.createUCP(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ message: 'Authentication required' });
    });

    it('should handle concurrent modifications', async () => {
      const concurrencyError = new Error('Resource modified by another user');
      concurrencyError.name = 'ConcurrencyError';
      
      mockStorage.updateUCP.mockRejectedValue(concurrencyError);
      mockRequest.params = { id: '123' };
      mockRequest.body = { status: 'finalizado' };
      
      await controller.updateUCP(mockRequest as Request, mockResponse as Response);
      
      expect(mockStatus).toHaveBeenCalledWith(409);
      expect(mockJson).toHaveBeenCalledWith({ 
        message: 'Resource was modified by another user. Please refresh and try again.' 
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk operations efficiently', async () => {
      const bulkItems = Array.from({ length: 100 }, (_, i) => ({
        productId: i + 1,
        quantity: Math.floor(Math.random() * 50) + 1,
        packagingId: Math.floor(Math.random() * 5) + 1,
      }));
      
      mockStorage.addUCPItem.mockImplementation(() => 
        Promise.resolve({ id: Date.now(), ucpId: 123 })
      );
      
      const start = performance.now();
      
      // Simulate bulk add operation
      for (const item of bulkItems) {
        mockRequest.body = item;
        await controller.addUCPItem(mockRequest as Request, mockResponse as Response);
      }
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle large result sets with pagination', async () => {
      const largeResultSet = Array.from({ length: 1000 }, () => generateMockUCP());
      
      mockStorage.getUCPs.mockResolvedValue({
        ucps: largeResultSet.slice(0, 50), // First page
        total: 1000,
        page: 1,
        limit: 50,
        totalPages: 20,
      });
      
      mockRequest.query = { limit: '50', page: '1' };
      
      const start = performance.now();
      await controller.getUCPs(mockRequest as Request, mockResponse as Response);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(100); // Should be very fast with pagination
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
        ucps: expect.arrayContaining([expect.any(Object)]),
        total: 1000,
      }));
    });
  });
});