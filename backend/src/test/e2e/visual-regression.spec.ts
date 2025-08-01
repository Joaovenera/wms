import { test, expect } from '@playwright/test'

test.describe('Visual Regression Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.fill('[data-testid=email-input]', 'admin@warehouse.com')
    await page.fill('[data-testid=password-input]', 'admin123')
    await page.click('[data-testid=login-button]')
    await page.waitForURL('/dashboard')
  })

  test.describe('Dashboard Screenshots', () => {
    test('should match dashboard layout on desktop', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Hide dynamic content that changes frequently
      await page.addStyleTag({
        content: `
          [data-testid="last-updated-timestamp"],
          [data-testid="current-time"],
          [data-testid="dynamic-chart-data"] {
            visibility: hidden !important;
          }
        `
      })
      
      // Take full page screenshot
      await expect(page).toHaveScreenshot('dashboard-desktop.png', {
        fullPage: true,
        animations: 'disabled'
      })
    })

    test('should match dashboard layout on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      await page.addStyleTag({
        content: `
          [data-testid="last-updated-timestamp"],
          [data-testid="current-time"] {
            visibility: hidden !important;
          }
        `
      })
      
      await expect(page).toHaveScreenshot('dashboard-tablet.png', {
        fullPage: true,
        animations: 'disabled'
      })
    })

    test('should match dashboard layout on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      await page.addStyleTag({
        content: `
          [data-testid="last-updated-timestamp"],
          [data-testid="current-time"] {
            visibility: hidden !important;
          }
        `
      })
      
      await expect(page).toHaveScreenshot('dashboard-mobile.png', {
        fullPage: true,
        animations: 'disabled'
      })
    })
  })

  test.describe('Products Page Screenshots', () => {
    test('should match products list layout', async ({ page }) => {
      await page.goto('/products')
      await page.waitForLoadState('networkidle')
      
      // Wait for product list to load
      await expect(page.locator('[data-testid=products-list]')).toBeVisible()
      
      // Hide dynamic timestamps
      await page.addStyleTag({
        content: `
          [data-testid*="timestamp"],
          [data-testid*="last-modified"] {
            visibility: hidden !important;
          }
        `
      })
      
      await expect(page).toHaveScreenshot('products-list.png', {
        fullPage: true,
        animations: 'disabled'
      })
    })

    test('should match product creation form', async ({ page }) => {
      await page.goto('/products')
      await page.click('[data-testid=create-product-button]')
      
      // Wait for form to be visible
      await expect(page.locator('[data-testid=product-form]')).toBeVisible()
      
      await expect(page.locator('[data-testid=product-form]')).toHaveScreenshot('product-create-form.png', {
        animations: 'disabled'
      })
    })

    test('should match product search results', async ({ page }) => {
      await page.goto('/products')
      await page.fill('[data-testid=search-input]', 'test')
      await page.press('[data-testid=search-input]', 'Enter')
      
      // Wait for search results
      await expect(page.locator('[data-testid=search-results]')).toBeVisible()
      
      await expect(page.locator('[data-testid=search-results]')).toHaveScreenshot('product-search-results.png', {
        animations: 'disabled'
      })
    })
  })

  test.describe('Pallets Page Screenshots', () => {
    test('should match pallets grid layout', async ({ page }) => {
      await page.goto('/pallets')
      await page.waitForLoadState('networkidle')
      
      await expect(page.locator('[data-testid=pallets-grid]')).toBeVisible()
      
      await expect(page).toHaveScreenshot('pallets-grid.png', {
        fullPage: true,
        animations: 'disabled'
      })
    })

    test('should match pallet creation wizard', async ({ page }) => {
      await page.goto('/pallets')
      await page.click('[data-testid=create-pallet-button]')
      
      await expect(page.locator('[data-testid=pallet-wizard]')).toBeVisible()
      
      await expect(page.locator('[data-testid=pallet-wizard]')).toHaveScreenshot('pallet-creation-wizard.png', {
        animations: 'disabled'
      })
    })

    test('should match pallet optimization view', async ({ page }) => {
      await page.goto('/pallets')
      await page.click('[data-testid=pallet-row]:first-child')
      await page.click('[data-testid=optimize-layout-button]')
      
      await expect(page.locator('[data-testid=optimization-view]')).toBeVisible()
      
      await expect(page.locator('[data-testid=optimization-view]')).toHaveScreenshot('pallet-optimization.png', {
        animations: 'disabled'
      })
    })
  })

  test.describe('Transfers Page Screenshots', () => {
    test('should match transfers list layout', async ({ page }) => {
      await page.goto('/transfers')
      await page.waitForLoadState('networkidle')
      
      await expect(page.locator('[data-testid=transfers-list]')).toBeVisible()
      
      // Hide timestamps in transfer list
      await page.addStyleTag({
        content: `
          [data-testid*="created-at"],
          [data-testid*="updated-at"] {
            visibility: hidden !important;
          }
        `
      })
      
      await expect(page).toHaveScreenshot('transfers-list.png', {
        fullPage: true,
        animations: 'disabled'
      })
    })

    test('should match transfer creation form', async ({ page }) => {
      await page.goto('/transfers')
      await page.click('[data-testid=create-transfer-button]')
      
      await expect(page.locator('[data-testid=transfer-form]')).toBeVisible()
      
      await expect(page.locator('[data-testid=transfer-form]')).toHaveScreenshot('transfer-creation-form.png', {
        animations: 'disabled'
      })
    })

    test('should match transfer execution interface', async ({ page }) => {
      await page.goto('/transfers')
      await page.click('[data-testid=transfer-row]:first-child')
      await page.click('[data-testid=execute-transfer-button]')
      
      await expect(page.locator('[data-testid=execution-interface]')).toBeVisible()
      
      await expect(page.locator('[data-testid=execution-interface]')).toHaveScreenshot('transfer-execution.png', {
        animations: 'disabled'
      })
    })
  })

  test.describe('Mobile Interface Screenshots', () => {
    test('should match mobile dashboard', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/mobile')
      await page.waitForLoadState('networkidle')
      
      await expect(page.locator('[data-testid=mobile-dashboard]')).toBeVisible()
      
      await page.addStyleTag({
        content: `
          [data-testid="mobile-timestamp"] {
            visibility: hidden !important;
          }
        `
      })
      
      await expect(page).toHaveScreenshot('mobile-dashboard.png', {
        fullPage: true,
        animations: 'disabled'
      })
    })

    test('should match mobile scanner interface', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/mobile/scanner')
      await page.waitForLoadState('networkidle')
      
      await expect(page.locator('[data-testid=mobile-scanner-view]')).toBeVisible()
      
      await expect(page).toHaveScreenshot('mobile-scanner.png', {
        fullPage: true,
        animations: 'disabled'
      })
    })

    test('should match mobile pallets view', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/mobile/pallets')
      await page.waitForLoadState('networkidle')
      
      await expect(page.locator('[data-testid=mobile-pallets-view]')).toBeVisible()
      
      await expect(page).toHaveScreenshot('mobile-pallets.png', {
        fullPage: true,
        animations: 'disabled'
      })
    })
  })

  test.describe('Component Screenshots', () => {
    test('should match navigation menu', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Take screenshot of main navigation
      await expect(page.locator('[data-testid=main-nav]')).toHaveScreenshot('main-navigation.png', {
        animations: 'disabled'
      })
    })

    test('should match user menu dropdown', async ({ page }) => {
      await page.goto('/dashboard')
      await page.click('[data-testid=user-menu-button]')
      
      await expect(page.locator('[data-testid=user-menu-dropdown]')).toBeVisible()
      
      await expect(page.locator('[data-testid=user-menu-dropdown]')).toHaveScreenshot('user-menu-dropdown.png', {
        animations: 'disabled'
      })
    })

    test('should match search modal', async ({ page }) => {
      await page.goto('/dashboard')
      await page.keyboard.press('Control+k')
      
      await expect(page.locator('[data-testid=search-modal]')).toBeVisible()
      
      await expect(page.locator('[data-testid=search-modal]')).toHaveScreenshot('search-modal.png', {
        animations: 'disabled'
      })
    })

    test('should match loading states', async ({ page }) => {
      await page.goto('/products')
      
      // Intercept API calls to show loading state
      await page.route('**/api/products', route => {
        setTimeout(() => route.continue(), 2000)
      })
      
      await page.reload()
      
      // Capture loading state
      await expect(page.locator('[data-testid=loading-spinner]')).toBeVisible()
      await expect(page.locator('[data-testid=loading-spinner]')).toHaveScreenshot('loading-state.png', {
        animations: 'disabled'
      })
    })
  })

  test.describe('Error States Screenshots', () => {
    test('should match 404 error page', async ({ page }) => {
      await page.goto('/non-existent-page')
      
      await expect(page.locator('[data-testid=not-found-page]')).toBeVisible()
      
      await expect(page).toHaveScreenshot('404-error-page.png', {
        fullPage: true,
        animations: 'disabled'
      })
    })

    test('should match network error state', async ({ page }) => {
      await page.goto('/products')
      
      // Simulate network error
      await page.route('**/api/**', route => route.abort())
      
      await page.reload()
      
      await expect(page.locator('[data-testid=network-error]')).toBeVisible()
      
      await expect(page.locator('[data-testid=network-error]')).toHaveScreenshot('network-error-state.png', {
        animations: 'disabled'
      })
    })

    test('should match form validation errors', async ({ page }) => {
      await page.goto('/products')
      await page.click('[data-testid=create-product-button]')
      
      // Submit form without required fields
      await page.click('[data-testid=save-product-button]')
      
      // Wait for validation errors
      await expect(page.locator('[data-testid*="error"]')).toBeVisible()
      
      await expect(page.locator('[data-testid=product-form]')).toHaveScreenshot('form-validation-errors.png', {
        animations: 'disabled'
      })
    })
  })

  test.describe('Theme Variations', () => {
    test('should match dark theme dashboard', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Enable dark theme
      await page.click('[data-testid=theme-toggle]')
      
      // Wait for theme to apply
      await page.waitForTimeout(500)
      
      await page.addStyleTag({
        content: `
          [data-testid="last-updated-timestamp"] {
            visibility: hidden !important;
          }
        `
      })
      
      await expect(page).toHaveScreenshot('dashboard-dark-theme.png', {
        fullPage: true,
        animations: 'disabled'
      })
    })

    test('should match high contrast mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.addInitScript(() => {
        document.documentElement.classList.add('high-contrast')
      })
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      await expect(page).toHaveScreenshot('dashboard-high-contrast.png', {
        fullPage: true,
        animations: 'disabled'
      })
    })
  })

  test.describe('Responsive Breakpoints', () => {
    const breakpoints = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1024, height: 768 },
      { name: 'large-desktop', width: 1440, height: 900 }
    ]

    for (const breakpoint of breakpoints) {
      test(`should match products page at ${breakpoint.name} breakpoint`, async ({ page }) => {
        await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height })
        await page.goto('/products')
        await page.waitForLoadState('networkidle')
        
        await expect(page.locator('[data-testid=products-list]')).toBeVisible()
        
        await expect(page).toHaveScreenshot(`products-${breakpoint.name}.png`, {
          fullPage: true,
          animations: 'disabled'
        })
      })
    }
  })

  test.describe('Interactive States', () => {
    test('should match button hover states', async ({ page }) => {
      await page.goto('/products')
      
      // Hover over create button
      await page.hover('[data-testid=create-product-button]')
      
      await expect(page.locator('[data-testid=create-product-button]')).toHaveScreenshot('button-hover-state.png', {
        animations: 'disabled'
      })
    })

    test('should match input focus states', async ({ page }) => {
      await page.goto('/products')
      await page.click('[data-testid=create-product-button]')
      
      // Focus on first input
      await page.focus('[data-testid=product-sku-input]')
      
      await expect(page.locator('[data-testid=product-sku-input]')).toHaveScreenshot('input-focus-state.png', {
        animations: 'disabled'
      })
    })

    test('should match selected row states', async ({ page }) => {
      await page.goto('/products')
      
      // Select first product row
      await page.click('[data-testid=product-row]:first-child')
      
      await expect(page.locator('[data-testid=product-row]:first-child')).toHaveScreenshot('selected-row-state.png', {
        animations: 'disabled'
      })
    })
  })

  test.describe('Data Visualization', () => {
    test('should match dashboard charts', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Wait for charts to render
      await expect(page.locator('[data-testid=activity-chart]')).toBeVisible()
      
      // Hide dynamic data points but keep chart structure
      await page.addStyleTag({
        content: `
          [data-testid*="chart"] .recharts-tooltip-wrapper {
            display: none !important;
          }
        `
      })
      
      await expect(page.locator('[data-testid=dashboard-charts]')).toHaveScreenshot('dashboard-charts.png', {
        animations: 'disabled'
      })
    })

    test('should match report visualizations', async ({ page }) => {
      await page.goto('/reports')
      await page.click('[data-testid=inventory-report-button]')
      await page.click('[data-testid=generate-report-button]')
      
      // Wait for report to generate
      await expect(page.locator('[data-testid=report-chart]')).toBeVisible()
      
      await expect(page.locator('[data-testid=report-visualization]')).toHaveScreenshot('report-charts.png', {
        animations: 'disabled'
      })
    })
  })
})