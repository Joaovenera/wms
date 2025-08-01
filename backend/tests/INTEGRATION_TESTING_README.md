# WMS Backend Integration Testing Suite

This directory contains comprehensive integration tests for the Warehouse Management System (WMS) backend API. The test suite is designed to validate API endpoints, business logic, error handling, and system behavior under various conditions.

## 🚀 Quick Start

```bash
# Run all integration tests
npm run test:integration

# Run specific test suite
npx vitest run tests/integration/auth.test.ts

# Run tests with coverage
npm run test:integration:coverage

# Run tests in watch mode
npx vitest tests/integration --watch
```

## 📁 Test Structure

```
tests/
├── integration/                 # Integration test suites
│   ├── auth.test.ts            # Authentication & authorization tests
│   ├── users.test.ts           # User management API tests
│   ├── products.test.ts        # Product management API tests
│   ├── pallets.test.ts         # Pallet management API tests
│   ├── ucps.test.ts            # UCP (Unit Container Pallet) tests
│   ├── vehicles.test.ts        # Vehicle management API tests
│   ├── transfer-requests.test.ts # Transfer request workflow tests
│   └── error-scenarios.test.ts # Comprehensive error handling tests
├── helpers/                    # Test utilities and helpers
│   ├── test-app-factory.ts     # Express app factory for tests
│   ├── test-data-factory.ts    # Test data generation utilities
│   ├── api-test-helper.ts      # HTTP request helper class
│   ├── database-test-helper.ts # Database setup and cleanup
│   ├── redis-test-helper.ts    # Redis cache test utilities
│   └── mock-services.ts        # Service mocking utilities
├── fixtures/                   # Static test data
│   └── test-data.ts           # Predefined test entities
├── setup.ts                    # Global test setup and teardown
└── run-integration-tests.js    # Custom test runner with reporting
```

## 🛠️ Test Infrastructure

### Test Database Setup

The integration tests use a separate test database to ensure isolation from development data:

```env
# .env.test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wms_test
REDIS_URL=redis://localhost:6379/1
NODE_ENV=test
```

### Test Utilities

#### TestAppFactory
Creates and manages Express application instances for testing:

```typescript
const app = await testAppFactory.createApp();
const apiHelper = new ApiTestHelper(app);
```

#### TestDataFactory  
Generates realistic test data with relationships:

```typescript
const scenario = TestDataFactory.createCompleteScenario();
// Returns: users, products, pallets, ucps, vehicles, transferRequests
```

#### ApiTestHelper
Provides convenient HTTP request methods with authentication:

```typescript
const response = await apiHelper.get('/api/products', userToken);
apiHelper.expectSuccess(response, 200);
```

## 🧪 Test Categories

### 1. Authentication Tests (`auth.test.ts`)

- **User Authentication**: Session validation, token handling
- **Authorization Levels**: Role-based access control testing
- **Security**: Session hijacking protection, malformed tokens
- **Performance**: Authentication response times, burst requests

```typescript
describe('Authentication API Integration Tests', () => {
  it('should return current user info for authenticated requests', async () => {
    const response = await apiHelper.get('/api/user', operatorToken);
    apiHelper.expectSuccess(response, 200);
  });
});
```

### 2. User Management Tests (`users.test.ts`)

- **CRUD Operations**: Create, read, update, delete users
- **Role Management**: Role assignment and permission validation
- **Data Validation**: Input sanitization, field validation
- **Access Control**: User isolation, admin-only operations

### 3. Product Management Tests (`products.test.ts`)

- **Product Lifecycle**: Creation, updates, soft deletion
- **Search & Filtering**: Product queries, category filtering
- **Validation**: SKU uniqueness, dimension validation
- **Relationships**: Product-UCP associations

### 4. Pallet Management Tests (`pallets.test.ts`)

- **Pallet Types**: Standard, Euro, custom pallet handling
- **Capacity Management**: Weight/volume limit validation
- **Utilization**: Current usage tracking, optimization
- **Constraints**: Active UCP prevention for deletion

### 5. UCP Tests (`ucps.test.ts`)

- **UCP Workflow**: Creation, item addition, status transitions
- **Item Management**: Product placement, position validation
- **Capacity Validation**: Weight/volume constraint enforcement
- **Status Management**: Workflow state transitions

### 6. Vehicle Management Tests (`vehicles.test.ts`)

- **Fleet Management**: Vehicle registration, status tracking
- **Assignment System**: Operator assignment, availability tracking
- **Maintenance**: Service scheduling, status management
- **Performance**: Utilization analytics, concurrent operations

### 7. Transfer Request Tests (`transfer-requests.test.ts`)

- **Request Lifecycle**: Creation, approval, execution, completion
- **Workflow Management**: Status transitions, approval hierarchy
- **Location Validation**: Source/destination verification
- **Business Rules**: Priority handling, conflict resolution

### 8. Error Scenario Tests (`error-scenarios.test.ts`)

Comprehensive error handling validation:

#### Database Errors
- Connection failures, query timeouts
- Constraint violations, transaction rollbacks
- Concurrent access conflicts

#### Authentication Errors  
- Expired tokens, privilege escalation
- Session hijacking attempts
- Malformed credentials

#### Input Validation Errors
- SQL injection attempts
- XSS payload handling
- Oversized payload protection
- Malformed JSON handling

#### Business Logic Errors
- Foreign key violations
- Circular dependencies
- Resource capacity exceeded
- Workflow state conflicts

#### External Service Failures
- Redis cache failures
- WebSocket service errors
- File system errors

## 📊 Test Reporting

### Automated Test Runner

The custom test runner (`run-integration-tests.js`) provides:

- **Environment Setup**: Database migrations, test data seeding
- **Parallel Execution**: Optimized test suite execution
- **Comprehensive Reporting**: JSON and HTML report generation
- **Error Analysis**: Detailed failure reporting and categorization

```bash
# Run with custom runner
node tests/run-integration-tests.js
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:integration:coverage

# View HTML coverage report
open coverage/index.html
```

### Performance Monitoring

Each test suite includes performance benchmarks:

```typescript
it('should handle concurrent operations efficiently', async () => {
  const startTime = Date.now();
  const responses = await Promise.all(requests);
  const totalTime = Date.now() - startTime;
  
  expect(totalTime).toBeLessThan(2000); // 2 second threshold
});
```

## 🔧 Configuration

### Vitest Configuration

```typescript
// vitest.unified.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 75,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

### Environment Variables

```env
# Required for integration tests
DATABASE_URL=postgresql://user:pass@localhost:5432/wms_test
REDIS_URL=redis://localhost:6379/1

# Optional test configuration
VITEST_VERBOSE=false
TEST_TIMEOUT=30000
LOG_LEVEL=error
```

## 🚨 Best Practices

### Test Isolation

Each test should be completely independent:

```typescript
beforeEach(async () => {
  TestDataFactory.resetCounters();
  await global.testHelpers.db.clearAllTables();
  await setupTestData();
});
```

### Realistic Test Data

Use the TestDataFactory for consistent, realistic data:

```typescript
// ✅ Good - realistic relationships
const scenario = TestDataFactory.createCompleteScenario();

// ❌ Avoid - hardcoded test data
const user = { id: 'test-123', name: 'Test User' };
```

### Error Testing

Validate both success and failure scenarios:

```typescript
it('should reject invalid product data', async () => {
  const invalidProduct = { ...validProduct, weight: -1 };
  const response = await apiHelper.post('/api/products', invalidProduct, adminToken);
  
  apiHelper.expectValidationError(response, 'weight');
});
```

### Performance Validation

Include performance assertions:

```typescript
it('should respond within reasonable time', async () => {
  const startTime = Date.now();
  await apiHelper.get('/api/products', operatorToken);
  const responseTime = Date.now() - startTime;
  
  expect(responseTime).toBeLessThan(500);
});
```

## 🐛 Debugging Tests

### Verbose Output

```bash
# Enable verbose logging
VITEST_VERBOSE=true npx vitest run tests/integration/auth.test.ts
```

### Database Inspection

```typescript
// Check database state during tests
const count = await global.testHelpers.db.countRecords('users');
console.log(`Users in database: ${count}`);
```

### Test Isolation Issues

```bash
# Run single test to isolate issues
npx vitest run tests/integration/users.test.ts -t "should create new user"
```

## 📈 Continuous Integration

### GitHub Actions Integration

```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: wms_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:integration
```

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check database is running
   pg_isready -h localhost -p 5432
   
   # Reset test database
   dropdb wms_test && createdb wms_test
   ```

2. **Port Conflicts**
   ```bash
   # Check for port usage
   lsof -i :3000 -i :5432 -i :6379
   ```

3. **Test Timeouts**
   ```bash
   # Increase timeout for slow tests
   VITEST_TIMEOUT=60000 npm run test:integration
   ```

4. **Memory Issues**
   ```bash
   # Run tests with more memory
   NODE_OPTIONS="--max-old-space-size=4096" npm run test:integration
   ```

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Supertest API Testing](https://github.com/visionmedia/supertest)
- [Express Testing Best Practices](https://expressjs.com/en/guide/testing.html)
- [Database Testing Strategies](https://martinfowler.com/articles/practical-test-pyramid.html)

## 🤝 Contributing

When adding new integration tests:

1. **Follow Naming Conventions**: `feature.test.ts`
2. **Use TestDataFactory**: For consistent test data
3. **Include Error Scenarios**: Test failure paths
4. **Add Performance Checks**: Validate response times
5. **Update Documentation**: Keep this README current

For questions or issues with the test suite, please check the existing tests for patterns and consult the team documentation.