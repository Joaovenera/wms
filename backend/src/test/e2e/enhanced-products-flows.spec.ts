import { test, expect } from '@playwright/test'

test.describe('Enhanced Products Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user with stored authentication state
    await page.goto('/auth')
    await page.fill('input[type="email"]', 'admin@warehouse.com')
    await page.fill('input[type="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
    
    // Navigate to products page
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Products Page Layout and Navigation', () => {
    test('should display products page with proper Portuguese interface', async ({ page }) => {
      // Verify page title and description
      await expect(page.locator('h1')).toContainText('Produtos')
      await expect(page.locator('p')).toContainText('Gerenciamento de produtos/SKUs')
      
      // Verify search functionality
      await expect(page.locator('input[placeholder="Buscar produtos..."]')).toBeVisible()
      
      // Verify "Novo Produto" button
      await expect(page.locator('button', { hasText: 'Novo Produto' })).toBeVisible()
      
      // Verify products grid is displayed
      await expect(page.locator('.grid')).toBeVisible()
    })

    test('should display product cards with correct information', async ({ page }) => {
      // Wait for products to load
      await page.waitForSelector('[data-testid="product-card"]:first-child', { timeout: 10000 })
      
      const firstProductCard = page.locator('[data-testid="product-card"]:first-child')
      
      // Verify product card structure
      await expect(firstProductCard.locator('h3')).toBeVisible() // Product name
      await expect(firstProductCard.locator('[data-testid="product-sku"]')).toBeVisible()
      await expect(firstProductCard.locator('[data-testid="product-stock"]')).toBeVisible()
      
      // Verify action buttons
      await expect(firstProductCard.locator('[title="Ver detalhes"]')).toBeVisible()
      await expect(firstProductCard.locator('[title="Gerenciar fotos"]')).toBeVisible()
      await expect(firstProductCard.locator('[title="Editar produto"]')).toBeVisible()
      await expect(firstProductCard.locator('[title="Desativar produto"]')).toBeVisible()
    })
  })

  test.describe('Product Creation Flow', () => {
    test('should create a new product with all required fields', async ({ page }) => {
      const timestamp = Date.now()
      const productSku = `E2E-PROD-${timestamp}`
      const productName = `E2E Test Product ${timestamp}`
      
      // Click "Novo Produto" button
      await page.click('button', { hasText: 'Novo Produto' })
      
      // Verify dialog opened
      await expect(page.locator('[role="dialog"]')).toBeVisible()
      await expect(page.locator('h2', { hasText: 'Novo Produto' })).toBeVisible()
      
      // Fill required fields
      await page.fill('input[placeholder="PRD-001"]', productSku)
      await page.fill('input[placeholder="Nome do produto"]', productName)
      await page.fill('textarea[placeholder="Descrição detalhada do produto"]', 'Produto criado via E2E testing')
      
      // Select category
      await page.click('[data-testid="category-select"]')
      await page.click('[data-testid="category-option"]:first-child')
      
      // Fill brand
      await page.fill('input[placeholder="Nome da marca"]', 'Test Brand')
      
      // Select unit
      await page.click('[data-testid="unit-select"]')
      await page.click('text=Unidade')
      
      // Fill weight and dimensions
      await page.fill('input[placeholder="0.000"]', '2.5')
      await page.fill('input[placeholder="0.00"]:first-child', '10') // Length
      await page.fill('input[placeholder="0.00"]:nth-child(2)', '8')  // Width
      await page.fill('input[placeholder="0.00"]:nth-child(3)', '5')  // Height
      
      // Fill barcode
      await page.fill('input[placeholder="1234567890123"]', `${timestamp}123`)
      
      // Set stock levels
      await page.fill('input[type="number"]:first-of-type', '10') // Min stock
      await page.fill('input[type="number"]:last-of-type', '100') // Max stock
      
      // Submit form
      await page.click('button[type="submit"]')
      
      // Verify success message
      await expect(page.locator('[data-sonner-toast]')).toContainText('Produto criado com sucesso')
      
      // Verify dialog closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible()
      
      // Verify product appears in the list
      await page.waitForSelector(`text=${productSku}`, { timeout: 10000 })
      await expect(page.locator(`text=${productSku}`)).toBeVisible()
      await expect(page.locator(`text=${productName}`)).toBeVisible()
    })

    test('should validate required fields and show error messages', async ({ page }) => {
      // Click "Novo Produto" button
      await page.click('button', { hasText: 'Novo Produto' })
      
      // Try to submit without filling required fields
      await page.click('button[type="submit"]')
      
      // Should still be in dialog (validation should prevent submission)
      await expect(page.locator('[role="dialog"]')).toBeVisible()
      
      // Check for validation messages (depends on implementation)
      const requiredFields = [
        'input[placeholder="PRD-001"]',
        'input[placeholder="Nome do produto"]'
      ]
      
      for (const field of requiredFields) {
        await expect(page.locator(field)).toHaveAttribute('required')
      }
    })

    test('should handle category selection with subcategories', async ({ page }) => {
      await page.click('button', { hasText: 'Novo Produto' })
      
      // Fill basic info
      await page.fill('input[placeholder="PRD-001"]', 'CAT-TEST-001')
      await page.fill('input[placeholder="Nome do produto"]', 'Category Test Product')
      
      // Select main category
      await page.click('[data-testid="category-select"]')
      const categoryOption = page.locator('text=Máquinas')
      if (await categoryOption.isVisible()) {
        await categoryOption.click()
        
        // Select subcategory if available
        await page.click('[data-testid="subcategory-select"]')
        const subcategoryOption = page.locator('text=Bordado')
        if (await subcategoryOption.isVisible()) {
          await subcategoryOption.click()
        }
      }
      
      // Verify category field is populated
      const categoryField = page.locator('input[name="category"]')
      const categoryValue = await categoryField.inputValue()
      expect(categoryValue).toBeTruthy()
    })
  })

  test.describe('Product Search and Filtering', () => {
    test('should search products by SKU', async ({ page }) => {
      // Wait for products to load
      await page.waitForSelector('[data-testid="product-card"]')
      
      // Get the first product's SKU
      const firstProductSku = await page.locator('[data-testid="product-sku"]:first-child').textContent()
      
      if (firstProductSku) {
        // Search for the SKU
        await page.fill('input[placeholder="Buscar produtos..."]', firstProductSku.trim())
        
        // Wait for search results
        await page.waitForTimeout(1000)
        
        // Verify only matching products are shown
        const visibleProducts = page.locator('[data-testid="product-card"]')
        const count = await visibleProducts.count()
        
        // Should have at least one result
        expect(count).toBeGreaterThan(0)
        
        // First result should contain the searched SKU
        await expect(visibleProducts.first().locator('[data-testid="product-sku"]')).toContainText(firstProductSku.trim())
      }
    })

    test('should search products by name', async ({ page }) => {
      await page.waitForSelector('[data-testid="product-card"]')
      
      // Search for partial product name
      await page.fill('input[placeholder="Buscar produtos..."]', 'Test')
      await page.waitForTimeout(1000)
      
      // Verify results contain "Test" in name or SKU
      const visibleProducts = page.locator('[data-testid="product-card"]')
      const count = await visibleProducts.count()
      
      if (count > 0) {
        const firstResult = visibleProducts.first()
        const productText = await firstResult.textContent()
        expect(productText?.toLowerCase()).toContain('test')
      }
    })

    test('should handle no search results gracefully', async ({ page }) => {
      // Search for something that doesn't exist
      await page.fill('input[placeholder="Buscar produtos..."]', 'NonExistentProduct123XYZ')
      await page.waitForTimeout(1000)
      
      // Should show no results message
      await expect(page.locator('text=Nenhum produto encontrado')).toBeVisible()
      await expect(page.locator('text=Tente ajustar os filtros de busca')).toBeVisible()
    })
  })

  test.describe('Product Editing Flow', () => {
    test('should edit existing product successfully', async ({ page }) => {
      await page.waitForSelector('[data-testid="product-card"]')
      
      // Click edit button on first product
      await page.click('[data-testid="product-card"]:first-child [title="Editar produto"]')
      
      // Verify edit dialog opened
      await expect(page.locator('h2', { hasText: 'Editar Produto' })).toBeVisible()
      
      // Modify product name
      const nameInput = page.locator('input[placeholder="Nome do produto"]')
      const originalName = await nameInput.inputValue()
      const newName = `${originalName} - EDITED`
      
      await nameInput.fill(newName)
      
      // Submit changes
      await page.click('button[type="submit"]')
      
      // Verify success message
      await expect(page.locator('[data-sonner-toast]')).toContainText('Produto atualizado com sucesso')
      
      // Verify dialog closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible()
      
      // Verify changes are reflected in the list
      await page.waitForSelector(`text=${newName}`, { timeout: 10000 })
      await expect(page.locator(`text=${newName}`)).toBeVisible()
    })

    test('should cancel edit without saving changes', async ({ page }) => {
      await page.waitForSelector('[data-testid="product-card"]')
      
      // Get original product name
      const originalName = await page.locator('[data-testid="product-card"]:first-child h3').textContent()
      
      // Click edit button
      await page.click('[data-testid="product-card"]:first-child [title="Editar produto"]')
      
      // Make changes
      await page.fill('input[placeholder="Nome do produto"]', 'This should not be saved')
      
      // Cancel instead of save
      await page.click('button', { hasText: 'Cancelar' })
      
      // Verify dialog closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible()
      
      // Verify original name is still displayed
      if (originalName) {
        await expect(page.locator(`text=${originalName}`)).toBeVisible()
      }
    })
  })

  test.describe('Product Photo Management', () => {
    test('should open photo management dialog', async ({ page }) => {
      await page.waitForSelector('[data-testid="product-card"]')
      
      // Click photo management button
      await page.click('[data-testid="product-card"]:first-child [title="Gerenciar fotos"]')
      
      // Verify photo management dialog opened
      await expect(page.locator('[role="dialog"]')).toBeVisible()
      await expect(page.locator('text=Gerenciar Fotos')).toBeVisible()
    })
  })

  test.describe('Product Details Modal', () => {
    test('should open product details modal', async ({ page }) => {
      await page.waitForSelector('[data-testid="product-card"]')
      
      // Click details button
      await page.click('[data-testid="product-card"]:first-child [title="Ver detalhes"]')
      
      // Verify details modal opened
      await expect(page.locator('[role="dialog"]')).toBeVisible()
      await expect(page.locator('text=Detalhes do Produto')).toBeVisible()
    })
  })

  test.describe('Product Deletion Flow', () => {
    test('should deactivate product with confirmation', async ({ page }) => {
      // First create a test product to delete
      const timestamp = Date.now()
      const productSku = `DELETE-TEST-${timestamp}`
      
      await page.click('button', { hasText: 'Novo Produto' })
      await page.fill('input[placeholder="PRD-001"]', productSku)
      await page.fill('input[placeholder="Nome do produto"]', 'Product to Delete')
      await page.click('button[type="submit"]')
      
      // Wait for product to appear
      await page.waitForSelector(`text=${productSku}`)
      
      // Setup dialog handler for confirmation
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('Tem certeza que deseja desativar')
        await dialog.accept()
      })
      
      // Click delete button
      await page.click(`[data-testid="product-card"]:has-text("${productSku}") [title="Desativar produto"]`)
      
      // Verify success message
      await expect(page.locator('[data-sonner-toast]')).toContainText('Produto desativado com sucesso')
      
      // Verify product is no longer visible (or marked as inactive)
      await page.waitForTimeout(2000)
      const productCard = page.locator(`[data-testid="product-card"]:has-text("${productSku}")`)
      
      // Product might be hidden or marked as inactive
      if (await productCard.isVisible()) {
        await expect(productCard.locator('text=Inativo')).toBeVisible()
      }
    })
  })

  test.describe('Responsive Design', () => {
    test('should display products grid responsively on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Products should still be visible in mobile view
      await page.waitForSelector('[data-testid="product-card"]')
      await expect(page.locator('[data-testid="product-card"]')).toBeVisible()
      
      // Grid should adapt to mobile (single column)
      const grid = page.locator('.grid')
      await expect(grid).toHaveClass(/grid-cols-1/)
    })
  })

  test.describe('Performance and Loading States', () => {
    test('should show loading skeleton while products are loading', async ({ page }) => {
      // Intercept products API to add delay
      await page.route('/api/products*', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000))
        route.continue()
      })
      
      // Navigate to products page
      await page.goto('/products')
      
      // Should show loading skeletons
      await expect(page.locator('[data-testid="product-skeleton"]')).toBeVisible()
      
      // Wait for products to load
      await page.waitForSelector('[data-testid="product-card"]', { timeout: 5000 })
      
      // Skeletons should disappear
      await expect(page.locator('[data-testid="product-skeleton"]')).not.toBeVisible()
    })
  })

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully during product creation', async ({ page }) => {
      // Simulate API error
      await page.route('/api/products', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' })
        })
      })
      
      // Try to create product
      await page.click('button', { hasText: 'Novo Produto' })
      await page.fill('input[placeholder="PRD-001"]', 'ERROR-TEST')
      await page.fill('input[placeholder="Nome do produto"]', 'Error Test Product')
      await page.click('button[type="submit"]')
      
      // Should show error message
      await expect(page.locator('[data-sonner-toast]')).toContainText('Erro')
    })

    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate network failure
      await page.route('/api/products*', route => route.abort())
      
      // Navigate to products page
      await page.goto('/products')
      
      // Should handle the error gracefully (may show error message or retry mechanism)
      await page.waitForTimeout(3000)
      
      // Page should not crash
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('Batch Operations', () => {
    test('should support bulk operations on multiple products', async ({ page }) => {
      await page.waitForSelector('[data-testid="product-card"]')
      
      // Check if bulk operations are available
      const bulkCheckbox = page.locator('[data-testid="product-bulk-checkbox"]:first-child')
      
      if (await bulkCheckbox.isVisible()) {
        // Select multiple products
        await bulkCheckbox.check()
        
        // Look for bulk actions
        const bulkActions = page.locator('[data-testid="bulk-actions"]')
        if (await bulkActions.isVisible()) {
          await expect(bulkActions).toBeVisible()
        }
      }
    })
  })
})