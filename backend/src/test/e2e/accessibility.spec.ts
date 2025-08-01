import { test, expect } from '@playwright/test'
import { injectAxe, checkA11y } from 'axe-playwright'

test.describe('Accessibility Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.fill('[data-testid=email-input]', 'admin@warehouse.com')
    await page.fill('[data-testid=password-input]', 'admin123')
    await page.click('[data-testid=login-button]')
    await page.waitForURL('/dashboard')
    
    // Inject axe-core for accessibility testing
    await injectAxe(page)
  })

  test.describe('WCAG 2.1 Level AA Compliance', () => {
    test('should meet accessibility standards on dashboard', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      // Run axe accessibility tests
      await checkA11y(page, null, {
        detailedReport: true,
        detailedReportOptions: { html: true }
      })
    })

    test('should meet accessibility standards on products page', async ({ page }) => {
      await page.goto('/products')
      await page.waitForLoadState('networkidle')
      
      await checkA11y(page, null, {
        rules: {
          'color-contrast': { enabled: true },
          'keyboard-navigation': { enabled: true },
          'focus-management': { enabled: true }
        }
      })
    })

    test('should meet accessibility standards on forms', async ({ page }) => {
      await page.goto('/products')
      await page.click('[data-testid=create-product-button]')
      
      await checkA11y(page, '[data-testid=product-form]', {
        rules: {
          'label-content-name-mismatch': { enabled: true },
          'form-field-multiple-labels': { enabled: true },
          'input-button-name': { enabled: true }
        }
      })
    })

    test('should meet accessibility standards on mobile interface', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/mobile')
      await page.waitForLoadState('networkidle')
      
      await checkA11y(page, null, {
        rules: {
          'target-size': { enabled: true }, // Touch targets should be large enough
          'color-contrast': { enabled: true }
        }
      })
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('should support full keyboard navigation on dashboard', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Start from first focusable element
      await page.keyboard.press('Tab')
      
      // Navigate through main menu
      let focusedElement = await page.locator(':focus').getAttribute('data-testid')
      expect(focusedElement).toBeTruthy()
      
      // Test navigation to each main section
      const mainSections = ['nav-products', 'nav-pallets', 'nav-transfers', 'nav-reports']
      
      for (const section of mainSections) {
        await page.keyboard.press('Tab')
        focusedElement = await page.locator(':focus').getAttribute('data-testid')
        
        if (focusedElement === section) {
          // Enter the section
          await page.keyboard.press('Enter')
          await page.waitForLoadState('networkidle')
          
          // Verify we navigated
          expect(page.url()).toContain(section.replace('nav-', ''))
          
          // Go back to dashboard
          await page.goto('/dashboard')
          break
        }
      }
    })

    test('should support keyboard navigation in data tables', async ({ page }) => {
      await page.goto('/products')
      
      // Focus on first product row
      await page.keyboard.press('Tab')
      
      let currentRow = 0
      const maxRows = 5
      
      // Navigate through rows with arrow keys
      for (let i = 0; i < maxRows; i++) {
        await page.keyboard.press('ArrowDown')
        currentRow++
        
        // Verify focus moved to next row
        const focusedRow = await page.locator(':focus').closest('[data-testid^="product-row"]')
        await expect(focusedRow).toBeVisible()
      }
      
      // Navigate back up
      for (let i = 0; i < 2; i++) {
        await page.keyboard.press('ArrowUp')
        currentRow--
      }
      
      // Enter to select/open row
      await page.keyboard.press('Enter')
      
      // Verify action occurred (detail view or edit form opened)
      const detailView = page.locator('[data-testid=product-detail-view], [data-testid=product-edit-form]')
      await expect(detailView).toBeVisible()
    })

    test('should support keyboard navigation in forms', async ({ page }) => {
      await page.goto('/products')
      await page.click('[data-testid=create-product-button]')
      
      // Tab through form fields
      const formFields = [
        'product-sku-input',
        'product-name-input',
        'product-description-input',
        'product-weight-input',
        'save-product-button'
      ]
      
      for (const field of formFields) {
        await page.keyboard.press('Tab')
        
        const focusedElement = await page.locator(':focus')
        const testId = await focusedElement.getAttribute('data-testid')
        
        if (testId === field) {
          // If it's an input field, type something
          if (field.includes('input')) {
            await page.keyboard.type('test value')
          }
          
          // If it's the save button, we found it
          if (field === 'save-product-button') {
            await expect(focusedElement).toBeFocused()
            break
          }
        }
      }
    })

    test('should support keyboard shortcuts', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Test global shortcuts
      await page.keyboard.press('Alt+1') // Go to products
      await expect(page).toHaveURL(/\/products/)
      
      await page.keyboard.press('Alt+2') // Go to pallets
      await expect(page).toHaveURL(/\/pallets/)
      
      await page.keyboard.press('Alt+3') // Go to transfers
      await expect(page).toHaveURL(/\/transfers/)
      
      // Test search shortcut
      await page.keyboard.press('Control+k') // Or Cmd+k on Mac
      await expect(page.locator('[data-testid=search-modal]')).toBeVisible()
      
      // Close with Escape
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-testid=search-modal]')).not.toBeVisible()
    })
  })

  test.describe('Screen Reader Support', () => {
    test('should have proper ARIA labels and roles', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Check main navigation has proper ARIA attributes
      await expect(page.locator('[data-testid=main-nav]')).toHaveAttribute('role', 'navigation')
      await expect(page.locator('[data-testid=main-nav]')).toHaveAttribute('aria-label', 'Main navigation')
      
      // Check buttons have labels
      const navButtons = page.locator('[data-testid^="nav-"]')
      const buttonCount = await navButtons.count()
      
      for (let i = 0; i < buttonCount; i++) {
        const button = navButtons.nth(i)
        const ariaLabel = await button.getAttribute('aria-label')
        const textContent = await button.textContent()
        
        // Button should have either aria-label or text content
        expect(ariaLabel || textContent).toBeTruthy()
      }
      
      // Check headings are properly structured
      const headings = page.locator('h1, h2, h3, h4, h5, h6')
      const headingCount = await headings.count()
      
      expect(headingCount).toBeGreaterThan(0)
      
      // Verify main heading exists
      await expect(page.locator('h1')).toBeVisible()
    })

    test('should provide proper form labels and descriptions', async ({ page }) => {
      await page.goto('/products')
      await page.click('[data-testid=create-product-button]')
      
      // Check form has proper structure
      await expect(page.locator('[data-testid=product-form]')).toHaveAttribute('role', 'form')
      
      // Check all inputs have labels
      const inputs = page.locator('input[data-testid*="input"]')
      const inputCount = await inputs.count()
      
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i)
        const inputId = await input.getAttribute('id')
        const ariaLabel = await input.getAttribute('aria-label')
        const ariaLabelledBy = await input.getAttribute('aria-labelledby')
        
        // Input should be associated with a label
        if (inputId) {
          const associatedLabel = page.locator(`label[for="${inputId}"]`)
          const labelExists = await associatedLabel.count() > 0
          
          expect(labelExists || ariaLabel || ariaLabelledBy).toBeTruthy()
        }
      }
      
      // Check error messages are properly associated
      await page.click('[data-testid=save-product-button]') // Trigger validation
      
      const errorMessages = page.locator('[data-testid*="error"]')
      const errorCount = await errorMessages.count()
      
      if (errorCount > 0) {
        const firstError = errorMessages.first()
        const errorId = await firstError.getAttribute('id')
        expect(errorId).toBeTruthy()
        
        // Find associated input
        const associatedInput = page.locator(`[aria-describedby*="${errorId}"]`)
        await expect(associatedInput).toBeVisible()
      }
    })

    test('should provide proper live region updates', async ({ page }) => {
      await page.goto('/products')
      
      // Check for live regions
      await expect(page.locator('[aria-live]')).toHaveCount({ min: 1 })
      
      // Test status updates
      await page.click('[data-testid=create-product-button]')
      await page.fill('[data-testid=product-sku-input]', 'TEST-A11Y')
      await page.fill('[data-testid=product-name-input]', 'Accessibility Test')
      await page.click('[data-testid=save-product-button]')
      
      // Success message should be announced
      const successMessage = page.locator('[data-testid=success-message]')
      await expect(successMessage).toHaveAttribute('aria-live', 'polite')
      await expect(successMessage).toBeVisible()
    })

    test('should support screen reader navigation landmarks', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Check for proper landmark structure
      await expect(page.locator('[role="banner"], header')).toBeVisible() // Header
      await expect(page.locator('[role="main"], main')).toBeVisible()     // Main content
      await expect(page.locator('[role="navigation"], nav')).toBeVisible() // Navigation
      
      // Footer might not always be present
      const footer = page.locator('[role="contentinfo"], footer')
      const footerCount = await footer.count()
      if (footerCount > 0) {
        await expect(footer).toBeVisible()
      }
      
      // Check sidebar if present
      const sidebar = page.locator('[role="complementary"], aside')
      const sidebarCount = await sidebar.count()
      if (sidebarCount > 0) {
        await expect(sidebar).toBeVisible()
      }
    })
  })

  test.describe('Visual Accessibility', () => {
    test('should meet color contrast requirements', async ({ page }) => {
      await page.goto('/dashboard')
      
      // This would typically be handled by axe-core, but we can do basic checks
      const buttons = page.locator('button[data-testid]')
      const buttonCount = await buttons.count()
      
      for (let i = 0; i < Math.min(buttonCount, 5); i++) { // Check first 5 buttons
        const button = buttons.nth(i)
        await expect(button).toBeVisible()
        
        // Verify button is not just using color to convey information
        const textContent = await button.textContent()
        expect(textContent?.trim()).toBeTruthy()
      }
    })

    test('should support high contrast mode', async ({ page }) => {
      // Enable high contrast mode
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.addInitScript(() => {
        // Simulate Windows high contrast mode
        document.documentElement.classList.add('high-contrast')
      })
      
      await page.goto('/dashboard')
      
      // Verify critical elements are still visible
      await expect(page.locator('[data-testid=dashboard-welcome]')).toBeVisible()
      await expect(page.locator('[data-testid=main-nav]')).toBeVisible()
      
      // Test form elements in high contrast
      await page.goto('/products')
      await page.click('[data-testid=create-product-button]')
      
      await expect(page.locator('[data-testid=product-form]')).toBeVisible()
      await expect(page.locator('[data-testid=product-sku-input]')).toBeVisible()
    })

    test('should support reduced motion preferences', async ({ page }) => {
      // Disable animations
      await page.emulateMedia({ reducedMotion: 'reduce' })
      
      await page.goto('/dashboard')
      
      // Test navigation without animations
      await page.click('[data-testid=nav-products]')
      await page.waitForURL('/products')
      
      // Verify page loads without motion effects
      await expect(page.locator('[data-testid=products-list]')).toBeVisible()
      
      // Test modal opening without animations
      await page.click('[data-testid=create-product-button]')
      await expect(page.locator('[data-testid=product-form]')).toBeVisible()
    })

    test('should support zoom up to 200%', async ({ page }) => {
      await page.goto('/dashboard')
      
      // Set zoom to 200%
      await page.evaluate(() => {
        document.body.style.zoom = '2'
      })
      
      // Wait for layout to adjust
      await page.waitForTimeout(500)
      
      // Verify critical elements are still accessible
      await expect(page.locator('[data-testid=dashboard-welcome]')).toBeVisible()
      await expect(page.locator('[data-testid=main-nav]')).toBeVisible()
      
      // Test form interaction at 200% zoom
      await page.click('[data-testid=nav-products]')
      await page.click('[data-testid=create-product-button]')
      
      await expect(page.locator('[data-testid=product-form]')).toBeVisible()
      
      // Verify form fields are accessible
      await page.fill('[data-testid=product-sku-input]', 'ZOOM-TEST')
      await page.fill('[data-testid=product-name-input]', 'Zoom Test Product')
      
      // Button should still be clickable
      await expect(page.locator('[data-testid=save-product-button]')).toBeVisible()
    })
  })

  test.describe('Mobile Accessibility', () => {
    test('should meet accessibility standards on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/mobile')
      
      await injectAxe(page)
      await checkA11y(page, null, {
        rules: {
          'target-size': { enabled: true }, // Ensure touch targets are large enough
          'color-contrast': { enabled: true }
        }
      })
    })

    test('should support touch accessibility features', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/mobile/pallets')
      
      // Test touch target sizes
      const touchTargets = page.locator('[data-testid*="button"], [data-testid*="tap"]')
      const targetCount = await touchTargets.count()
      
      for (let i = 0; i < Math.min(targetCount, 5); i++) {
        const target = touchTargets.nth(i)
        const boundingBox = await target.boundingBox()
        
        if (boundingBox) {
          // Touch targets should be at least 44x44 pixels
          expect(boundingBox.width).toBeGreaterThanOrEqual(44)
          expect(boundingBox.height).toBeGreaterThanOrEqual(44)
        }
      }
    })

    test('should support voice control features', async ({ page, context }) => {
      await context.grantPermissions(['microphone'])
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/mobile/scanner')
      
      // Test voice activation button
      await expect(page.locator('[data-testid=voice-activation-button]')).toHaveAttribute('aria-label')
      
      // Test voice commands interface
      await page.tap('[data-testid=voice-activation-button]')
      
      const voiceInterface = page.locator('[data-testid=voice-interface]')
      if (await voiceInterface.count() > 0) {
        await expect(voiceInterface).toHaveAttribute('role', 'region')
        await expect(voiceInterface).toHaveAttribute('aria-live', 'polite')
      }
    })
  })

  test.describe('Error Handling Accessibility', () => {
    test('should provide accessible error messages', async ({ page }) => {
      await page.goto('/products')
      await page.click('[data-testid=create-product-button]')
      
      // Submit form without required fields
      await page.click('[data-testid=save-product-button]')
      
      // Error messages should be properly announced
      const errorMessages = page.locator('[data-testid*="error"]')
      const errorCount = await errorMessages.count()
      
      if (errorCount > 0) {
        const firstError = errorMessages.first()
        
        // Error should have proper attributes
        await expect(firstError).toHaveAttribute('role', 'alert')
        await expect(firstError).toHaveAttribute('aria-live', 'assertive')
        
        // Error should be associated with input
        const errorId = await firstError.getAttribute('id')
        if (errorId) {
          const associatedInput = page.locator(`[aria-describedby*="${errorId}"]`)
          await expect(associatedInput).toBeVisible()
        }
      }
    })

    test('should handle network errors accessibly', async ({ page }) => {
      await page.goto('/products')
      
      // Simulate network error
      await page.route('**/api/**', route => route.abort())
      
      await page.click('[data-testid=create-product-button]')
      await page.fill('[data-testid=product-sku-input]', 'TEST')
      await page.click('[data-testid=save-product-button]')
      
      // Network error should be announced
      await expect(page.locator('[data-testid=network-error]')).toBeVisible()
      await expect(page.locator('[data-testid=network-error]')).toHaveAttribute('role', 'alert')
      
      // Retry button should be accessible
      const retryButton = page.locator('[data-testid=retry-button]')
      await expect(retryButton).toHaveAttribute('aria-label')
      await expect(retryButton).toBeFocusable()
    })
  })
})