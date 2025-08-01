import { faker } from '@faker-js/faker';

export interface TestPackagingType {
  id?: number;
  productId: number;
  name: string;
  barcode?: string;
  baseUnitQuantity: string;
  isBaseUnit: boolean;
  parentPackagingId?: number;
  level: number;
  dimensions?: {
    width: number;
    height: number;
    depth: number;
  };
  isActive: boolean;
  createdBy: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TestPackagingHierarchy {
  baseUnit: TestPackagingType;
  secondaryPackagings: TestPackagingType[];
  tertiaryPackagings: TestPackagingType[];
}

export interface TestStockItem {
  id?: number;
  ucpId: number;
  productId: number;
  quantity: string;
  lot?: string;
  expiryDate?: Date;
  packagingTypeId: number;
  addedBy: number;
}

export class PackagingTestFactory {
  private static packagingCounter = 0;
  private static barcodeCounter = 1000000000000;

  /**
   * Generate a unique barcode for testing
   */
  public static generateBarcode(): string {
    return (++this.barcodeCounter).toString();
  }

  /**
   * Create a base unit packaging type
   */
  public static createBaseUnit(productId: number, createdBy: number, overrides: Partial<TestPackagingType> = {}): TestPackagingType {
    const counter = ++this.packagingCounter;
    
    return {
      productId,
      name: `Unidade ${counter}`,
      baseUnitQuantity: '1.000',
      isBaseUnit: true,
      level: 1,
      isActive: true,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Create a secondary packaging (like boxes, packs)
   */
  public static createSecondaryPackaging(
    productId: number, 
    createdBy: number, 
    baseUnitQuantity: number = 12,
    overrides: Partial<TestPackagingType> = {}
  ): TestPackagingType {
    const counter = ++this.packagingCounter;
    const commonBoxSizes = [6, 12, 24, 36, 48];
    const quantity = overrides.baseUnitQuantity ? 
      parseFloat(overrides.baseUnitQuantity) : 
      (baseUnitQuantity || faker.helpers.arrayElement(commonBoxSizes));
    
    return {
      productId,
      name: `Caixa ${quantity}un ${counter}`,
      barcode: this.generateBarcode(),
      baseUnitQuantity: `${quantity}.000`,
      isBaseUnit: false,
      level: 2,
      dimensions: {
        width: faker.number.int({ min: 10, max: 50 }),
        height: faker.number.int({ min: 10, max: 30 }),
        depth: faker.number.int({ min: 10, max: 40 })
      },
      isActive: true,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Create a tertiary packaging (like displays, master cases)
   */
  public static createTertiaryPackaging(
    productId: number, 
    createdBy: number, 
    baseUnitQuantity: number = 144,
    overrides: Partial<TestPackagingType> = {}
  ): TestPackagingType {
    const counter = ++this.packagingCounter;
    const commonDisplaySizes = [72, 144, 288, 576];
    const quantity = overrides.baseUnitQuantity ? 
      parseFloat(overrides.baseUnitQuantity) : 
      (baseUnitQuantity || faker.helpers.arrayElement(commonDisplaySizes));
    
    return {
      productId,
      name: `Display ${quantity}un ${counter}`,
      barcode: this.generateBarcode(),
      baseUnitQuantity: `${quantity}.000`,
      isBaseUnit: false,
      level: 3,
      dimensions: {
        width: faker.number.int({ min: 40, max: 80 }),
        height: faker.number.int({ min: 30, max: 60 }),
        depth: faker.number.int({ min: 30, max: 70 })
      },
      isActive: true,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Create a pallet-level packaging
   */
  public static createPalletPackaging(
    productId: number, 
    createdBy: number, 
    baseUnitQuantity: number = 1440,
    overrides: Partial<TestPackagingType> = {}
  ): TestPackagingType {
    const counter = ++this.packagingCounter;
    const commonPalletSizes = [1440, 2880, 5760];
    const quantity = overrides.baseUnitQuantity ? 
      parseFloat(overrides.baseUnitQuantity) : 
      (baseUnitQuantity || faker.helpers.arrayElement(commonPalletSizes));
    
    return {
      productId,
      name: `Pallet ${quantity}un ${counter}`,
      barcode: this.generateBarcode(),
      baseUnitQuantity: `${quantity}.000`,
      isBaseUnit: false,
      level: 4,
      dimensions: {
        width: 120, // Standard pallet width
        height: 100, // Standard pallet depth
        depth: faker.number.int({ min: 100, max: 200 }) // Variable height
      },
      isActive: true,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  /**
   * Create a complete packaging hierarchy for a product
   */
  public static createPackagingHierarchy(
    productId: number, 
    createdBy: number, 
    options: {
      includeSecondary?: boolean;
      includeTertiary?: boolean;
      includePallet?: boolean;
      secondaryCount?: number;
      tertiaryCount?: number;
    } = {}
  ): TestPackagingHierarchy {
    const {
      includeSecondary = true,
      includeTertiary = true,
      includePallet = true,
      secondaryCount = 2,
      tertiaryCount = 1
    } = options;

    const baseUnit = this.createBaseUnit(productId, createdBy);
    
    const secondaryPackagings: TestPackagingType[] = [];
    if (includeSecondary) {
      for (let i = 0; i < secondaryCount; i++) {
        const quantities = [6, 12, 18, 24, 30, 36];
        secondaryPackagings.push(
          this.createSecondaryPackaging(productId, createdBy, quantities[i % quantities.length])
        );
      }
    }

    const tertiaryPackagings: TestPackagingType[] = [];
    if (includeTertiary) {
      for (let i = 0; i < tertiaryCount; i++) {
        const quantities = [72, 144, 216, 288];
        tertiaryPackagings.push(
          this.createTertiaryPackaging(productId, createdBy, quantities[i % quantities.length])
        );
      }
    }

    if (includePallet) {
      tertiaryPackagings.push(
        this.createPalletPackaging(productId, createdBy)
      );
    }

    return {
      baseUnit,
      secondaryPackagings,
      tertiaryPackagings
    };
  }

  /**
   * Create hierarchical packaging with parent-child relationships
   */
  public static createHierarchicalPackaging(
    productId: number, 
    createdBy: number
  ): TestPackagingType[] {
    const baseUnit = this.createBaseUnit(productId, createdBy);
    
    const box = this.createSecondaryPackaging(productId, createdBy, 12, {
      parentPackagingId: baseUnit.id
    });
    
    const display = this.createTertiaryPackaging(productId, createdBy, 72, {
      parentPackagingId: box.id,
      name: 'Display 6 caixas'
    });
    
    const pallet = this.createPalletPackaging(productId, createdBy, 1440, {
      parentPackagingId: display.id,
      level: 5,
      name: 'Pallet 20 displays'
    });

    return [baseUnit, box, display, pallet];
  }

  /**
   * Create stock items for testing
   */
  public static createStockItems(
    ucpId: number,
    productId: number,
    packagingTypes: TestPackagingType[],
    addedBy: number,
    options: {
      minQuantityPerPackaging?: number;
      maxQuantityPerPackaging?: number;
      includeLots?: boolean;
      includeExpiry?: boolean;
    } = {}
  ): TestStockItem[] {
    const {
      minQuantityPerPackaging = 10,
      maxQuantityPerPackaging = 100,
      includeLots = false,
      includeExpiry = false
    } = options;

    return packagingTypes.map(packaging => ({
      ucpId,
      productId,
      quantity: faker.number.int({ 
        min: minQuantityPerPackaging, 
        max: maxQuantityPerPackaging 
      }).toString(),
      lot: includeLots ? faker.string.alphanumeric(8).toUpperCase() : undefined,
      expiryDate: includeExpiry ? faker.date.future({ years: 2 }) : undefined,
      packagingTypeId: packaging.id!,
      addedBy
    }));
  }

  /**
   * Generate conversion test cases
   */
  public static generateConversionTestCases(): Array<{
    description: string;
    fromQuantity: number;
    fromBaseUnits: number;
    toBaseUnits: number;
    expectedResult: number;
  }> {
    return [
      {
        description: 'Convert units to boxes (1:12 ratio)',
        fromQuantity: 24,
        fromBaseUnits: 1,
        toBaseUnits: 12,
        expectedResult: 2
      },
      {
        description: 'Convert boxes to pallets (12:1440 ratio)',
        fromQuantity: 10,
        fromBaseUnits: 12,
        toBaseUnits: 1440,
        expectedResult: 0.08333333333333333
      },
      {
        description: 'Convert units to pallets (1:1440 ratio)',
        fromQuantity: 1440,
        fromBaseUnits: 1,
        toBaseUnits: 1440,
        expectedResult: 1
      },
      {
        description: 'Convert fractional quantities',
        fromQuantity: 1.5,
        fromBaseUnits: 12,
        toBaseUnits: 6,
        expectedResult: 3
      },
      {
        description: 'Convert same packaging type',
        fromQuantity: 5,
        fromBaseUnits: 12,
        toBaseUnits: 12,
        expectedResult: 5
      }
    ];
  }

  /**
   * Generate optimization test scenarios
   */
  public static generateOptimizationScenarios(): Array<{
    description: string;
    requestedUnits: number;
    availableStock: Array<{ level: number; baseUnits: number; available: number }>;
    expectedStrategy: string;
    shouldFulfill: boolean;
  }> {
    return [
      {
        description: 'Perfect pallet fulfillment',
        requestedUnits: 1440,
        availableStock: [
          { level: 1, baseUnits: 1, available: 100 },
          { level: 2, baseUnits: 12, available: 50 },
          { level: 4, baseUnits: 1440, available: 2 }
        ],
        expectedStrategy: 'use_largest_first',
        shouldFulfill: true
      },
      {
        description: 'Mixed packaging optimization',
        requestedUnits: 156, // 1 pallet + 1 box
        availableStock: [
          { level: 1, baseUnits: 1, available: 100 },
          { level: 2, baseUnits: 12, available: 20 },
          { level: 4, baseUnits: 144, available: 1 }
        ],
        expectedStrategy: 'optimize_combination',
        shouldFulfill: true
      },
      {
        description: 'Insufficient stock scenario',
        requestedUnits: 5000,
        availableStock: [
          { level: 1, baseUnits: 1, available: 50 },
          { level: 2, baseUnits: 12, available: 10 },
          { level: 3, baseUnits: 144, available: 1 }
        ],
        expectedStrategy: 'use_all_available',
        shouldFulfill: false
      },
      {
        description: 'Small quantity - use smallest packaging',
        requestedUnits: 5,
        availableStock: [
          { level: 1, baseUnits: 1, available: 100 },
          { level: 2, baseUnits: 12, available: 20 },
          { level: 4, baseUnits: 1440, available: 1 }
        ],
        expectedStrategy: 'use_appropriate_size',
        shouldFulfill: true
      }
    ];
  }

  /**
   * Generate edge case test data
   */
  public static generateEdgeCases(): Array<{
    description: string;
    input: any;
    expectedBehavior: 'error' | 'success';
    expectedError?: string;
  }> {
    return [
      {
        description: 'Zero quantity conversion',
        input: { quantity: 0, packagingId: 1 },
        expectedBehavior: 'success'
      },
      {
        description: 'Negative quantity',
        input: { quantity: -5, packagingId: 1 },
        expectedBehavior: 'error',
        expectedError: 'Quantity must be positive'
      },
      {
        description: 'Very large quantity',
        input: { quantity: Number.MAX_SAFE_INTEGER, packagingId: 1 },
        expectedBehavior: 'success'
      },
      {
        description: 'Non-existent packaging ID',
        input: { quantity: 10, packagingId: 99999 },
        expectedBehavior: 'error',
        expectedError: 'Packaging not found'
      },
      {
        description: 'Invalid product ID',
        input: { productId: -1 },
        expectedBehavior: 'error',
        expectedError: 'Invalid product ID'
      },
      {
        description: 'Decimal quantities with high precision',
        input: { quantity: 3.141592653589793, packagingId: 1 },
        expectedBehavior: 'success'
      }
    ];
  }

  /**
   * Create realistic warehouse scenarios
   */
  public static createWarehouseScenarios(): Array<{
    name: string;
    description: string;
    products: number;
    packagingTypesPerProduct: number;
    stockLevels: 'low' | 'medium' | 'high';
    complexity: 'simple' | 'complex';
  }> {
    return [
      {
        name: 'Small Warehouse',
        description: 'Small operation with basic packaging hierarchy',
        products: 5,
        packagingTypesPerProduct: 3,
        stockLevels: 'medium',
        complexity: 'simple'
      },
      {
        name: 'Medium Distribution Center',
        description: 'Medium-sized DC with complex packaging',
        products: 20,
        packagingTypesPerProduct: 5,
        stockLevels: 'high',
        complexity: 'complex'
      },
      {
        name: 'Large Enterprise Warehouse',
        description: 'Enterprise-level with extensive hierarchy',
        products: 100,
        packagingTypesPerProduct: 7,
        stockLevels: 'high',
        complexity: 'complex'
      },
      {
        name: 'Low Stock Scenario',
        description: 'Testing with limited inventory',
        products: 10,
        packagingTypesPerProduct: 4,
        stockLevels: 'low',
        complexity: 'simple'
      }
    ];
  }

  /**
   * Reset counters for clean test runs
   */
  public static resetCounters(): void {
    this.packagingCounter = 0;
    this.barcodeCounter = 1000000000000;
  }

  /**
   * Create random packaging data for property-based testing
   */
  public static createRandomPackaging(
    productId: number,
    createdBy: number,
    constraints: {
      minBaseUnits?: number;
      maxBaseUnits?: number;
      maxLevel?: number;
      allowBarcode?: boolean;
    } = {}
  ): TestPackagingType {
    const {
      minBaseUnits = 1,
      maxBaseUnits = 10000,
      maxLevel = 5,
      allowBarcode = true
    } = constraints;

    const baseUnits = faker.number.int({ min: minBaseUnits, max: maxBaseUnits });
    const level = faker.number.int({ min: 1, max: maxLevel });
    const isBaseUnit = level === 1 && baseUnits === 1;

    return {
      productId,
      name: faker.commerce.productName(),
      barcode: allowBarcode && faker.datatype.boolean() ? this.generateBarcode() : undefined,
      baseUnitQuantity: `${baseUnits}.000`,
      isBaseUnit,
      level,
      dimensions: faker.datatype.boolean() ? {
        width: faker.number.int({ min: 5, max: 200 }),
        height: faker.number.int({ min: 5, max: 200 }),
        depth: faker.number.int({ min: 5, max: 200 })
      } : undefined,
      isActive: faker.datatype.boolean({ probability: 0.9 }), // 90% chance of being active
      createdBy,
      createdAt: faker.date.past({ years: 2 }),
      updatedAt: faker.date.recent({ days: 30 })
    };
  }
}