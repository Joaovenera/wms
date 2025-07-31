export const testUsers = {
  admin: {
    id: 'test-admin-1',
    username: 'testadmin',
    email: 'admin@test.com',
    firstName: 'Test',
    lastName: 'Admin',
    role: 'admin' as const,
    isActive: true,
    password: 'admin123',
  },
  operator: {
    id: 'test-operator-1',
    username: 'testoperator',
    email: 'operator@test.com',
    firstName: 'Test',
    lastName: 'Operator', 
    role: 'operator' as const,
    isActive: true,
    password: 'operator123',
  },
  viewer: {
    id: 'test-viewer-1',
    username: 'testviewer',
    email: 'viewer@test.com',
    firstName: 'Test',
    lastName: 'Viewer',
    role: 'viewer' as const,
    isActive: true,
    password: 'viewer123',
  },
  inactive: {
    id: 'test-inactive-1',
    username: 'testinactive',
    email: 'inactive@test.com',
    firstName: 'Test',
    lastName: 'Inactive',
    role: 'operator' as const,
    isActive: false,
    password: 'inactive123',
  }
};

export const testProducts = {
  electronics: {
    id: 'test-product-electronics-1',
    code: 'ELEC001',
    name: 'Test Electronic Device',
    description: 'A test electronic device for testing purposes',
    dimensions: { width: 20, height: 10, depth: 5 },
    weight: 0.5,
    category: 'electronics',
    isActive: true,
  },
  furniture: {
    id: 'test-product-furniture-1',
    code: 'FURN001',
    name: 'Test Furniture Item',
    description: 'A test furniture item for testing purposes',
    dimensions: { width: 100, height: 80, depth: 40 },
    weight: 25.0,
    category: 'furniture',
    isActive: true,
  },
  clothing: {
    id: 'test-product-clothing-1',
    code: 'CLOTH001',
    name: 'Test Clothing Item',
    description: 'A test clothing item for testing purposes',
    dimensions: { width: 30, height: 40, depth: 2 },
    weight: 0.3,
    category: 'clothing',
    isActive: true,
  },
  inactive: {
    id: 'test-product-inactive-1',
    code: 'INACT001',
    name: 'Inactive Test Product',
    description: 'An inactive test product',
    dimensions: { width: 15, height: 15, depth: 15 },
    weight: 1.0,
    category: 'other',
    isActive: false,
  }
};

export const testPallets = {
  standard: {
    id: 'test-pallet-1',
    code: 'PAL001',
    type: 'standard' as const,
    dimensions: { width: 120, height: 100 },
    maxWeight: 1000,
    maxHeight: 200,
    isActive: true,
  },
  euro: {
    id: 'test-pallet-2', 
    code: 'EURO001',
    type: 'euro' as const,
    dimensions: { width: 120, height: 80 },
    maxWeight: 1200,
    maxHeight: 180,
    isActive: true,
  },
  custom: {
    id: 'test-pallet-3',
    code: 'CUSTOM001',
    type: 'custom' as const,
    dimensions: { width: 100, height: 100 },
    maxWeight: 800,
    maxHeight: 150,
    isActive: true,
  }
};

export const testUcps = {
  created: {
    id: 'test-ucp-1',
    code: 'UCP001',
    palletId: 'test-pallet-1',
    status: 'created' as const,
    totalWeight: 0,
    totalItems: 0,
    createdBy: 'test-operator-1',
  },
  inProgress: {
    id: 'test-ucp-2',
    code: 'UCP002',
    palletId: 'test-pallet-2',
    status: 'in_progress' as const,
    totalWeight: 50.5,
    totalItems: 10,
    createdBy: 'test-operator-1',
  },
  completed: {
    id: 'test-ucp-3',
    code: 'UCP003',
    palletId: 'test-pallet-3',
    status: 'completed' as const,
    totalWeight: 125.0,
    totalItems: 25,
    createdBy: 'test-operator-1',
  }
};

export const testUcpItems = [
  {
    id: 'test-ucp-item-1',
    ucpId: 'test-ucp-2',
    productId: 'test-product-electronics-1',
    quantity: 5,
    position: { x: 0, y: 0, z: 0, layer: 1 },
    weight: 2.5,
  },
  {
    id: 'test-ucp-item-2',
    ucpId: 'test-ucp-2',
    productId: 'test-product-clothing-1',
    quantity: 10,
    position: { x: 20, y: 0, z: 0, layer: 1 },
    weight: 3.0,
  },
  {
    id: 'test-ucp-item-3',
    ucpId: 'test-ucp-3',
    productId: 'test-product-furniture-1',
    quantity: 1,
    position: { x: 0, y: 0, z: 0, layer: 1 },
    weight: 25.0,
  }
];

export const testTransferRequests = {
  pending: {
    id: 'test-transfer-1',
    ucpId: 'test-ucp-3',
    fromLocation: 'A1-01-01',
    toLocation: 'B2-03-02',
    status: 'pending' as const,
    priority: 'medium' as const,
    requestedBy: 'test-operator-1',
    notes: 'Test transfer request',
  },
  approved: {
    id: 'test-transfer-2',
    ucpId: 'test-ucp-2',
    fromLocation: 'C3-02-01',
    toLocation: 'D4-01-03',
    status: 'approved' as const,
    priority: 'high' as const,
    requestedBy: 'test-operator-1',
    approvedBy: 'test-admin-1',
    notes: 'Approved test transfer',
  }
};

export const testVehicles = {
  forklift: {
    id: 'test-vehicle-1',
    code: 'FORK001',
    name: 'Test Forklift 1',
    type: 'forklift' as const,
    maxCapacity: 2000,
    status: 'available' as const,
    isActive: true,
  },
  truck: {
    id: 'test-vehicle-2',
    code: 'TRUCK001',
    name: 'Test Truck 1',
    type: 'truck' as const,
    maxCapacity: 10000,
    status: 'in_use' as const,
    isActive: true,
  }
};

// Helper function to get timestamp-based test data
export const createTimestampedTestData = () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return {
    now,
    yesterday,
    tomorrow,
    timestamps: {
      created: yesterday,
      updated: now,
      scheduled: tomorrow,
    }
  };
};

// Helper function to generate unique test IDs
export const generateTestId = (prefix: string = 'test'): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
};

// Helper function to create test data variations
export const createTestVariations = <T>(baseData: T, variations: Partial<T>[]): T[] => {
  return variations.map(variation => ({ ...baseData, ...variation }));
};