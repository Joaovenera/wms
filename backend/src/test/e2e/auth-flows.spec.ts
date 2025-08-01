import { test, expect } from '@playwright/test'

test.describe('Authentication Flows', () => {
  test.describe('Login Flow', () => {
    test('should login with valid credentials', async ({ page }) => {
      await page.goto('/login')
      
      // Verify login form elements
      await expect(page.locator('[data-testid=login-form]')).toBeVisible()
      await expect(page.locator('[data-testid=email-input]')).toBeVisible()
      await expect(page.locator('[data-testid=password-input]')).toBeVisible()
      await expect(page.locator('[data-testid=login-button]')).toBeVisible()
      
      // Fill credentials
      await page.fill('[data-testid=email-input]', 'admin@warehouse.com')
      await page.fill('[data-testid=password-input]', 'admin123')
      
      // Submit login
      await page.click('[data-testid=login-button]')
      
      // Verify redirect to dashboard
      await page.waitForURL('/dashboard')
      await expect(page.locator('[data-testid=dashboard-welcome]')).toBeVisible()
      await expect(page.locator('[data-testid=user-menu]')).toContainText('Admin User')
    })

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login')
      
      // Fill invalid credentials
      await page.fill('[data-testid=email-input]', 'invalid@warehouse.com')
      await page.fill('[data-testid=password-input]', 'wrongpassword')
      
      // Submit login
      await page.click('[data-testid=login-button]')
      
      // Verify error message
      await expect(page.locator('[data-testid=login-error]')).toBeVisible()
      await expect(page.locator('[data-testid=login-error]')).toContainText('Invalid credentials')
      
      // Verify still on login page
      await expect(page).toHaveURL('/login')
    })

    test('should validate required fields', async ({ page }) => {
      await page.goto('/login')
      
      // Try to submit without credentials
      await page.click('[data-testid=login-button]')
      
      // Verify validation errors
      await expect(page.locator('[data-testid=email-error]')).toBeVisible()
      await expect(page.locator('[data-testid=password-error]')).toBeVisible()
      
      // Fill only email
      await page.fill('[data-testid=email-input]', 'test@warehouse.com')
      await page.click('[data-testid=login-button]')
      
      // Verify password still required
      await expect(page.locator('[data-testid=password-error]')).toBeVisible()
      await expect(page.locator('[data-testid=email-error]')).not.toBeVisible()
    })

    test('should handle email format validation', async ({ page }) => {
      await page.goto('/login')
      
      // Fill invalid email format
      await page.fill('[data-testid=email-input]', 'invalid-email')
      await page.fill('[data-testid=password-input]', 'password123')
      await page.click('[data-testid=login-button]')
      
      // Verify email format error
      await expect(page.locator('[data-testid=email-format-error]')).toBeVisible()
      await expect(page.locator('[data-testid=email-format-error]')).toContainText('Invalid email format')
    })

    test('should handle "Remember Me" functionality', async ({ page, context }) => {
      await page.goto('/login')
      
      // Login with remember me checked
      await page.fill('[data-testid=email-input]', 'user@warehouse.com')
      await page.fill('[data-testid=password-input]', 'user123')
      await page.check('[data-testid=remember-me-checkbox]')
      await page.click('[data-testid=login-button]')
      
      await page.waitForURL('/dashboard')
      
      // Verify persistent session
      const cookies = await context.cookies()
      const sessionCookie = cookies.find(cookie => cookie.name === 'session')
      expect(sessionCookie).toBeTruthy()
      expect(sessionCookie?.expires).toBeGreaterThan(Date.now() / 1000 + 86400) // More than 1 day
    })
  })

  test.describe('Logout Flow', () => {
    test('should logout successfully', async ({ page }) => {
      // Login first
      await page.goto('/login')
      await page.fill('[data-testid=email-input]', 'admin@warehouse.com')
      await page.fill('[data-testid=password-input]', 'admin123')
      await page.click('[data-testid=login-button]')
      await page.waitForURL('/dashboard')
      
      // Logout
      await page.click('[data-testid=user-menu]')
      await page.click('[data-testid=logout-button]')
      
      // Verify redirect to login
      await page.waitForURL('/login')
      await expect(page.locator('[data-testid=logout-success-message]')).toBeVisible()
    })

    test('should clear session data on logout', async ({ page, context }) => {
      // Login first
      await page.goto('/login')
      await page.fill('[data-testid=email-input]', 'admin@warehouse.com')
      await page.fill('[data-testid=password-input]', 'admin123')
      await page.click('[data-testid=login-button]')
      await page.waitForURL('/dashboard')
      
      // Logout
      await page.click('[data-testid=user-menu]')
      await page.click('[data-testid=logout-button]')
      await page.waitForURL('/login')
      
      // Verify session cleared
      const cookies = await context.cookies()
      const sessionCookie = cookies.find(cookie => cookie.name === 'session')
      expect(sessionCookie).toBeFalsy()
      
      // Try to access protected route
      await page.goto('/dashboard')
      await page.waitForURL('/login')
    })
  })

  test.describe('Session Management', () => {
    test('should redirect to login when session expires', async ({ page }) => {
      // Login first
      await page.goto('/login')
      await page.fill('[data-testid=email-input]', 'admin@warehouse.com')
      await page.fill('[data-testid=password-input]', 'admin123')
      await page.click('[data-testid=login-button]')
      await page.waitForURL('/dashboard')
      
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
      
      // Verify redirect to login with session expired message
      await page.waitForURL('/login')
      await expect(page.locator('[data-testid=session-expired-message]')).toBeVisible()
    })

    test('should handle concurrent session limits', async ({ browser }) => {
      const context1 = await browser.newContext()
      const context2 = await browser.newContext()
      
      const page1 = await context1.newPage()
      const page2 = await context2.newPage()
      
      // Login with same user in first browser
      await page1.goto('/login')
      await page1.fill('[data-testid=email-input]', 'user@warehouse.com')
      await page1.fill('[data-testid=password-input]', 'user123')
      await page1.click('[data-testid=login-button]')
      await page1.waitForURL('/dashboard')
      
      // Login with same user in second browser
      await page2.goto('/login')
      await page2.fill('[data-testid=email-input]', 'user@warehouse.com')
      await page2.fill('[data-testid=password-input]', 'user123')
      await page2.click('[data-testid=login-button]')
      await page2.waitForURL('/dashboard')
      
      // Verify first session is invalidated (if concurrent sessions not allowed)
      await page1.reload()
      await page1.waitForURL('/login')
      await expect(page1.locator('[data-testid=session-invalidated-message]')).toBeVisible()
      
      await context1.close()
      await context2.close()
    })

    test('should maintain session across page refreshes', async ({ page }) => {
      // Login
      await page.goto('/login')
      await page.fill('[data-testid=email-input]', 'admin@warehouse.com')
      await page.fill('[data-testid=password-input]', 'admin123')
      await page.click('[data-testid=login-button]')
      await page.waitForURL('/dashboard')
      
      // Refresh page
      await page.reload()
      
      // Verify still authenticated
      await expect(page.locator('[data-testid=dashboard-welcome]')).toBeVisible()
      await expect(page.locator('[data-testid=user-menu]')).toContainText('Admin User')
    })
  })

  test.describe('Password Recovery', () => {
    test('should initiate password recovery', async ({ page }) => {
      await page.goto('/login')
      
      // Click forgot password link
      await page.click('[data-testid=forgot-password-link]')
      await page.waitForURL('/forgot-password')
      
      // Fill email
      await page.fill('[data-testid=recovery-email-input]', 'admin@warehouse.com')
      await page.click('[data-testid=send-recovery-button]')
      
      // Verify success message
      await expect(page.locator('[data-testid=recovery-sent-message]')).toBeVisible()
      await expect(page.locator('[data-testid=recovery-sent-message]')).toContainText('Recovery email sent')
    })

    test('should validate email for password recovery', async ({ page }) => {
      await page.goto('/forgot-password')
      
      // Try with invalid email
      await page.fill('[data-testid=recovery-email-input]', 'invalid-email')
      await page.click('[data-testid=send-recovery-button]')
      
      // Verify validation error
      await expect(page.locator('[data-testid=email-format-error]')).toBeVisible()
      
      // Try with non-existent email
      await page.fill('[data-testid=recovery-email-input]', 'nonexistent@warehouse.com')
      await page.click('[data-testid=send-recovery-button]')
      
      // Verify user not found error
      await expect(page.locator('[data-testid=user-not-found-error]')).toBeVisible()
    })
  })

  test.describe('Role-Based Access', () => {
    test('should redirect admin users to admin dashboard', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[data-testid=email-input]', 'admin@warehouse.com')
      await page.fill('[data-testid=password-input]', 'admin123')
      await page.click('[data-testid=login-button]')
      
      // Verify admin dashboard elements
      await page.waitForURL('/dashboard')
      await expect(page.locator('[data-testid=admin-panel-access]')).toBeVisible()
      await expect(page.locator('[data-testid=user-management-link]')).toBeVisible()
    })

    test('should restrict regular users from admin features', async ({ page }) => {
      await page.goto('/login')
      await page.fill('[data-testid=email-input]', 'user@warehouse.com')
      await page.fill('[data-testid=password-input]', 'user123')
      await page.click('[data-testid=login-button]')
      
      // Verify regular user dashboard
      await page.waitForURL('/dashboard')
      await expect(page.locator('[data-testid=admin-panel-access]')).not.toBeVisible()
      await expect(page.locator('[data-testid=user-management-link]')).not.toBeVisible()
      
      // Try to access admin route directly
      await page.goto('/admin/users')
      await page.waitForURL('/unauthorized')
      await expect(page.locator('[data-testid=access-denied-message]')).toBeVisible()
    })

    test('should show mobile interface for mobile users', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      await page.goto('/login')
      await page.fill('[data-testid=email-input]', 'mobile@warehouse.com')
      await page.fill('[data-testid=password-input]', 'mobile123')
      await page.click('[data-testid=login-button]')
      
      // Verify mobile interface
      await page.waitForURL('/mobile')
      await expect(page.locator('[data-testid=mobile-dashboard]')).toBeVisible()
      await expect(page.locator('[data-testid=mobile-nav-menu]')).toBeVisible()
    })
  })

  test.describe('Security Features', () => {
    test('should implement rate limiting on login attempts', async ({ page }) => {
      await page.goto('/login')
      
      // Make multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        await page.fill('[data-testid=email-input]', 'admin@warehouse.com')
        await page.fill('[data-testid=password-input]', 'wrongpassword')
        await page.click('[data-testid=login-button]')
        await page.waitForTimeout(100)
      }
      
      // Verify rate limiting message
      await expect(page.locator('[data-testid=rate-limit-error]')).toBeVisible()
      await expect(page.locator('[data-testid=rate-limit-error]')).toContainText('Too many attempts')
    })

    test('should prevent CSRF attacks', async ({ page }) => {
      // This would require more complex setup with actual CSRF token validation
      // For now, verify CSRF token is present in forms
      await page.goto('/login')
      
      const csrfToken = await page.locator('[name="_csrf"]')
      await expect(csrfToken).toBeAttached()
      
      const tokenValue = await csrfToken.getAttribute('value')
      expect(tokenValue).toBeTruthy()
      expect(tokenValue?.length).toBeGreaterThan(10)
    })

    test('should enforce secure headers', async ({ page }) => {
      const response = await page.goto('/login')
      const headers = response?.headers()
      
      // Verify security headers
      expect(headers?.['x-content-type-options']).toBe('nosniff')
      expect(headers?.['x-frame-options']).toBe('DENY')
      expect(headers?.['x-xss-protection']).toBe('1; mode=block')
      expect(headers?.['strict-transport-security']).toContain('max-age')
    })
  })
})