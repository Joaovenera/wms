# E2E Testing Guide - Warehouse Management System

## Overview

This guide covers the comprehensive End-to-End (E2E) testing pipeline for the Warehouse Management System. Our E2E testing strategy ensures quality across all user workflows, device types, and accessibility requirements.

## Table of Contents

1. [Test Architecture](#test-architecture)
2. [Test Categories](#test-categories)
3. [Running Tests](#running-tests)
4. [Writing Tests](#writing-tests)
5. [CI/CD Integration](#cicd-integration)
6. [Performance Testing](#performance-testing)
7. [Accessibility Testing](#accessibility-testing)
8. [Mobile Testing](#mobile-testing)
9. [Visual Regression Testing](#visual-regression-testing)
10. [Troubleshooting](#troubleshooting)

## Test Architecture

### Playwright Configuration

Our E2E tests use Playwright with the following projects:

- **Desktop Browsers**: Chrome, Firefox, Safari
- **Mobile Devices**: iPhone 12, Pixel 5, iPad Pro
- **Specialized Projects**: Performance, Accessibility, Visual Regression

### Test Structure

```
backend/src/test/e2e/
├── auth/                       # Authentication state files
├── fixtures/                   # Test data and images
├── global-setup.ts            # Global test setup
├── global-teardown.ts         # Global test cleanup
├── seed-test-data.ts          # Test data seeding
├── clean-test-data.ts         # Test data cleanup
├── auth-flows.spec.ts         # Authentication tests
├── warehouse-operations.spec.ts # Core warehouse workflows
├── mobile-workflows.spec.ts   # Mobile-specific tests
├── performance.spec.ts        # Performance testing
├── accessibility.spec.ts      # Accessibility compliance
└── visual-regression.spec.ts  # Visual regression tests
```

## Test Categories

### 1. Authentication Flows (`auth-flows.spec.ts`)

Tests user authentication, session management, and security:

- Login/logout flows
- Form validation
- Session expiration
- Role-based access control
- Password recovery
- Security headers validation
- Rate limiting

### 2. Warehouse Operations (`warehouse-operations.spec.ts`)

Tests core business workflows:

- **Product Management**: CRUD operations, photo uploads, packaging hierarchy
- **Inventory Management**: Stock movements, transfers, discrepancies
- **Pallet Management**: Creation, optimization, capacity constraints
- **Loading Operations**: Planning, execution, vehicle optimization
- **Reporting**: Data generation, exports, real-time dashboards

### 3. Mobile Workflows (`mobile-workflows.spec.ts`)

Mobile-specific functionality:

- Touch navigation and gestures
- Barcode scanning (camera and manual)
- Photo capture capabilities
- Offline mode and synchronization
- Performance on mobile networks
- Landscape/portrait orientation

### 4. Performance Testing (`performance.spec.ts`)

Performance benchmarks and optimization:

- Page load times
- API response times
- Memory usage monitoring
- Concurrent user simulation
- Large dataset handling
- Real-time update performance

### 5. Accessibility Testing (`accessibility.spec.ts`)

WCAG 2.1 Level AA compliance:

- Screen reader compatibility
- Keyboard navigation
- Color contrast validation
- Focus management
- ARIA attributes
- Mobile accessibility

## Running Tests

### Prerequisites

```bash
# Install dependencies
cd backend
npm install

# Install Playwright browsers
npx playwright install --with-deps
```

### Basic Test Execution

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test categories
npm run test:e2e:auth           # Authentication tests
npm run test:e2e:warehouse      # Warehouse operations
npm run test:e2e:mobile         # Mobile tests
npm run test:e2e:performance    # Performance tests
npm run test:e2e:accessibility  # Accessibility tests

# Run with UI (interactive mode)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode (step through tests)
npm run test:e2e:debug
```

### Environment Setup

```bash
# Setup test database and seed data
npm run test:setup

# Start backend and frontend services
npm run dev  # In backend directory
cd ../frontend && npm run dev
```

### Specific Browser Testing

```bash
# Run tests on specific browsers
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Run mobile tests
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
npx playwright test --project="iPad"
```

## Writing Tests

### Test Structure Template

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup code (login, navigation, etc.)
    await page.goto('/feature-page')
  })

  test('should perform specific action', async ({ page }) => {
    // Test implementation
    await page.click('[data-testid=action-button]')
    await expect(page.locator('[data-testid=result]')).toBeVisible()
  })

  test.afterEach(async ({ page }) => {
    // Cleanup if needed
  })
})
```

### Best Practices

1. **Data Test IDs**: Always use `data-testid` attributes for element selection
2. **Wait Strategies**: Use appropriate wait strategies (`waitForLoadState`, `waitForSelector`)
3. **Assertions**: Use meaningful assertions with clear error messages
4. **Test Isolation**: Each test should be independent and idempotent
5. **Cleanup**: Clean up test data after each test run

### Authentication

Tests can use pre-saved authentication states:

```typescript
// Use saved authentication state
test.use({ storageState: 'src/test/e2e/auth/admin-auth.json' })

// Or login programmatically
test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.fill('[data-testid=email-input]', 'admin@warehouse.com')
  await page.fill('[data-testid=password-input]', 'admin123')
  await page.click('[data-testid=login-button]')
  await page.waitForURL('/dashboard')
})
```

## CI/CD Integration

### GitHub Actions Workflow

Our CI/CD pipeline runs E2E tests automatically:

- **Triggers**: Push to main/develop, Pull Requests, Daily schedule
- **Parallel Execution**: Tests run across multiple browser/device combinations
- **Reporting**: HTML reports, Allure reports, test artifacts
- **Notifications**: Slack notifications for failures

### Pipeline Structure

1. **Setup Phase**: Database, services, dependencies
2. **Test Execution**: Parallel test runs across projects
3. **Reporting**: Generate and upload test reports
4. **Notification**: Send results to development team

### Environment Variables

```bash
# Required for CI
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/warehouse_test
REDIS_URL=redis://localhost:6379
BASE_URL=http://localhost:5173
API_URL=http://localhost:3001
CI=true
```

## Performance Testing

### Performance Budgets

Our performance targets:

- **Dashboard Load**: < 2 seconds
- **Product List**: < 1.5 seconds for first content
- **API Responses**: < 500ms for standard operations
- **Search Operations**: < 3 seconds for complex queries
- **Mobile Performance**: < 5 seconds on slow 3G

### Performance Metrics

Tests monitor:

- Page load times
- First contentful paint
- Time to interactive
- Memory usage
- API response times
- WebSocket performance

### Running Performance Tests

```bash
# Run performance tests
npm run test:e2e:performance

# Performance testing with specific conditions
npx playwright test performance.spec.ts --project=performance
```

## Accessibility Testing

### WCAG 2.1 Level AA Compliance

Our accessibility tests ensure:

- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Readers**: Proper ARIA labels and structure
- **Color Contrast**: Meets minimum contrast ratios
- **Focus Management**: Logical focus order
- **Mobile Accessibility**: Touch target sizes, voice control

### Accessibility Tools Integration

- **axe-core**: Automated accessibility scanning
- **axe-playwright**: Playwright integration for axe-core
- **Manual Testing**: Keyboard navigation, screen reader testing

### Running Accessibility Tests

```bash
# Run accessibility tests
npm run test:e2e:accessibility

# Accessibility testing with detailed reports
npx playwright test accessibility.spec.ts --project=accessibility
```

## Mobile Testing

### Device Coverage

- **Phones**: iPhone 12, Pixel 5
- **Tablets**: iPad Pro
- **Orientations**: Portrait and landscape
- **Networks**: Slow 3G simulation

### Mobile-Specific Features

- Touch gestures and interactions
- Camera access for barcode scanning
- Offline functionality
- Push notifications
- Performance on mobile networks

### Running Mobile Tests

```bash
# Run all mobile tests
npm run test:e2e:mobile

# Specific device testing
npx playwright test mobile-workflows.spec.ts --project="iPhone 12"
npx playwright test mobile-workflows.spec.ts --project="iPad"
```

## Visual Regression Testing

### Screenshot Comparison

Visual tests capture and compare:

- Page layouts across viewports
- Component rendering consistency
- Theme variations (light/dark)
- Error states and loading screens

### Managing Visual Baselines

```bash
# Update visual baselines
npx playwright test --project=visual --update-snapshots

# Review visual differences
npx playwright show-report
```

## Troubleshooting

### Common Issues

1. **Test Timeouts**
   ```bash
   # Increase timeout for slow operations
   test.setTimeout(60000)
   ```

2. **Flaky Tests**
   ```typescript
   // Add proper waits
   await page.waitForLoadState('networkidle')
   await expect(element).toBeVisible()
   ```

3. **Authentication Issues**
   ```bash
   # Regenerate auth states
   npx playwright test auth-setup.spec.ts
   ```

4. **Database Issues**
   ```bash
   # Reset test database
   npm run test:setup
   ```

### Debug Tools

```bash
# Run with debug mode
npm run test:e2e:debug

# View test trace
npx playwright show-trace trace.zip

# Generate and view HTML report
npm run test:e2e:report
```

### Log Analysis

Check logs for issues:

- **Backend logs**: `backend/logs/`
- **Test outputs**: `backend/test-results/`
- **Screenshots**: Captured on failures
- **Videos**: Available for failed tests

## Reporting

### Available Reports

1. **HTML Report**: Interactive test results with screenshots
2. **Allure Report**: Detailed reporting with trends
3. **JUnit Report**: CI/CD integration format
4. **JSON Report**: Programmatic access to results

### Accessing Reports

```bash
# View HTML report
npm run test:e2e:report

# Generate Allure report
npx allure generate test-results/allure-results -o test-results/allure-report
npx allure open test-results/allure-report
```

## Contributing

### Adding New Tests

1. Create test file in appropriate category
2. Follow naming convention: `feature-name.spec.ts`
3. Use consistent test structure and data-testid attributes
4. Include both positive and negative test cases
5. Add performance and accessibility considerations

### Updating Existing Tests

1. Maintain backward compatibility
2. Update test data and assertions as needed
3. Verify tests pass across all browser projects
4. Update documentation for any new features

### Code Review Checklist

- [ ] Tests follow established patterns
- [ ] Proper use of data-testid selectors
- [ ] Appropriate wait strategies
- [ ] Meaningful assertions and error messages
- [ ] Test isolation and cleanup
- [ ] Performance considerations
- [ ] Accessibility compliance
- [ ] Mobile compatibility

For questions or issues, contact the development team or create an issue in the repository.