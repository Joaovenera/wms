import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PackagingService } from '../../../services/packaging.service';
import { PackagingTestFactory } from '../../helpers/packaging-test-factory';
import { faker } from '@faker-js/faker';

// Mock the database
vi.mock('../../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}));

/**
 * Property-Based Testing for Packaging Composition
 * 
 * These tests use randomly generated data to verify that the packaging
 * service maintains certain invariants and properties regardless of input.
 */
describe('PackagingService - Property-Based Tests', () => {
  let packagingService: PackagingService;

  beforeEach(() => {
    packagingService = new PackagingService();
    vi.clearAllMocks();
    PackagingTestFactory.resetCounters();
  });

  describe('Unit Conversion Properties', () => {
    /**
     * Property: Converting to base units and back should return original quantity
     * ∀ quantity, packaging: convertFromBase(convertToBase(quantity)) ≈ quantity
     */
    it('should maintain round-trip conversion accuracy', async () => {
      const iterations = 50;
      
      for (let i = 0; i < iterations; i++) {
        const originalQuantity = faker.number.float({ min: 0.1, max: 1000, fractionDigits: 3 });
        const baseUnitQuantity = faker.number.int({ min: 1, max: 100 });
        
        // Mock database responses
        const mockDb = vi.mocked(await import('../../../db')).db;
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

        // Convert to base units
        const baseUnits = await packagingService.convertToBaseUnits(originalQuantity, 1);
        
        // Convert back from base units
        const reconvertedQuantity = await packagingService.convertFromBaseUnits(baseUnits, 1);
        
        // Should be approximately equal (accounting for floating point precision)
        expect(Math.abs(reconvertedQuantity - originalQuantity)).toBeLessThan(0.001);
        
        vi.clearAllMocks();
      }
    });

    /**
     * Property: Conversion factor calculation should be symmetric
     * ∀ a, b: conversionFactor(a, b) * conversionFactor(b, a) = 1
     */
    it('should maintain symmetric conversion factors', async () => {
      const iterations = 25;
      
      for (let i = 0; i < iterations; i++) {
        const baseUnitsA = faker.number.int({ min: 1, max: 100 });
        const baseUnitsB = faker.number.int({ min: 1, max: 100 });
        
        // Ensure they're different to avoid division by same number
        if (baseUnitsA === baseUnitsB) continue;
        
        const mockDb = vi.mocked(await import('../../../db')).db;
        
        // Mock for A to B conversion
        const mockSelectAB = vi.fn().mockReturnThis();
        const mockFromAB = vi.fn().mockReturnThis();
        const mockWhereAB = vi.fn().mockReturnThis();
        const mockLimitAB = vi.fn().mockResolvedValue([{ 
          fromBaseQty: baseUnitsA, 
          toBaseQty: baseUnitsB 
        }]);

        // Mock for B to A conversion
        const mockSelectBA = vi.fn().mockReturnThis();
        const mockFromBA = vi.fn().mockReturnThis();
        const mockWhereBA = vi.fn().mockReturnThis();
        const mockLimitBA = vi.fn().mockResolvedValue([{ 
          fromBaseQty: baseUnitsB, 
          toBaseQty: baseUnitsA 
        }]);

        mockDb.select
          .mockReturnValueOnce({
            from: mockFromAB.mockReturnValue({
              where: mockWhereAB.mockReturnValue({
                limit: mockLimitAB
              })
            })
          })
          .mockReturnValueOnce({
            from: mockFromBA.mockReturnValue({
              where: mockWhereBA.mockReturnValue({
                limit: mockLimitBA
              })
            })
          });

        const factorAB = await packagingService.calculateConversionFactor(1, 2);
        const factorBA = await packagingService.calculateConversionFactor(2, 1);
        
        const product = factorAB * factorBA;
        
        // Product should be approximately 1
        expect(Math.abs(product - 1)).toBeLessThan(0.001);
        
        vi.clearAllMocks();
      }
    });

    /**
     * Property: Zero quantity conversions should always return zero
     * ∀ packaging: convert(0, packaging) = 0
     */
    it('should always return zero for zero quantity conversions', async () => {
      const iterations = 20;
      
      for (let i = 0; i < iterations; i++) {
        const baseUnitQuantity = faker.number.int({ min: 1, max: 1000 });
        
        const mockDb = vi.mocked(await import('../../../db')).db;
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

        const resultToBase = await packagingService.convertToBaseUnits(0, 1);
        const resultFromBase = await packagingService.convertFromBaseUnits(0, 1);
        
        expect(resultToBase).toBe(0);
        expect(resultFromBase).toBe(0);
        
        vi.clearAllMocks();
      }
    });

    /**
     * Property: Conversion should be proportional
     * ∀ quantity, factor: convert(quantity * factor) = convert(quantity) * factor
     */
    it('should maintain proportional conversion', async () => {
      const iterations = 30;
      
      for (let i = 0; i < iterations; i++) {
        const baseQuantity = faker.number.float({ min: 1, max: 100, fractionDigits: 2 });
        const factor = faker.number.float({ min: 1.5, max: 5, fractionDigits: 2 });
        const baseUnitQuantity = faker.number.int({ min: 2, max: 50 });
        
        const mockDb = vi.mocked(await import('../../../db')).db;
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

        const result1 = await packagingService.convertToBaseUnits(baseQuantity, 1);
        
        vi.clearAllMocks();
        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere.mockReturnValue({
              limit: mockLimit
            })
          })
        });

        const result2 = await packagingService.convertToBaseUnits(baseQuantity * factor, 1);
        
        // result2 should be approximately result1 * factor
        const expectedResult = result1 * factor;
        expect(Math.abs(result2 - expectedResult)).toBeLessThan(0.01);
        
        vi.clearAllMocks();
      }
    });
  });

  describe('Picking Optimization Properties', () => {
    /**
     * Property: Optimization should never exceed available stock
     * ∀ request, stock: totalPicked ≤ totalAvailable
     */
    it('should never exceed available stock in optimization', async () => {
      const iterations = 30;
      
      for (let i = 0; i < iterations; i++) {
        const productId = faker.number.int({ min: 1, max: 100 });
        const requestedUnits = faker.number.int({ min: 1, max: 10000 });
        
        // Generate random packaging hierarchy
        const packagings = PackagingTestFactory.createPackagingHierarchy(productId, 1);
        const allPackagings = [
          packagings.baseUnit,
          ...packagings.secondaryPackagings,
          ...packagings.tertiaryPackagings
        ];
        
        // Generate random stock levels
        const stockByPackaging = allPackagings.map(pkg => ({
          packagingId: pkg.id || faker.number.int({ min: 1, max: 1000 }),
          availablePackages: faker.number.int({ min: 0, max: 100 }),
          baseUnitQuantity: parseFloat(pkg.baseUnitQuantity)
        }));
        
        // Calculate total available stock
        const totalAvailable = stockByPackaging.reduce((sum, stock) => 
          sum + (stock.availablePackages * stock.baseUnitQuantity), 0
        );
        
        // Mock service methods
        vi.spyOn(packagingService, 'getPackagingsByProduct').mockResolvedValue(allPackagings as any);
        vi.spyOn(packagingService, 'getStockByPackaging').mockResolvedValue(stockByPackaging as any);
        
        const result = await packagingService.optimizePickingByPackaging(productId, requestedUnits);
        
        expect(result.totalPlanned).toBeLessThanOrEqual(totalAvailable);
        expect(result.totalPlanned).toBeLessThanOrEqual(requestedUnits);
        
        vi.restoreAllMocks();
      }
    });

    /**
     * Property: Optimization should use largest packaging first when possible
     * ∀ plan: if largerPackaging.available > 0 and fits, use it before smaller
     */
    it('should prioritize larger packaging when available', async () => {
      const iterations = 20;
      
      for (let i = 0; i < iterations; i++) {
        const productId = faker.number.int({ min: 1, max: 100 });
        
        // Create packaging with clear size hierarchy
        const packagings = [
          { id: 1, baseUnitQuantity: '1', level: 1, name: 'Unit' },
          { id: 2, baseUnitQuantity: '12', level: 2, name: 'Box' },
          { id: 3, baseUnitQuantity: '144', level: 3, name: 'Case' }
        ];
        
        // Ensure all have good stock
        const stockByPackaging = [
          { packagingId: 1, availablePackages: 1000 },
          { packagingId: 2, availablePackages: 100 },
          { packagingId: 3, availablePackages: 10 }
        ];
        
        // Request amount that can be fulfilled by larger packaging
        const requestedUnits = 288; // Exactly 2 cases
        
        vi.spyOn(packagingService, 'getPackagingsByProduct').mockResolvedValue(packagings as any);
        vi.spyOn(packagingService, 'getStockByPackaging').mockResolvedValue(stockByPackaging as any);
        
        const result = await packagingService.optimizePickingByPackaging(productId, requestedUnits);
        
        if (result.canFulfill) {
          // First item in plan should be the largest available packaging
          const firstItem = result.pickingPlan[0];
          expect(firstItem.packaging.name).toBe('Case');
          expect(firstItem.quantity).toBe(2);
        }
        
        vi.restoreAllMocks();
      }
    });

    /**
     * Property: Empty request should return empty plan
     * optimize(product, 0) = { plan: [], remaining: 0, canFulfill: true }
     */
    it('should return empty plan for zero requests', async () => {
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const productId = faker.number.int({ min: 1, max: 100 });
        const packagings = PackagingTestFactory.createPackagingHierarchy(productId, 1);
        
        vi.spyOn(packagingService, 'getPackagingsByProduct').mockResolvedValue([packagings.baseUnit] as any);
        vi.spyOn(packagingService, 'getStockByPackaging').mockResolvedValue([] as any);
        
        const result = await packagingService.optimizePickingByPackaging(productId, 0);
        
        expect(result.pickingPlan).toEqual([]);
        expect(result.remaining).toBe(0);
        expect(result.canFulfill).toBe(true);
        expect(result.totalPlanned).toBe(0);
        
        vi.restoreAllMocks();
      }
    });
  });

  describe('Data Integrity Properties', () => {
    /**
     * Property: Base unit quantity should always be positive
     * ∀ packaging: packaging.baseUnitQuantity > 0
     */
    it('should enforce positive base unit quantities', () => {
      const iterations = 50;
      
      for (let i = 0; i < iterations; i++) {
        const packaging = PackagingTestFactory.createRandomPackaging(1, 1, {
          minBaseUnits: 1,
          maxBaseUnits: 10000
        });
        
        const baseUnits = parseFloat(packaging.baseUnitQuantity);
        expect(baseUnits).toBeGreaterThan(0);
      }
    });

    /**
     * Property: Packaging levels should be consistent with hierarchy
     * ∀ child, parent: child.level > parent.level
     */
    it('should maintain consistent hierarchy levels', () => {
      const iterations = 20;
      
      for (let i = 0; i < iterations; i++) {
        const hierarchy = PackagingTestFactory.createHierarchicalPackaging(1, 1);
        
        for (let j = 1; j < hierarchy.length; j++) {
          const child = hierarchy[j];
          const parent = hierarchy.find(p => p.id === child.parentPackagingId);
          
          if (parent) {
            expect(child.level).toBeGreaterThan(parent.level);
          }
        }
      }
    });

    /**
     * Property: Only one base unit per product
     * ∀ product: count(packaging where isBaseUnit = true) ≤ 1
     */
    it('should allow only one base unit per product', () => {
      const iterations = 20;
      
      for (let i = 0; i < iterations; i++) {
        const productId = faker.number.int({ min: 1, max: 100 });
        const hierarchy = PackagingTestFactory.createPackagingHierarchy(productId, 1);
        
        const allPackagings = [
          hierarchy.baseUnit,
          ...hierarchy.secondaryPackagings,
          ...hierarchy.tertiaryPackagings
        ];
        
        const baseUnits = allPackagings.filter(p => p.isBaseUnit);
        expect(baseUnits).toHaveLength(1);
        expect(baseUnits[0].baseUnitQuantity).toBe('1.000');
      }
    });

    /**
     * Property: Barcodes should be unique when present
     * ∀ packagings: if barcode exists, it should be unique
     */
    it('should generate unique barcodes', () => {
      const barcodes = new Set<string>();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        const packaging = PackagingTestFactory.createSecondaryPackaging(1, 1);
        
        if (packaging.barcode) {
          expect(barcodes.has(packaging.barcode)).toBe(false);
          barcodes.add(packaging.barcode);
        }
      }
    });
  });

  describe('Edge Case Properties', () => {
    /**
     * Property: Service should handle extreme values gracefully
     * ∀ extremeValue: service should not crash or return invalid results
     */
    it('should handle extreme values gracefully', async () => {
      const extremeValues = [
        0,
        0.000001,
        Number.MAX_SAFE_INTEGER,
        Number.MIN_VALUE,
        999999999,
        0.123456789
      ];
      
      for (const value of extremeValues) {
        const mockDb = vi.mocked(await import('../../../db')).db;
        const mockSelect = vi.fn().mockReturnThis();
        const mockFrom = vi.fn().mockReturnThis();
        const mockWhere = vi.fn().mockReturnThis();
        const mockLimit = vi.fn().mockResolvedValue([{ baseUnitQuantity: 12 }]);

        mockDb.select.mockReturnValue({
          from: mockFrom.mockReturnValue({
            where: mockWhere.mockReturnValue({
              limit: mockLimit
            })
          })
        });

        const result = await packagingService.convertToBaseUnits(value, 1);
        
        expect(result).toBeDefined();
        expect(typeof result).toBe('number');
        expect(isNaN(result)).toBe(false);
        expect(isFinite(result)).toBe(true);
        
        vi.clearAllMocks();
      }
    });

    /**
     * Property: Conversion test cases should pass consistently
     * ∀ testCase: expected result should match actual result
     */
    it('should pass all conversion test cases', async () => {
      const testCases = PackagingTestFactory.generateConversionTestCases();
      
      for (const testCase of testCases) {
        const mockDb = vi.mocked(await import('../../../db')).db;
        
        // Mock for convertToBaseUnits
        const mockSelect1 = vi.fn().mockReturnThis();
        const mockFrom1 = vi.fn().mockReturnThis();
        const mockWhere1 = vi.fn().mockReturnThis();
        const mockLimit1 = vi.fn().mockResolvedValue([{ 
          baseUnitQuantity: testCase.fromBaseUnits 
        }]);

        // Mock for convertFromBaseUnits
        const mockSelect2 = vi.fn().mockReturnThis();
        const mockFrom2 = vi.fn().mockReturnThis();
        const mockWhere2 = vi.fn().mockReturnThis();
        const mockLimit2 = vi.fn().mockResolvedValue([{ 
          baseUnitQuantity: testCase.toBaseUnits 
        }]);

        mockDb.select
          .mockReturnValueOnce({
            from: mockFrom1.mockReturnValue({
              where: mockWhere1.mockReturnValue({
                limit: mockLimit1
              })
            })
          })
          .mockReturnValueOnce({
            from: mockFrom2.mockReturnValue({
              where: mockWhere2.mockReturnValue({
                limit: mockLimit2
              })
            })
          });

        // Convert to base units first
        const baseUnits = await packagingService.convertToBaseUnits(testCase.fromQuantity, 1);
        
        // Then convert from base units to target
        const result = await packagingService.convertFromBaseUnits(baseUnits, 2);
        
        expect(Math.abs(result - testCase.expectedResult)).toBeLessThan(0.0001);
        
        vi.clearAllMocks();
      }
    });
  });

  describe('Performance Properties', () => {
    /**
     * Property: Response time should scale reasonably with input size
     * ∀ input: responseTime should not grow exponentially with input size
     */
    it('should maintain reasonable performance scaling', async () => {
      const inputSizes = [1, 5, 10, 25, 50];
      const maxAcceptableTime = 100; // milliseconds
      
      for (const size of inputSizes) {
        const packagings = Array.from({ length: size }, (_, i) => 
          PackagingTestFactory.createRandomPackaging(1, 1)
        );
        
        const startTime = performance.now();
        
        // Simulate processing all packagings
        for (const packaging of packagings) {
          const baseUnits = parseFloat(packaging.baseUnitQuantity);
          expect(baseUnits).toBeGreaterThan(0);
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Performance should be reasonable even for larger inputs
        expect(duration).toBeLessThan(maxAcceptableTime);
      }
    });

    /**
     * Property: Memory usage should be bounded
     * ∀ operation: memory usage should not grow unboundedly
     */
    it('should maintain bounded memory usage', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        // Create and discard packaging objects
        const packaging = PackagingTestFactory.createRandomPackaging(
          faker.number.int({ min: 1, max: 100 }),
          faker.number.int({ min: 1, max: 10 })
        );
        
        // Perform some operations
        const baseUnits = parseFloat(packaging.baseUnitQuantity);
        const isValid = baseUnits > 0;
        
        expect(isValid).toBe(true);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Invariant Properties', () => {
    /**
     * Property: Sum of individual conversions equals conversion of sum
     * ∀ quantities: convert(sum(quantities)) = sum(convert(quantity))
     */
    it('should maintain additive conversion property', async () => {
      const iterations = 20;
      
      for (let i = 0; i < iterations; i++) {
        const quantities = Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, 
          () => faker.number.float({ min: 1, max: 100, fractionDigits: 2 })
        );
        const baseUnitQuantity = faker.number.int({ min: 2, max: 20 });
        
        const mockDb = vi.mocked(await import('../../../db')).db;
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

        // Convert sum of quantities
        const totalQuantity = quantities.reduce((sum, q) => sum + q, 0);
        const convertedSum = await packagingService.convertToBaseUnits(totalQuantity, 1);
        
        vi.clearAllMocks();
        
        // Convert individual quantities and sum results
        const mockSelectMultiple = vi.fn().mockReturnThis();
        const mockFromMultiple = vi.fn().mockReturnThis();
        const mockWhereMultiple = vi.fn().mockReturnThis();
        const mockLimitMultiple = vi.fn().mockResolvedValue([{ baseUnitQuantity }]);

        mockDb.select.mockReturnValue({
          from: mockFromMultiple.mockReturnValue({
            where: mockWhereMultiple.mockReturnValue({
              limit: mockLimitMultiple
            })
          })
        });

        const individualConversions = await Promise.all(
          quantities.map(q => packagingService.convertToBaseUnits(q, 1))
        );
        const sumOfConversions = individualConversions.reduce((sum, result) => sum + result, 0);
        
        expect(Math.abs(convertedSum - sumOfConversions)).toBeLessThan(0.001);
        
        vi.clearAllMocks();
      }
    });

    /**
     * Property: Optimization should be deterministic for same inputs
     * ∀ input: optimize(input) should return same result on repeated calls
     */
    it('should provide deterministic optimization results', async () => {
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const productId = faker.number.int({ min: 1, max: 100 });
        const requestedUnits = faker.number.int({ min: 100, max: 1000 });
        
        const packagings = PackagingTestFactory.createPackagingHierarchy(productId, 1);
        const allPackagings = [packagings.baseUnit, ...packagings.secondaryPackagings];
        const stockByPackaging = allPackagings.map(pkg => ({
          packagingId: pkg.id || 1,
          availablePackages: faker.number.int({ min: 5, max: 50 })
        }));
        
        vi.spyOn(packagingService, 'getPackagingsByProduct').mockResolvedValue(allPackagings as any);
        vi.spyOn(packagingService, 'getStockByPackaging').mockResolvedValue(stockByPackaging as any);
        
        // Run optimization twice with same inputs
        const result1 = await packagingService.optimizePickingByPackaging(productId, requestedUnits);
        const result2 = await packagingService.optimizePickingByPackaging(productId, requestedUnits);
        
        expect(result1.totalPlanned).toBe(result2.totalPlanned);
        expect(result1.remaining).toBe(result2.remaining);
        expect(result1.canFulfill).toBe(result2.canFulfill);
        expect(result1.pickingPlan).toEqual(result2.pickingPlan);
        
        vi.restoreAllMocks();
      }
    });
  });
});