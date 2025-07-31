# WMS Backend Testing Guide

This document provides comprehensive guidance for testing the Warehouse Management System (WMS) backend application.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Helpers](#test-helpers)
- [Best Practices](#best-practices)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Overview

The WMS backend uses **Jest** as the primary testing framework with **Supertest** for API testing. The test suite includes:

- **Unit Tests**: Testing individual functions, classes, and modules
- **Integration Tests**: Testing API endpoints and database interactions
- **Mock Services**: Simulating external dependencies
- **Test Fixtures**: Providing consistent test data

## Test Structure

```
tests/
├── setup.ts                 # Global test setup and teardown
├── helpers/                 # Test utilities and helpers
│   ├── api-test-helper.ts   # API testing utilities
│   ├── database-test-helper.ts # Database testing utilities
│   ├── redis-test-helper.ts # Redis testing utilities
│   ├── mock-services.ts     # Mock implementations
│   └── create-test-db.ts    # Database creation script
├── fixtures/                # Test data and fixtures
│   └── test-data.ts         # Static test data
├── unit/                    # Unit tests
│   ├── controllers/         # Controller tests
│   ├── services/           # Service tests
│   └── utils/              # Utility function tests
└── integration/            # Integration tests
    ├── products.test.ts    # Product API tests
    └── ...                 # Other API tests
```

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 17+
- Redis 7+ (optional, tests can run without Redis)

### Environment Setup

1. **Copy environment template:**
   ```bash
   cp .env.test.example .env.test
   ```

2. **Update test environment variables:**
   ```bash
   # Edit .env.test with your local settings
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wms_test
   REDIS_URL=redis://localhost:6379/1
   ```

3. **Create test database:**
   ```bash
   npm run test:db
   ```

4. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

5. **Install dependencies:**
   ```bash
   npm install
   ```

## Running Tests

### All Tests
```bash
npm test
```

### Test Types
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode (re-run on file changes)
npm run test:watch

# Coverage report
npm run test:coverage

# CI mode (no watch, with coverage)
npm run test:ci
```

### Single Test File
```bash
# Run specific test file
npx jest tests/unit/services/packaging.service.test.ts

# Run tests matching pattern
npx jest --testNamePattern="should create new product"
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockDbClient, resetAllMocks } from '../../helpers/mock-services';
import { ProductService } from '../../../src/services/product.service';

describe('ProductService', () => {
  let productService: ProductService;

  beforeEach(() => {
    resetAllMocks();
    productService = new ProductService(mockDbClient);
  });

  describe('createProduct', () => {
    it('should create product with valid data', async () => {
      const productData = {
        code: 'TEST001',
        name: 'Test Product',
        category: 'electronics'
      };

      mockDbClient.insert.mockResolvedValue([{ id: 'new-id', ...productData }]);

      const result = await productService.createProduct(productData);

      expect(mockDbClient.insert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining(productData)
      );
      expect(result.id).toBe('new-id');
      expect(result.code).toBe(productData.code);
    });

    it('should validate required fields', async () => {
      const invalidData = { name: 'Test Product' }; // Missing code

      await expect(productService.createProduct(invalidData))
        .rejects
        .toThrow('Product code is required');
    });
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ApiTestHelper } from '../helpers/api-test-helper';
import { app } from '../../src/app';

describe('Products API Integration', () => {
  let apiHelper: ApiTestHelper;
  let adminToken: string;

  beforeAll(async () => {
    apiHelper = new ApiTestHelper(app);
    adminToken = await apiHelper.loginUser({
      username: 'testadmin',
      password: 'admin123'
    });
  });

  beforeEach(async () => {
    await global.testHelpers.db.clearAllTables();
    await global.testHelpers.db.seedTestData();
  });

  it('should create new product', async () => {
    const productData = {
      code: 'NEW001',
      name: 'New Product',
      category: 'electronics'
    };

    const response = await apiHelper.post('/api/products', productData, adminToken);

    apiHelper.expectSuccess(response, 201);
    expect(response.body.code).toBe(productData.code);
  });
});
```

## Test Helpers

### Database Helper
```typescript
// Clear all tables
await global.testHelpers.db.clearAllTables();

// Seed test data
await global.testHelpers.db.seedTestData();

// Get database instance
const db = global.testHelpers.db.getDb();

// Execute raw SQL
await global.testHelpers.db.executeRaw('SELECT 1');
```

### API Helper
```typescript
const apiHelper = new ApiTestHelper(app);

// Make authenticated requests
const response = await apiHelper.get('/api/products', token);
const response = await apiHelper.post('/api/products', data, token);

// Validate responses
apiHelper.expectSuccess(response, 200);
apiHelper.expectError(response, 404);
apiHelper.expectValidationError(response, 'code');
```

### Mock Services
```typescript
import { mockRedisClient, mockDbClient, resetAllMocks } from '../helpers/mock-services';

// Reset all mocks before each test
beforeEach(() => {
  resetAllMocks();
});

// Mock specific behavior
mockDbClient.select.mockResolvedValue([{ id: '1', name: 'Test' }]);
mockRedisClient.get.mockResolvedValue('cached-value');
```

## Best Practices

### 1. Test Organization
- Group related tests using `describe` blocks
- Use descriptive test names that explain expected behavior
- Follow AAA pattern: Arrange, Act, Assert

### 2. Test Data
- Use test fixtures for consistent data
- Clean database state between tests
- Avoid hardcoded values, use constants

### 3. Mocking
- Mock external dependencies (database, Redis, APIs)
- Reset mocks between tests
- Mock at the appropriate level (unit vs integration)

### 4. Assertions
- Use specific assertions (`toBe`, `toEqual`, `toContain`)
- Test both success and error cases
- Verify side effects (database changes, API calls)

### 5. Performance
- Keep tests fast (<100ms for unit tests)
- Use `beforeAll` for expensive setup
- Avoid unnecessary database operations

### 6. Coverage
- Aim for >80% code coverage
- Focus on critical business logic
- Don't chase 100% coverage at expense of quality

## CI/CD Integration

Tests run automatically on:
- **Push to main/develop branches**
- **Pull requests**
- **Schedule** (nightly builds)

### GitHub Actions Workflow

The CI pipeline:
1. Sets up Node.js and databases (PostgreSQL, Redis)
2. Installs dependencies
3. Runs type checking
4. Executes unit tests
5. Executes integration tests
6. Generates coverage reports
7. Uploads test results and artifacts

### Environment Variables

CI environment requires:
```yaml
DATABASE_URL: postgresql://postgres:postgres@localhost:5432/wms_test
REDIS_URL: redis://localhost:6379/1
NODE_ENV: test
```

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check if test database exists
psql -U postgres -c "\\l" | grep wms_test

# Recreate test database
npm run test:db drop
npm run test:db
```

### Redis Connection Issues
```bash
# Check if Redis is running
redis-cli ping

# Tests can run without Redis (it's optional)
# Set REDIS_URL to empty string to disable
```

### Port Conflicts
```bash
# Change test ports in .env.test
API_PORT=3002
DB_PORT=5433
REDIS_PORT=6380
```

### Memory Issues
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm test
```

### Test Timeouts
```bash
# Increase Jest timeout
jest --testTimeout=60000

# Or set in individual tests
jest.setTimeout(60000);
```

### Common Error Solutions

1. **"Database not found"**
   - Run `npm run test:setup`

2. **"Port already in use"**
   - Change ports in `.env.test`
   - Kill processes using the port

3. **"Module not found"**
   - Run `npm install`
   - Check import paths

4. **"Connection refused"**
   - Ensure databases are running
   - Check connection strings

5. **"Test hangs"**
   - Check for unclosed database connections
   - Ensure proper cleanup in tests

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Drizzle ORM Testing](https://orm.drizzle.team/docs/guides/testing)
- [PostgreSQL Testing Best Practices](https://wiki.postgresql.org/wiki/Testing)