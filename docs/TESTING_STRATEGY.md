# Testing Strategy & Coverage Documentation

## Overview

The WMS testing strategy implements a comprehensive multi-layered approach ensuring high code quality, reliability, and performance across all system components. The testing pyramid includes unit tests, integration tests, end-to-end tests, and performance tests.

## Testing Architecture

```
                    ┌─────────────────────────────┐
                    │      E2E Tests (10%)       │
                    │  - User workflows          │
                    │  - Cross-browser testing   │
                    │  - Mobile testing          │
                    └─────────────────────────────┘
                               │
                ┌─────────────────────────────────────┐
                │       Integration Tests (20%)      │
                │  - API endpoint testing            │
                │  - Database integration            │
                │  - Component integration           │
                │  - External service mocking        │
                └─────────────────────────────────────┘
                               │
        ┌─────────────────────────────────────────────────┐
        │              Unit Tests (70%)                   │
        │  - Pure function testing                        │
        │  - Component logic testing                      │
        │  - Service layer testing                        │
        │  - Utility function testing                     │
        └─────────────────────────────────────────────────┘
```

## Testing Tools & Frameworks

### Backend Testing Stack

- **Vitest** - Fast unit testing framework
- **Supertest** - HTTP assertion library
- **Playwright** - Cross-browser E2E testing
- **MSW (Mock Service Worker)** - API mocking
- **Docker Test Containers** - Isolated database testing
- **@testcontainers/postgresql** - PostgreSQL testing containers

### Frontend Testing Stack

- **Vitest** - Unit and integration testing
- **React Testing Library** - Component testing
- **Jest DOM** - Custom DOM matchers
- **MSW** - API mocking for frontend
- **Playwright** - E2E testing
- **Axe-core** - Accessibility testing

## Test Configuration

### Backend Test Configuration

```typescript
// vitest.unified.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
```

### Frontend Test Configuration

```typescript
// vitest.config.ts (Frontend)
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.stories.*',
        '**/*.d.ts'
      ]
    }
  },
});
```

### Playwright E2E Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './src/test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] }
    },
    {
      name: 'accessibility',
      testMatch: '**/accessibility.spec.ts',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'performance',
      testMatch: '**/performance.spec.ts',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--enable-precise-memory-info']
        }
      }
    }
  ]
});
```

## Unit Testing

### Backend Unit Tests

#### Controller Testing

```typescript
// products.controller.unit.test.ts
describe('ProductsController', () => {
  let controller: ProductsController;
  let mockProductService: jest.Mocked<ProductService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockProductService = {
      getProducts: jest.fn(),
      createProduct: jest.fn(),
      updateProduct: jest.fn(),
      deleteProduct: jest.fn(),
    } as jest.Mocked<ProductService>;

    controller = new ProductsController(mockProductService);
    mockRequest = {
      query: {},
      body: {},
      params: {},
      user: { id: 1, role: 'admin' }
    };
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
  });

  describe('getProducts', () => {
    it('should return paginated products with stock info', async () => {
      const mockProducts = [
        { id: 1, sku: 'PROD-001', name: 'Product A', totalStock: 100 }
      ];
      const mockPagination = { page: 1, limit: 10, total: 1, totalPages: 1 };

      mockProductService.getProducts.mockResolvedValue({
        products: mockProducts,
        pagination: mockPagination
      });

      mockRequest.query = { page: '1', limit: '10', withStock: 'true' };

      await controller.getProducts(mockRequest as Request, mockResponse as Response);

      expect(mockProductService.getProducts).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        withStock: true,
        search: undefined,
        category: undefined
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        products: mockProducts,
        pagination: mockPagination
      });
    });

    it('should handle service errors gracefully', async () => {
      mockProductService.getProducts.mockRejectedValue(new Error('Database error'));

      await controller.getProducts(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'Failed to fetch products'
      });
    });
  });
});
```

#### Service Testing

```typescript
// packaging.service.unit.test.ts
describe('PackagingService', () => {
  let service: PackagingService;
  let mockDatabase: jest.Mocked<Database>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockDatabase = createMockDatabase();
    mockCacheService = createMockCacheService();
    service = new PackagingService(mockDatabase, mockCacheService);
  });

  describe('createComposition', () => {
    it('should create valid packaging composition', async () => {
      const request: CompositionRequest = {
        products: [
          { productId: 1, quantity: 100, packagingTypeId: 2 }
        ],
        palletId: 1,
        constraints: { maxWeight: 2000, maxHeight: 180 }
      };

      const mockPallet = createMockPallet({ maxWeight: 2000 });
      const mockProduct = createMockProduct({ weight: 1.5 });
      const mockPackaging = createMockPackagingType({ baseUnitQuantity: 12 });

      mockDatabase.query.mockResolvedValueOnce([mockPallet]);
      mockDatabase.query.mockResolvedValueOnce([mockProduct]);
      mockDatabase.query.mockResolvedValueOnce([mockPackaging]);

      const result = await service.createComposition(request);

      expect(result.isValid).toBe(true);
      expect(result.efficiency).toBeGreaterThan(80);
      expect(result.weight.total).toBeLessThanOrEqual(2000);
      expect(result.height.total).toBeLessThanOrEqual(180);
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should validate weight constraints', async () => {
      const request: CompositionRequest = {
        products: [
          { productId: 1, quantity: 2000 }
        ],
        palletId: 1,
        constraints: { maxWeight: 1000 }
      };

      const mockPallet = createMockPallet({ maxWeight: 1000 });
      const mockProduct = createMockProduct({ weight: 1.0 });

      mockDatabase.query.mockResolvedValueOnce([mockPallet]);
      mockDatabase.query.mockResolvedValueOnce([mockProduct]);

      const result = await service.createComposition(request);

      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Weight constraint exceeded');
      expect(result.weight.total).toBeGreaterThan(1000);
    });
  });
});
```

### Frontend Unit Tests

#### Component Testing

```typescript
// product-search-with-stock.test.tsx
describe('ProductSearchWithStock', () => {
  const mockOnProductSelect = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render search input with placeholder', () => {
    render(
      <ProductSearchWithStock
        onProductSelect={mockOnProductSelect}
        placeholder="Search products..."
      />
    );

    expect(screen.getByPlaceholderText('Search products...')).toBeInTheDocument();
  });

  it('should display search results with stock information', async () => {
    const mockProducts = [
      {
        id: 1,
        sku: 'PROD-001',
        name: 'Product A',
        totalStock: 150,
        ucpStock: [
          { ucpCode: 'UCP-001', positionCode: 'PP-01-01-0', quantity: '50.000' }
        ]
      }
    ];

    // Mock API response
    server.use(
      rest.get('/api/products', (req, res, ctx) => {
        return res(ctx.json({ products: mockProducts }));
      })
    );

    render(
      <ProductSearchWithStock onProductSelect={mockOnProductSelect} />
    );

    const searchInput = screen.getByRole('textbox');
    fireEvent.change(searchInput, { target: { value: 'PROD-001' } });

    await waitFor(() => {
      expect(screen.getByText('Product A')).toBeInTheDocument();
      expect(screen.getByText('Stock: 150')).toBeInTheDocument();
      expect(screen.getByText('UCP-001')).toBeInTheDocument();
    });
  });

  it('should call onProductSelect when product is clicked', async () => {
    const mockProduct = {
      id: 1,
      sku: 'PROD-001',
      name: 'Product A',
      totalStock: 150
    };

    server.use(
      rest.get('/api/products', (req, res, ctx) => {
        return res(ctx.json({ products: [mockProduct] }));
      })
    );

    render(
      <ProductSearchWithStock onProductSelect={mockOnProductSelect} />
    );

    const searchInput = screen.getByRole('textbox');
    fireEvent.change(searchInput, { target: { value: 'PROD-001' } });

    await waitFor(() => {
      expect(screen.getByText('Product A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Product A'));

    expect(mockOnProductSelect).toHaveBeenCalledWith(mockProduct);
  });
});
```

#### Hook Testing

```typescript
// usePackaging.test.ts
describe('usePackaging', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should fetch packaging types for product', async () => {
    const mockPackagingTypes = [
      { id: 1, name: 'Unit', baseUnitQuantity: 1, isBaseUnit: true },
      { id: 2, name: 'Box', baseUnitQuantity: 12, isBaseUnit: false }
    ];

    server.use(
      rest.get('/api/packaging/products/1/types', (req, res, ctx) => {
        return res(ctx.json(mockPackagingTypes));
      })
    );

    const { result } = renderHook(() => usePackaging(1), { wrapper });

    await waitFor(() => {
      expect(result.current.packagingTypes).toEqual(mockPackagingTypes);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should optimize picking plan', async () => {
    const mockOptimizedPlan = {
      pickingPlan: [
        { packaging: { id: 2, name: 'Box' }, quantity: 2, baseUnits: 24 }
      ],
      remaining: 1,
      totalPlanned: 24,
      canFulfill: true
    };

    server.use(
      rest.post('/api/packaging/optimize-picking', (req, res, ctx) => {
        return res(ctx.json(mockOptimizedPlan));
      })
    );

    const { result } = renderHook(() => usePackaging(1), { wrapper });

    act(() => {
      result.current.optimizePicking.mutate({
        productId: 1,
        requestedQuantity: 25
      });
    });

    await waitFor(() => {
      expect(result.current.optimizePicking.data).toEqual(mockOptimizedPlan);
    });
  });
});
```

## Integration Testing

### API Integration Tests

```typescript
// products.integration.test.ts
describe('Products API Integration', () => {
  let app: Express;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    app = await createTestApp(testDb);
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    await testDb.seed();
  });

  afterEach(async () => {
    await testDb.reset();
  });

  describe('GET /api/products', () => {
    it('should return products with pagination', async () => {
      const response = await request(app)
        .get('/api/products?page=1&limit=5')
        .expect(200);

      expect(response.body).toHaveProperty('products');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.products).toHaveLength(5);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 5,
        total: expect.any(Number),
        totalPages: expect.any(Number)
      });
    });

    it('should filter products by category', async () => {
      const response = await request(app)
        .get('/api/products?category=Electronics')
        .expect(200);

      expect(response.body.products).toHaveLength(3);
      response.body.products.forEach((product: Product) => {
        expect(product.category).toBe('Electronics');
      });
    });

    it('should include stock information when requested', async () => {
      const response = await request(app)
        .get('/api/products?withStock=true')
        .expect(200);

      response.body.products.forEach((product: Product) => {
        expect(product).toHaveProperty('totalStock');
        expect(product).toHaveProperty('ucpStock');
      });
    });
  });

  describe('POST /api/products', () => {
    it('should create new product', async () => {
      const productData = {
        sku: 'PROD-NEW-001',
        name: 'New Product',
        category: 'Test',
        unit: 'un',
        weight: '1.5'
      };

      const response = await request(app)
        .post('/api/products')
        .send(productData)
        .expect(201);

      expect(response.body).toMatchObject(productData);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: 'Product without SKU'
      };

      const response = await request(app)
        .post('/api/products')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toContainEqual(
        expect.objectContaining({
          field: 'sku',
          message: expect.stringContaining('required')
        })
      );
    });
  });
});
```

### Database Integration Tests

```typescript
// packaging-composition.integration.test.ts
describe('Packaging Composition Database Integration', () => {
  let db: TestDatabase;
  let service: PackagingCompositionService;

  beforeAll(async () => {
    db = await createTestDatabase();
    service = new PackagingCompositionService(db.connection);
  });

  afterAll(async () => {
    await db.cleanup();
  });

  describe('Complex Composition Scenarios', () => {
    it('should handle multi-product composition with hierarchy', async () => {
      // Create test data
      await db.seed({
        products: [
          { id: 1, sku: 'PROD-A', weight: 1.0, dimensions: { width: 10, length: 15, height: 5 } },
          { id: 2, sku: 'PROD-B', weight: 2.0, dimensions: { width: 20, length: 10, height: 8 } }
        ],
        packagingTypes: [
          { id: 1, productId: 1, name: 'Unit', baseUnitQuantity: 1, isBaseUnit: true },
          { id: 2, productId: 1, name: 'Box', baseUnitQuantity: 12, parentPackagingId: 1 },
          { id: 3, productId: 2, name: 'Unit', baseUnitQuantity: 1, isBaseUnit: true }
        ],
        pallets: [
          { id: 1, code: 'PLT-001', maxWeight: 2000, width: 120, length: 100, height: 15 }
        ]
      });

      const composition = await service.createComposition({
        products: [
          { productId: 1, quantity: 48, packagingTypeId: 2 }, // 4 boxes
          { productId: 2, quantity: 20 }
        ],
        palletId: 1,
        constraints: {
          maxWeight: 1800,
          maxHeight: 200
        }
      });

      expect(composition.isValid).toBe(true);
      expect(composition.products).toHaveLength(2);
      expect(composition.weight.total).toBeLessThanOrEqual(1800);
      expect(composition.height.total).toBeLessThanOrEqual(200);

      // Verify database persistence
      const saved = await service.saveComposition({
        name: 'Test Composition',
        ...composition
      });

      expect(saved.id).toBeDefined();
      expect(saved.result).toEqual(composition);
    });
  });
});
```

## End-to-End Testing

### Complete User Workflows

```typescript
// warehouse-operations.spec.ts
import { test, expect, Page } from '@playwright/test';

test.describe('Warehouse Operations', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/');
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should create UCP and add products', async () => {
    // Navigate to UCPs page
    await page.getByRole('link', { name: 'UCPs' }).click();
    await expect(page).toHaveURL('/ucps');

    // Create new UCP
    await page.getByRole('button', { name: 'New UCP' }).click();
    
    // Fill UCP creation form
    await page.getByLabel('UCP Code').fill('UCP-TEST-001');
    await page.getByLabel('Pallet').click();
    await page.getByRole('option', { name: 'PLT-001' }).click();
    await page.getByLabel('Position').click();
    await page.getByRole('option', { name: 'PP-01-01-0' }).click();
    
    await page.getByRole('button', { name: 'Create UCP' }).click();
    
    // Verify UCP creation
    await expect(page.getByText('UCP created successfully')).toBeVisible();
    await expect(page.getByText('UCP-TEST-001')).toBeVisible();

    // Add product to UCP
    await page.getByRole('button', { name: 'Add Product' }).click();
    await page.getByLabel('Product').fill('PROD-001');
    await page.getByRole('option', { name: 'Product A (PROD-001)' }).click();
    await page.getByLabel('Quantity').fill('25');
    await page.getByLabel('Lot').fill('LOT-001');
    
    await page.getByRole('button', { name: 'Add Item' }).click();
    
    // Verify item addition
    await expect(page.getByText('Item added successfully')).toBeVisible();
    await expect(page.getByText('Product A')).toBeVisible();
    await expect(page.getByText('25.000')).toBeVisible();
  });

  test('should plan and execute transfer', async () => {
    // Navigate to transfer planning
    await page.getByRole('link', { name: 'Transfer Planning' }).click();
    
    // Create transfer request
    await page.getByRole('button', { name: 'New Transfer' }).click();
    
    // Select vehicle
    await page.getByLabel('Vehicle').click();
    await page.getByRole('option', { name: 'VH-001 - Truck A' }).click();
    
    // Set locations
    await page.getByLabel('From Location').fill('Santa Catarina');
    await page.getByLabel('To Location').fill('São Paulo');
    
    // Add products
    await page.getByRole('button', { name: 'Add Product' }).click();
    await page.getByLabel('Product').fill('PROD-001');
    await page.getByRole('option', { name: 'Product A (PROD-001)' }).click();
    await page.getByLabel('Quantity').fill('100');
    
    await page.getByRole('button', { name: 'Add Item' }).click();
    
    // Save transfer request
    await page.getByRole('button', { name: 'Create Transfer' }).click();
    
    // Verify transfer creation and capacity calculation
    await expect(page.getByText('Transfer request created')).toBeVisible();
    await expect(page.getByText('Capacity Usage:')).toBeVisible();
    
    // Start loading execution
    await page.getByRole('button', { name: 'Start Loading' }).click();
    
    // Simulate item scanning
    await page.getByRole('button', { name: 'Scan Item' }).click();
    await page.getByLabel('Barcode').fill('1234567890123');
    await page.getByRole('button', { name: 'Confirm Scan' }).click();
    
    // Confirm loading
    await page.getByLabel('Loaded Quantity').fill('100');
    await page.getByRole('button', { name: 'Confirm Loading' }).click();
    
    // Complete execution
    await page.getByRole('button', { name: 'Complete Loading' }).click();
    
    // Verify completion
    await expect(page.getByText('Loading completed successfully')).toBeVisible();
  });
});
```

### Mobile Testing

```typescript
// mobile-workflows.spec.ts
test.describe('Mobile Warehouse Operations', () => {
  test.use({ 
    viewport: { width: 375, height: 667 },
    hasTouch: true 
  });

  test('should handle mobile scanner workflow', async ({ page }) => {
    await page.goto('/mobile');
    
    // Login
    await page.getByLabel('Email').fill('operator@example.com');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Login' }).click();
    
    // Navigate to scanner
    await page.getByRole('button', { name: 'Scanner' }).click();
    
    // Mock camera permission
    await page.context().grantPermissions(['camera']);
    
    // Start scanning
    await page.getByRole('button', { name: 'Start Scanner' }).click();
    
    // Simulate barcode scan
    await page.evaluate(() => {
      // Mock successful scan
      window.dispatchEvent(new CustomEvent('barcode-scanned', {
        detail: { code: '1234567890123', type: 'barcode' }
      }));
    });
    
    // Verify product information display
    await expect(page.getByText('Product A')).toBeVisible();
    await expect(page.getByText('Stock: 150')).toBeVisible();
    
    // Quick actions
    await page.getByRole('button', { name: 'View Details' }).click();
    await expect(page.getByText('SKU: PROD-001')).toBeVisible();
  });
});
```

## Performance Testing

### Load Testing

```typescript
// cache-performance.spec.ts
describe('Cache Performance Tests', () => {
  let server: TestServer;
  let cache: CacheService;

  beforeAll(async () => {
    server = await createTestServer();
    cache = server.cacheService;
  });

  afterAll(async () => {
    await server.cleanup();
  });

  test('should handle high-frequency product stock queries', async () => {
    const productId = 1;
    const concurrentRequests = 100;
    const requests = Array.from({ length: concurrentRequests }, () => 
      request(server.app)
        .get(`/api/products/${productId}/stock`)
        .expect(200)
    );

    const start = Date.now();
    const responses = await Promise.all(requests);
    const duration = Date.now() - start;

    // All requests should complete within 2 seconds
    expect(duration).toBeLessThan(2000);
    
    // Cache hit rate should be high after first request
    const cacheStats = await cache.getStats();
    expect(cacheStats.hitRate).toBeGreaterThan(0.95);
    
    // All responses should be identical (cached)
    const firstResponse = responses[0].body;
    responses.forEach(response => {
      expect(response.body).toEqual(firstResponse);
    });
  });

  test('should maintain performance under database load', async () => {
    // Generate large dataset
    await seedLargeDataset(server.db, {
      products: 10000,
      ucps: 5000,
      ucpItems: 25000
    });

    const queries = [
      () => request(server.app).get('/api/products?withStock=true&limit=50'),
      () => request(server.app).get('/api/ucps?limit=50'),
      () => request(server.app).get('/api/positions?status=available'),
    ];

    // Test concurrent mixed queries
    const concurrentQueries = Array.from({ length: 30 }, (_, i) => 
      queries[i % queries.length]()
    );

    const start = Date.now();
    await Promise.all(concurrentQueries);
    const duration = Date.now() - start;

    // Should complete within 5 seconds even with large dataset
    expect(duration).toBeLessThan(5000);
  });
});
```

### Memory and Resource Testing

```typescript
// performance.spec.ts (Playwright)
test('should not have memory leaks in single-page navigation', async ({ page }) => {
  // Navigate through all major pages multiple times
  const pages = ['/products', '/ucps', '/pallets', '/vehicles', '/transfer-planning'];
  
  for (let iteration = 0; iteration < 5; iteration++) {
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      
      // Trigger garbage collection
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });
    }
  }

  // Measure final memory usage
  const memoryUsage = await page.evaluate(() => {
    return {
      usedJSHeapSize: (performance as any).memory?.usedJSHeapSize,
      totalJSHeapSize: (performance as any).memory?.totalJSHeapSize,
    };
  });

  // Memory usage should be reasonable (< 50MB)
  if (memoryUsage.usedJSHeapSize) {
    expect(memoryUsage.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024);
  }
});
```

## Accessibility Testing

```typescript
// accessibility.spec.ts
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await injectAxe(page);
  });

  test('should not have accessibility violations on main pages', async ({ page }) => {
    const pages = [
      '/',
      '/products',
      '/ucps',
      '/pallets',
      '/vehicles'
    ];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      
      await checkA11y(page, null, {
        detailedReport: true,
        detailedReportOptions: { html: true }
      });
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/products');
    
    // Tab through interactive elements
    await page.keyboard.press('Tab'); // Focus first button
    await page.keyboard.press('Tab'); // Focus search input
    await page.keyboard.press('Tab'); // Focus filter dropdown
    
    // Verify focus is visible
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Test Enter key activation
    await page.keyboard.press('Enter');
    // Verify appropriate action occurred
  });
});
```

## Test Data Management

### Test Database Setup

```typescript
// test-app-factory.ts
export const createTestApp = async (testDb?: TestDatabase): Promise<Express> => {
  const db = testDb || await createTestDatabase();
  
  const app = express();
  
  // Configure test middleware
  app.use(express.json());
  app.use(cors());
  
  // Mock authentication for tests
  app.use((req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', role: 'admin' };
    next();
  });
  
  // Register routes with test database
  await registerRoutes(app, db);
  
  return app;
};

export const createTestDatabase = async (): Promise<TestDatabase> => {
  const container = await new PostgreSqlContainer()
    .withDatabase('test_wms')
    .withUsername('test_user')
    .withPassword('test_password')
    .start();

  const db = drizzle(postgres(container.getConnectionUri()));
  
  // Run migrations
  await migrate(db, { migrationsFolder: './drizzle' });
  
  return {
    connection: db,
    container,
    async seed(data?: SeedData) {
      if (data) {
        await seedCustomData(db, data);
      } else {
        await seedDefaultData(db);
      }
    },
    async reset() {
      await truncateAllTables(db);
    },
    async cleanup() {
      await container.stop();
    }
  };
};
```

### Test Data Factories

```typescript
// test-data-factory.ts
export const createMockProduct = (overrides?: Partial<Product>): Product => ({
  id: 1,
  sku: 'PROD-001',
  name: 'Test Product',
  category: 'Test',
  unit: 'un',
  weight: '1.5',
  dimensions: { width: 10, length: 15, height: 5 },
  isActive: true,
  createdBy: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

export const createMockUcp = (overrides?: Partial<Ucp>): Ucp => ({
  id: 1,
  code: 'UCP-TEST-001',
  palletId: 1,
  positionId: 1,
  status: 'active',
  createdBy: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

export const seedDefaultData = async (db: Database) => {
  // Insert test users
  await db.insert(users).values([
    { email: 'admin@test.com', password: 'hashed_password', role: 'admin' },
    { email: 'operator@test.com', password: 'hashed_password', role: 'operator' }
  ]);

  // Insert test products
  await db.insert(products).values([
    createMockProduct({ id: 1, sku: 'PROD-001', name: 'Product A' }),
    createMockProduct({ id: 2, sku: 'PROD-002', name: 'Product B' }),
    createMockProduct({ id: 3, sku: 'PROD-003', name: 'Product C' })
  ]);

  // Continue with other entities...
};
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/test_db

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install
      
      - name: Start application
        run: npm run dev &
        
      - name: Wait for server
        run: npx wait-on http://localhost:3000
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Coverage Reporting

### Coverage Thresholds

```typescript
// Coverage requirements by component
const coverageThresholds = {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  },
  './src/services/': {
    branches: 90,
    functions: 90,
    lines: 90,
    statements: 90
  },
  './src/controllers/': {
    branches: 85,
    functions: 85,
    lines: 85,
    statements: 85
  }
};
```

### Quality Gates

1. **Unit Tests**: Must achieve >80% coverage
2. **Integration Tests**: All API endpoints must be tested
3. **E2E Tests**: All critical user workflows must be covered
4. **Performance Tests**: Response times must be <2s for 95th percentile
5. **Accessibility**: No critical a11y violations allowed
6. **Security**: No high/critical security vulnerabilities

This comprehensive testing strategy ensures high-quality, reliable, and maintainable code across the entire WMS application.