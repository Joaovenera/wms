# Packaging Composition Test Suite

This comprehensive test suite validates the packaging composition algorithms and business logic in the WMS system. The tests are organized into multiple categories to ensure thorough coverage of all scenarios.

## Test Architecture

### Test Structure
```
src/test/
├── unit/services/
│   ├── packaging-composition.service.unit.test.ts      # Core unit tests
│   └── packaging-composition.property.test.ts         # Property-based tests
├── integration/
│   └── packaging-composition.integration.test.ts      # API integration tests
├── performance/
│   └── packaging-composition.performance.test.ts      # Performance benchmarks
└── helpers/
    └── packaging-test-factory.ts                     # Test data factory
```

## Test Categories

### 1. Unit Tests (`packaging-composition.service.unit.test.ts`)

**Coverage**: Core business logic, algorithms, and service methods

**Test Groups**:
- **Packaging Type Management**: CRUD operations, validation
- **Unit Conversion Tests**: Base unit conversions, factor calculations
- **Stock Management Tests**: Consolidated stock, stock by packaging
- **Picking Optimization Tests**: Algorithm validation, edge cases
- **Packaging Creation and Validation**: Business rule enforcement
- **Packaging Hierarchy Tests**: Tree structure building
- **Edge Cases and Error Handling**: Boundary conditions, error scenarios

**Key Features**:
- Mock database interactions for isolated testing
- Comprehensive validation of business rules
- Error condition testing
- Edge case handling (zero quantities, large numbers, etc.)

### 2. Integration Tests (`packaging-composition.integration.test.ts`)

**Coverage**: End-to-end API functionality, database interactions

**Test Groups**:
- **GET /api/packaging/products/:productId**: Packaging retrieval with stock
- **GET /api/packaging/products/:productId/hierarchy**: Hierarchical structure
- **POST /api/packaging/scan**: Barcode scanning functionality
- **POST /api/packaging/convert**: Quantity conversion API
- **POST /api/packaging/optimize-picking**: Picking optimization API
- **POST /api/packaging**: Packaging creation API
- **PUT /api/packaging/:id**: Packaging updates
- **DELETE /api/packaging/:id**: Soft delete operations
- **Error Handling and Edge Cases**: Real error scenarios
- **Performance and Load Testing**: Response time validation

**Key Features**:
- Real database transactions
- Authentication testing
- Input validation
- Error response validation
- Concurrent request handling
- Performance benchmarking

### 3. Performance Tests (`packaging-composition.performance.test.ts`)

**Coverage**: Performance characteristics, scalability, memory usage

**Test Groups**:
- **Packaging Retrieval Performance**: Sub-50ms response times
- **Unit Conversion Performance**: Sub-20ms conversions
- **Picking Optimization Performance**: Scalable optimization algorithms
- **Concurrent Operations Performance**: Multi-request handling
- **Memory Usage and Efficiency**: Memory leak detection
- **Database Query Optimization**: Query count validation
- **Stress Testing**: High-load scenarios

**Performance Benchmarks**:
- `getPackagingsByProduct`: < 50ms
- `getStockByPackaging`: < 100ms
- `getStockConsolidated`: < 30ms
- `convertToBaseUnits`: < 20ms
- `calculateConversionFactor`: < 25ms
- `optimizePickingByPackaging` (small): < 100ms
- `optimizePickingByPackaging` (large): < 200ms

### 4. Property-Based Tests (`packaging-composition.property.test.ts`)

**Coverage**: Mathematical properties, invariants, edge cases

**Test Categories**:
- **Unit Conversion Properties**: Round-trip accuracy, symmetry, proportionality
- **Picking Optimization Properties**: Stock limits, priority ordering
- **Data Integrity Properties**: Positive quantities, hierarchy consistency
- **Edge Case Properties**: Extreme values, boundary conditions
- **Performance Properties**: Scaling characteristics, memory bounds
- **Invariant Properties**: Mathematical invariants, determinism

**Key Properties Tested**:
- `convertFromBase(convertToBase(x)) ≈ x` (Round-trip accuracy)
- `factor(A,B) * factor(B,A) = 1` (Conversion symmetry)
- `convert(0) = 0` (Zero identity)
- `convert(x * k) = convert(x) * k` (Proportionality)
- `totalPicked ≤ totalAvailable` (Stock constraints)
- `optimize(input) = optimize(input)` (Determinism)

## Test Data Factory

### `PackagingTestFactory`

**Purpose**: Generate realistic test data for all test scenarios

**Key Methods**:
- `createBaseUnit()`: Generate base unit packaging
- `createSecondaryPackaging()`: Generate box/pack level packaging
- `createTertiaryPackaging()`: Generate display/case level packaging  
- `createPalletPackaging()`: Generate pallet level packaging
- `createPackagingHierarchy()`: Generate complete hierarchies
- `createHierarchicalPackaging()`: Generate parent-child relationships
- `createStockItems()`: Generate stock data
- `generateConversionTestCases()`: Generate conversion scenarios
- `generateOptimizationScenarios()`: Generate optimization test cases
- `generateEdgeCases()`: Generate boundary condition tests
- `createWarehouseScenarios()`: Generate realistic warehouse data

**Features**:
- Faker.js integration for realistic data
- Configurable constraints and options
- Hierarchical relationship management
- Barcode generation with uniqueness
- Dimensional data generation
- Stock level simulation

## Running the Tests

### Individual Test Suites

```bash
# Unit tests only
npm run test:unit -- packaging-composition.service.unit.test.ts

# Integration tests only  
npm run test:integration -- packaging-composition.integration.test.ts

# Performance tests only
npm run test:performance -- packaging-composition.performance.test.ts

# Property-based tests only
npm run test:unit -- packaging-composition.property.test.ts
```

### All Packaging Tests

```bash
# Run all packaging-related tests
npm run test -- --testPathPattern=packaging-composition

# Run with coverage
npm run test:coverage -- --testPathPattern=packaging-composition
```

### Performance Monitoring

```bash
# Run performance tests with detailed output
npm run test:performance -- packaging-composition.performance.test.ts --verbose
```

## Test Configuration

### Database Setup

Integration and performance tests require:
- Test database connection
- Transaction rollback capability
- Test data isolation
- Authentication middleware testing

### Mock Configuration

Unit tests use comprehensive mocking:
- Database client mocking
- Service method mocking
- External dependency isolation
- Controlled test scenarios

### Performance Thresholds

Configurable performance limits:
```typescript
const PERFORMANCE_THRESHOLDS = {
  packaging_retrieval: 50,      // ms
  stock_calculation: 100,       // ms
  unit_conversion: 20,          // ms
  optimization_small: 100,      // ms
  optimization_large: 200,      // ms
  concurrent_requests: 500,     // ms for 20 requests
  memory_increase: 50 * 1024 * 1024  // bytes (50MB)
};
```

## Coverage Goals

### Target Coverage Metrics
- **Statements**: >95%
- **Branches**: >90%
- **Functions**: >95%
- **Lines**: >95%

### Critical Paths (100% Coverage Required)
- Unit conversion algorithms
- Picking optimization logic
- Business rule validation
- Error handling paths
- Stock calculation methods

## Test Data Patterns

### Realistic Scenarios
- Small warehouse (5 products, 3 packaging types each)
- Medium distribution center (20 products, 5 packaging types each)
- Large enterprise warehouse (100 products, 7 packaging types each)
- Low stock scenarios
- High complexity hierarchies

### Edge Cases
- Zero quantities
- Maximum safe integer values
- Fractional quantities with high precision
- Non-existent IDs
- Malformed input data
- Concurrent access scenarios

## Continuous Integration

### Pre-commit Hooks
- Unit test execution
- Basic performance validation
- Code coverage check

### CI Pipeline
- Full test suite execution
- Performance regression detection
- Coverage report generation
- Test result archiving

### Performance Monitoring
- Benchmark result tracking
- Performance regression alerts
- Memory usage monitoring
- Database query optimization validation

## Debugging Test Failures

### Common Issues

1. **Database State**: Ensure proper test data cleanup
2. **Mock Setup**: Verify mock return values match expected data structure
3. **Async Operations**: Check proper async/await usage
4. **Performance Variance**: Account for system load in performance tests
5. **Property Test Failures**: Investigate edge cases revealed by random data

### Debug Tools

```bash
# Run specific test with debug output
npm run test -- --testNamePattern="specific test name" --verbose

# Run with Node.js debugging
node --inspect-brk node_modules/.bin/vitest run packaging-composition

# Generate detailed coverage report
npm run test:coverage -- --reporter=html
```

## Contributing

### Adding New Tests

1. **Unit Tests**: Add to appropriate describe block in unit test file
2. **Integration Tests**: Create new endpoint test group
3. **Performance Tests**: Add with appropriate threshold
4. **Property Tests**: Define mathematical property and implement test

### Test Naming Convention

```typescript
describe('ServiceClass - Test Category', () => {
  describe('methodName', () => {
    it('should perform expected behavior under normal conditions', () => {
      // Test implementation
    });
    
    it('should handle edge case: specific scenario description', () => {
      // Edge case test
    });
    
    it('should throw error when invalid input provided', () => {
      // Error condition test
    });
  });
});
```

### Property Test Guidelines

```typescript
it('should maintain mathematical property: property description', async () => {
  const iterations = 50;
  
  for (let i = 0; i < iterations; i++) {
    // Generate random input using faker or test factory
    const input = generateRandomInput();
    
    // Execute operation
    const result = await service.operation(input);
    
    // Assert property holds
    expect(propertyHolds(input, result)).toBe(true);
  }
});
```

This comprehensive test suite ensures the packaging composition system is robust, performant, and maintains mathematical correctness across all operations.