import { generateTestId, createTimestampedTestData } from '../fixtures/test-data';

export interface TestUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'operator' | 'viewer';
  isActive: boolean;
  password?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TestProduct {
  id: string;
  code: string;
  name: string;
  description: string;
  dimensions: { width: number; height: number; depth: number };
  weight: number;
  category: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TestPallet {
  id: string;
  code: string;
  type: 'standard' | 'euro' | 'custom';
  dimensions: { width: number; height: number };
  maxWeight: number;
  maxHeight: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TestUCP {
  id: string;
  code: string;
  palletId: string;
  status: 'created' | 'in_progress' | 'completed' | 'cancelled';
  totalWeight: number;
  totalItems: number;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TestVehicle {
  id: string;
  code: string;
  name: string;
  type: 'forklift' | 'truck' | 'crane' | 'conveyor';
  maxCapacity: number;
  status: 'available' | 'in_use' | 'maintenance';
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TestTransferRequest {
  id: string;
  ucpId: string;
  fromLocation: string;
  toLocation: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requestedBy: string;
  approvedBy?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class TestDataFactory {
  private static userCounter = 0;
  private static productCounter = 0;
  private static palletCounter = 0;
  private static ucpCounter = 0;
  private static vehicleCounter = 0;
  private static transferCounter = 0;

  /**
   * Create a test user with optional overrides
   */
  public static createUser(overrides: Partial<TestUser> = {}): TestUser {
    const { now } = createTimestampedTestData();
    const counter = ++this.userCounter;

    return {
      id: generateTestId('user'),
      username: `testuser${counter}`,
      email: `test${counter}@example.com`,
      firstName: `Test${counter}`,
      lastName: 'User',
      role: 'operator',
      isActive: true,
      password: 'test123',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  /**
   * Create multiple test users
   */
  public static createUsers(count: number, overrides: Partial<TestUser> = {}): TestUser[] {
    return Array.from({ length: count }, () => this.createUser(overrides));
  }

  /**
   * Create a test product with optional overrides
   */
  public static createProduct(overrides: Partial<TestProduct> = {}): TestProduct {
    const { now } = createTimestampedTestData();
    const counter = ++this.productCounter;

    return {
      id: generateTestId('product'),
      code: `PROD${String(counter).padStart(3, '0')}`,
      name: `Test Product ${counter}`,
      description: `Test product ${counter} for integration testing`,
      dimensions: { width: 10 + counter, height: 20 + counter, depth: 5 + counter },
      weight: 1.0 + (counter * 0.5),
      category: ['electronics', 'furniture', 'clothing', 'tools'][counter % 4],
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  /**
   * Create multiple test products
   */
  public static createProducts(count: number, overrides: Partial<TestProduct> = {}): TestProduct[] {
    return Array.from({ length: count }, () => this.createProduct(overrides));
  }

  /**
   * Create a test pallet with optional overrides
   */
  public static createPallet(overrides: Partial<TestPallet> = {}): TestPallet {
    const { now } = createTimestampedTestData();
    const counter = ++this.palletCounter;

    return {
      id: generateTestId('pallet'),
      code: `PAL${String(counter).padStart(3, '0')}`,
      type: ['standard', 'euro', 'custom'][counter % 3] as 'standard' | 'euro' | 'custom',
      dimensions: { width: 120, height: 100 },
      maxWeight: 1000 + (counter * 100),
      maxHeight: 200,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  /**
   * Create multiple test pallets
   */
  public static createPallets(count: number, overrides: Partial<TestPallet> = {}): TestPallet[] {
    return Array.from({ length: count }, () => this.createPallet(overrides));
  }

  /**
   * Create a test UCP with optional overrides
   */
  public static createUCP(palletId: string, createdBy: string, overrides: Partial<TestUCP> = {}): TestUCP {
    const { now } = createTimestampedTestData();
    const counter = ++this.ucpCounter;

    return {
      id: generateTestId('ucp'),
      code: `UCP${String(counter).padStart(3, '0')}`,
      palletId,
      status: 'created',
      totalWeight: 0,
      totalItems: 0,
      createdBy,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  /**
   * Create multiple test UCPs
   */
  public static createUCPs(count: number, palletId: string, createdBy: string, overrides: Partial<TestUCP> = {}): TestUCP[] {
    return Array.from({ length: count }, () => this.createUCP(palletId, createdBy, overrides));
  }

  /**
   * Create a test vehicle with optional overrides
   */
  public static createVehicle(overrides: Partial<TestVehicle> = {}): TestVehicle {
    const { now } = createTimestampedTestData();
    const counter = ++this.vehicleCounter;

    return {
      id: generateTestId('vehicle'),
      code: `VEH${String(counter).padStart(3, '0')}`,
      name: `Test Vehicle ${counter}`,
      type: ['forklift', 'truck', 'crane', 'conveyor'][counter % 4] as TestVehicle['type'],
      maxCapacity: 1000 + (counter * 500),
      status: 'available',
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  /**
   * Create multiple test vehicles
   */
  public static createVehicles(count: number, overrides: Partial<TestVehicle> = {}): TestVehicle[] {
    return Array.from({ length: count }, () => this.createVehicle(overrides));
  }

  /**
   * Create a test transfer request with optional overrides
   */
  public static createTransferRequest(ucpId: string, requestedBy: string, overrides: Partial<TestTransferRequest> = {}): TestTransferRequest {
    const { now } = createTimestampedTestData();
    const counter = ++this.transferCounter;

    return {
      id: generateTestId('transfer'),
      ucpId,
      fromLocation: `A${counter}-01-01`,
      toLocation: `B${counter}-02-02`,
      status: 'pending',
      priority: ['low', 'medium', 'high', 'urgent'][counter % 4] as TestTransferRequest['priority'],
      requestedBy,
      notes: `Test transfer request ${counter}`,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  /**
   * Create multiple test transfer requests
   */
  public static createTransferRequests(count: number, ucpId: string, requestedBy: string, overrides: Partial<TestTransferRequest> = {}): TestTransferRequest[] {
    return Array.from({ length: count }, () => this.createTransferRequest(ucpId, requestedBy, overrides));
  }

  /**
   * Create a complete test scenario with related entities
   */
  public static createCompleteScenario() {
    const admin = this.createUser({ role: 'admin', username: 'testadmin', email: 'admin@test.com' });
    const operator = this.createUser({ role: 'operator', username: 'testoperator', email: 'operator@test.com' });
    const manager = this.createUser({ role: 'manager', username: 'testmanager', email: 'manager@test.com' });

    const products = this.createProducts(5);
    const pallets = this.createPallets(3);
    const vehicles = this.createVehicles(2);

    const ucps = pallets.map(pallet => 
      this.createUCP(pallet.id, operator.id, { status: 'in_progress' })
    );

    const transferRequests = ucps.map(ucp => 
      this.createTransferRequest(ucp.id, operator.id)
    );

    return {
      users: { admin, operator, manager },
      products,
      pallets,
      vehicles,
      ucps,
      transferRequests,
    };
  }

  /**
   * Reset all counters for clean test runs
   */
  public static resetCounters(): void {
    this.userCounter = 0;
    this.productCounter = 0;
    this.palletCounter = 0;
    this.ucpCounter = 0;
    this.vehicleCounter = 0;
    this.transferCounter = 0;
  }
}