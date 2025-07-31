import { test, expect, Page } from '@playwright/test'

test.describe('Warehouse Management Workflows', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    
    // Login before each test
    await page.goto('/login')
    await page.fill('[data-testid=email-input]', 'test@warehouse.com')
    await page.fill('[data-testid=password-input]', 'testpassword')
    await page.click('[data-testid=login-button]')
    
    // Wait for dashboard to load
    await page.waitForURL('/dashboard')
  })

  test.describe('Product Management Workflow', () => {
    test('should create, update, and delete product', async () => {
      // Navigate to products page
      await page.click('[data-testid=nav-products]')
      await page.waitForURL('/products')
      
      // Create new product
      await page.click('[data-testid=create-product-button]')
      
      const productSku = `E2E-${Date.now()}`
      await page.fill('[data-testid=product-sku-input]', productSku)
      await page.fill('[data-testid=product-name-input]', 'E2E Test Product')
      await page.fill('[data-testid=product-description-input]', 'Product created by E2E test')
      await page.fill('[data-testid=product-weight-input]', '2.5')
      
      await page.click('[data-testid=save-product-button]')
      
      // Verify product was created
      await expect(page.locator(`[data-testid=product-row-${productSku}]`)).toBeVisible()
      await expect(page.locator('text=E2E Test Product')).toBeVisible()
      
      // Update product
      await page.click(`[data-testid=edit-product-${productSku}]`)
      await page.fill('[data-testid=product-name-input]', 'Updated E2E Test Product')
      await page.click('[data-testid=save-product-button]')
      
      // Verify product was updated
      await expect(page.locator('text=Updated E2E Test Product')).toBeVisible()
      
      // Delete product
      await page.click(`[data-testid=delete-product-${productSku}]`)
      await page.click('[data-testid=confirm-delete-button]')
      
      // Verify product was deleted
      await expect(page.locator(`[data-testid=product-row-${productSku}]`)).not.toBeVisible()
    })

    test('should handle product photo upload', async () => {
      // Navigate to products and select existing product
      await page.click('[data-testid=nav-products]')
      await page.waitForURL('/products')
      
      // Click on first product
      await page.click('[data-testid=product-row]:first-child')
      
      // Open photo management
      await page.click('[data-testid=manage-photos-button]')
      
      // Upload photo
      const filePath = 'src/test/fixtures/test-image.jpg'
      await page.setInputFiles('[data-testid=photo-upload-input]', filePath)
      
      // Wait for upload to complete
      await expect(page.locator('[data-testid=photo-upload-success]')).toBeVisible()
      
      // Verify photo appears in gallery
      await expect(page.locator('[data-testid=product-photo]:first-child')).toBeVisible()
      
      // Set as primary photo
      await page.click('[data-testid=set-primary-photo]:first-child')
      await expect(page.locator('[data-testid=primary-photo-badge]')).toBeVisible()
    })
  })

  test.describe('Packaging Management Workflow', () => {
    test('should create packaging hierarchy', async () => {
      // Create test product first
      await page.click('[data-testid=nav-products]')
      await page.click('[data-testid=create-product-button]')
      
      const productSku = `PKG-E2E-${Date.now()}`
      await page.fill('[data-testid=product-sku-input]', productSku)
      await page.fill('[data-testid=product-name-input]', 'Packaging Test Product')
      await page.click('[data-testid=save-product-button]')
      
      // Navigate to packaging for this product
      await page.click(`[data-testid=manage-packaging-${productSku}]`)
      
      // Create base unit
      await page.click('[data-testid=create-packaging-button]')
      await page.fill('[data-testid=packaging-name-input]', 'Unit')
      await page.fill('[data-testid=packaging-quantity-input]', '1')
      await page.check('[data-testid=is-base-unit-checkbox]')
      await page.fill('[data-testid=packaging-barcode-input]', `UNIT-${Date.now()}`)
      await page.click('[data-testid=save-packaging-button]')
      
      // Verify base unit was created
      await expect(page.locator('text=Unit')).toBeVisible()
      await expect(page.locator('[data-testid=base-unit-badge]')).toBeVisible()
      
      // Create box packaging
      await page.click('[data-testid=create-packaging-button]')
      await page.fill('[data-testid=packaging-name-input]', 'Box')
      await page.fill('[data-testid=packaging-quantity-input]', '12')
      await page.fill('[data-testid=packaging-barcode-input]', `BOX-${Date.now()}`)
      await page.click('[data-testid=save-packaging-button]')
      
      // Create case packaging
      await page.click('[data-testid=create-packaging-button]')
      await page.fill('[data-testid=packaging-name-input]', 'Case')
      await page.fill('[data-testid=packaging-quantity-input]', '144')
      await page.fill('[data-testid=packaging-barcode-input]', `CASE-${Date.now()}`)
      await page.click('[data-testid=save-packaging-button]')
      
      // Verify all packaging levels are visible
      await expect(page.locator('text=Unit')).toBeVisible()
      await expect(page.locator('text=Box')).toBeVisible()
      await expect(page.locator('text=Case')).toBeVisible()
      
      // Test conversion calculator
      await page.click('[data-testid=conversion-calculator-button]')
      await page.selectOption('[data-testid=from-packaging-select]', 'Case')
      await page.selectOption('[data-testid=to-packaging-select]', 'Unit')
      await page.fill('[data-testid=quantity-input]', '2')
      await page.click('[data-testid=calculate-button]')
      
      // Verify conversion result
      await expect(page.locator('text=288 Units')).toBeVisible() // 2 cases * 144 units
    })

    test('should scan barcode to find packaging', async () => {
      // Navigate to barcode scanner
      await page.click('[data-testid=nav-scanner]')
      
      // Simulate barcode scan
      await page.fill('[data-testid=barcode-input]', 'BOX-123456789')
      await page.press('[data-testid=barcode-input]', 'Enter')
      
      // Verify packaging details appear
      await expect(page.locator('[data-testid=packaging-details]')).toBeVisible()
      await expect(page.locator('text=Box')).toBeVisible()
      
      // Verify stock information
      await expect(page.locator('[data-testid=stock-info]')).toBeVisible()
    })
  })

  test.describe('Pallet Management Workflow', () => {
    test('should create and configure pallet', async () => {
      // Navigate to pallets page
      await page.click('[data-testid=nav-pallets]')
      await page.waitForURL('/pallets')
      
      // Create new pallet
      await page.click('[data-testid=create-pallet-button]')
      
      const palletCode = `PAL-E2E-${Date.now()}`
      await page.fill('[data-testid=pallet-code-input]', palletCode)
      await page.fill('[data-testid=pallet-max-weight-input]', '1000')
      await page.fill('[data-testid=pallet-max-height-input]', '200')
      await page.selectOption('[data-testid=pallet-location-select]', 'A-01-01')
      
      await page.click('[data-testid=save-pallet-button]')
      
      // Verify pallet was created
      await expect(page.locator(`[data-testid=pallet-${palletCode}]`)).toBeVisible()
      
      // Configure pallet structure
      await page.click(`[data-testid=configure-pallet-${palletCode}]`)
      
      // Set dimensions
      await page.fill('[data-testid=pallet-length-input]', '120')
      await page.fill('[data-testid=pallet-width-input]', '80')
      await page.click('[data-testid=save-dimensions-button]')
      
      // Add products to pallet
      await page.click('[data-testid=add-product-to-pallet-button]')
      await page.fill('[data-testid=product-search-input]', 'Test Product')
      await page.click('[data-testid=product-result]:first-child')
      await page.fill('[data-testid=quantity-input]', '24')
      await page.click('[data-testid=add-to-pallet-button]')
      
      // Verify product was added
      await expect(page.locator('[data-testid=pallet-item]:first-child')).toBeVisible()
      
      // Check pallet utilization
      await expect(page.locator('[data-testid=weight-utilization]')).toContainText('%')
      await expect(page.locator('[data-testid=height-utilization]')).toContainText('%')
    })

    test('should optimize pallet layout', async () => {
      // Navigate to pallets and select existing pallet
      await page.click('[data-testid=nav-pallets]')
      await page.click('[data-testid=pallet-row]:first-child')
      
      // Open layout optimizer
      await page.click('[data-testid=optimize-layout-button]')
      
      // Run optimization
      await page.click('[data-testid=run-optimization-button]')
      
      // Wait for optimization to complete
      await expect(page.locator('[data-testid=optimization-complete]')).toBeVisible()
      
      // Verify optimization results
      await expect(page.locator('[data-testid=optimization-score]')).toBeVisible()
      await expect(page.locator('[data-testid=space-utilization]')).toBeVisible()
      
      // Apply optimization
      await page.click('[data-testid=apply-optimization-button]')
      
      // Verify layout was updated
      await expect(page.locator('[data-testid=layout-updated-message]')).toBeVisible()
    })
  })

  test.describe('Transfer Management Workflow', () => {
    test('should create and execute transfer request', async () => {
      // Navigate to transfers
      await page.click('[data-testid=nav-transfers]')
      await page.waitForURL('/transfers')
      
      // Create new transfer request
      await page.click('[data-testid=create-transfer-button]')
      
      // Fill transfer details
      const transferId = `TR-E2E-${Date.now()}`
      await page.fill('[data-testid=transfer-id-input]', transferId)
      await page.selectOption('[data-testid=from-location-select]', 'A-01-01')
      await page.selectOption('[data-testid=to-location-select]', 'B-02-03')
      await page.selectOption('[data-testid=priority-select]', 'high')
      
      // Add items to transfer
      await page.click('[data-testid=add-transfer-item-button]')
      await page.fill('[data-testid=item-search-input]', 'Test Product')
      await page.click('[data-testid=item-result]:first-child')
      await page.fill('[data-testid=transfer-quantity-input]', '10')
      await page.click('[data-testid=add-item-button]')
      
      // Save transfer request
      await page.click('[data-testid=save-transfer-button]')
      
      // Verify transfer was created
      await expect(page.locator(`[data-testid=transfer-${transferId}]`)).toBeVisible()
      await expect(page.locator('[data-testid=transfer-status]')).toContainText('Pending')
      
      // Execute transfer
      await page.click(`[data-testid=execute-transfer-${transferId}]`)
      
      // Confirm items
      await page.click('[data-testid=confirm-item]:first-child')
      await page.fill('[data-testid=actual-quantity-input]', '10')
      await page.click('[data-testid=confirm-button]')
      
      // Complete transfer
      await page.click('[data-testid=complete-transfer-button]')
      
      // Verify transfer completion
      await expect(page.locator('[data-testid=transfer-status]')).toContainText('Completed')
      await expect(page.locator('[data-testid=completion-timestamp]')).toBeVisible()
    })

    test('should handle transfer discrepancies', async () => {
      // Create transfer with discrepancy
      await page.click('[data-testid=nav-transfers]')
      await page.click('[data-testid=transfer-row]:first-child')
      
      // Execute transfer with different quantities
      await page.click('[data-testid=execute-transfer-button]')
      await page.fill('[data-testid=actual-quantity-input]', '8') // Less than expected 10
      await page.click('[data-testid=confirm-button]')
      
      // Verify discrepancy is flagged
      await expect(page.locator('[data-testid=discrepancy-warning]')).toBeVisible()
      await expect(page.locator('text=Quantity discrepancy detected')).toBeVisible()
      
      // Add discrepancy reason
      await page.fill('[data-testid=discrepancy-reason-input]', 'Damaged items found')
      await page.click('[data-testid=resolve-discrepancy-button]')
      
      // Complete transfer with discrepancy
      await page.click('[data-testid=complete-transfer-button]')
      
      // Verify discrepancy is recorded
      await expect(page.locator('[data-testid=transfer-discrepancy]')).toBeVisible()
    })
  })

  test.describe('Loading Execution Workflow', () => {
    test('should plan and execute loading operation', async () => {
      // Navigate to loading executions
      await page.click('[data-testid=nav-loading]')
      await page.waitForURL('/loading')
      
      // Create new loading plan
      await page.click('[data-testid=create-loading-plan-button]')
      
      const loadingId = `LOAD-E2E-${Date.now()}`
      await page.fill('[data-testid=loading-id-input]', loadingId)
      await page.selectOption('[data-testid=vehicle-select]', 'TRUCK-001')
      await page.fill('[data-testid=driver-input]', 'John Driver')
      await page.fill('[data-testid=destination-input]', 'Distribution Center A')
      
      // Add pallets to loading plan
      await page.click('[data-testid=add-pallet-button]')
      await page.click('[data-testid=pallet-selector]:first-child')
      await page.click('[data-testid=pallet-selector]:nth-child(2)')
      await page.click('[data-testid=add-selected-pallets-button]')
      
      // Optimize loading order
      await page.click('[data-testid=optimize-loading-button]')
      await expect(page.locator('[data-testid=optimization-complete]')).toBeVisible()
      
      // Save loading plan
      await page.click('[data-testid=save-loading-plan-button]')
      
      // Execute loading
      await page.click(`[data-testid=execute-loading-${loadingId}]`)
      
      // Scan pallets during loading
      await page.fill('[data-testid=pallet-scan-input]', 'PAL-001')
      await page.press('[data-testid=pallet-scan-input]', 'Enter')
      await expect(page.locator('[data-testid=pallet-loaded-confirm]')).toBeVisible()
      
      // Complete loading
      await page.click('[data-testid=complete-loading-button]')
      
      // Verify loading completion
      await expect(page.locator('[data-testid=loading-status]')).toContainText('Completed')
      await expect(page.locator('[data-testid=loading-report]')).toBeVisible()
    })

    test('should handle vehicle capacity constraints', async () => {
      // Create loading plan that exceeds capacity
      await page.click('[data-testid=nav-loading]')
      await page.click('[data-testid=create-loading-plan-button]')
      
      await page.selectOption('[data-testid=vehicle-select]', 'VAN-002') // Smaller vehicle
      
      // Add many pallets
      await page.click('[data-testid=add-pallet-button]')
      const pallets = await page.locator('[data-testid=pallet-selector]').count()
      
      for (let i = 0; i < Math.min(pallets, 10); i++) {
        await page.click(`[data-testid=pallet-selector]:nth-child(${i + 1})`)
      }
      
      await page.click('[data-testid=add-selected-pallets-button]')
      
      // Verify capacity warning
      await expect(page.locator('[data-testid=capacity-warning]')).toBeVisible()
      await expect(page.locator('text=Exceeds vehicle capacity')).toBeVisible()
      
      // Auto-optimize for capacity
      await page.click('[data-testid=auto-optimize-capacity-button]')
      
      // Verify optimization removed excess pallets
      await expect(page.locator('[data-testid=capacity-ok]')).toBeVisible()
    })
  })

  test.describe('Reporting and Analytics', () => {
    test('should generate transfer report', async () => {
      // Navigate to reports
      await page.click('[data-testid=nav-reports]')
      await page.waitForURL('/reports')
      
      // Generate transfer report
      await page.click('[data-testid=transfer-report-button]')
      
      // Set date range
      await page.fill('[data-testid=start-date-input]', '2025-01-01')
      await page.fill('[data-testid=end-date-input]', '2025-12-31')
      
      // Select filters
      await page.selectOption('[data-testid=status-filter]', 'completed')
      await page.selectOption('[data-testid=priority-filter]', 'all')
      
      // Generate report
      await page.click('[data-testid=generate-report-button]')
      
      // Wait for report generation
      await expect(page.locator('[data-testid=report-content]')).toBeVisible()
      
      // Verify report components
      await expect(page.locator('[data-testid=summary-stats]')).toBeVisible()
      await expect(page.locator('[data-testid=transfer-list]')).toBeVisible()
      await expect(page.locator('[data-testid=performance-chart]')).toBeVisible()
      
      // Export report
      await page.click('[data-testid=export-pdf-button]')
      
      // Verify download started
      const download = await page.waitForEvent('download')
      expect(download.suggestedFilename()).toContain('transfer-report')
    })

    test('should display real-time dashboard metrics', async () => {
      // Navigate to dashboard
      await page.click('[data-testid=nav-dashboard]')
      await page.waitForURL('/dashboard')
      
      // Verify key metrics are displayed
      await expect(page.locator('[data-testid=total-products]')).toBeVisible()
      await expect(page.locator('[data-testid=active-transfers]')).toBeVisible()
      await expect(page.locator('[data-testid=pending-loadings]')).toBeVisible()
      await expect(page.locator('[data-testid=warehouse-utilization]')).toBeVisible()
      
      // Verify charts are rendered
      await expect(page.locator('[data-testid=activity-chart]')).toBeVisible()
      await expect(page.locator('[data-testid=performance-chart]')).toBeVisible()
      
      // Test real-time updates (mock data change)
      const initialTransferCount = await page.locator('[data-testid=active-transfers]').textContent()
      
      // Trigger data refresh
      await page.click('[data-testid=refresh-dashboard-button]')
      
      // Verify data refreshed (loading state shown)
      await expect(page.locator('[data-testid=dashboard-loading]')).toBeVisible()
      await expect(page.locator('[data-testid=dashboard-loading]')).not.toBeVisible()
    })
  })

  test.describe('Mobile Responsiveness', () => {
    test('should work on mobile viewport', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Navigate to products
      await page.click('[data-testid=mobile-menu-button]')
      await page.click('[data-testid=nav-products]')
      
      // Verify mobile layout
      await expect(page.locator('[data-testid=mobile-product-list]')).toBeVisible()
      
      // Test mobile product creation
      await page.click('[data-testid=mobile-create-button]')
      await expect(page.locator('[data-testid=mobile-product-form]')).toBeVisible()
      
      // Fill form on mobile
      await page.fill('[data-testid=product-sku-input]', 'MOBILE-001')
      await page.fill('[data-testid=product-name-input]', 'Mobile Test Product')
      
      // Save product
      await page.click('[data-testid=mobile-save-button]')
      
      // Verify product appears in mobile list
      await expect(page.locator('text=Mobile Test Product')).toBeVisible()
    })
  })

  test.describe('Error Handling and Recovery', () => {
    test('should handle network errors gracefully', async () => {
      // Simulate network failure
      await page.route('**/api/**', route => route.abort())
      
      // Try to load products page
      await page.click('[data-testid=nav-products]')
      
      // Verify error message is shown
      await expect(page.locator('[data-testid=network-error]')).toBeVisible()
      await expect(page.locator('text=Unable to connect')).toBeVisible()
      
      // Verify retry functionality
      await expect(page.locator('[data-testid=retry-button]')).toBeVisible()
      
      // Restore network and retry
      await page.unroute('**/api/**')
      await page.click('[data-testid=retry-button]')
      
      // Verify data loads after retry
      await expect(page.locator('[data-testid=products-list]')).toBeVisible()
    })

    test('should handle session expiration', async () => {
      // Simulate session expiration
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Session expired' })
        })
      })
      
      // Try to access protected resource
      await page.click('[data-testid=nav-products]')
      
      // Verify redirect to login
      await page.waitForURL('/login')
      await expect(page.locator('[data-testid=session-expired-message]')).toBeVisible()
      
      // Login again
      await page.fill('[data-testid=email-input]', 'test@warehouse.com')
      await page.fill('[data-testid=password-input]', 'testpassword')
      await page.click('[data-testid=login-button]')
      
      // Verify successful re-authentication
      await page.waitForURL('/dashboard')
    })
  })
})