import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { 
  PackagingCompositionService, 
  CompositionRequest,
  CompositionResult 
} from '../../../services/packaging-composition.service';
import { db } from '../../../db';
import { packagingCompositions, compositionItems, compositionReports } from '../../../db/schema';
import { eq } from 'drizzle-orm';

// Mock the database
vi.mock('../../../db');
vi.mock('../../../services/packaging.service');
vi.mock('../../../infrastructure/cache/composition-cache.service');

describe('PackagingCompositionService - Enhanced Database Operations', () => {
  let service: PackagingCompositionService;
  
  const mockUser = { id: 1 };
  const mockPallet = { id: 1, maxWeight: 1000, width: 120, length: 80, height: 200 };
  const mockProduct = { 
    id: 1, 
    name: 'Test Product', 
    weight: 5.5, 
    dimensions: { width: 30, length: 20, height: 15 } 
  };

  beforeEach(() => {
    service = new PackagingCompositionService();
    vi.clearAllMocks();
  });

  describe('saveComposition', () => {
    it('should save composition to database with correct data', async () => {
      const mockComposition = {
        id: 1,
        name: 'Test Composition',
        description: 'Test Description',
        palletId: 1,
        status: 'draft',
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockInsertResult = [mockComposition];
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(mockInsertResult)
        })
      } as any);

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockResolvedValue(undefined)
      } as any);

      const request: CompositionRequest & { name: string; description?: string } = {
        name: 'Test Composition',
        description: 'Test Description',
        products: [
          { productId: 1, quantity: 10, packagingTypeId: 1 }
        ],
        palletId: 1
      };

      const result: CompositionResult = {
        isValid: true,
        efficiency: 0.85,
        layout: {
          layers: 2,
          itemsPerLayer: 5,
          totalItems: 10,
          arrangement: []
        },
        weight: { total: 55, limit: 1000, utilization: 0.055 },
        volume: { total: 0.09, limit: 1.92, utilization: 0.047 },
        height: { total: 30, limit: 200, utilization: 0.15 },
        recommendations: [],
        warnings: [],
        products: []
      };

      const savedComposition = await service.saveComposition(request, result, mockUser.id);

      expect(savedComposition).toEqual(mockComposition);
      expect(db.insert).toHaveBeenCalledWith(packagingCompositions);
      expect(db.insert).toHaveBeenCalledWith(compositionItems);
    });

    it('should handle composition with multiple products', async () => {
      const mockComposition = { id: 1, name: 'Multi Product Composition' };
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockComposition])
        })
      } as any);

      const request = {
        name: 'Multi Product Composition',
        products: [
          { productId: 1, quantity: 10, packagingTypeId: 1 },
          { productId: 2, quantity: 5, packagingTypeId: 2 },
          { productId: 3, quantity: 15, packagingTypeId: 3 }
        ],
        palletId: 1
      };

      const result: CompositionResult = {
        isValid: true,
        efficiency: 0.75,
        layout: { layers: 3, itemsPerLayer: 10, totalItems: 30, arrangement: [] },
        weight: { total: 125, limit: 1000, utilization: 0.125 },
        volume: { total: 0.25, limit: 1.92, utilization: 0.13 },
        height: { total: 45, limit: 200, utilization: 0.225 },
        recommendations: [],
        warnings: [],
        products: []
      };

      await service.saveComposition(request, result, mockUser.id);

      // Verify composition items were inserted
      expect(db.insert).toHaveBeenCalledWith(compositionItems);
      const itemsCall = vi.mocked(db.insert).mock.calls.find(call => call[0] === compositionItems);
      expect(itemsCall).toBeDefined();
    });
  });

  describe('getCompositionById', () => {
    it('should return composition with items when found', async () => {
      const mockComposition = {
        id: 1,
        name: 'Test Composition',
        palletId: 1,
        status: 'draft',
        createdBy: 1
      };

      const mockItems = [
        { id: 1, compositionId: 1, productId: 1, quantity: '10', layer: 1 },
        { id: 2, compositionId: 1, productId: 2, quantity: '5', layer: 1 }
      ];

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockComposition])
          })
        })
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockItems)
        })
      } as any);

      const result = await service.getCompositionById(1);

      expect(result).toEqual({
        ...mockComposition,
        items: mockItems
      });
    });

    it('should return null when composition not found', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      } as any);

      const result = await service.getCompositionById(999);

      expect(result).toBeNull();
    });
  });

  describe('listCompositions', () => {
    it('should return paginated compositions with correct total', async () => {
      const mockCompositions = [
        { id: 1, name: 'Composition 1', status: 'draft' },
        { id: 2, name: 'Composition 2', status: 'approved' }
      ];

      const mockTotal = [{ count: 25 }];

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockCompositions)
              })
            })
          })
        })
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockTotal)
        })
      } as any);

      const result = await service.listCompositions({
        page: 2,
        limit: 10,
        status: 'draft'
      });

      expect(result).toEqual({
        compositions: mockCompositions,
        total: 25
      });
    });

    it('should apply filters correctly', async () => {
      const mockCompositions = [
        { id: 1, name: 'User Composition', createdBy: 1, status: 'approved' }
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockCompositions)
              })
            })
          })
        })
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }])
        })
      } as any);

      const result = await service.listCompositions({
        status: 'approved',
        userId: 1
      });

      expect(result.compositions).toEqual(mockCompositions);
      expect(result.total).toBe(1);
    });
  });

  describe('updateCompositionStatus', () => {
    it('should update status and set approval fields when approving', async () => {
      const mockUpdatedComposition = {
        id: 1,
        status: 'approved',
        approvedBy: 1,
        approvedAt: new Date()
      };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdatedComposition])
          })
        })
      } as any);

      const result = await service.updateCompositionStatus(1, 'approved', 1);

      expect(result).toEqual(mockUpdatedComposition);
      expect(db.update).toHaveBeenCalledWith(packagingCompositions);
    });

    it('should throw error when composition not found', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([])
          })
        })
      } as any);

      await expect(service.updateCompositionStatus(999, 'approved'))
        .rejects.toThrow('Composição não encontrada: 999');
    });
  });

  describe('deleteComposition', () => {
    it('should soft delete composition and related items', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }])
          })
        })
      } as any);

      await service.deleteComposition(1);

      expect(db.update).toHaveBeenCalledWith(packagingCompositions);
      expect(db.update).toHaveBeenCalledWith(compositionItems);
    });

    it('should throw error when composition not found', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([])
          })
        })
      } as any);

      await expect(service.deleteComposition(999))
        .rejects.toThrow('Composição não encontrada: 999');
    });
  });

  describe('generateCompositionReport', () => {
    it('should generate report with all options enabled', async () => {
      const mockComposition = {
        id: 1,
        name: 'Test Composition',
        result: {
          isValid: true,
          efficiency: 0.85,
          volume: { utilization: 0.8 },
          weight: { utilization: 0.7 },
          height: { utilization: 0.9 }
        },
        items: []
      };

      vi.spyOn(service, 'getCompositionById').mockResolvedValue(mockComposition as any);

      const mockReport = { id: 1, compositionId: 1, reportType: 'detailed' };
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockReport])
        })
      } as any);

      const result = await service.generateCompositionReport(1, {
        includeMetrics: true,
        includeRecommendations: true,
        includeCostAnalysis: true
      }, 1);

      expect(result).toEqual(mockReport);
      expect(db.insert).toHaveBeenCalledWith(compositionReports);
    });

    it('should throw error when composition not found', async () => {
      vi.spyOn(service, 'getCompositionById').mockResolvedValue(null);

      await expect(service.generateCompositionReport(999, {}, 1))
        .rejects.toThrow('Composição não encontrada: 999');
    });
  });

  describe('assembleComposition', () => {
    it('should successfully assemble approved composition', async () => {
      const mockComposition = {
        id: 1,
        name: 'Test Composition',
        status: 'approved',
        items: [
          { productId: 1, quantity: '10', packagingTypeId: 1 }
        ]
      };

      vi.spyOn(service, 'getCompositionById').mockResolvedValue(mockComposition as any);
      vi.spyOn(service as any, 'getProductDetails').mockResolvedValue([
        { productId: 1, packaging: { id: 1 } }
      ]);
      vi.spyOn(service, 'updateCompositionStatus').mockResolvedValue({} as any);

      // Mock packaging service methods
      const packagingService = await import('../../../services/packaging.service');
      vi.spyOn(packagingService.packagingService, 'getStockConsolidated')
        .mockResolvedValue({ totalBaseUnits: 100 } as any);
      vi.spyOn(packagingService.packagingService, 'convertToBaseUnits')
        .mockResolvedValue(50);

      const result = await service.assembleComposition(1, 1, 1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('montada com sucesso');
    });

    it('should throw error for non-approved composition', async () => {
      const mockComposition = {
        id: 1,
        name: 'Test Composition',
        status: 'draft',
        items: []
      };

      vi.spyOn(service, 'getCompositionById').mockResolvedValue(mockComposition as any);

      await expect(service.assembleComposition(1, 1, 1))
        .rejects.toThrow('Apenas composições aprovadas podem ser montadas');
    });

    it('should throw error for insufficient stock', async () => {
      const mockComposition = {
        id: 1,
        name: 'Test Composition',
        status: 'approved',
        items: [
          { productId: 1, quantity: '10', packagingTypeId: 1 }
        ]
      };

      vi.spyOn(service, 'getCompositionById').mockResolvedValue(mockComposition as any);
      vi.spyOn(service as any, 'getProductDetails').mockResolvedValue([
        { productId: 1, packaging: { id: 1 } }
      ]);

      // Mock insufficient stock
      const packagingService = await import('../../../services/packaging.service');
      vi.spyOn(packagingService.packagingService, 'getStockConsolidated')
        .mockResolvedValue({ totalBaseUnits: 30 } as any);
      vi.spyOn(packagingService.packagingService, 'convertToBaseUnits')
        .mockResolvedValue(50);

      await expect(service.assembleComposition(1, 1, 1))
        .rejects.toThrow('Estoque insuficiente');
    });
  });

  describe('disassembleComposition', () => {
    it('should successfully disassemble executed composition', async () => {
      const mockComposition = {
        id: 1,
        name: 'Test Composition',
        status: 'executed',
        items: [
          { productId: 1, quantity: '10' },
          { productId: 2, quantity: '5' }
        ]
      };

      vi.spyOn(service, 'getCompositionById').mockResolvedValue(mockComposition as any);
      vi.spyOn(service, 'updateCompositionStatus').mockResolvedValue({} as any);

      const targetUcps = [
        { productId: 1, quantity: 8, ucpId: 1 },
        { productId: 2, quantity: 3, ucpId: 2 }
      ];

      const result = await service.disassembleComposition(1, targetUcps, 1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('desmontada com sucesso');
    });

    it('should throw error for non-executed composition', async () => {
      const mockComposition = {
        id: 1,
        name: 'Test Composition',
        status: 'approved',
        items: []
      };

      vi.spyOn(service, 'getCompositionById').mockResolvedValue(mockComposition as any);

      await expect(service.disassembleComposition(1, [], 1))
        .rejects.toThrow('Apenas composições executadas podem ser desmontadas');
    });

    it('should throw error for invalid product in composition', async () => {
      const mockComposition = {
        id: 1,
        name: 'Test Composition',
        status: 'executed',
        items: [
          { productId: 1, quantity: '10' }
        ]
      };

      vi.spyOn(service, 'getCompositionById').mockResolvedValue(mockComposition as any);

      const targetUcps = [
        { productId: 999, quantity: 5, ucpId: 1 } // Product not in composition
      ];

      await expect(service.disassembleComposition(1, targetUcps, 1))
        .rejects.toThrow('Produto 999 não encontrado na composição');
    });

    it('should throw error for quantity exceeding composition', async () => {
      const mockComposition = {
        id: 1,
        name: 'Test Composition',
        status: 'executed',
        items: [
          { productId: 1, quantity: '10' }
        ]
      };

      vi.spyOn(service, 'getCompositionById').mockResolvedValue(mockComposition as any);

      const targetUcps = [
        { productId: 1, quantity: 15, ucpId: 1 } // More than available
      ];

      await expect(service.disassembleComposition(1, targetUcps, 1))
        .rejects.toThrow('Quantidade a desmontar (15) é maior que a disponível na composição (10)');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      vi.mocked(db.select).mockRejectedValue(new Error('Database connection failed'));

      await expect(service.getCompositionById(1))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle invalid data types in database operations', async () => {
      vi.mocked(db.insert).mockRejectedValue(new Error('Invalid data type'));

      const request = {
        name: 'Test Composition',
        products: [{ productId: 1, quantity: 10 }]
      };

      const result: CompositionResult = {
        isValid: true,
        efficiency: 0.85,
        layout: { layers: 1, itemsPerLayer: 10, totalItems: 10, arrangement: [] },
        weight: { total: 50, limit: 1000, utilization: 0.05 },
        volume: { total: 0.1, limit: 1.0, utilization: 0.1 },
        height: { total: 15, limit: 200, utilization: 0.075 },
        recommendations: [],
        warnings: [],
        products: []
      };

      await expect(service.saveComposition(request, result, 1))
        .rejects.toThrow('Invalid data type');
    });
  });
});