import { test, expect, devices } from '@playwright/test'

// Mobile-specific E2E tests
test.describe('Mobile Warehouse Operations', () => {
  test.use({ ...devices['iPhone 12'] })

  test.beforeEach(async ({ page }) => {
    // Login on mobile
    await page.goto('/login')
    await page.fill('[data-testid=email-input]', 'mobile@warehouse.com')
    await page.fill('[data-testid=password-input]', 'mobilepass')
    await page.tap('[data-testid=login-button]')
    
    await page.waitForURL('/mobile')
  })

  test.describe('Mobile Navigation', () => {
    test('should navigate through mobile interface', async ({ page }) => {
      // Test mobile dashboard
      await expect(page.locator('[data-testid=mobile-dashboard]')).toBeVisible()
      
      // Test hamburger menu
      await page.tap('[data-testid=mobile-menu-button]')
      await expect(page.locator('[data-testid=mobile-nav-menu]')).toBeVisible()
      
      // Navigate to mobile pallets
      await page.tap('[data-testid=mobile-nav-pallets]')
      await page.waitForURL('/mobile/pallets')
      await expect(page.locator('[data-testid=mobile-pallets-view]')).toBeVisible()
    })

    test('should handle swipe gestures', async ({ page }) => {
      await page.goto('/mobile/pallets')
      
      // Swipe to reveal actions
      const firstPallet = page.locator('[data-testid=mobile-pallet-item]').first()
      await firstPallet.swipe({ direction: 'left' })
      
      // Verify action buttons appear
      await expect(page.locator('[data-testid=pallet-action-edit]')).toBeVisible()
      await expect(page.locator('[data-testid=pallet-action-delete]')).toBeVisible()
    })
  })

  test.describe('Barcode Scanning', () => {
    test('should open camera for barcode scanning', async ({ page, context }) => {
      // Grant camera permissions
      await context.grantPermissions(['camera'])
      
      await page.goto('/mobile/scanner')
      
      // Test barcode scanner activation
      await page.tap('[data-testid=start-camera-button]')
      
      // Verify camera interface
      await expect(page.locator('[data-testid=camera-view]')).toBeVisible()
      await expect(page.locator('[data-testid=scan-overlay]')).toBeVisible()
      
      // Test manual barcode entry
      await page.tap('[data-testid=manual-entry-button]')
      await page.fill('[data-testid=barcode-input]', '123456789012')
      await page.tap('[data-testid=submit-barcode-button]')
      
      // Verify barcode processing
      await expect(page.locator('[data-testid=barcode-result]')).toBeVisible()
    })

    test('should handle barcode scan results', async ({ page }) => {
      await page.goto('/mobile/scanner')
      
      // Simulate successful barcode scan
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('barcode-scanned', {
          detail: { code: 'PAL-123456', type: 'pallet' }
        }))
      })
      
      // Verify scan result processing
      await expect(page.locator('[data-testid=scan-success]')).toBeVisible()
      await expect(page.locator('text=PAL-123456')).toBeVisible()
      
      // Test quick actions
      await expect(page.locator('[data-testid=quick-action-view]')).toBeVisible()
      await expect(page.locator('[data-testid=quick-action-transfer]')).toBeVisible()
    })
  })

  test.describe('Mobile Pallet Management', () => {
    test('should create pallet on mobile', async ({ page }) => {
      await page.goto('/mobile/pallets')
      
      // Open create pallet form
      await page.tap('[data-testid=mobile-create-pallet-button]')
      
      // Fill mobile form
      const palletCode = `MOB-${Date.now()}`
      await page.fill('[data-testid=pallet-code-input]', palletCode)
      await page.fill('[data-testid=max-weight-input]', '1000')
      await page.fill('[data-testid=max-height-input]', '200')
      
      // Select location using mobile picker
      await page.tap('[data-testid=location-picker-button]')
      await page.tap('[data-testid=location-option-A-01-01]')
      
      // Save pallet
      await page.tap('[data-testid=save-pallet-button]')
      
      // Verify creation success
      await expect(page.locator('[data-testid=creation-success]')).toBeVisible()
      await expect(page.locator(`text=${palletCode}`)).toBeVisible()
    })

    test('should edit pallet using mobile form', async ({ page }) => {
      await page.goto('/mobile/pallets')
      
      // Select first pallet
      const firstPallet = page.locator('[data-testid=mobile-pallet-item]').first()
      await firstPallet.tap()
      
      // Open edit mode
      await page.tap('[data-testid=edit-pallet-button]')
      
      // Edit details
      await page.fill('[data-testid=max-weight-input]', '1200')
      await page.fill('[data-testid=description-input]', 'Updated via mobile')
      
      // Save changes
      await page.tap('[data-testid=save-changes-button]')
      
      // Verify update
      await expect(page.locator('[data-testid=update-success]')).toBeVisible()
      await expect(page.locator('text=1200')).toBeVisible()
    })
  })

  test.describe('Mobile Product Search', () => {
    test('should search products on mobile', async ({ page }) => {
      await page.goto('/mobile/products')
      
      // Use mobile search
      await page.tap('[data-testid=mobile-search-button]')
      await page.fill('[data-testid=search-input]', 'test product')
      
      // Verify search results
      await expect(page.locator('[data-testid=mobile-search-results]')).toBeVisible()
      
      // Test result selection
      await page.tap('[data-testid=search-result-item]')
      
      // Verify product details view
      await expect(page.locator('[data-testid=mobile-product-details]')).toBeVisible()
    })

    test('should handle voice search', async ({ page, context }) => {
      // Grant microphone permissions
      await context.grantPermissions(['microphone'])
      
      await page.goto('/mobile/products')
      
      // Activate voice search
      await page.tap('[data-testid=voice-search-button]')
      
      // Verify voice interface
      await expect(page.locator('[data-testid=voice-listening-indicator]')).toBeVisible()
      
      // Simulate voice input
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('voice-input', {
          detail: { transcript: 'search for test product' }
        }))
      })
      
      // Verify voice search processing
      await expect(page.locator('[data-testid=voice-processing]')).toBeVisible()
    })
  })

  test.describe('Mobile Transfer Operations', () => {
    test('should create transfer request on mobile', async ({ page }) => {
      await page.goto('/mobile/transfers')
      
      // Create new transfer
      await page.tap('[data-testid=mobile-create-transfer-button]')
      
      // Fill transfer details using mobile components
      await page.tap('[data-testid=from-location-selector]')
      await page.tap('[data-testid=location-A-01-01]')
      
      await page.tap('[data-testid=to-location-selector]')
      await page.tap('[data-testid=location-B-02-03]')
      
      await page.tap('[data-testid=priority-selector]')
      await page.tap('[data-testid=priority-high]')
      
      // Add items using mobile interface
      await page.tap('[data-testid=add-items-button]')
      await page.tap('[data-testid=scan-item-button]')
      
      // Simulate item scan
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('item-scanned', {
          detail: { sku: 'ITEM-001', name: 'Test Item' }
        }))
      })
      
      await page.fill('[data-testid=quantity-input]', '5')
      await page.tap('[data-testid=add-item-confirm]')
      
      // Save transfer
      await page.tap('[data-testid=save-transfer-button]')
      
      // Verify creation
      await expect(page.locator('[data-testid=transfer-created]')).toBeVisible()
    })

    test('should execute transfer on mobile', async ({ page }) => {
      await page.goto('/mobile/transfers')
      
      // Select pending transfer
      await page.tap('[data-testid=pending-transfer]:first-child')
      
      // Start execution
      await page.tap('[data-testid=start-execution-button]')
      
      // Scan items during execution
      await page.tap('[data-testid=scan-next-item-button]')
      
      // Simulate item confirmation
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('item-confirmed', {
          detail: { scanned: true, quantity: 5 }
        }))
      })
      
      // Complete transfer
      await page.tap('[data-testid=complete-transfer-button]')
      
      // Verify completion
      await expect(page.locator('[data-testid=transfer-completed]')).toBeVisible()
    })
  })

  test.describe('Mobile Photo Capture', () => {
    test('should capture product photos on mobile', async ({ page, context }) => {
      // Grant camera permissions
      await context.grantPermissions(['camera'])
      
      await page.goto('/mobile/products')
      await page.tap('[data-testid=mobile-product-item]')
      
      // Open photo capture
      await page.tap('[data-testid=add-photo-button]')
      
      // Activate camera
      await page.tap('[data-testid=camera-capture-button]')
      
      // Verify camera interface
      await expect(page.locator('[data-testid=camera-preview]')).toBeVisible()
      await expect(page.locator('[data-testid=capture-button]')).toBeVisible()
      
      // Simulate photo capture
      await page.tap('[data-testid=capture-button]')
      
      // Verify photo preview
      await expect(page.locator('[data-testid=photo-preview]')).toBeVisible()
      
      // Confirm photo
      await page.tap('[data-testid=confirm-photo-button]')
      
      // Verify upload
      await expect(page.locator('[data-testid=photo-uploaded]')).toBeVisible()
    })
  })

  test.describe('Mobile Offline Support', () => {
    test('should handle offline mode', async ({ page, context }) => {
      // Go online first
      await page.goto('/mobile/pallets')
      await expect(page.locator('[data-testid=mobile-pallets-view]')).toBeVisible()
      
      // Go offline
      await context.setOffline(true)
      
      // Verify offline indicator
      await expect(page.locator('[data-testid=offline-indicator]')).toBeVisible()
      
      // Test offline functionality
      await page.tap('[data-testid=mobile-create-pallet-button]')
      
      const palletCode = `OFFLINE-${Date.now()}`
      await page.fill('[data-testid=pallet-code-input]', palletCode)
      await page.tap('[data-testid=save-pallet-button]')
      
      // Verify offline save
      await expect(page.locator('[data-testid=saved-offline]')).toBeVisible()
      
      // Go back online
      await context.setOffline(false)
      
      // Verify sync indicator
      await expect(page.locator('[data-testid=syncing-indicator]')).toBeVisible()
      await expect(page.locator('[data-testid=sync-complete]')).toBeVisible()
    })

    test('should sync offline changes when back online', async ({ page, context }) => {
      // Create offline data
      await context.setOffline(true)
      await page.goto('/mobile/transfers')
      
      // Create transfer offline
      await page.tap('[data-testid=mobile-create-transfer-button]')
      await page.fill('[data-testid=transfer-notes]', 'Created offline')
      await page.tap('[data-testid=save-transfer-button]')
      
      // Verify offline storage
      await expect(page.locator('[data-testid=offline-queue-count]')).toContainText('1')
      
      // Go back online
      await context.setOffline(false)
      await page.reload()
      
      // Wait for sync
      await expect(page.locator('[data-testid=sync-complete]')).toBeVisible()
      
      // Verify data was synced
      await expect(page.locator('text=Created offline')).toBeVisible()
      await expect(page.locator('[data-testid=offline-queue-count]')).toContainText('0')
    })
  })

  test.describe('Mobile Performance', () => {
    test('should load quickly on mobile', async ({ page }) => {
      const startTime = Date.now()
      
      await page.goto('/mobile')
      await page.waitForLoadState('networkidle')
      
      const loadTime = Date.now() - startTime
      
      // Should load within 3 seconds on mobile
      expect(loadTime).toBeLessThan(3000)
      
      // Verify essential mobile elements are visible
      await expect(page.locator('[data-testid=mobile-dashboard]')).toBeVisible()
      await expect(page.locator('[data-testid=mobile-nav-menu]')).toBeVisible()
    })

    test('should handle touch interactions smoothly', async ({ page }) => {
      await page.goto('/mobile/products')
      
      // Test list scrolling performance
      const productList = page.locator('[data-testid=mobile-product-list]')
      
      // Scroll down
      await productList.evaluate(element => {
        element.scrollTop = element.scrollHeight
      })
      
      // Verify smooth scrolling (no layout shifts)
      await expect(page.locator('[data-testid=mobile-product-item]')).toHaveCount({ min: 1 })
      
      // Test pull-to-refresh
      await page.touchscreen.tap(200, 100)
      await page.touchscreen.tap(200, 300)
      
      // Verify refresh indicator
      await expect(page.locator('[data-testid=pull-refresh-indicator]')).toBeVisible()
    })
  })

  test.describe('Mobile Accessibility', () => {
    test('should support screen reader navigation', async ({ page }) => {
      await page.goto('/mobile')
      
      // Verify ARIA labels and roles
      await expect(page.locator('[data-testid=mobile-nav-button]')).toHaveAttribute('aria-label', 'Open navigation menu')
      await expect(page.locator('[data-testid=mobile-search-button]')).toHaveAttribute('aria-label', 'Search products')
      
      // Test keyboard navigation
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')
      
      // Verify focus management
      await expect(page.locator('[data-testid=mobile-nav-menu]')).toBeVisible()
    })

    test('should support high contrast mode', async ({ page }) => {
      // Enable high contrast
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.addStyleTag({ content: '@media (prefers-contrast: high) { * { filter: contrast(150%); } }' })
      
      await page.goto('/mobile')
      
      // Verify high contrast elements are visible
      await expect(page.locator('[data-testid=mobile-dashboard]')).toBeVisible()
      
      // Check color contrast ratios (would need additional tooling in real implementation)
      const backgroundColor = await page.locator('body').evaluate(el => 
        getComputedStyle(el).backgroundColor
      )
      
      expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)') // Should have background color
    })
  })
})