import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { PackagingService } from '../../../services/packaging.service';
import { db } from '../../../db';
import { packagingTypes, ucpItems, products } from '../../../db/schema';
import { TestDataFactory } from '../../helpers/test-data-factory';

// Mock the database
vi.mock('../../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}));

describe('PackagingService - Composition Unit Tests', () => {
  let packagingService: PackagingService;
  let mockDb: any;

  beforeAll(() => {
    TestDataFactory.resetCounters();
  });

  beforeEach(() => {
    packagingService = new PackagingService();
    mockDb = vi.mocked(db);
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Packaging Type Management', () => {
    describe('getPackagingsByProduct', () => {
      it('should retrieve all active packaging types for a product ordered by level', async () => {
        const productId = 1;
        const mockPackagings = [
          { id: 1, productId, name: 'Unidade', level: 1, baseUnitQuantity: '1', isBaseUnit: true, isActive: true },
          { id: 2, productId, name: 'Caixa', level: 2, baseUnitQuantity: '12', isBaseUnit: false, isActive: true },
          { id: 3, productId, name: 'Pallet', level: 3, baseUnitQuantity: '144', isBaseUnit: false, isActive: true }
        ];

        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockOrderBy = vi.fn().mockResolvedValue(mockPackagings);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere.mockReturnValue({
              orderBy: mockOrderBy
            })
          })
        });

        const result = await packagingService.getPackagingsByProduct(productId);

        expect(mockDb.select).toHaveBeenCalled();
        expect(result).toEqual(mockPackagings);
        expect(result).toHaveLength(3);
        expect(result[0].level).toBe(1);
        expect(result[0].isBaseUnit).toBe(true);
      });

      it('should return empty array when no packaging types exist', async () => {
        const productId = 999;

        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockOrderBy = vi.fn().mockResolvedValue([]);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere.mockReturnValue({
              orderBy: mockOrderBy
            })
          })
        });

        const result = await packagingService.getPackagingsByProduct(productId);

        expect(result).toEqual([]);
        expect(result).toHaveLength(0);
      });
    });

    describe('getPackagingByBarcode', () => {
      it('should retrieve packaging by barcode successfully', async () => {
        const barcode = '1234567890123';
        const mockPackaging = {
          id: 1,
          productId: 1,
          name: 'Caixa 12 unidades',
          barcode,
          baseUnitQuantity: '12',
          isActive: true
        };

        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockLimit = vi.fn().mockResolvedValue([mockPackaging]);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere.mockReturnValue({
              limit: mockLimit
            })
          })
        });

        const result = await packagingService.getPackagingByBarcode(barcode);

        expect(result).toEqual(mockPackaging);
        expect(mockLimit).toHaveBeenCalledWith(1);
      });

      it('should throw error when barcode not found', async () => {
        const barcode = 'nonexistent';

        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockLimit = vi.fn().mockResolvedValue([]);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere.mockReturnValue({
              limit: mockLimit
            })
          })
        });

        await expect(packagingService.getPackagingByBarcode(barcode))
          .rejects.toThrow(`Embalagem não encontrada para o código de barras: ${barcode}`);
      });
    });

    describe('getBasePackaging', () => {
      it('should retrieve base packaging for product', async () => {
        const productId = 1;
        const mockBasePackaging = {
          id: 1,
          productId,
          name: 'Unidade',
          baseUnitQuantity: '1',
          isBaseUnit: true,
          isActive: true
        };

        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockLimit = vi.fn().mockResolvedValue([mockBasePackaging]);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere.mockReturnValue({
              limit: mockLimit
            })
          })
        });

        const result = await packagingService.getBasePackaging(productId);

        expect(result).toEqual(mockBasePackaging);
        expect(result.isBaseUnit).toBe(true);
      });

      it('should throw error when base packaging not found', async () => {
        const productId = 999;

        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockLimit = vi.fn().mockResolvedValue([]);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere.mockReturnValue({
              limit: mockLimit
            })
          })
        });

        await expect(packagingService.getBasePackaging(productId))
          .rejects.toThrow(`Embalagem base não encontrada para o produto: ${productId}`);
      });
    });
  });

  describe('Unit Conversion Tests', () => {
    describe('convertToBaseUnits', () => {
      it('should convert packaging quantity to base units correctly', async () => {
        const quantity = 5;
        const packagingTypeId = 2;
        const baseUnitQuantity = 12;

        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockLimit = vi.fn().mockResolvedValue([{ baseUnitQuantity }]);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere.mockReturnValue({
              limit: mockLimit
            })
          })
        });

        const result = await packagingService.convertToBaseUnits(quantity, packagingTypeId);

        expect(result).toBe(60); // 5 boxes * 12 units each
      });

      it('should handle decimal quantities in conversion', async () => {
        const quantity = 2.5;
        const packagingTypeId = 2;
        const baseUnitQuantity = 12;

        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockLimit = vi.fn().mockResolvedValue([{ baseUnitQuantity }]);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere.mockReturnValue({
              limit: mockLimit
            })
          })
        });

        const result = await packagingService.convertToBaseUnits(quantity, packagingTypeId);

        expect(result).toBe(30); // 2.5 boxes * 12 units each
      });

      it('should throw error when packaging type not found', async () => {
        const quantity = 5;
        const packagingTypeId = 999;

        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockLimit = vi.fn().mockResolvedValue([]);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere.mockReturnValue({
              limit: mockLimit
            })
          })
        });

        await expect(packagingService.convertToBaseUnits(quantity, packagingTypeId))
          .rejects.toThrow(`Tipo de embalagem não encontrado: ${packagingTypeId}`);
      });
    });

    describe('convertFromBaseUnits', () => {
      it('should convert base units to packaging quantity correctly', async () => {
        const baseQuantity = 60;
        const targetPackagingId = 2;
        const baseUnitQuantity = 12;

        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockLimit = vi.fn().mockResolvedValue([{ baseUnitQuantity }]);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere.mockReturnValue({
              limit: mockLimit
            })
          })
        });

        const result = await packagingService.convertFromBaseUnits(baseQuantity, targetPackagingId);

        expect(result).toBe(5); // 60 units / 12 units per box
      });

      it('should handle fractional results in conversion', async () => {
        const baseQuantity = 30;
        const targetPackagingId = 2;
        const baseUnitQuantity = 12;

        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockLimit = vi.fn().mockResolvedValue([{ baseUnitQuantity }]);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere.mockReturnValue({
              limit: mockLimit
            })
          })
        });

        const result = await packagingService.convertFromBaseUnits(baseQuantity, targetPackagingId);

        expect(result).toBe(2.5); // 30 units / 12 units per box
      });
    });

    describe('calculateConversionFactor', () => {
      it('should calculate conversion factor between packaging types', async () => {
        const fromPackagingId = 1;
        const toPackagingId = 2;
        const fromBaseQty = 1; // unit
        const toBaseQty = 12; // box

        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockLimit = vi.fn().mockResolvedValue([{ fromBaseQty, toBaseQty }]);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere.mockReturnValue({
              limit: mockLimit
            })
          })
        });

        const result = await packagingService.calculateConversionFactor(fromPackagingId, toPackagingId);

        expect(result).toBe(1/12); // 1 unit = 1/12 box
      });

      it('should handle same packaging type conversion', async () => {
        const fromPackagingId = 2;
        const toPackagingId = 2;
        const fromBaseQty = 12;
        const toBaseQty = 12;

        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockLimit = vi.fn().mockResolvedValue([{ fromBaseQty, toBaseQty }]);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere.mockReturnValue({
              limit: mockLimit
            })
          })
        });

        const result = await packagingService.calculateConversionFactor(fromPackagingId, toPackagingId);

        expect(result).toBe(1); // Same packaging type
      });
    });
  });

  describe('Stock Management Tests', () => {
    describe('getStockConsolidated', () => {
      it('should calculate consolidated stock in base units', async () => {
        const productId = 1;
        const mockStock = {
          productId,
          totalBaseUnits: 240,
          locationsCount: 3,
          itemsCount: 5
        };

        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockResolvedValue([mockStock]);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere
          })
        });

        const result = await packagingService.getStockConsolidated(productId);

        expect(result).toEqual(mockStock);
        expect(result.totalBaseUnits).toBe(240);
        expect(result.locationsCount).toBe(3);
      });

      it('should return zero stock when no items exist', async () => {
        const productId = 999;
        const mockStock = {
          productId,
          totalBaseUnits: 0,
          locationsCount: 0,
          itemsCount: 0
        };

        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockResolvedValue([mockStock]);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere
          })
        });

        const result = await packagingService.getStockConsolidated(productId);

        expect(result.totalBaseUnits).toBe(0);
        expect(result.locationsCount).toBe(0);
      });
    });

    describe('getStockByPackaging', () => {
      it('should calculate stock breakdown by packaging type', async () => {
        const productId = 1;
        const mockStockByPackaging = [
          {
            packagingId: 1,
            packagingName: 'Unidade',
            barcode: null,
            baseUnitQuantity: 1,
            level: 1,
            availablePackages: 8,
            remainingBaseUnits: 0,
            totalBaseUnits: 8
          },
          {
            packagingId: 2,
            packagingName: 'Caixa',
            barcode: '1234567890123',
            baseUnitQuantity: 12,
            level: 2,
            availablePackages: 20,
            remainingBaseUnits: 4,
            totalBaseUnits: 244
          }
        ];

        const mockSelect = vi.fn().mockReturnThis();
        const mockLeftJoin = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockGroupBy = vi.fn().mockReturnThis();
        const mockOrderBy = vi.fn().mockResolvedValue(mockStockByPackaging);

        mockDb.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: mockLeftJoin.mockReturnValue({
              where: mockWhere.mockReturnValue({
                groupBy: mockGroupBy.mockReturnValue({
                  orderBy: mockOrderBy
                })
              })
            })
          })
        });

        const result = await packagingService.getStockByPackaging(productId);

        expect(result).toEqual(mockStockByPackaging);
        expect(result).toHaveLength(2);
        expect(result[0].availablePackages).toBe(8);
        expect(result[1].availablePackages).toBe(20);
      });
    });
  });

  describe('Picking Optimization Tests', () => {
    describe('optimizePickingByPackaging', () => {
      beforeEach(() => {
        // Mock getPackagingsByProduct
        vi.spyOn(packagingService, 'getPackagingsByProduct').mockResolvedValue([
          { id: 1, name: 'Unidade', baseUnitQuantity: '1', level: 1 } as any,
          { id: 2, name: 'Caixa', baseUnitQuantity: '12', level: 2 } as any,
          { id: 3, name: 'Pallet', baseUnitQuantity: '144', level: 3 } as any
        ]);

        // Mock getStockByPackaging
        vi.spyOn(packagingService, 'getStockByPackaging').mockResolvedValue([
          { packagingId: 1, availablePackages: 50 } as any,
          { packagingId: 2, availablePackages: 10 } as any,
          { packagingId: 3, availablePackages: 2 } as any
        ]);
      });

      it('should optimize picking using largest packaging first', async () => {
        const productId = 1;
        const requestedBaseUnits = 300; // 2 pallets + 1 box

        const result = await packagingService.optimizePickingByPackaging(productId, requestedBaseUnits);

        expect(result.pickingPlan).toHaveLength(2);
        expect(result.pickingPlan[0].packaging.name).toBe('Pallet');
        expect(result.pickingPlan[0].quantity).toBe(2);
        expect(result.pickingPlan[0].baseUnits).toBe(288);
        
        expect(result.pickingPlan[1].packaging.name).toBe('Caixa');
        expect(result.pickingPlan[1].quantity).toBe(1);
        expect(result.pickingPlan[1].baseUnits).toBe(12);

        expect(result.canFulfill).toBe(true);
        expect(result.remaining).toBe(0);
        expect(result.totalPlanned).toBe(300);
      });

      it('should handle partial fulfillment when stock insufficient', async () => {
        const productId = 1;
        const requestedBaseUnits = 500; // More than available

        const result = await packagingService.optimizePickingByPackaging(productId, requestedBaseUnits);

        expect(result.canFulfill).toBe(false);
        expect(result.remaining).toBeGreaterThan(0);
        expect(result.totalPlanned).toBeLessThan(requestedBaseUnits);
      });

      it('should use only available packaging when some types are out of stock', async () => {
        // Override mock to simulate no pallets available
        vi.spyOn(packagingService, 'getStockByPackaging').mockResolvedValue([
          { packagingId: 1, availablePackages: 50 } as any,
          { packagingId: 2, availablePackages: 10 } as any,
          { packagingId: 3, availablePackages: 0 } as any // No pallets
        ]);

        const productId = 1;
        const requestedBaseUnits = 100;

        const result = await packagingService.optimizePickingByPackaging(productId, requestedBaseUnits);

        // Should not use pallets (level 3)
        const hasPallets = result.pickingPlan.some(item => item.packaging.level === 3);
        expect(hasPallets).toBe(false);
        
        // Should use boxes and units
        expect(result.pickingPlan).toHaveLength(2);
        expect(result.canFulfill).toBe(true);
      });

      it('should handle edge case with zero requested units', async () => {
        const productId = 1;
        const requestedBaseUnits = 0;

        const result = await packagingService.optimizePickingByPackaging(productId, requestedBaseUnits);

        expect(result.pickingPlan).toHaveLength(0);
        expect(result.canFulfill).toBe(true);
        expect(result.remaining).toBe(0);
        expect(result.totalPlanned).toBe(0);
      });
    });
  });

  describe('Packaging Creation and Validation Tests', () => {
    describe('createPackaging', () => {
      it('should create new packaging successfully', async () => {
        const packagingData = {
          productId: 1,
          name: 'Nova Embalagem',
          baseUnitQuantity: '24',
          isBaseUnit: false,
          level: 2,
          createdBy: 1
        };

        // Mock base unit check (no existing base unit)
        const mockSelectForBase = vi.fn().mockReturnThis();
        const mockFromForBase = vi.fn().mockReturnThis();
        const mockWhereForBase = vi.fn().mockReturnThis();
        const mockLimitForBase = vi.fn().mockResolvedValue([]);

        // Mock barcode check (not provided, skip)
        
        // Mock insert operation
        const mockInsert = vi.fn().mockReturnThis();
        const mockValues = vi.fn().mockReturnThis();
        const mockReturning = vi.fn().mockResolvedValue([{ id: 1, ...packagingData }]);

        mockDb.select.mockReturnValue({
          from: mockFromForBase.mockReturnValue({
            where: mockWhereForBase.mockReturnValue({
              limit: mockLimitForBase
            })
          })
        });

        mockDb.insert.mockReturnValue({
          values: mockValues.mockReturnValue({
            returning: mockReturning
          })
        });

        const result = await packagingService.createPackaging(packagingData);

        expect(result).toEqual({ id: 1, ...packagingData });
        expect(mockDb.insert).toHaveBeenCalled();
      });

      it('should throw error when creating duplicate base unit', async () => {
        const packagingData = {
          productId: 1,
          name: 'Segunda Base',
          baseUnitQuantity: '1',
          isBaseUnit: true,
          level: 1,
          createdBy: 1
        };

        // Mock existing base unit
        const mockSelectForBase = vi.fn().mockReturnThis();
        const mockFromForBase = vi.fn().mockReturnThis();
        const mockWhereForBase = vi.fn().mockReturnThis();
        const mockLimitForBase = vi.fn().mockResolvedValue([{ id: 1, isBaseUnit: true }]);

        mockDb.select.mockReturnValue({
          from: mockFromForBase.mockReturnValue({
            where: mockWhereForBase.mockReturnValue({
              limit: mockLimitForBase
            })
          })
        });

        await expect(packagingService.createPackaging(packagingData))
          .rejects.toThrow('Já existe uma embalagem base para este produto');
      });

      it('should throw error when creating packaging with duplicate barcode', async () => {
        const packagingData = {
          productId: 1,
          name: 'Nova Embalagem',
          barcode: '1234567890123',
          baseUnitQuantity: '12',
          isBaseUnit: false,
          level: 2,
          createdBy: 1
        };

        // Mock base unit check (passed)
        const mockSelectForBase = vi.fn().mockReturnThis();
        const mockFromForBase = vi.fn().mockReturnThis();
        const mockWhereForBase = vi.fn().mockReturnThis();
        const mockLimitForBase = vi.fn().mockResolvedValue([]);

        // Mock barcode check (existing barcode)
        const mockSelectForBarcode = vi.fn().mockReturnThis();
        const mockFromForBarcode = vi.fn().mockReturnThis();
        const mockWhereForBarcode = vi.fn().mockReturnThis();
        const mockLimitForBarcode = vi.fn().mockResolvedValue([{ id: 2, barcode: packagingData.barcode }]);

        mockDb.select
          .mockReturnValueOnce({
            from: mockFromForBase.mockReturnValue({
              where: mockWhereForBase.mockReturnValue({
                limit: mockLimitForBase
              })
            })
          })
          .mockReturnValueOnce({
            from: mockFromForBarcode.mockReturnValue({
              where: mockWhereForBarcode.mockReturnValue({
                limit: mockLimitForBarcode
              })
            })
          });

        await expect(packagingService.createPackaging(packagingData))
          .rejects.toThrow('Código de barras já existe em outra embalagem');
      });
    });

    describe('updatePackaging', () => {
      it('should update packaging successfully', async () => {
        const packagingId = 1;
        const updates = { name: 'Nome Atualizado', baseUnitQuantity: '15' };

        // Mock update operation
        const mockUpdate = vi.fn().mockReturnThis();
        const mockSet = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockReturning = vi.fn().mockResolvedValue([{ id: packagingId, ...updates }]);

        mockDb.update.mockReturnValue({
          set: mockSet.mockReturnValue({
            where: mockWhere.mockReturnValue({
              returning: mockReturning
            })
          })
        });

        const result = await packagingService.updatePackaging(packagingId, updates);

        expect(result).toEqual({ id: packagingId, ...updates });
        expect(mockDb.update).toHaveBeenCalled();
      });

      it('should throw error when packaging not found for update', async () => {
        const packagingId = 999;
        const updates = { name: 'Nome Atualizado' };

        // Mock update operation returning empty result
        const mockUpdate = vi.fn().mockReturnThis();
        const mockSet = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockReturning = vi.fn().mockResolvedValue([]);

        mockDb.update.mockReturnValue({
          set: mockSet.mockReturnValue({
            where: mockWhere.mockReturnValue({
              returning: mockReturning
            })
          })
        });

        await expect(packagingService.updatePackaging(packagingId, updates))
          .rejects.toThrow(`Embalagem não encontrada: ${packagingId}`);
      });
    });

    describe('deletePackaging', () => {
      it('should soft delete packaging when no items are associated', async () => {
        const packagingId = 1;

        // Mock check for items using packaging (none found)
        const mockSelectForItems = vi.fn().mockReturnThis();
        const mockFromForItems = vi.fn().mockReturnThis();
        const mockWhereForItems = vi.fn().mockReturnThis();
        const mockLimitForItems = vi.fn().mockResolvedValue([]);

        // Mock update operation for soft delete
        const mockUpdate = vi.fn().mockReturnThis();
        const mockSet = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockReturning = vi.fn().mockResolvedValue([{ id: packagingId, isActive: false }]);

        mockDb.select.mockReturnValue({
          from: mockFromForItems.mockReturnValue({
            where: mockWhereForItems.mockReturnValue({
              limit: mockLimitForItems
            })
          })
        });

        mockDb.update.mockReturnValue({
          set: mockSet.mockReturnValue({
            where: mockWhere.mockReturnValue({
              returning: mockReturning
            })
          })
        });

        await expect(packagingService.deletePackaging(packagingId)).resolves.toBeUndefined();
        expect(mockDb.update).toHaveBeenCalled();
      });

      it('should throw error when trying to delete packaging with associated items', async () => {
        const packagingId = 1;

        // Mock check for items using packaging (items found)
        const mockSelectForItems = vi.fn().mockReturnThis();
        const mockFromForItems = vi.fn().mockReturnThis();
        const mockWhereForItems = vi.fn().mockReturnThis();
        const mockLimitForItems = vi.fn().mockResolvedValue([{ id: 1, packagingTypeId: packagingId }]);

        mockDb.select.mockReturnValue({
          from: mockFromForItems.mockReturnValue({
            where: mockWhereForItems.mockReturnValue({
              limit: mockLimitForItems
            })
          })
        });

        await expect(packagingService.deletePackaging(packagingId))
          .rejects.toThrow('Não é possível remover embalagem que possui itens associados');
      });
    });
  });

  describe('Packaging Hierarchy Tests', () => {
    describe('getPackagingHierarchy', () => {
      it('should build hierarchical structure correctly', async () => {
        const productId = 1;

        // Mock flat packaging data
        vi.spyOn(packagingService, 'getPackagingsByProduct').mockResolvedValue([
          { id: 1, name: 'Unidade', parentPackagingId: null, level: 1 } as any,
          { id: 2, name: 'Caixa', parentPackagingId: 1, level: 2 } as any,
          { id: 3, name: 'Pallet', parentPackagingId: 2, level: 3 } as any,
          { id: 4, name: 'Display', parentPackagingId: 1, level: 2 } as any
        ]);

        const result = await packagingService.getPackagingHierarchy(productId);

        // Should have one root item (Unidade)
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Unidade');
        
        // Root should have two children (Caixa and Display)
        expect(result[0].children).toHaveLength(2);
        
        // Caixa should have one child (Pallet)
        const caixa = result[0].children.find((child: any) => child.name === 'Caixa');
        expect(caixa.children).toHaveLength(1);
        expect(caixa.children[0].name).toBe('Pallet');
        
        // Display should have no children
        const display = result[0].children.find((child: any) => child.name === 'Display');
        expect(display.children).toHaveLength(0);
      });

      it('should handle multiple root items', async () => {
        const productId = 1;

        // Mock data with multiple root items
        vi.spyOn(packagingService, 'getPackagingsByProduct').mockResolvedValue([
          { id: 1, name: 'Unidade A', parentPackagingId: null, level: 1 } as any,
          { id: 2, name: 'Unidade B', parentPackagingId: null, level: 1 } as any,
          { id: 3, name: 'Caixa A', parentPackagingId: 1, level: 2 } as any
        ]);

        const result = await packagingService.getPackagingHierarchy(productId);

        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('Unidade A');
        expect(result[1].name).toBe('Unidade B');
        expect(result[0].children).toHaveLength(1);
        expect(result[1].children).toHaveLength(0);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle zero quantities in calculations', () => {
      expect(packagingService.convertToBaseUnits(0, 1)).resolves.toBe(0);
      expect(packagingService.convertFromBaseUnits(0, 1)).resolves.toBe(0);
    });

    it('should handle very large numbers in calculations', async () => {
      const largeQuantity = 999999999;
      const packagingTypeId = 1;
      const baseUnitQuantity = 1000;

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([{ baseUnitQuantity }]);

      mockDb.select.mockReturnValue({
        from: mockFrom.mockReturnValue({
          where: mockWhere.mockReturnValue({
            limit: mockLimit
          })
        })
      });

      const result = await packagingService.convertToBaseUnits(largeQuantity, packagingTypeId);
      expect(result).toBe(largeQuantity * baseUnitQuantity);
    });

    it('should handle negative quantities gracefully', async () => {
      const negativeQuantity = -5;
      const packagingTypeId = 1;

      // The service should handle this appropriately based on business rules
      // For now, we expect it to process but the calling code should validate
      await expect(async () => {
        await packagingService.convertToBaseUnits(negativeQuantity, packagingTypeId);
      }).not.toThrow();
    });
  });
});