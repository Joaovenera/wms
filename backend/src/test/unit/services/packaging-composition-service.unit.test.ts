import { PackagingCompositionService } from '../../../services/packaging-composition.service';
import { db } from '../../../db';
import { 
  packagingTypes, 
  pallets, 
  products, 
  packagingCompositions,
  compositionItems,
  compositionReports
} from '../../../db/schema';
import { packagingService } from '../../../services/packaging.service';

// Mock database
jest.mock('../../../db', () => ({
  db: {
    insert: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }
}));

// Mock packaging service
jest.mock('../../../services/packaging.service', () => ({
  packagingService: {
    getStockConsolidated: jest.fn(),
    convertToBaseUnits: jest.fn(),
    convertFromBaseUnits: jest.fn(),
  }
}));

describe('PackagingCompositionService', () => {
  let service: PackagingCompositionService;
  let mockDb: jest.Mocked<typeof db>;
  let mockPackagingService: jest.Mocked<typeof packagingService>;

  beforeEach(() => {
    service = new PackagingCompositionService();
    mockDb = db as jest.Mocked<typeof db>;
    mockPackagingService = packagingService as jest.Mocked<typeof packagingService>;
    jest.clearAllMocks();
  });

  describe('calculateOptimalComposition', () => {
    const mockProducts = [
      {
        id: 1,
        name: 'Test Product 1',
        code: 'PROD001',
        weight: '10.5',
        dimensions: { width: 20, length: 30, height: 15 },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 1
      }
    ];

    const mockPackaging = [
      {
        id: 1,
        productId: 1,
        name: 'Unit',
        isBaseUnit: true,
        multiplier: 1,
        barcode: 'BAR001',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 1
      }
    ];

    const mockPallet = {
      id: 1,
      code: 'PAL001',
      type: 'standard' as const,
      width: '120',
      length: '100',
      height: '15',
      maxWeight: '1000',
      status: 'disponivel' as const,
      location: 'DOCK-01',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 1
    };

    beforeEach(() => {
      // Mock database queries
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockPallet])
          })
        })
      } as any);

      // Mock product and packaging queries
      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockProducts)
          })
        } as any)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockPackaging)
          })
        } as any);
    });

    it('should calculate optimal composition for valid products', async () => {
      const request = {
        products: [
          { productId: 1, quantity: 10, packagingTypeId: 1 }
        ],
        palletId: 1
      };

      const result = await service.calculateOptimalComposition(request);

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('efficiency');
      expect(result).toHaveProperty('layout');
      expect(result).toHaveProperty('weight');
      expect(result).toHaveProperty('volume');
      expect(result).toHaveProperty('height');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('products');
      
      expect(result.products).toHaveLength(1);
      expect(result.layout.totalItems).toBe(10);
    });

    it('should handle composition without specified pallet', async () => {
      // Mock pallet selection
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockPallet])
        })
      } as any);

      const request = {
        products: [
          { productId: 1, quantity: 5 }
        ]
      };

      const result = await service.calculateOptimalComposition(request);

      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });

    it('should apply custom constraints', async () => {
      const request = {
        products: [
          { productId: 1, quantity: 10 }
        ],
        palletId: 1,
        constraints: {
          maxWeight: 500,
          maxHeight: 100,
          maxVolume: 1.5
        }
      };

      const result = await service.calculateOptimalComposition(request);

      expect(result.weight.limit).toBe(500);
      expect(result.height.limit).toBe(100);
      expect(result.volume.limit).toBe(1.5);
    });

    it('should generate warnings for low efficiency', async () => {
      // Mock data that would result in low efficiency
      const lowEfficiencyRequest = {
        products: [
          { productId: 1, quantity: 1 } // Very small quantity
        ],
        palletId: 1
      };

      const result = await service.calculateOptimalComposition(lowEfficiencyRequest);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('eficiência'))).toBe(true);
    });

    it('should handle products not found error', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]) // No products found
        })
      } as any);

      const request = {
        products: [
          { productId: 999, quantity: 10 }
        ]
      };

      await expect(service.calculateOptimalComposition(request))
        .rejects.toThrow('Produto não encontrado: 999');
    });

    it('should handle pallet not found error', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockProducts)
          })
        } as any)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockPackaging)
          })
        } as any)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]) // No pallet found
            })
          })
        } as any);

      const request = {
        products: [
          { productId: 1, quantity: 10 }
        ],
        palletId: 999
      };

      await expect(service.calculateOptimalComposition(request))
        .rejects.toThrow('Pallet não encontrado: 999');
    });
  });

  describe('validateCompositionConstraints', () => {
    beforeEach(() => {
      // Setup common mocks for validation tests
      const mockProducts = [{
        id: 1,
        name: 'Heavy Product',
        weight: '50', // Heavy product for weight testing
        dimensions: { width: 50, length: 50, height: 50 }
      }];

      const mockPallet = {
        id: 1,
        maxWeight: '100', // Limited weight capacity
        width: '120',
        length: '100'
      };

      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockProducts)
          })
        } as any)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([])
          })
        } as any)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockPallet])
            })
          })
        } as any);
    });

    it('should return valid when constraints are met', async () => {
      const request = {
        products: [
          { productId: 1, quantity: 1, packagingTypeId: 1 }
        ],
        palletId: 1
      };

      const result = await service.validateCompositionConstraints(request);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect weight violations', async () => {
      const request = {
        products: [
          { productId: 1, quantity: 3, packagingTypeId: 1 } // 3 * 50kg = 150kg > 100kg limit
        ],
        palletId: 1
      };

      const result = await service.validateCompositionConstraints(request);

      expect(result.isValid).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'weight',
            severity: 'error'
          })
        ])
      );
    });

    it('should generate efficiency warnings', async () => {
      const request = {
        products: [
          { productId: 1, quantity: 1, packagingTypeId: 1 } // Low quantity = low efficiency
        ],
        palletId: 1
      };

      const result = await service.validateCompositionConstraints(request);

      expect(result.warnings.some(w => w.includes('eficiência'))).toBe(true);
    });

    it('should provide detailed metrics', async () => {
      const request = {
        products: [
          { productId: 1, quantity: 2, packagingTypeId: 1 }
        ],
        palletId: 1
      };

      const result = await service.validateCompositionConstraints(request);

      expect(result.metrics).toEqual(
        expect.objectContaining({
          totalWeight: expect.any(Number),
          totalVolume: expect.any(Number),
          totalHeight: expect.any(Number),
          efficiency: expect.any(Number)
        })
      );
    });
  });

  describe('saveComposition', () => {
    const mockCompositionResult = {
      isValid: true,
      efficiency: 0.85,
      layout: {
        layers: 1,
        itemsPerLayer: 10,
        totalItems: 10,
        arrangement: []
      },
      weight: { total: 105, limit: 1000, utilization: 0.105 },
      volume: { total: 0.5, limit: 2.4, utilization: 0.208 },
      height: { total: 15, limit: 200, utilization: 0.075 },
      recommendations: [],
      warnings: [],
      products: []
    };

    beforeEach(() => {
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 1,
            name: 'Test Composition',
            description: 'Test Description',
            status: 'draft',
            createdAt: new Date(),
            updatedAt: new Date()
          }])
        })
      } as any);
    });

    it('should save composition with valid data', async () => {
      const request = {
        name: 'Test Composition',
        description: 'Test Description',
        products: [
          { productId: 1, quantity: 10, packagingTypeId: 1 }
        ],
        palletId: 1
      };

      const result = await service.saveComposition(
        request,
        mockCompositionResult,
        1
      );

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Test Composition');
      expect(mockDb.insert).toHaveBeenCalledWith(packagingCompositions);
    });

    it('should save composition items', async () => {
      const request = {
        name: 'Test Composition',
        products: [
          { productId: 1, quantity: 5, packagingTypeId: 1 },
          { productId: 2, quantity: 3, packagingTypeId: 2 }
        ]
      };

      await service.saveComposition(request, mockCompositionResult, 1);

      expect(mockDb.insert).toHaveBeenCalledWith(compositionItems);
    });

    it('should handle composition without products', async () => {
      const request = {
        name: 'Empty Composition',
        products: []
      };

      const result = await service.saveComposition(
        request,
        mockCompositionResult,
        1
      );

      expect(result).toHaveProperty('id');
      // Should not call insert for composition items
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCompositionById', () => {
    const mockComposition = {
      id: 1,
      name: 'Test Composition',
      status: 'approved',
      isActive: true
    };

    const mockItems = [
      { id: 1, compositionId: 1, productId: 1, quantity: '10', isActive: true },
      { id: 2, compositionId: 1, productId: 2, quantity: '5', isActive: true }
    ];

    beforeEach(() => {
      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockComposition])
            })
          })
        } as any)
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockItems)
          })
        } as any);
    });

    it('should return composition with items', async () => {
      const result = await service.getCompositionById(1);

      expect(result).toEqual({
        ...mockComposition,
        items: mockItems
      });
    });

    it('should return null for non-existent composition', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      } as any);

      const result = await service.getCompositionById(999);

      expect(result).toBeNull();
    });
  });

  describe('assembleComposition', () => {
    const mockComposition = {
      id: 1,
      name: 'Test Composition',
      status: 'approved',
      items: [
        { id: 1, productId: 1, quantity: '10', packagingTypeId: 1 }
      ]
    };

    beforeEach(() => {
      // Mock getCompositionById
      jest.spyOn(service, 'getCompositionById').mockResolvedValue(mockComposition as any);
      
      // Mock stock check
      mockPackagingService.getStockConsolidated.mockResolvedValue({
        totalBaseUnits: 100,
        availableStock: 100
      } as any);
      
      mockPackagingService.convertToBaseUnits.mockResolvedValue(10);
      
      // Mock status update
      jest.spyOn(service, 'updateCompositionStatus').mockResolvedValue({} as any);
    });

    it('should successfully assemble approved composition with sufficient stock', async () => {
      const result = await service.assembleComposition(1, 100, 1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('montada com sucesso');
      expect(service.updateCompositionStatus).toHaveBeenCalledWith(1, 'executed');
    });

    it('should reject non-approved composition', async () => {
      jest.spyOn(service, 'getCompositionById').mockResolvedValue({
        ...mockComposition,
        status: 'draft'
      } as any);

      await expect(service.assembleComposition(1, 100, 1))
        .rejects.toThrow('Apenas composições aprovadas podem ser montadas');
    });

    it('should reject composition with insufficient stock', async () => {
      mockPackagingService.getStockConsolidated.mockResolvedValue({
        totalBaseUnits: 5 // Less than required 10
      } as any);

      await expect(service.assembleComposition(1, 100, 1))
        .rejects.toThrow('Estoque insuficiente');
    });

    it('should reject non-existent composition', async () => {
      jest.spyOn(service, 'getCompositionById').mockResolvedValue(null);

      await expect(service.assembleComposition(999, 100, 1))
        .rejects.toThrow('Composição não encontrada: 999');
    });
  });

  describe('disassembleComposition', () => {
    const mockComposition = {
      id: 1,
      name: 'Test Composition',
      status: 'executed',
      items: [
        { id: 1, productId: 1, quantity: '10' },
        { id: 2, productId: 2, quantity: '5' }
      ]
    };

    beforeEach(() => {
      jest.spyOn(service, 'getCompositionById').mockResolvedValue(mockComposition as any);
      jest.spyOn(service, 'updateCompositionStatus').mockResolvedValue({} as any);
    });

    it('should successfully disassemble executed composition', async () => {
      const targetUcps = [
        { productId: 1, quantity: 5, ucpId: 101 },
        { productId: 2, quantity: 3, ucpId: 102 }
      ];

      const result = await service.disassembleComposition(1, targetUcps, 1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('desmontada com sucesso');
      expect(service.updateCompositionStatus).toHaveBeenCalledWith(1, 'approved');
    });

    it('should reject non-executed composition', async () => {
      jest.spyOn(service, 'getCompositionById').mockResolvedValue({
        ...mockComposition,
        status: 'approved'
      } as any);

      await expect(service.disassembleComposition(1, [], 1))
        .rejects.toThrow('Apenas composições executadas podem ser desmontadas');
    });

    it('should reject invalid product quantities', async () => {
      const targetUcps = [
        { productId: 1, quantity: 15, ucpId: 101 } // More than available (10)
      ];

      await expect(service.disassembleComposition(1, targetUcps, 1))
        .rejects.toThrow('Quantidade a desmontar (15) é maior que a disponível');
    });

    it('should reject products not in composition', async () => {
      const targetUcps = [
        { productId: 999, quantity: 5, ucpId: 101 } // Product not in composition
      ];

      await expect(service.disassembleComposition(1, targetUcps, 1))
        .rejects.toThrow('Produto 999 não encontrado na composição');
    });
  });

  describe('generateCompositionReport', () => {
    const mockComposition = {
      id: 1,
      name: 'Test Composition',
      result: {
        efficiency: 0.85,
        weight: { utilization: 0.75 },
        volume: { utilization: 0.68 },
        height: { utilization: 0.45 }
      }
    };

    beforeEach(() => {
      jest.spyOn(service, 'getCompositionById').mockResolvedValue(mockComposition as any);
      
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 1,
            compositionId: 1,
            reportType: 'detailed',
            title: 'Test Report'
          }])
        })
      } as any);
    });

    it('should generate complete report with all options', async () => {
      const options = {
        includeMetrics: true,
        includeRecommendations: true,
        includeCostAnalysis: true
      };

      const result = await service.generateCompositionReport(1, options, 1);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('reportType', 'detailed');
      expect(mockDb.insert).toHaveBeenCalledWith(compositionReports);
    });

    it('should generate minimal report without optional sections', async () => {
      const options = {
        includeMetrics: false,
        includeRecommendations: false,
        includeCostAnalysis: false
      };

      const result = await service.generateCompositionReport(1, options, 1);

      expect(result).toHaveProperty('id');
    });

    it('should reject report for non-existent composition', async () => {
      jest.spyOn(service, 'getCompositionById').mockResolvedValue(null);

      await expect(service.generateCompositionReport(999, {}, 1))
        .rejects.toThrow('Composição não encontrada: 999');
    });
  });

  describe('updateCompositionStatus', () => {
    beforeEach(() => {
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{
              id: 1,
              status: 'approved',
              updatedAt: new Date()
            }])
          })
        })
      } as any);
    });

    it('should update composition status successfully', async () => {
      const result = await service.updateCompositionStatus(1, 'approved', 1);

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('status', 'approved');
      expect(mockDb.update).toHaveBeenCalledWith(packagingCompositions);
    });

    it('should handle approval with user tracking', async () => {
      await service.updateCompositionStatus(1, 'approved', 1);

      // Verify that approvedBy and approvedAt are set for approval
      const updateCall = mockDb.update().set as jest.Mock;
      const updateData = updateCall.mock.calls[0][0];
      
      expect(updateData.approvedBy).toBe(1);
      expect(updateData.approvedAt).toBeDefined();
    });

    it('should reject update for non-existent composition', async () => {
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([])
          })
        })
      } as any);

      await expect(service.updateCompositionStatus(999, 'approved'))
        .rejects.toThrow('Composição não encontrada: 999');
    });
  });

  describe('deleteComposition', () => {
    beforeEach(() => {
      mockDb.update
        .mockReturnValueOnce({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([{
                id: 1,
                isActive: false
              }])
            })
          })
        } as any)
        .mockReturnValueOnce({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([])
          })
        } as any);
    });

    it('should soft delete composition and items', async () => {
      await service.deleteComposition(1);

      expect(mockDb.update).toHaveBeenCalledWith(packagingCompositions);
      expect(mockDb.update).toHaveBeenCalledWith(compositionItems);
    });

    it('should reject deletion of non-existent composition', async () => {
      mockDb.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([])
          })
        })
      } as any);

      await expect(service.deleteComposition(999))
        .rejects.toThrow('Composição não encontrada: 999');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large composition calculations efficiently', async () => {
      const largeRequest = {
        products: Array.from({ length: 100 }, (_, i) => ({
          productId: i + 1,
          quantity: 10
        }))
      };

      // Mock large dataset
      const mockProducts = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Product ${i + 1}`,
        weight: '1',
        dimensions: { width: 10, length: 10, height: 10 }
      }));

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockProducts)
        })
      } as any);

      const startTime = Date.now();
      await service.calculateOptimalComposition(largeRequest);
      const endTime = Date.now();

      // Should complete within reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle edge case of zero quantity products', async () => {
      const request = {
        products: [
          { productId: 1, quantity: 0 }
        ]
      };

      // Should handle gracefully without crashing
      const result = await service.calculateOptimalComposition(request);
      expect(result).toBeDefined();
    });

    it('should handle very heavy products that exceed pallet capacity', async () => {
      const mockHeavyProduct = [{
        id: 1,
        weight: '2000', // 2000kg - exceeds typical pallet capacity
        dimensions: { width: 100, length: 100, height: 100 }
      }];

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockHeavyProduct)
        })
      } as any);

      const request = {
        products: [{ productId: 1, quantity: 1 }]
      };

      const result = await service.validateCompositionConstraints(request);
      expect(result.isValid).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'weight' })
        ])
      );
    });
  });
});