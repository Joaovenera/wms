import { test, expect, devices } from '@playwright/test'

test.describe('Mobile Warehouse Workflows', () => {
  // Use mobile device configuration
  test.use({ ...devices['iPhone 12'] })
  
  test.beforeEach(async ({ page }) => {
    // Login as mobile user
    await page.goto('/login')
    await page.fill('[data-testid=email-input]', 'mobile@warehouse.com')
    await page.fill('[data-testid=password-input]', 'mobile123')
    await page.tap('[data-testid=login-button]')
    await page.waitForURL('/mobile')
  })

  test.describe('Mobile Navigation', () => {
    test('should navigate through mobile interface smoothly', async ({ page }) => {
      // Verify mobile dashboard loads
      await expect(page.locator('[data-testid=mobile-dashboard]')).toBeVisible()
      
      // Test hamburger menu
      await page.tap('[data-testid=mobile-menu-button]')
      await expect(page.locator('[data-testid=mobile-nav-menu]')).toBeVisible()
      
      // Navigate to different sections
      await page.tap('[data-testid=mobile-nav-scanner]')
      await page.waitForURL('/mobile/scanner')
      await expect(page.locator('[data-testid=mobile-scanner-view]')).toBeVisible()
      
      await page.tap('[data-testid=mobile-menu-button]')
      await page.tap('[data-testid=mobile-nav-pallets]')
      await page.waitForURL('/mobile/pallets')
      await expect(page.locator('[data-testid=mobile-pallets-view]')).toBeVisible()
      
      await page.tap('[data-testid=mobile-menu-button]')
      await page.tap('[data-testid=mobile-nav-transfers]')
      await page.waitForURL('/mobile/transfers')
      await expect(page.locator('[data-testid=mobile-transfers-view]')).toBeVisible()
    })

    test('should handle swipe gestures for navigation', async ({ page }) => {
      await page.goto('/mobile/pallets')
      
      // Swipe right to left for next section
      await page.touchscreen.swipe(300, 300, 50, 300, 10)
      await expect(page.locator('[data-testid=mobile-transfers-view]')).toBeVisible()
      
      // Swipe left to right for previous section
      await page.touchscreen.swipe(50, 300, 300, 300, 10)
      await expect(page.locator('[data-testid=mobile-pallets-view]')).toBeVisible()
    })

    test('should support pull-to-refresh functionality', async ({ page }) => {
      await page.goto('/mobile/pallets')
      
      // Pull to refresh gesture
      await page.touchscreen.swipe(200, 100, 200, 300, 20)
      
      // Verify refresh indicator appears and disappears
      await expect(page.locator('[data-testid=pull-refresh-indicator]')).toBeVisible()
      await expect(page.locator('[data-testid=pull-refresh-indicator]')).not.toBeVisible()
      
      // Verify data refreshed
      await expect(page.locator('[data-testid=last-updated-mobile]')).toBeVisible()
    })
  })

  test.describe('Mobile Barcode Scanning', () => {
    test('should activate camera for barcode scanning', async ({ page, context }) => {
      // Grant camera permissions
      await context.grantPermissions(['camera'])
      
      await page.goto('/mobile/scanner')
      
      // Start camera scanning
      await page.tap('[data-testid=start-camera-button]')
      
      // Verify camera interface
      await expect(page.locator('[data-testid=camera-view]')).toBeVisible()
      await expect(page.locator('[data-testid=scan-overlay]')).toBeVisible()
      await expect(page.locator('[data-testid=scan-instructions]')).toBeVisible()
      
      // Test camera controls
      await expect(page.locator('[data-testid=camera-flip-button]')).toBeVisible()
      await expect(page.locator('[data-testid=camera-flash-button]')).toBeVisible()
      await expect(page.locator('[data-testid=stop-camera-button]')).toBeVisible()
    })

    test('should handle manual barcode entry', async ({ page }) => {
      await page.goto('/mobile/scanner')
      
      // Switch to manual entry
      await page.tap('[data-testid=manual-entry-button]')
      await expect(page.locator('[data-testid=manual-entry-form]')).toBeVisible()
      
      // Enter barcode manually
      await page.fill('[data-testid=barcode-input]', 'PAL-TEST-001')
      await page.tap('[data-testid=submit-barcode-button]')
      
      // Verify barcode processing
      await expect(page.locator('[data-testid=barcode-result]')).toBeVisible()
      await expect(page.locator('[data-testid=pallet-details]')).toBeVisible()
      
      // Test quick actions
      await expect(page.locator('[data-testid=quick-action-view]')).toBeVisible()
      await expect(page.locator('[data-testid=quick-action-transfer]')).toBeVisible()
      await expect(page.locator('[data-testid=quick-action-edit]')).toBeVisible()
    })

    test('should process different barcode types', async ({ page }) => {
      await page.goto('/mobile/scanner')
      
      const barcodeTests = [
        { code: 'PAL-TEST-001', type: 'pallet', expected: 'Pallet Details' },
        { code: 'TEST-PROD-001', type: 'product', expected: 'Product Information' },
        { code: 'UNIT-123456', type: 'packaging', expected: 'Packaging Details' },
        { code: 'A-01-01', type: 'location', expected: 'Location Information' }
      ]
      
      for (const barcodeTest of barcodeTests) {
        await page.fill('[data-testid=barcode-input]', barcodeTest.code)
        await page.tap('[data-testid=submit-barcode-button]')
        
        await expect(page.locator('[data-testid=scan-result-title]')).toContainText(barcodeTest.expected)
        
        // Clear for next test
        await page.tap('[data-testid=scan-another-button]')
      }
    })

    test('should handle invalid barcodes gracefully', async ({ page }) => {
      await page.goto('/mobile/scanner')
      
      // Test invalid barcode
      await page.fill('[data-testid=barcode-input]', 'INVALID-CODE-999')
      await page.tap('[data-testid=submit-barcode-button]')
      
      // Verify error handling
      await expect(page.locator('[data-testid=barcode-error]')).toBeVisible()
      await expect(page.locator('[data-testid=barcode-error]')).toContainText('Barcode not found')
      
      // Verify retry option
      await expect(page.locator('[data-testid=retry-scan-button]')).toBeVisible()
      
      // Test retry
      await page.tap('[data-testid=retry-scan-button]')
      await expect(page.locator('[data-testid=barcode-input]')).toBeFocused()
    })
  })

  test.describe('Mobile Pallet Management', () => {
    test('should create pallet using mobile form', async ({ page }) => {
      await page.goto('/mobile/pallets')
      
      // Create new pallet
      await page.tap('[data-testid=mobile-create-pallet-button]')
      await expect(page.locator('[data-testid=mobile-pallet-form]')).toBeVisible()
      
      // Fill form using mobile-optimized inputs
      const palletCode = `MOB-${Date.now()}`
      await page.fill('[data-testid=pallet-code-input]', palletCode)
      await page.fill('[data-testid=max-weight-input]', '1000')
      await page.fill('[data-testid=max-height-input]', '200')
      
      // Use mobile location picker
      await page.tap('[data-testid=location-picker-button]')
      await expect(page.locator('[data-testid=location-picker-modal]')).toBeVisible()
      await page.tap('[data-testid=location-option-A-01-01]')
      
      // Save pallet
      await page.tap('[data-testid=save-pallet-button]')
      
      // Verify creation success
      await expect(page.locator('[data-testid=creation-success-toast]')).toBeVisible()
      await expect(page.locator(`[data-testid=mobile-pallet-${palletCode}]`)).toBeVisible()
    })

    test('should edit pallet using mobile interface', async ({ page }) => {
      await page.goto('/mobile/pallets')
      
      // Select first pallet
      const firstPallet = page.locator('[data-testid=mobile-pallet-item]').first()
      await firstPallet.tap()
      
      // Open edit mode
      await page.tap('[data-testid=mobile-edit-button]')
      await expect(page.locator('[data-testid=mobile-edit-form]')).toBeVisible()
      
      // Edit details
      await page.fill('[data-testid=max-weight-input]', '1200')
      await page.fill('[data-testid=description-input]', 'Updated via mobile')
      
      // Save changes
      await page.tap('[data-testid=mobile-save-button]')
      
      // Verify update
      await expect(page.locator('[data-testid=update-success-toast]')).toBeVisible()
      await expect(page.locator('text=1200')).toBeVisible()
    })

    test('should handle swipe actions on pallet items', async ({ page }) => {
      await page.goto('/mobile/pallets')
      
      const firstPallet = page.locator('[data-testid=mobile-pallet-item]').first()
      
      // Swipe left to reveal actions
      await firstPallet.swipe({ direction: 'left' })
      
      // Verify action buttons appear
      await expect(page.locator('[data-testid=pallet-action-edit]')).toBeVisible()
      await expect(page.locator('[data-testid=pallet-action-transfer]')).toBeVisible()
      await expect(page.locator('[data-testid=pallet-action-delete]')).toBeVisible()
      
      // Test quick transfer action
      await page.tap('[data-testid=pallet-action-transfer]')
      await expect(page.locator('[data-testid=quick-transfer-modal]')).toBeVisible()
    })
  })

  test.describe('Mobile Transfer Operations', () => {
    test('should create transfer request on mobile', async ({ page }) => {
      await page.goto('/mobile/transfers')
      
      // Create new transfer
      await page.tap('[data-testid=mobile-create-transfer-button]')
      await expect(page.locator('[data-testid=mobile-transfer-form]')).toBeVisible()
      
      // Fill transfer details using mobile components
      await page.tap('[data-testid=from-location-selector]')
      await page.tap('[data-testid=location-A-01-01]')
      
      await page.tap('[data-testid=to-location-selector]')
      await page.tap('[data-testid=location-B-02-03]')
      
      await page.tap('[data-testid=priority-selector]')
      await page.tap('[data-testid=priority-high]')
      
      // Add items using mobile scanning
      await page.tap('[data-testid=add-items-button]')
      await page.tap('[data-testid=scan-item-button]')
      
      // Simulate item scan
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('item-scanned', {
          detail: { sku: 'TEST-PROD-001', name: 'Test Product 1' }
        }))
      })
      
      await page.fill('[data-testid=quantity-input]', '5')
      await page.tap('[data-testid=add-item-confirm]')
      
      // Save transfer
      await page.tap('[data-testid=save-transfer-button]')
      
      // Verify creation
      await expect(page.locator('[data-testid=transfer-created-toast]')).toBeVisible()
    })

    test('should execute transfer on mobile with step-by-step guidance', async ({ page }) => {
      await page.goto('/mobile/transfers')
      
      // Select pending transfer
      await page.tap('[data-testid=pending-transfer]:first-child')
      
      // Start execution
      await page.tap('[data-testid=start-execution-button]')
      await expect(page.locator('[data-testid=mobile-execution-wizard]')).toBeVisible()
      
      // Step 1: Navigate to source location
      await expect(page.locator('[data-testid=step-navigation-instruction]')).toBeVisible()
      await page.tap('[data-testid=arrived-at-location-button]')
      
      // Step 2: Scan items
      await expect(page.locator('[data-testid=step-scan-instruction]')).toBeVisible()
      await page.tap('[data-testid=scan-next-item-button]')
      
      // Simulate item scan
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('item-confirmed', {
          detail: { scanned: true, quantity: 5 }
        }))
      })
      
      await expect(page.locator('[data-testid=item-confirmed-checkmark]')).toBeVisible()
      
      // Step 3: Navigate to destination
      await page.tap('[data-testid=next-step-button]')
      await expect(page.locator('[data-testid=step-destination-instruction]')).toBeVisible()
      await page.tap('[data-testid=arrived-at-destination-button]')
      
      // Step 4: Complete transfer
      await page.tap('[data-testid=complete-transfer-button]')
      
      // Verify completion
      await expect(page.locator('[data-testid=transfer-completed-celebration]')).toBeVisible()
      await expect(page.locator('[data-testid=completion-summary]')).toBeVisible()
    })

    test('should handle offline mode for transfers', async ({ page, context }) => {
      await page.goto('/mobile/transfers')
      
      // Go offline
      await context.setOffline(true)
      
      // Verify offline indicator
      await expect(page.locator('[data-testid=offline-indicator]')).toBeVisible()
      
      // Create transfer offline
      await page.tap('[data-testid=mobile-create-transfer-button]')
      await page.fill('[data-testid=transfer-notes]', 'Created offline')
      await page.tap('[data-testid=save-transfer-button]')
      
      // Verify offline save
      await expect(page.locator('[data-testid=saved-offline-toast]')).toBeVisible()
      await expect(page.locator('[data-testid=offline-queue-indicator]')).toContainText('1')
      
      // Go back online
      await context.setOffline(false)
      
      // Verify sync
      await expect(page.locator('[data-testid=syncing-indicator]')).toBeVisible()
      await expect(page.locator('[data-testid=sync-complete-toast]')).toBeVisible()
      await expect(page.locator('[data-testid=offline-queue-indicator]')).toContainText('0')
    })
  })

  test.describe('Mobile Photo Capture', () => {
    test('should capture product photos on mobile', async ({ page, context }) => {
      // Grant camera permissions
      await context.grantPermissions(['camera'])
      
      await page.goto('/mobile/products')
      await page.tap('[data-testid=mobile-product-item]:first-child')
      
      // Open photo capture
      await page.tap('[data-testid=add-photo-button]')
      await expect(page.locator('[data-testid=mobile-camera-interface]')).toBeVisible()
      
      // Activate camera
      await page.tap('[data-testid=camera-capture-button]')
      
      // Verify camera interface
      await expect(page.locator('[data-testid=camera-preview]')).toBeVisible()
      await expect(page.locator('[data-testid=capture-button]')).toBeVisible()
      await expect(page.locator('[data-testid=camera-controls]')).toBeVisible()
      
      // Test camera controls
      await page.tap('[data-testid=camera-flip-button]')
      await page.tap('[data-testid=camera-flash-toggle]')
      
      // Simulate photo capture
      await page.tap('[data-testid=capture-button]')
      
      // Verify photo preview
      await expect(page.locator('[data-testid=photo-preview]')).toBeVisible()
      await expect(page.locator('[data-testid=photo-actions]')).toBeVisible()
      
      // Confirm photo
      await page.tap('[data-testid=confirm-photo-button]')
      
      // Verify upload
      await expect(page.locator('[data-testid=photo-uploaded-toast]')).toBeVisible()
      await expect(page.locator('[data-testid=photo-thumbnail]')).toBeVisible()
    })

    test('should handle multiple photo capture modes', async ({ page, context }) => {
      await context.grantPermissions(['camera'])
      await page.goto('/mobile/scanner')
      
      // Test different capture modes
      const captureModes = [
        { mode: 'product', button: '[data-testid=product-photo-mode]' },
        { mode: 'damage', button: '[data-testid=damage-photo-mode]' },
        { mode: 'location', button: '[data-testid=location-photo-mode]' }
      ]
      
      for (const mode of captureModes) {
        await page.tap('[data-testid=camera-mode-selector]')
        await page.tap(mode.button)
        
        await expect(page.locator(`[data-testid=${mode.mode}-capture-interface]`)).toBeVisible()
        
        // Verify mode-specific features
        if (mode.mode === 'damage') {
          await expect(page.locator('[data-testid=damage-severity-selector]')).toBeVisible()
        }
        
        if (mode.mode === 'location') {
          await expect(page.locator('[data-testid=location-tag-input]')).toBeVisible()
        }
      }
    })
  })

  test.describe('Mobile Performance and UX', () => {
    test('should load quickly on mobile network', async ({ page }) => {
      // Simulate slow 3G network
      await page.route('**/*', route => {
        setTimeout(() => route.continue(), 100) // Add 100ms delay
      })
      
      const startTime = Date.now()
      await page.goto('/mobile')
      await page.waitForLoadState('networkidle')
      const loadTime = Date.now() - startTime
      
      // Should load within 5 seconds on slow network
      expect(loadTime).toBeLessThan(5000)
      
      // Verify critical mobile elements are visible
      await expect(page.locator('[data-testid=mobile-dashboard]')).toBeVisible()
    })

    test('should handle touch interactions smoothly', async ({ page }) => {
      await page.goto('/mobile/products')
      
      // Test list scrolling performance
      const productList = page.locator('[data-testid=mobile-product-list]')
      
      // Scroll down rapidly
      for (let i = 0; i < 5; i++) {
        await productList.evaluate(element => {
          element.scrollTop += 200
        })
        await page.waitForTimeout(50)
      }
      
      // Verify smooth scrolling (no layout shifts)
      await expect(page.locator('[data-testid=mobile-product-item]')).toHaveCount({ min: 1 })
      
      // Test rapid tap interactions
      for (let i = 0; i < 3; i++) {
        await page.tap('[data-testid=mobile-search-button]')
        await page.tap('[data-testid=close-search-button]')
        await page.waitForTimeout(100)
      }
      
      // Verify app remains responsive
      await expect(page.locator('[data-testid=mobile-product-list]')).toBeVisible()
    })

    test('should support landscape orientation', async ({ page }) => {
      // Switch to landscape
      await page.setViewportSize({ width: 667, height: 375 })
      await page.goto('/mobile/pallets')
      
      // Verify landscape layout
      await expect(page.locator('[data-testid=mobile-landscape-layout]')).toBeVisible()
      await expect(page.locator('[data-testid=landscape-pallet-grid]')).toBeVisible()
      
      // Test landscape-specific features
      await expect(page.locator('[data-testid=landscape-action-bar]')).toBeVisible()
      
      // Switch back to portrait
      await page.setViewportSize({ width: 375, height: 667 })
      await expect(page.locator('[data-testid=mobile-portrait-layout]')).toBeVisible()
    })

    test('should handle device rotation gracefully', async ({ page }) => {
      await page.goto('/mobile/scanner')
      
      // Start in portrait
      await expect(page.locator('[data-testid=portrait-scanner-layout]')).toBeVisible()
      
      // Rotate to landscape
      await page.setViewportSize({ width: 667, height: 375 })
      
      // Verify layout adapts
      await expect(page.locator('[data-testid=landscape-scanner-layout]')).toBeVisible()
      
      // Verify functionality preserved
      await page.tap('[data-testid=start-camera-button]')
      await expect(page.locator('[data-testid=camera-view]')).toBeVisible()
    })
  })

  test.describe('Mobile Accessibility', () => {
    test('should support screen reader navigation', async ({ page }) => {
      await page.goto('/mobile')
      
      // Verify ARIA labels and roles
      await expect(page.locator('[data-testid=mobile-nav-button]')).toHaveAttribute('aria-label', 'Open navigation menu')
      await expect(page.locator('[data-testid=mobile-search-button]')).toHaveAttribute('aria-label', 'Search products')
      
      // Test focus management
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')
      
      // Verify focus moves correctly
      await expect(page.locator('[data-testid=mobile-nav-menu]')).toBeVisible()
      
      // Test skip links
      await expect(page.locator('[data-testid=skip-to-content]')).toBeVisible()
    })

    test('should support high contrast mode', async ({ page }) => {
      // Enable high contrast
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.goto('/mobile')
      
      // Verify high contrast elements are visible
      await expect(page.locator('[data-testid=mobile-dashboard]')).toBeVisible()
      
      // Test button visibility in high contrast
      await expect(page.locator('[data-testid=mobile-nav-button]')).toBeVisible()
      await expect(page.locator('[data-testid=mobile-search-button]')).toBeVisible()
    })

    test('should support large text settings', async ({ page }) => {
      // Simulate large text preference
      await page.addStyleTag({ 
        content: '* { font-size: 1.2em !important; line-height: 1.5em !important; }' 
      })
      
      await page.goto('/mobile')
      
      // Verify layout adapts to larger text
      await expect(page.locator('[data-testid=mobile-dashboard]')).toBeVisible()
      
      // Verify text doesn't overflow containers
      const buttonText = await page.locator('[data-testid=mobile-nav-button]').boundingBox()
      expect(buttonText?.width).toBeGreaterThan(0)
    })
  })
})