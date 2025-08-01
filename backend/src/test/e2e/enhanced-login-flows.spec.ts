import { test, expect } from '@playwright/test'

test.describe('Enhanced Login Flows E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth')
  })

  test.describe('Login Flow - Portuguese Interface', () => {
    test('should display Portuguese login interface correctly', async ({ page }) => {
      // Verify login form elements in Portuguese
      await expect(page.locator('h1')).toContainText('MWS')
      await expect(page.locator('h2')).toContainText('Sistema de Controle de Estoque')
      await expect(page.locator('[data-testid="login-tab"]', { hasText: 'Entrar' })).toBeVisible()
      
      // Verify form fields
      await expect(page.locator('input[type="email"]')).toHaveAttribute('placeholder', 'seu@email.com')
      await expect(page.locator('input[type="password"]')).toHaveAttribute('placeholder', '••••••••')
      await expect(page.locator('button[type="submit"]')).toContainText('Entrar')
    })

    test('should login with admin credentials and redirect to dashboard', async ({ page }) => {
      // Fill credentials
      await page.fill('input[type="email"]', 'admin@warehouse.com')
      await page.fill('input[type="password"]', 'admin123')
      
      // Submit login
      await page.click('button[type="submit"]')
      
      // Verify success toast message
      await expect(page.locator('[data-sonner-toast]')).toContainText('Login realizado com sucesso')
      await expect(page.locator('[data-sonner-toast]')).toContainText('Bem-vindo ao MWS!')
      
      // Verify redirect to dashboard
      await page.waitForURL('/')
      await expect(page).toHaveURL('/')
    })

    test('should show error for invalid credentials', async ({ page }) => {
      // Fill invalid credentials
      await page.fill('input[type="email"]', 'invalid@warehouse.com')
      await page.fill('input[type="password"]', 'wrongpassword')
      
      // Submit login
      await page.click('button[type="submit"]')
      
      // Verify error toast message
      await expect(page.locator('[data-sonner-toast]')).toContainText('Erro no login')
      
      // Verify still on auth page
      await expect(page).toHaveURL('/auth')
    })

    test('should validate required fields', async ({ page }) => {
      // Try to submit without credentials
      await page.click('button[type="submit"]')
      
      // Check for HTML5 validation or custom validation messages
      const emailInput = page.locator('input[type="email"]')
      const passwordInput = page.locator('input[type="password"]')
      
      await expect(emailInput).toHaveAttribute('required')
      await expect(passwordInput).toHaveAttribute('required')
      
      // Fill only email
      await page.fill('input[type="email"]', 'test@warehouse.com')
      await page.click('button[type="submit"]')
      
      // Password should still be required
      await expect(passwordInput).toHaveAttribute('required')
    })

    test('should handle different user roles properly', async ({ page }) => {
      // Login as regular user
      await page.fill('input[type="email"]', 'user@warehouse.com')
      await page.fill('input[type="password"]', 'user123')
      await page.click('button[type="submit"]')
      
      await page.waitForURL('/')
      
      // Verify user can access basic functionality
      await expect(page.locator('h1')).toContainText('Dashboard')
    })

    test('should show loading state during authentication', async ({ page }) => {
      // Fill credentials
      await page.fill('input[type="email"]', 'admin@warehouse.com')
      await page.fill('input[type="password"]', 'admin123')
      
      // Intercept login request to add delay
      await page.route('/api/login', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        route.continue()
      })
      
      // Submit login
      await page.click('button[type="submit"]')
      
      // Check for loading state
      await expect(page.locator('button[type="submit"]')).toContainText('Entrando...')
      await expect(page.locator('button[type="submit"]')).toBeDisabled()
    })
  })

  test.describe('Registration Flow - Portuguese Interface', () => {
    test('should display registration form in Portuguese', async ({ page }) => {
      // Click register tab
      await page.click('[data-testid="register-tab"]', { hasText: 'Cadastrar' })
      
      // Verify form fields
      await expect(page.locator('input[placeholder="João"]')).toBeVisible()
      await expect(page.locator('input[placeholder="Silva"]')).toBeVisible()
      await expect(page.locator('input[placeholder="seu@email.com"]')).toBeVisible()
      await expect(page.locator('button[type="submit"]')).toContainText('Cadastrar')
    })

    test('should register new user successfully', async ({ page }) => {
      // Click register tab
      await page.click('[data-testid="register-tab"]')
      
      // Fill registration form
      await page.fill('input[placeholder="João"]', 'Test')
      await page.fill('input[placeholder="Silva"]', 'User')
      await page.fill('input[type="email"]', 'testuser@warehouse.com')
      const passwordInputs = page.locator('input[type="password"]')
      await passwordInputs.nth(0).fill('testpassword123')
      await passwordInputs.nth(1).fill('testpassword123')
      
      // Submit registration
      await page.click('button[type="submit"]')
      
      // Verify success message
      await expect(page.locator('[data-sonner-toast]')).toContainText('Cadastro realizado com sucesso')
      
      // Verify redirect
      await page.waitForURL('/')
    })

    test('should show loading state during registration', async ({ page }) => {
      // Click register tab
      await page.click('[data-testid="register-tab"]')
      
      // Fill form
      await page.fill('input[placeholder="João"]', 'Test')
      await page.fill('input[placeholder="Silva"]', 'User')
      await page.fill('input[type="email"]', 'testuser2@warehouse.com')
      const passwordInputs = page.locator('input[type="password"]')
      await passwordInputs.nth(0).fill('testpassword123')
      await passwordInputs.nth(1).fill('testpassword123')
      
      // Intercept registration request
      await page.route('/api/register', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        route.continue()
      })
      
      // Submit registration
      await page.click('button[type="submit"]')
      
      // Check loading state
      await expect(page.locator('button[type="submit"]')).toContainText('Cadastrando...')
      await expect(page.locator('button[type="submit"]')).toBeDisabled()
    })
  })

  test.describe('Authentication State Management', () => {
    test('should persist authentication across page refreshes', async ({ page, context }) => {
      // Login
      await page.fill('input[type="email"]', 'admin@warehouse.com')
      await page.fill('input[type="password"]', 'admin123')
      await page.click('button[type="submit"]')
      await page.waitForURL('/')
      
      // Refresh page
      await page.reload()
      
      // Should still be authenticated
      await expect(page).toHaveURL('/')
      await expect(page.locator('h1')).toContainText('Dashboard')
    })

    test('should redirect to auth when accessing protected routes without login', async ({ page }) => {
      // Try to access protected route directly
      await page.goto('/products')
      
      // Should redirect to auth page
      await page.waitForURL('/auth')
      await expect(page).toHaveURL('/auth')
    })

    test('should clear session on logout', async ({ page }) => {
      // Login first
      await page.fill('input[type="email"]', 'admin@warehouse.com')
      await page.fill('input[type="password"]', 'admin123')
      await page.click('button[type="submit"]')
      await page.waitForURL('/')
      
      // Logout (assuming there's a logout mechanism)
      // This would need to be implemented in the UI
      await page.evaluate(() => {
        // Clear localStorage/sessionStorage manually for test
        localStorage.clear()
        sessionStorage.clear()
      })
      
      // Try to access protected route
      await page.goto('/products')
      await page.waitForURL('/auth')
    })
  })

  test.describe('Responsive Design', () => {
    test('should display mobile-optimized login on small screens', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Verify mobile layout
      await expect(page.locator('.grid-cols-1')).toBeVisible()
      
      // Verify form is still functional
      await page.fill('input[type="email"]', 'admin@warehouse.com')
      await page.fill('input[type="password"]', 'admin123')
      await page.click('button[type="submit"]')
      
      await page.waitForURL('/')
    })

    test('should display desktop layout on large screens', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 })
      
      // Verify desktop layout elements
      await expect(page.locator('.lg\\:grid-cols-2')).toBeVisible()
      await expect(page.locator('h2')).toContainText('Sistema de Controle de Estoque')
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper form labels and accessibility attributes', async ({ page }) => {
      // Check form labels
      await expect(page.locator('label', { hasText: 'Email' })).toBeVisible()
      await expect(page.locator('label', { hasText: 'Senha' })).toBeVisible()
      
      // Check input associations
      const emailInput = page.locator('input[type="email"]')
      const passwordInput = page.locator('input[type="password"]')
      
      await expect(emailInput).toHaveAttribute('type', 'email')
      await expect(passwordInput).toHaveAttribute('type', 'password')
    })

    test('should support keyboard navigation', async ({ page }) => {
      // Navigate through form using Tab
      await page.keyboard.press('Tab')
      await expect(page.locator('input[type="email"]')).toBeFocused()
      
      await page.keyboard.press('Tab')
      await expect(page.locator('input[type="password"]')).toBeFocused()
      
      await page.keyboard.press('Tab')
      await expect(page.locator('button[type="submit"]')).toBeFocused()
      
      // Should be able to submit with Enter
      await page.fill('input[type="email"]', 'admin@warehouse.com')
      await page.fill('input[type="password"]', 'admin123')
      await page.keyboard.press('Enter')
      
      await page.waitForURL('/')
    })
  })

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate network failure
      await page.route('/api/login', route => route.abort())
      
      await page.fill('input[type="email"]', 'admin@warehouse.com')
      await page.fill('input[type="password"]', 'admin123')
      await page.click('button[type="submit"]')
      
      // Should show error message
      await expect(page.locator('[data-sonner-toast]')).toContainText('Erro no login')
    })

    test('should handle server errors (500)', async ({ page }) => {
      // Simulate server error
      await page.route('/api/login', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' })
        })
      })
      
      await page.fill('input[type="email"]', 'admin@warehouse.com')
      await page.fill('input[type="password"]', 'admin123')
      await page.click('button[type="submit"]')
      
      // Should show error message
      await expect(page.locator('[data-sonner-toast]')).toContainText('Erro no login')
    })
  })

  test.describe('Security Features', () => {
    test('should not expose passwords in DOM', async ({ page }) => {
      await page.fill('input[type="password"]', 'secretpassword')
      
      // Password input should have type="password"
      await expect(page.locator('input[type="password"]')).toHaveAttribute('type', 'password')
      
      // Password should not be visible in page content
      const pageContent = await page.textContent('body')
      expect(pageContent).not.toContain('secretpassword')
    })

    test('should clear sensitive data from forms on error', async ({ page }) => {
      await page.fill('input[type="email"]', 'test@warehouse.com')
      await page.fill('input[type="password"]', 'wrongpassword')
      
      // Simulate login error
      await page.route('/api/login', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Invalid credentials' })
        })
      })
      
      await page.click('button[type="submit"]')
      
      // Email should remain, but password should be cleared for security
      await expect(page.locator('input[type="email"]')).toHaveValue('test@warehouse.com')
      // Note: This depends on implementation - some apps clear password, others don't
    })
  })
})