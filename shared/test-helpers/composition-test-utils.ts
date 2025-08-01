/**
 * Shared test utilities for packaging composition testing
 * Provides common test helpers, mock factories, and validation utilities
 */

import { 
  CompositionRequest, 
  CompositionResult, 
  ValidationResult, 
  PackagingComposition,
  Product,
  PackagingType,
  Pallet 
} from '../../frontend/src/types/api';

// Mock data factories
export class CompositionTestDataFactory {
  
  static createMockProduct(overrides: Partial<Product> = {}): Product {
    return {
      id: 1,
      name: 'Test Product',
      code: 'TEST001',
      description: 'Test product for composition testing',
      weight: '10.5',
      dimensions: {
        width: 20,
        length: 30,
        height: 15
      },
      category: 'Electronics',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      createdBy: 1,
      ...overrides
    };
  }

  static createMockPackagingType(overrides: Partial<PackagingType> = {}): PackagingType {
    return {
      id: 1,
      productId: 1,
      name: 'Unit',
      description: 'Individual unit packaging',
      isBaseUnit: true,
      multiplier: 1,
      barcode: 'TEST001UNIT',
      dimensions: {
        width: 20,
        length: 30,
        height: 15
      },
      weight: '10.5',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      createdBy: 1,
      ...overrides
    };
  }

  static createMockPallet(overrides: Partial<Pallet> = {}): Pallet {
    return {
      id: 1,
      code: 'PAL001',
      type: 'standard',
      width: '120',
      length: '100',
      height: '15',
      maxWeight: '1000',
      status: 'disponivel',
      location: 'DOCK-01',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      createdBy: 1,
      ...overrides
    };
  }

  static createMockCompositionRequest(overrides: Partial<CompositionRequest> = {}): CompositionRequest {
    return {
      products: [
        {
          productId: 1,
          quantity: 10,
          packagingTypeId: 1
        }
      ],
      palletId: 1,
      constraints: {
        maxWeight: 800,
        maxHeight: 180,
        maxVolume: 2.0
      },
      ...overrides
    };
  }

  static createMockCompositionResult(overrides: Partial<CompositionResult> = {}): CompositionResult {
    return {
      isValid: true,
      efficiency: 0.85,
      layout: {
        layers: 2,
        itemsPerLayer: 5,
        totalItems: 10,
        arrangement: [
          {
            productId: 1,
            packagingTypeId: 1,
            quantity: 1,
            position: { x: 0, y: 0, z: 0 },
            dimensions: { width: 20, length: 30, height: 15 }
          }
        ]
      },
      weight: {
        total: 105,
        limit: 1000,
        utilization: 0.105
      },
      volume: {
        total: 0.9,
        limit: 2.4,
        utilization: 0.375
      },
      height: {
        total: 30,
        limit: 200,
        utilization: 0.15
      },
      recommendations: [
        'Consider optimizing product arrangement for better space utilization'
      ],
      warnings: [],
      products: [
        {
          productId: 1,
          packagingTypeId: 1,
          quantity: 10,
          totalWeight: 105,
          totalVolume: 0.9,
          efficiency: 0.85,
          canFit: true,
          issues: []
        }
      ],
      ...overrides
    };
  }

  static createMockValidationResult(overrides: Partial<ValidationResult> = {}): ValidationResult {
    return {
      isValid: true,
      violations: [],
      warnings: [],
      metrics: {
        totalWeight: 105,
        totalVolume: 0.9,
        totalHeight: 30,
        efficiency: 0.85
      },
      ...overrides
    };
  }

  static createMockPackagingComposition(overrides: Partial<PackagingComposition> = {}): PackagingComposition {
    return {
      id: 1,
      name: 'Test Composition',
      description: 'Test composition for unit testing',
      status: 'draft',
      palletId: 1,
      constraints: {
        maxWeight: 800,
        maxHeight: 180,
        maxVolume: 2.0
      },
      result: this.createMockCompositionResult(),
      efficiency: '0.85',
      totalWeight: '105',
      totalVolume: '0.9',
      totalHeight: '30',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      createdBy: 1,
      products: [
        {
          id: 1,
          compositionId: 1,
          productId: 1,
          packagingTypeId: 1,
          quantity: 10,
          layer: 1,
          sortOrder: 0,
          isActive: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          addedBy: 1
        }
      ],
      pallet: this.createMockPallet(),
      ...overrides
    };
  }

  // Edge case data generators
  static createInvalidCompositionRequest(): CompositionRequest {
    return {
      products: [
        {
          productId: -1, // Invalid ID
          quantity: -5, // Negative quantity
          packagingTypeId: 0 // Invalid packaging type
        }
      ],
      palletId: -1, // Invalid pallet ID
      constraints: {
        maxWeight: -100, // Negative constraint
        maxHeight: 0, // Zero constraint
        maxVolume: Infinity // Invalid constraint
      }
    };
  }

  static createOverloadedCompositionRequest(): CompositionRequest {
    return {
      products: Array.from({ length: 100 }, (_, i) => ({
        productId: i + 1,
        quantity: 50,
        packagingTypeId: i + 1
      })),
      palletId: 1,
      constraints: {
        maxWeight: 10000,
        maxHeight: 500,
        maxVolume: 50
      }
    };
  }

  static createMinimalCompositionRequest(): CompositionRequest {
    return {
      products: [
        {
          productId: 1,
          quantity: 1
        }
      ]
    };
  }
}

// Test assertion utilities
export class CompositionTestAssertions {
  
  static assertValidCompositionResult(result: CompositionResult): void {
    expect(result).toBeDefined();
    expect(result.isValid).toBeDefined();
    expect(result.efficiency).toBeGreaterThanOrEqual(0);
    expect(result.efficiency).toBeLessThanOrEqual(1);
    
    // Layout assertions
    expect(result.layout).toBeDefined();
    expect(result.layout.totalItems).toBeGreaterThanOrEqual(0);
    expect(result.layout.layers).toBeGreaterThanOrEqual(0);
    expect(result.layout.itemsPerLayer).toBeGreaterThanOrEqual(0);
    expect(result.layout.arrangement).toBeInstanceOf(Array);

    // Weight assertions
    expect(result.weight.total).toBeGreaterThanOrEqual(0);
    expect(result.weight.limit).toBeGreaterThan(0);
    expect(result.weight.utilization).toBeGreaterThanOrEqual(0);

    // Volume assertions
    expect(result.volume.total).toBeGreaterThanOrEqual(0);
    expect(result.volume.limit).toBeGreaterThan(0);
    expect(result.volume.utilization).toBeGreaterThanOrEqual(0);

    // Height assertions
    expect(result.height.total).toBeGreaterThanOrEqual(0);
    expect(result.height.limit).toBeGreaterThan(0);
    expect(result.height.utilization).toBeGreaterThanOrEqual(0);

    // Arrays assertions
    expect(result.recommendations).toBeInstanceOf(Array);
    expect(result.warnings).toBeInstanceOf(Array);
    expect(result.products).toBeInstanceOf(Array);
  }

  static assertValidationViolations(result: ValidationResult, expectedViolationTypes: string[]): void {
    expect(result.isValid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    
    const actualTypes = result.violations.map(v => v.type);
    expectedViolationTypes.forEach(expectedType => {
      expect(actualTypes).toContain(expectedType);
    });

    result.violations.forEach(violation => {
      expect(violation.type).toMatch(/weight|volume|height|compatibility/);
      expect(violation.severity).toMatch(/error|warning/);
      expect(violation.message).toBeTruthy();
      expect(violation.affectedProducts).toBeInstanceOf(Array);
    });
  }

  static assertPerformanceMetrics(
    executionTime: number, 
    maxTime: number, 
    memoryIncrease?: number, 
    maxMemory?: number
  ): void {
    expect(executionTime).toBeLessThanOrEqual(maxTime);
    expect(executionTime).toBeGreaterThan(0);
    
    if (memoryIncrease !== undefined && maxMemory !== undefined) {
      expect(memoryIncrease).toBeLessThanOrEqual(maxMemory);
    }
  }

  static assertCompositionConsistency(composition: PackagingComposition): void {
    expect(composition.id).toBeGreaterThan(0);
    expect(composition.name).toBeTruthy();
    expect(composition.status).toMatch(/draft|validated|approved|executed/);
    
    // Efficiency consistency
    const resultEfficiency = composition.result.efficiency;
    const storedEfficiency = parseFloat(composition.efficiency);
    expect(Math.abs(resultEfficiency - storedEfficiency)).toBeLessThan(0.01);

    // Weight consistency
    const resultWeight = composition.result.weight.total;
    const storedWeight = parseFloat(composition.totalWeight);
    expect(Math.abs(resultWeight - storedWeight)).toBeLessThan(0.01);

    // Products consistency
    expect(composition.products.length).toBeGreaterThan(0);
    const calculatedTotalQuantity = composition.products.reduce((sum, p) => sum + p.quantity, 0);
    const layoutTotalItems = composition.result.layout.totalItems;
    expect(calculatedTotalQuantity).toBe(layoutTotalItems);
  }
}

// Test performance utilities
export class CompositionPerformanceUtils {
  
  static async measureExecutionTime<T>(operation: () => Promise<T>): Promise<{ result: T; executionTime: number }> {
    const startTime = Date.now();
    const result = await operation();
    const executionTime = Date.now() - startTime;
    
    return { result, executionTime };
  }

  static measureMemoryUsage<T>(operation: () => T): { result: T; memoryDelta: number } {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const memoryBefore = process.memoryUsage().heapUsed;
    const result = operation();
    
    if (global.gc) {
      global.gc();
    }
    
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryDelta = memoryAfter - memoryBefore;
    
    return { result, memoryDelta };
  }

  static async benchmarkOperation<T>(
    operation: () => Promise<T>, 
    iterations: number = 10
  ): Promise<{
    averageTime: number;
    minTime: number;
    maxTime: number;
    totalTime: number;
    throughput: number;
  }> {
    const times: number[] = [];
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const iterationStart = Date.now();
      await operation();
      const iterationEnd = Date.now();
      times.push(iterationEnd - iterationStart);
    }

    const totalTime = Date.now() - startTime;
    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const throughput = (iterations / totalTime) * 1000; // operations per second

    return {
      averageTime,
      minTime,
      maxTime,
      totalTime,
      throughput
    };
  }
}

// Mock service utilities
export class CompositionMockUtils {
  
  static createMockDbQueries() {
    return {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([])
        })
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([])
          })
        })
      }),
      delete: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([])
      })
    };
  }

  static createMockPackagingService() {
    return {
      getStockConsolidated: jest.fn().mockResolvedValue({
        totalBaseUnits: 100,
        availableStock: 100
      }),
      convertToBaseUnits: jest.fn().mockResolvedValue(10),
      convertFromBaseUnits: jest.fn().mockResolvedValue(1),
      getPackagingsByProduct: jest.fn().mockResolvedValue([]),
      getStockByPackaging: jest.fn().mockResolvedValue([]),
      getPackagingHierarchy: jest.fn().mockResolvedValue([])
    };
  }

  static setupMockCompositionService() {
    const mockService = {
      calculateOptimalComposition: jest.fn(),
      validateCompositionConstraints: jest.fn(),
      saveComposition: jest.fn(),
      getCompositionById: jest.fn(),
      listCompositions: jest.fn(),
      updateCompositionStatus: jest.fn(),
      deleteComposition: jest.fn(),
      generateCompositionReport: jest.fn(),
      assembleComposition: jest.fn(),
      disassembleComposition: jest.fn()
    };

    // Default implementations
    mockService.calculateOptimalComposition.mockResolvedValue(
      CompositionTestDataFactory.createMockCompositionResult()
    );
    
    mockService.validateCompositionConstraints.mockResolvedValue(
      CompositionTestDataFactory.createMockValidationResult()
    );
    
    mockService.getCompositionById.mockResolvedValue(
      CompositionTestDataFactory.createMockPackagingComposition()
    );

    return mockService;
  }
}

// Test scenario generators
export class CompositionTestScenarios {
  
  static getStandardTestScenarios(): Array<{
    name: string;
    request: CompositionRequest;
    expectedValid: boolean;
    description: string;
  }> {
    return [
      {
        name: 'Valid small composition',
        request: CompositionTestDataFactory.createMockCompositionRequest({
          products: [{ productId: 1, quantity: 5, packagingTypeId: 1 }]
        }),
        expectedValid: true,
        description: 'Should validate a small, simple composition'
      },
      {
        name: 'Valid multi-product composition',
        request: CompositionTestDataFactory.createMockCompositionRequest({
          products: [
            { productId: 1, quantity: 10, packagingTypeId: 1 },
            { productId: 2, quantity: 5, packagingTypeId: 2 },
            { productId: 3, quantity: 3, packagingTypeId: 3 }
          ]
        }),
        expectedValid: true,
        description: 'Should validate a multi-product composition'
      },
      {
        name: 'Overweight composition',
        request: CompositionTestDataFactory.createMockCompositionRequest({
          products: [{ productId: 1, quantity: 200, packagingTypeId: 1 }], // Very heavy
          constraints: { maxWeight: 100 } // Low weight limit
        }),
        expectedValid: false,
        description: 'Should reject composition that exceeds weight limits'
      },
      {
        name: 'Over-volume composition',
        request: CompositionTestDataFactory.createMockCompositionRequest({
          products: [{ productId: 1, quantity: 100, packagingTypeId: 1 }], // Large volume
          constraints: { maxVolume: 0.1 } // Very small volume limit
        }),
        expectedValid: false,
        description: 'Should reject composition that exceeds volume limits'
      },
      {
        name: 'Minimal valid composition',
        request: CompositionTestDataFactory.createMinimalCompositionRequest(),
        expectedValid: true,
        description: 'Should validate minimal composition with single product'
      }
    ];
  }

  static getPerformanceTestScenarios(): Array<{
    name: string;
    request: CompositionRequest;
    maxExecutionTime: number;
    description: string;
  }> {
    return [
      {
        name: 'Single product performance',
        request: CompositionTestDataFactory.createMockCompositionRequest({
          products: [{ productId: 1, quantity: 10 }]
        }),
        maxExecutionTime: 100, // 100ms
        description: 'Single product should calculate quickly'
      },
      {
        name: 'Medium complexity performance',
        request: CompositionTestDataFactory.createMockCompositionRequest({
          products: Array.from({ length: 10 }, (_, i) => ({
            productId: i + 1,
            quantity: 5 + i,
            packagingTypeId: (i % 3) + 1
          }))
        }),
        maxExecutionTime: 500, // 500ms
        description: '10 products should calculate within reasonable time'
      },
      {
        name: 'High complexity performance',
        request: CompositionTestDataFactory.createMockCompositionRequest({
          products: Array.from({ length: 50 }, (_, i) => ({
            productId: (i % 10) + 1,
            quantity: 2 + (i % 5),
            packagingTypeId: (i % 5) + 1
          }))
        }),
        maxExecutionTime: 2000, // 2 seconds
        description: '50 products should calculate within 2 seconds'
      }
    ];
  }

  static getErrorTestScenarios(): Array<{
    name: string;
    request: CompositionRequest;
    expectedError: string | RegExp;
    description: string;
  }> {
    return [
      {
        name: 'Non-existent product',
        request: CompositionTestDataFactory.createMockCompositionRequest({
          products: [{ productId: 99999, quantity: 10 }]
        }),
        expectedError: /produto não encontrado/i,
        description: 'Should throw error for non-existent product'
      },
      {
        name: 'Non-existent pallet',
        request: CompositionTestDataFactory.createMockCompositionRequest({
          palletId: 99999
        }),
        expectedError: /pallet não encontrado/i,
        description: 'Should throw error for non-existent pallet'
      },
      {
        name: 'Invalid constraints',
        request: CompositionTestDataFactory.createInvalidCompositionRequest(),
        expectedError: /invalid|constraint/i,
        description: 'Should handle invalid constraints gracefully'
      }
    ];
  }
}

// Export all utilities
export {
  CompositionTestDataFactory,
  CompositionTestAssertions,
  CompositionPerformanceUtils,
  CompositionMockUtils,
  CompositionTestScenarios
};