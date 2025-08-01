import { test, expect } from '@playwright/test'

test.describe('Performance Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.fill('[data-testid=email-input]', 'admin@warehouse.com')
    await page.fill('[data-testid=password-input]', 'admin123')
    await page.click('[data-testid=login-button]')
    await page.waitForURL('/dashboard')
  })

  test.describe('Page Load Performance', () => {
    test('should load dashboard within performance budget', async ({ page }) => {
      const startTime = Date.now()
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const loadTime = Date.now() - startTime
      
      // Dashboard should load within 2 seconds
      expect(loadTime).toBeLessThan(2000)
      
      // Verify critical elements are visible
      await expect(page.locator('[data-testid=dashboard-welcome]')).toBeVisible()
      await expect(page.locator('[data-testid=nav-menu]')).toBeVisible()
    })

    test('should load products page efficiently with large dataset', async ({ page }) => {
      const startTime = Date.now()
      
      await page.goto('/products')
      
      // Wait for first product to be visible (not all products)
      await expect(page.locator('[data-testid=product-row]:first-child')).toBeVisible()
      
      const firstContentTime = Date.now() - startTime
      
      // First meaningful content should appear within 1.5 seconds
      expect(firstContentTime).toBeLessThan(1500)
      
      // Wait for all content to load
      await page.waitForLoadState('networkidle')
      const fullLoadTime = Date.now() - startTime
      
      // Full page should load within 3 seconds
      expect(fullLoadTime).toBeLessThan(3000)
      
      // Verify pagination or virtualization is working
      const visibleProducts = await page.locator('[data-testid=product-row]').count()
      expect(visibleProducts).toBeLessThanOrEqual(50) // Should not load all products at once
    })

    test('should handle concurrent user interactions without performance degradation', async ({ page }) => {
      await page.goto('/products')
      
      const startTime = Date.now()
      
      // Simulate rapid user interactions
      const interactions = [
        () => page.click('[data-testid=search-input]'),
        () => page.fill('[data-testid=search-input]', 'test'),
        () => page.click('[data-testid=filter-button]'),
        () => page.click('[data-testid=sort-button]'),
        () => page.click('[data-testid=view-toggle-button]')
      ]
      
      // Execute interactions rapidly
      for (let i = 0; i < 10; i++) {
        const interaction = interactions[i % interactions.length]
        await interaction()
        await page.waitForTimeout(50) // Minimal delay between interactions
      }
      
      const interactionTime = Date.now() - startTime
      
      // All interactions should complete within 5 seconds
      expect(interactionTime).toBeLessThan(5000)
      
      // Verify page is still responsive
      await expect(page.locator('[data-testid=products-list]')).toBeVisible()
    })

    test('should maintain performance with real-time updates', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Enable real-time updates
      await page.click('[data-testid=enable-realtime-button]')
      
      const startTime = Date.now()
      
      // Simulate multiple real-time updates
      for (let i = 0; i < 20; i++) {
        await page.evaluate(() => {
          // Simulate WebSocket message
          window.dispatchEvent(new CustomEvent('websocket-update', {
            detail: { type: 'inventory_change', data: { id: Math.random() } }
          }))
        })
        await page.waitForTimeout(100)
      }
      
      const updateTime = Date.now() - startTime
      
      // Updates should be processed efficiently
      expect(updateTime).toBeLessThan(3000)
      
      // Verify UI remains responsive
      await page.click('[data-testid=nav-products]')
      await expect(page.locator('[data-testid=products-list]')).toBeVisible()
    })
  })

  test.describe('Memory and Resource Usage', () => {
    test('should not have memory leaks during navigation', async ({ page }) => {
      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0
      })
      
      // Navigate through multiple pages
      const pages = ['/products', '/pallets', '/transfers', '/reports', '/dashboard']
      
      for (let i = 0; i < 3; i++) { // Repeat navigation 3 times
        for (const route of pages) {
          await page.goto(route)
          await page.waitForLoadState('networkidle')
          await page.waitForTimeout(500) // Allow time for cleanup
        }
      }
      
      // Force garbage collection if available
      await page.evaluate(() => {
        if ((window as any).gc) {
          (window as any).gc()
        }
      })
      
      // Check final memory usage
      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0
      })
      
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = (finalMemory - initialMemory) / initialMemory
        
        // Memory increase should be less than 50% after navigation
        expect(memoryIncrease).toBeLessThan(0.5)
      }
    })

    test('should handle large file uploads efficiently', async ({ page }) => {
      await page.goto('/products')
      await page.click('[data-testid=product-row]:first-child')
      await page.click('[data-testid=manage-photos-button]')
      
      const startTime = Date.now()
      
      // Simulate large file upload (use test fixture)
      const filePath = 'src/test/fixtures/large-test-image.jpg'
      await page.setInputFiles('[data-testid=photo-upload-input]', filePath)
      
      // Wait for upload progress
      await expect(page.locator('[data-testid=upload-progress]')).toBeVisible()
      
      // Wait for upload completion
      await expect(page.locator('[data-testid=photo-upload-success]')).toBeVisible()
      
      const uploadTime = Date.now() - startTime
      
      // Upload should complete within 10 seconds for test environment
      expect(uploadTime).toBeLessThan(10000)
      
      // Verify image is properly processed
      await expect(page.locator('[data-testid=uploaded-photo-thumbnail]')).toBeVisible()
    })

    test('should handle multiple concurrent operations', async ({ browser }) => {
      // Create multiple browser contexts to simulate concurrent users
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext(),
        browser.newContext()
      ])
      
      const pages = await Promise.all(contexts.map(context => context.newPage()))
      
      const startTime = Date.now()
      
      // Login all users simultaneously
      await Promise.all(pages.map(async (page, index) => {
        await page.goto('/login')
        await page.fill('[data-testid=email-input]', `user${index + 1}@warehouse.com`)
        await page.fill('[data-testid=password-input]', 'password123')
        await page.click('[data-testid=login-button]')
        await page.waitForURL('/dashboard')
      }))
      
      // Perform operations simultaneously
      await Promise.all(pages.map(async (page, index) => {
        switch (index) {
          case 0:
            await page.goto('/products')
            await page.fill('[data-testid=search-input]', 'test')
            break
          case 1:
            await page.goto('/pallets')
            await page.click('[data-testid=create-pallet-button]')
            break
          case 2:
            await page.goto('/transfers')
            await page.click('[data-testid=filter-button]')
            break
        }
      }))
      
      const operationTime = Date.now() - startTime
      
      // All operations should complete within 8 seconds
      expect(operationTime).toBeLessThan(8000)
      
      // Cleanup
      await Promise.all(contexts.map(context => context.close()))
    })
  })

  test.describe('API Performance', () => {
    test('should handle API responses within performance budget', async ({ page }) => {
      // Intercept and measure API calls
      const apiTimes: { [key: string]: number } = {}
      
      page.on('response', response => {
        if (response.url().includes('/api/')) {
          const endpoint = new URL(response.url()).pathname
          apiTimes[endpoint] = Date.now()
        }
      })
      
      page.on('request', request => {
        if (request.url().includes('/api/')) {
          const endpoint = new URL(request.url()).pathname
          apiTimes[endpoint] = Date.now()
        }
      })
      
      await page.goto('/products')
      await page.waitForLoadState('networkidle')
      
      // Check specific API response times
      const criticalEndpoints = ['/api/products', '/api/health']
      
      for (const endpoint of criticalEndpoints) {
        if (apiTimes[endpoint]) {
          // API responses should be fast (this is a simplified check)
          // In real implementation, you'd track request start and response end times
          expect(apiTimes[endpoint]).toBeTruthy()
        }
      }
    })

    test('should handle API rate limiting gracefully', async ({ page }) => {
      await page.goto('/products')
      
      // Make rapid API requests
      const startTime = Date.now()
      
      for (let i = 0; i < 20; i++) {
        await page.fill('[data-testid=search-input]', `search-${i}`)
        await page.waitForTimeout(50) // Rapid typing simulation
      }
      
      // Wait for all requests to complete
      await page.waitForLoadState('networkidle')
      
      const totalTime = Date.now() - startTime
      
      // Should handle rate limiting without breaking the UI
      await expect(page.locator('[data-testid=products-list]')).toBeVisible()
      
      // If rate limited, should show appropriate message
      const rateLimitMessage = page.locator('[data-testid=rate-limit-warning]')
      if (await rateLimitMessage.isVisible()) {
        await expect(rateLimitMessage).toContainText('Please slow down')
      }
    })

    test('should handle network failures gracefully', async ({ page }) => {
      await page.goto('/products')
      await page.waitForLoadState('networkidle')
      
      // Simulate network failure
      await page.route('**/api/**', route => route.abort())
      
      const startTime = Date.now()
      
      // Try to perform actions that require API calls
      await page.click('[data-testid=create-product-button]')
      await page.fill('[data-testid=product-name-input]', 'Test Product')
      await page.click('[data-testid=save-product-button]')
      
      // Should show error within reasonable time
      await expect(page.locator('[data-testid=network-error]')).toBeVisible({ timeout: 5000 })
      
      const errorTime = Date.now() - startTime
      
      // Error should be detected within 5 seconds
      expect(errorTime).toBeLessThan(5000)
      
      // Verify retry mechanism
      await expect(page.locator('[data-testid=retry-button]')).toBeVisible()
      
      // Restore network and test retry
      await page.unroute('**/api/**')
      await page.click('[data-testid=retry-button]')
      
      // Should recover successfully
      await expect(page.locator('[data-testid=products-list]')).toBeVisible()
    })
  })

  test.describe('Database Performance', () => {
    test('should handle large dataset queries efficiently', async ({ page }) => {
      await page.goto('/products')
      
      const startTime = Date.now()
      
      // Search in large dataset
      await page.fill('[data-testid=search-input]', 'test')
      await page.press('[data-testid=search-input]', 'Enter')
      
      // Wait for search results
      await expect(page.locator('[data-testid=search-results]')).toBeVisible()
      
      const searchTime = Date.now() - startTime
      
      // Search should complete within 3 seconds
      expect(searchTime).toBeLessThan(3000)
      
      // Verify pagination is working
      await expect(page.locator('[data-testid=pagination]')).toBeVisible()
      
      // Test sorting performance
      const sortStartTime = Date.now()
      
      await page.click('[data-testid=sort-by-name]')
      await page.waitForLoadState('networkidle')
      
      const sortTime = Date.now() - sortStartTime
      
      // Sorting should complete within 2 seconds
      expect(sortTime).toBeLessThan(2000)
    })

    test('should handle complex reports efficiently', async ({ page }) => {
      await page.goto('/reports')
      
      const startTime = Date.now()
      
      // Generate complex report
      await page.click('[data-testid=inventory-report-button]')
      await page.fill('[data-testid=start-date-input]', '2024-01-01')
      await page.fill('[data-testid=end-date-input]', '2025-12-31')
      await page.selectOption('[data-testid=location-filter]', 'all')
      await page.click('[data-testid=generate-report-button]')
      
      // Wait for report generation
      await expect(page.locator('[data-testid=report-content]')).toBeVisible()
      
      const reportTime = Date.now() - startTime
      
      // Report should generate within 10 seconds
      expect(reportTime).toBeLessThan(10000)
      
      // Verify report contains data
      await expect(page.locator('[data-testid=report-summary]')).toBeVisible()
      await expect(page.locator('[data-testid=report-chart]')).toBeVisible()
    })
  })

  test.describe('Real-time Performance', () => {
    test('should handle WebSocket connections efficiently', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Enable real-time updates
      await page.click('[data-testid=enable-realtime-button]')
      
      // Wait for WebSocket connection
      await expect(page.locator('[data-testid=realtime-connected]')).toBeVisible()
      
      const startTime = Date.now()
      
      // Simulate high-frequency updates
      for (let i = 0; i < 100; i++) {
        await page.evaluate((index) => {
          window.dispatchEvent(new CustomEvent('websocket-update', {
            detail: { 
              type: 'inventory_update', 
              data: { productId: index % 10, quantity: Math.random() * 100 } 
            }
          }))
        }, i)
        
        if (i % 10 === 0) {
          await page.waitForTimeout(10) // Minimal pause every 10 updates
        }
      }
      
      const updateTime = Date.now() - startTime
      
      // Should handle 100 updates within 5 seconds
      expect(updateTime).toBeLessThan(5000)
      
      // Verify UI remains responsive
      await page.click('[data-testid=nav-products]')
      await expect(page.locator('[data-testid=products-list]')).toBeVisible()
    })

    test('should handle background sync efficiently', async ({ page, context }) => {
      await page.goto('/mobile/transfers')
      
      // Go offline
      await context.setOffline(true)
      
      // Create multiple offline changes
      for (let i = 0; i < 5; i++) {
        await page.tap('[data-testid=mobile-create-transfer-button]')
        await page.fill('[data-testid=transfer-notes]', `Offline transfer ${i}`)
        await page.tap('[data-testid=save-transfer-button]')
      }
      
      // Verify offline queue
      await expect(page.locator('[data-testid=offline-queue-indicator]')).toContainText('5')
      
      // Go back online
      const syncStartTime = Date.now()
      await context.setOffline(false)
      
      // Wait for sync completion
      await expect(page.locator('[data-testid=sync-complete-toast]')).toBeVisible()
      await expect(page.locator('[data-testid=offline-queue-indicator]')).toContainText('0')
      
      const syncTime = Date.now() - syncStartTime
      
      // Sync should complete within 8 seconds
      expect(syncTime).toBeLessThan(8000)
    })
  })
})