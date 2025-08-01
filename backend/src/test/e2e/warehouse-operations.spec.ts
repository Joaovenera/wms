import { test, expect } from '@playwright/test'

test.describe('Warehouse Operations E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Use admin authentication state
    await page.goto('/login')
    await page.fill('[data-testid=email-input]', 'admin@warehouse.com')
    await page.fill('[data-testid=password-input]', 'admin123')
    await page.click('[data-testid=login-button]')
    await page.waitForURL('/dashboard')
  })

  test.describe('Product Management Operations', () => {
    test('should complete product lifecycle from creation to deletion', async ({ page }) => {
      await page.click('[data-testid=nav-products]')
      await page.waitForURL('/products')
      
      // Create product
      await page.click('[data-testid=create-product-button]')
      
      const productSku = `E2E-LIFECYCLE-${Date.now()}`
      await page.fill('[data-testid=product-sku-input]', productSku)
      await page.fill('[data-testid=product-name-input]', 'Lifecycle Test Product')
      await page.fill('[data-testid=product-description-input]', 'Full lifecycle test')
      await page.fill('[data-testid=product-weight-input]', '5.5')
      await page.fill('[data-testid=product-length-input]', '20')
      await page.fill('[data-testid=product-width-input]', '15')
      await page.fill('[data-testid=product-height-input]', '10')
      
      await page.click('[data-testid=save-product-button]')
      
      // Verify product creation
      await expect(page.locator(`[data-testid=product-row-${productSku}]`)).toBeVisible()
      
      // Upload product photos
      await page.click(`[data-testid=product-row-${productSku}]`)
      await page.click('[data-testid=manage-photos-button]')
      
      const filePath = 'src/test/fixtures/test-image.jpg'
      await page.setInputFiles('[data-testid=photo-upload-input]', filePath)
      await expect(page.locator('[data-testid=photo-upload-success]')).toBeVisible()
      
      // Set primary photo
      await page.click('[data-testid=set-primary-photo]:first-child')
      await expect(page.locator('[data-testid=primary-photo-badge]')).toBeVisible()
      
      // Create packaging hierarchy
      await page.click('[data-testid=manage-packaging-button]')
      
      // Base unit
      await page.click('[data-testid=create-packaging-button]')
      await page.fill('[data-testid=packaging-name-input]', 'Unit')
      await page.fill('[data-testid=packaging-quantity-input]', '1')
      await page.check('[data-testid=is-base-unit-checkbox]')
      await page.fill('[data-testid=packaging-barcode-input]', `UNIT-${Date.now()}`)
      await page.click('[data-testid=save-packaging-button]')
      
      // Box packaging
      await page.click '[data-testid=create-packaging-button]')
      await page.fill('[data-testid=packaging-name-input]', 'Box')
      await page.fill('[data-testid=packaging-quantity-input]', '12')
      await page.fill('[data-testid=packaging-barcode-input]', `BOX-${Date.now()}`)
      await page.click('[data-testid=save-packaging-button]')
      
      // Verify packaging created
      await expect(page.locator('text=Unit')).toBeVisible()
      await expect(page.locator('text=Box')).toBeVisible()
      
      // Update product
      await page.click('[data-testid=edit-product-button]')
      await page.fill('[data-testid=product-description-input]', 'Updated lifecycle test')
      await page.click('[data-testid=save-product-button]')
      
      // Verify update
      await expect(page.locator('text=Updated lifecycle test')).toBeVisible()
      
      // Delete product
      await page.click(`[data-testid=delete-product-${productSku}]`)
      await page.click('[data-testid=confirm-delete-button]')
      
      // Verify deletion
      await expect(page.locator(`[data-testid=product-row-${productSku}]`)).not.toBeVisible()
    })

    test('should handle bulk product operations', async ({ page }) => {
      await page.click('[data-testid=nav-products]')
      await page.waitForURL('/products')
      
      // Create multiple products
      const productSkus = []
      for (let i = 1; i <= 3; i++) {
        await page.click('[data-testid=create-product-button]')
        
        const sku = `BULK-${Date.now()}-${i}`
        productSkus.push(sku)
        
        await page.fill('[data-testid=product-sku-input]', sku)
        await page.fill('[data-testid=product-name-input]', `Bulk Product ${i}`)
        await page.fill('[data-testid=product-weight-input]', '2.0')
        await page.click('[data-testid=save-product-button]')
        
        await expect(page.locator(`[data-testid=product-row-${sku}]`)).toBeVisible()
      }
      
      // Select all created products
      for (const sku of productSkus) {
        await page.check(`[data-testid=product-checkbox-${sku}]`)
      }
      
      // Bulk update
      await page.click('[data-testid=bulk-actions-button]')
      await page.click('[data-testid=bulk-update-button]')
      await page.fill('[data-testid=bulk-weight-input]', '3.0')
      await page.click('[data-testid=save-bulk-update-button]')
      
      // Verify bulk update
      for (const sku of productSkus) {
        await expect(page.locator(`[data-testid=product-weight-${sku}]`)).toContainText('3.0')
      }
      
      // Bulk delete
      await page.click('[data-testid=bulk-actions-button]')
      await page.click('[data-testid=bulk-delete-button]')
      await page.click('[data-testid=confirm-bulk-delete-button]')
      
      // Verify bulk deletion
      for (const sku of productSkus) {
        await expect(page.locator(`[data-testid=product-row-${sku}]`)).not.toBeVisible()
      }
    })
  })

  test.describe('Inventory Management Operations', () => {
    test('should manage stock levels and movements', async ({ page }) => {
      // Navigate to inventory
      await page.click('[data-testid=nav-inventory]')
      await page.waitForURL('/inventory')
      
      // Select first product
      await page.click('[data-testid=inventory-item]:first-child')
      
      // Add stock
      await page.click('[data-testid=add-stock-button]')
      await page.fill('[data-testid=quantity-input]', '100')
      await page.selectOption('[data-testid=location-select]', 'A-01-01')
      await page.fill('[data-testid=reason-input]', 'Stock replenishment')
      await page.click('[data-testid=confirm-add-stock-button]')
      
      // Verify stock addition
      await expect(page.locator('[data-testid=stock-added-success]')).toBeVisible()
      await expect(page.locator('[data-testid=current-stock]')).toContainText('100')
      
      // Remove stock
      await page.click('[data-testid=remove-stock-button]')
      await page.fill('[data-testid=quantity-input]', '25')
      await page.fill('[data-testid=reason-input]', 'Damaged goods')
      await page.click('[data-testid=confirm-remove-stock-button]')
      
      // Verify stock removal
      await expect(page.locator('[data-testid=stock-removed-success]')).toBeVisible()
      await expect(page.locator('[data-testid=current-stock]')).toContainText('75')
      
      // View stock movement history
      await page.click('[data-testid=view-movements-button]')
      await expect(page.locator('[data-testid=movement-history]')).toBeVisible()
      await expect(page.locator('text=Stock replenishment')).toBeVisible()
      await expect(page.locator('text=Damaged goods')).toBeVisible()
    })

    test('should handle stock transfers between locations', async ({ page }) => {
      await page.click('[data-testid=nav-transfers]')
      await page.waitForURL('/transfers')
      
      // Create stock transfer
      await page.click('[data-testid=create-transfer-button]')
      
      const transferId = `ST-${Date.now()}`
      await page.fill('[data-testid=transfer-id-input]', transferId)
      await page.selectOption('[data-testid=from-location-select]', 'A-01-01')
      await page.selectOption('[data-testid=to-location-select]', 'B-02-03')
      await page.selectOption('[data-testid=priority-select]', 'medium')
      
      // Add items to transfer
      await page.click('[data-testid=add-transfer-item-button]')
      await page.fill('[data-testid=item-search-input]', 'TEST-PROD-001')
      await page.click('[data-testid=item-result]:first-child')
      await page.fill('[data-testid=transfer-quantity-input]', '20')
      await page.click('[data-testid=add-item-button]')
      
      // Save transfer
      await page.click('[data-testid=save-transfer-button]')
      
      // Verify transfer created
      await expect(page.locator(`[data-testid=transfer-${transferId}]`)).toBeVisible()
      await expect(page.locator('[data-testid=transfer-status]')).toContainText('Pending')
      
      // Execute transfer
      await page.click(`[data-testid=execute-transfer-${transferId}]`)
      
      // Scan and confirm items
      await page.fill('[data-testid=barcode-scan-input]', 'TEST-PROD-001')
      await page.press('[data-testid=barcode-scan-input]', 'Enter')
      
      await page.fill('[data-testid=actual-quantity-input]', '20')
      await page.click('[data-testid=confirm-item-button]')
      
      // Complete transfer
      await page.click('[data-testid=complete-transfer-button]')
      
      // Verify completion
      await expect(page.locator('[data-testid=transfer-status]')).toContainText('Completed')
      await expect(page.locator('[data-testid=completion-timestamp]')).toBeVisible()
    })

    test('should handle stock discrepancies', async ({ page }) => {
      await page.click('[data-testid=nav-transfers]')
      await page.click('[data-testid=transfer-row]:first-child')
      
      // Execute transfer with discrepancy
      await page.click('[data-testid=execute-transfer-button]')
      
      // Simulate scanning less quantity than expected
      await page.fill('[data-testid=actual-quantity-input]', '15') // Expected was 20
      await page.click('[data-testid=confirm-item-button]')
      
      // Verify discrepancy detection
      await expect(page.locator('[data-testid=discrepancy-warning]')).toBeVisible()
      await expect(page.locator('text=Quantity discrepancy detected')).toBeVisible()
      
      // Add discrepancy reason
      await page.selectOption('[data-testid=discrepancy-reason-select]', 'damaged')
      await page.fill('[data-testid=discrepancy-notes-input]', '5 units found damaged during transfer')
      await page.click('[data-testid=resolve-discrepancy-button]')
      
      // Complete transfer with discrepancy
      await page.click('[data-testid=complete-transfer-button]')
      
      // Verify discrepancy recorded
      await expect(page.locator('[data-testid=transfer-discrepancy]')).toBeVisible()
      await expect(page.locator('[data-testid=discrepancy-report]')).toContainText('5 units variance')
    })
  })

  test.describe('Pallet Management Operations', () => {
    test('should create and configure pallet structure', async ({ page }) => {
      await page.click('[data-testid=nav-pallets]')
      await page.waitForURL('/pallets')
      
      // Create new pallet
      await page.click('[data-testid=create-pallet-button]')
      
      const palletCode = `PAL-E2E-${Date.now()}`
      await page.fill('[data-testid=pallet-code-input]', palletCode)
      await page.fill('[data-testid=pallet-max-weight-input]', '1200')
      await page.fill('[data-testid=pallet-max-height-input]', '180')
      await page.selectOption('[data-testid=pallet-location-select]', 'A-01-01')
      await page.fill('[data-testid=pallet-description-input]', 'E2E test pallet')
      
      await page.click('[data-testid=save-pallet-button]')
      
      // Verify pallet creation
      await expect(page.locator(`[data-testid=pallet-${palletCode}]`)).toBeVisible()
      
      // Configure pallet structure
      await page.click(`[data-testid=configure-pallet-${palletCode}]`)
      
      // Set dimensions
      await page.fill('[data-testid=pallet-length-input]', '120')
      await page.fill('[data-testid=pallet-width-input]', '80')
      await page.click('[data-testid=save-dimensions-button]')
      
      // Add products to pallet
      await page.click('[data-testid=add-product-to-pallet-button]')
      await page.fill('[data-testid=product-search-input]', 'TEST-PROD-001')
      await page.click('[data-testid=product-result]:first-child')
      await page.fill('[data-testid=quantity-input]', '24')
      await page.selectOption('[data-testid=packaging-select]', 'Box')
      await page.click('[data-testid=add-to-pallet-button]')
      
      // Verify product added
      await expect(page.locator('[data-testid=pallet-item]:first-child')).toBeVisible()
      await expect(page.locator('[data-testid=pallet-item]:first-child')).toContainText('TEST-PROD-001')
      
      // Check utilization
      await expect(page.locator('[data-testid=weight-utilization]')).toBeTruthy()
      await expect(page.locator('[data-testid=height-utilization]')).toBeTruthy()
      
      // Test pallet optimization
      await page.click('[data-testid=optimize-layout-button]')
      await page.click('[data-testid=run-optimization-button]')
      
      await expect(page.locator('[data-testid=optimization-complete]')).toBeVisible()
      await expect(page.locator('[data-testid=optimization-score]')).toBeVisible()
      
      // Apply optimization
      await page.click('[data-testid=apply-optimization-button]')
      await expect(page.locator('[data-testid=layout-updated-message]')).toBeVisible()
    })

    test('should handle pallet capacity constraints', async ({ page }) => {
      await page.click('[data-testid=nav-pallets]')
      await page.click('[data-testid=pallet-row]:first-child')
      
      // Try to add product that exceeds capacity
      await page.click('[data-testid=add-product-to-pallet-button]')
      await page.fill('[data-testid=product-search-input]', 'Heavy Test Product')
      await page.click('[data-testid=product-result]:first-child')
      await page.fill('[data-testid=quantity-input]', '100') // Should exceed weight capacity
      await page.click('[data-testid=add-to-pallet-button]')
      
      // Verify capacity warning
      await expect(page.locator('[data-testid=capacity-warning]')).toBeVisible()
      await expect(page.locator('text=Exceeds pallet capacity')).toBeVisible()
      
      // Verify suggestion for optimal quantity
      await expect(page.locator('[data-testid=suggested-quantity]')).toBeVisible()
      
      // Apply suggested quantity
      await page.click('[data-testid=apply-suggested-quantity-button]')
      await page.click('[data-testid=add-to-pallet-button]')
      
      // Verify successful addition with optimal quantity
      await expect(page.locator('[data-testid=item-added-success]')).toBeVisible()
    })
  })

  test.describe('Loading Operations', () => {
    test('should plan and execute loading operation', async ({ page }) => {
      await page.click('[data-testid=nav-loading]')
      await page.waitForURL('/loading')
      
      // Create loading plan
      await page.click('[data-testid=create-loading-plan-button]')
      
      const loadingId = `LOAD-E2E-${Date.now()}`
      await page.fill('[data-testid=loading-id-input]', loadingId)
      await page.selectOption('[data-testid=vehicle-select]', 'TRUCK-001')
      await page.fill('[data-testid=driver-input]', 'John Driver')
      await page.fill('[data-testid=destination-input]', 'Distribution Center A')
      await page.fill('[data-testid=planned-date-input]', '2025-02-01')
      
      // Add pallets to loading plan
      await page.click('[data-testid=add-pallet-button]')
      
      // Select pallets
      const palletCount = await page.locator('[data-testid=pallet-selector]').count()
      const palletsToSelect = Math.min(palletCount, 3)
      
      for (let i = 0; i < palletsToSelect; i++) {
        await page.click(`[data-testid=pallet-selector]:nth-child(${i + 1})`)
      }
      
      await page.click('[data-testid=add-selected-pallets-button]')
      
      // Verify pallets added
      await expect(page.locator('[data-testid=selected-pallets-count]')).toContainText(palletsToSelect.toString())
      
      // Optimize loading order
      await page.click('[data-testid=optimize-loading-button]')
      await expect(page.locator('[data-testid=optimization-complete]')).toBeVisible()
      
      // Save loading plan
      await page.click('[data-testid=save-loading-plan-button]')
      
      // Verify plan saved
      await expect(page.locator(`[data-testid=loading-plan-${loadingId}]`)).toBeVisible()
      
      // Execute loading
      await page.click(`[data-testid=execute-loading-${loadingId}]`)
      
      // Start loading process
      await page.click('[data-testid=start-loading-button]')
      
      // Scan pallets during loading
      const firstPalletCode = await page.locator('[data-testid=loading-pallet]:first-child').getAttribute('data-pallet-code')
      await page.fill('[data-testid=pallet-scan-input]', firstPalletCode || '')
      await page.press('[data-testid=pallet-scan-input]', 'Enter')
      
      await expect(page.locator('[data-testid=pallet-loaded-confirm]')).toBeVisible()
      
      // Complete loading
      await page.click('[data-testid=complete-loading-button]')
      
      // Verify completion
      await expect(page.locator('[data-testid=loading-status]')).toContainText('Completed')
      await expect(page.locator('[data-testid=loading-report]')).toBeVisible()
      
      // Generate loading report
      await page.click('[data-testid=generate-report-button]')
      await expect(page.locator('[data-testid=loading-report-content]')).toBeVisible()
    })

    test('should handle vehicle capacity optimization', async ({ page }) => {
      await page.click('[data-testid=nav-loading]')
      await page.click('[data-testid=create-loading-plan-button]')
      
      // Select smaller vehicle
      await page.selectOption('[data-testid=vehicle-select]', 'VAN-002')
      
      // Add many pallets
      await page.click('[data-testid=add-pallet-button]')
      const palletCount = await page.locator('[data-testid=pallet-selector]').count()
      
      // Select all available pallets
      for (let i = 0; i < palletCount; i++) {
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
      await expect(page.locator('[data-testid=optimized-pallet-count]')).toBeVisible()
      
      // Verify optimization suggestions
      await expect(page.locator('[data-testid=optimization-suggestions]')).toBeVisible()
    })
  })

  test.describe('Reporting and Analytics', () => {
    test('should generate comprehensive reports', async ({ page }) => {
      await page.click('[data-testid=nav-reports]')
      await page.waitForURL('/reports')
      
      // Generate inventory report
      await page.click('[data-testid=inventory-report-button]')
      await page.fill('[data-testid=start-date-input]', '2025-01-01')
      await page.fill('[data-testid=end-date-input]', '2025-12-31')
      await page.selectOption('[data-testid=location-filter]', 'all')
      await page.click('[data-testid=generate-report-button]')
      
      await expect(page.locator('[data-testid=report-content]')).toBeVisible()
      await expect(page.locator('[data-testid=inventory-summary]')).toBeVisible()
      
      // Export report
      await page.click('[data-testid=export-excel-button]')
      const download1 = await page.waitForEvent('download')
      expect(download1.suggestedFilename()).toContain('inventory-report')
      
      // Generate transfer performance report
      await page.click('[data-testid=transfer-report-button]')
      await page.selectOption('[data-testid=status-filter]', 'completed')
      await page.selectOption('[data-testid=priority-filter]', 'all')
      await page.click('[data-testid=generate-report-button]')
      
      await expect(page.locator('[data-testid=transfer-metrics]')).toBeVisible()
      await expect(page.locator('[data-testid=performance-chart]')).toBeVisible()
      
      // Generate loading efficiency report
      await page.click('[data-testid=loading-report-button]')
      await page.selectOption('[data-testid=vehicle-filter]', 'all')
      await page.click('[data-testid=generate-report-button]')
      
      await expect(page.locator('[data-testid=loading-efficiency]')).toBeVisible()
      await expect(page.locator('[data-testid=capacity-utilization]')).toBeVisible()
    })

    test('should display real-time dashboard analytics', async ({ page }) => {
      await page.click('[data-testid=nav-dashboard]')
      await page.waitForURL('/dashboard')
      
      // Verify key performance indicators
      await expect(page.locator('[data-testid=total-products]')).toBeVisible()
      await expect(page.locator('[data-testid=active-transfers]')).toBeVisible()
      await expect(page.locator('[data-testid=pending-loadings]')).toBeVisible()
      await expect(page.locator('[data-testid=warehouse-utilization]')).toBeVisible()
      
      // Verify charts are rendered
      await expect(page.locator('[data-testid=activity-chart]')).toBeVisible()
      await expect(page.locator('[data-testid=performance-chart]')).toBeVisible()
      await expect(page.locator('[data-testid=inventory-trend-chart]')).toBeVisible()
      
      // Test real-time updates
      const initialValue = await page.locator('[data-testid=active-transfers]').textContent()
      
      // Trigger data refresh
      await page.click('[data-testid=refresh-dashboard-button]')
      await expect(page.locator('[data-testid=dashboard-loading]')).toBeVisible()
      await expect(page.locator('[data-testid=dashboard-loading]')).not.toBeVisible()
      
      // Verify data refreshed
      await expect(page.locator('[data-testid=last-updated-timestamp]')).toBeVisible()
    })
  })
})