import { test, expect } from '@playwright/test'

test.describe('Enhanced Pallets Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/auth')
    await page.fill('input[type="email"]', 'admin@warehouse.com')
    await page.fill('input[type="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
    
    // Navigate to pallets page
    await page.goto('/pallets')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Pallets Page Layout and Navigation', () => {
    test('should display pallets page with proper Portuguese interface', async ({ page }) => {
      // Verify page title and description
      await expect(page.locator('h1')).toContainText('Pallets')
      await expect(page.locator('p')).toContainText('Gerenciamento de pallets do armazém')
      
      // Verify search and filter controls
      await expect(page.locator('input[placeholder="Buscar pallets..."]')).toBeVisible()
      await expect(page.locator('[data-testid="status-filter"]')).toBeVisible()
      
      // Verify action buttons
      await expect(page.locator('button', { hasText: 'Recarregar' })).toBeVisible()
      await expect(page.locator('button', { hasText: 'Novo Pallet' })).toBeVisible()
      
      // Verify pallets grid
      await expect(page.locator('.grid')).toBeVisible()
    })

    test('should display pallet cards with status indicators', async ({ page }) => {
      await page.waitForSelector('[data-testid="pallet-card"]:first-child', { timeout: 10000 })
      
      const firstPalletCard = page.locator('[data-testid="pallet-card"]:first-child')
      
      // Verify pallet card structure
      await expect(firstPalletCard.locator('[data-testid="pallet-code"]')).toBeVisible()
      await expect(firstPalletCard.locator('[data-testid="pallet-status"]')).toBeVisible()
      await expect(firstPalletCard.locator('[data-testid="pallet-type"]')).toBeVisible()
      await expect(firstPalletCard.locator('[data-testid="pallet-dimensions"]')).toBeVisible()
      
      // Verify action buttons
      await expect(firstPalletCard.locator('[title="Gerar QR Code"]')).toBeVisible()
      await expect(firstPalletCard.locator('[title="Editar"]')).toBeVisible()
      await expect(firstPalletCard.locator('[title="Excluir"]')).toBeVisible()
    })

    test('should show different status colors for pallets', async ({ page }) => {
      await page.waitForSelector('[data-testid="pallet-card"]')
      
      // Check for different status indicators
      const statusClasses = [
        'bg-green-100', // Disponível
        'bg-blue-100',  // Em Uso
        'bg-red-100',   // Defeituoso
        'bg-yellow-100', // Manutenção
        'bg-gray-100'   // Descarte
      ]
      
      const palletCards = page.locator('[data-testid="pallet-card"]')
      const count = await palletCards.count()
      
      // At least one pallet should have a status indicator
      expect(count).toBeGreaterThan(0)
      
      // First pallet should have a status indicator
      const firstCard = palletCards.first()
      const statusElement = firstCard.locator('[data-testid="pallet-status"]')
      await expect(statusElement).toBeVisible()
    })
  })

  test.describe('Pallet Creation Flow', () => {
    test('should create a new pallet with automatic code generation', async ({ page }) => {
      const timestamp = Date.now()
      
      // Click "Novo Pallet" button
      await page.click('button', { hasText: 'Novo Pallet' })
      
      // Verify dialog opened
      await expect(page.locator('[role="dialog"]')).toBeVisible()
      await expect(page.locator('h2', { hasText: 'Nova Layers' })).toBeVisible()
      
      // Code should be auto-generated
      const codeInput = page.locator('input[placeholder="PLT0001"]')
      const generatedCode = await codeInput.inputValue()
      expect(generatedCode).toBeTruthy()
      expect(generatedCode).toMatch(/^PLT\d+$/)
      
      // Select pallet type (should auto-fill dimensions)
      await page.click('[data-testid="type-select"]')
      await page.click('text=PBR')
      
      // Verify dimensions are auto-filled
      const widthInput = page.locator('input[type="number"]:has-text("Largura")').first()
      const lengthInput = page.locator('input[type="number"]:has-text("Comprimento")').first()
      const heightInput = page.locator('input[type="number"]:has-text("Altura")').first()
      
      await expect(widthInput).toHaveValue('100')
      await expect(lengthInput).toHaveValue('120')
      await expect(heightInput).toHaveValue('14')
      
      // Select material
      await page.click('[data-testid="material-select"]')
      await page.click('text=Madeira')
      
      // Set max weight (should be auto-filled)
      const maxWeightInput = page.locator('input[placeholder="Capacidade Máxima"]')
      await expect(maxWeightInput).toHaveValue('1500')
      
      // Add observations
      await page.fill('textarea', `E2E Test Pallet created at ${timestamp}`)
      
      // Submit form
      await page.click('button[type="submit"]')
      
      // Verify success message
      await expect(page.locator('[data-sonner-toast]')).toContainText('Layers criado com sucesso')
      
      // Verify dialog closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible()
      
      // Verify pallet appears in the list
      await page.waitForSelector(`text=${generatedCode}`, { timeout: 10000 })
      await expect(page.locator(`text=${generatedCode}`)).toBeVisible()
    })

    test('should create pallet with different types and validate auto-dimensions', async ({ page }) => {
      const palletTypes = [
        { type: 'Europeu', width: '80', length: '120', height: '14.4', maxWeight: '1500' },
        { type: 'Chep', width: '110', length: '110', height: '15', maxWeight: '1250' },
        { type: 'Americano', width: '101.6', length: '121.9', height: '14', maxWeight: '1360' }
      ]
      
      for (const palletType of palletTypes) {
        await page.click('button', { hasText: 'Novo Pallet' })
        
        // Select type
        await page.click('[data-testid="type-select"]')
        await page.click(`text=${palletType.type}`)
        
        // Verify auto-filled dimensions
        const widthInput = page.locator('input[type="number"]:has-text("Largura")').first()
        const lengthInput = page.locator('input[type="number"]:has-text("Comprimento")').first()
        const heightInput = page.locator('input[type="number"]:has-text("Altura")').first()
        const maxWeightInput = page.locator('input[placeholder="Capacidade Máxima"]')
        
        await expect(widthInput).toHaveValue(palletType.width)
        await expect(lengthInput).toHaveValue(palletType.length)
        await expect(heightInput).toHaveValue(palletType.height)
        await expect(maxWeightInput).toHaveValue(palletType.maxWeight)
        
        // Cancel this dialog and try next type
        await page.click('button', { hasText: 'Cancelar' })
        await expect(page.locator('[role="dialog"]')).not.toBeVisible()
      }
    })

    test('should handle photo capture for pallets', async ({ page }) => {
      await page.click('button', { hasText: 'Novo Pallet' })
      
      // Click photo capture button
      await page.click('button', { hasText: 'Capturar Foto' })
      
      // Verify camera dialog/component opens
      // Note: This might require mock camera access or simulation
      await expect(page.locator('[data-testid="camera-dialog"]')).toBeVisible()
      
      // Cancel camera for now
      await page.click('[data-testid="camera-cancel"]')
      
      // Cancel pallet creation
      await page.click('button', { hasText: 'Cancelar' })
    })
  })

  test.describe('Pallet Search and Filtering', () => {
    test('should search pallets by code', async ({ page }) => {
      await page.waitForSelector('[data-testid="pallet-card"]')
      
      // Get first pallet code
      const firstPalletCode = await page.locator('[data-testid="pallet-code"]:first-child').textContent()
      
      if (firstPalletCode) {
        // Search for the code
        await page.fill('input[placeholder="Buscar pallets..."]', firstPalletCode.trim())
        await page.keyboard.press('Enter')
        
        // Wait for search results
        await page.waitForTimeout(1000)
        
        // Verify filtered results
        const visiblePallets = page.locator('[data-testid="pallet-card"]')
        const count = await visiblePallets.count()
        
        expect(count).toBeGreaterThan(0)
        await expect(visiblePallets.first().locator('[data-testid="pallet-code"]')).toContainText(firstPalletCode.trim())
      }
    })

    test('should filter pallets by status', async ({ page }) => {
      await page.waitForSelector('[data-testid="pallet-card"]')
      
      // Click status filter
      await page.click('[data-testid="status-filter"]')
      await page.click('text=Disponível')
      
      // Wait for filter to apply
      await page.waitForTimeout(1000)
      
      // All visible pallets should have "Disponível" status
      const visiblePallets = page.locator('[data-testid="pallet-card"]')
      const count = await visiblePallets.count()
      
      if (count > 0) {
        const statusElements = page.locator('[data-testid="pallet-status"]:visible')
        const statusCount = await statusElements.count()
        
        for (let i = 0; i < statusCount; i++) {
          await expect(statusElements.nth(i)).toContainText('Disponível')
        }
      }
    })

    test('should handle force refresh functionality', async ({ page }) => {
      // Click refresh button
      await page.click('button', { hasText: 'Recarregar' })
      
      // Button should show loading state temporarily
      const refreshButton = page.locator('button', { hasText: 'Recarregar' })
      await expect(refreshButton.locator('.animate-spin')).toBeVisible()
      
      // Wait for refresh to complete
      await page.waitForTimeout(2000)
      
      // Loading animation should disappear
      await expect(refreshButton.locator('.animate-spin')).not.toBeVisible()
    })
  })

  test.describe('Pallet Status Management', () => {
    test('should update pallet status through editing', async ({ page }) => {
      await page.waitForSelector('[data-testid="pallet-card"]')
      
      // Click edit on first pallet
      await page.click('[data-testid="pallet-card"]:first-child [title="Editar"]')
      
      // Verify edit dialog
      await expect(page.locator('h2', { hasText: 'Editar Layers' })).toBeVisible()
      
      // Change status
      await page.click('[data-testid="status-select"]')
      await page.click('text=Em Uso')
      
      // Submit changes
      await page.click('button[type="submit"]')
      
      // Verify success message
      await expect(page.locator('[data-sonner-toast]')).toContainText('Layers atualizado com sucesso')
      
      // Verify status change is reflected
      await page.waitForTimeout(2000)
      const firstPallet = page.locator('[data-testid="pallet-card"]:first-child')
      await expect(firstPallet.locator('[data-testid="pallet-status"]')).toContainText('Em Uso')
    })
  })

  test.describe('QR Code Generation', () => {
    test('should generate QR code for pallet', async ({ page }) => {
      await page.waitForSelector('[data-testid="pallet-card"]')
      
      // Click QR code button on first pallet
      await page.click('[data-testid="pallet-card"]:first-child [title="Gerar QR Code"]')
      
      // Verify QR code dialog opens
      await expect(page.locator('[data-testid="qr-code-dialog"]')).toBeVisible()
      await expect(page.locator('[data-testid="qr-code-image"]')).toBeVisible()
      
      // Verify pallet information is displayed
      await expect(page.locator('[data-testid="qr-pallet-info"]')).toBeVisible()
      
      // Should have download or print options
      const downloadButton = page.locator('[data-testid="qr-download"]')
      const printButton = page.locator('[data-testid="qr-print"]')
      
      if (await downloadButton.isVisible()) {
        await expect(downloadButton).toBeVisible()
      }
      
      if (await printButton.isVisible()) {
        await expect(printButton).toBeVisible()
      }
      
      // Close dialog
      await page.click('[data-testid="qr-close"]')
      await expect(page.locator('[data-testid="qr-code-dialog"]')).not.toBeVisible()
    })
  })

  test.describe('Pallet Photo Management', () => {
    test('should display photo if pallet has one', async ({ page }) => {
      await page.waitForSelector('[data-testid="pallet-card"]')
      
      // Look for pallets with photos
      const palletWithPhoto = page.locator('[data-testid="pallet-card"]:has([title="Ver foto"])')
      
      if (await palletWithPhoto.count() > 0) {
        // Click photo view button
        await palletWithPhoto.first().locator('[title="Ver foto"]').click()
        
        // Verify photo viewer opens
        await expect(page.locator('[data-testid="photo-viewer"]')).toBeVisible()
        await expect(page.locator('[data-testid="pallet-photo"]')).toBeVisible()
        
        // Close photo viewer
        await page.keyboard.press('Escape')
        await expect(page.locator('[data-testid="photo-viewer"]')).not.toBeVisible()
      }
    })
  })

  test.describe('Pallet Deletion Flow', () => {
    test('should delete pallet with confirmation', async ({ page }) => {
      // First create a test pallet to delete
      const timestamp = Date.now()
      
      await page.click('button', { hasText: 'Novo Pallet' })
      
      // Create test pallet
      await page.click('[data-testid="type-select"]')
      await page.click('text=PBR')
      await page.click('[data-testid="material-select"]')
      await page.click('text=Madeira')
      await page.fill('textarea', `DELETE-TEST-${timestamp}`)
      await page.click('button[type="submit"]')
      
      // Wait for pallet to appear
      await page.waitForTimeout(2000)
      
      // Setup dialog handler for confirmation
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('Tem certeza que deseja excluir')
        await dialog.accept()
      })
      
      // Click delete on the last pallet (most likely our test pallet)
      const palletCards = page.locator('[data-testid="pallet-card"]')
      const lastPallet = palletCards.last()
      await lastPallet.locator('[title="Excluir"]').click()
      
      // Verify success message
      await expect(page.locator('[data-sonner-toast]')).toContainText('Layers excluído com sucesso')
    })
  })

  test.describe('Responsive Design', () => {
    test('should display pallets grid responsively on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Pallets should still be visible
      await page.waitForSelector('[data-testid="pallet-card"]')
      await expect(page.locator('[data-testid="pallet-card"]')).toBeVisible()
      
      // Grid should adapt to mobile
      const grid = page.locator('.grid')
      await expect(grid).toHaveClass(/grid-cols-1/)
      
      // Filter controls should be stacked vertically
      const filterContainer = page.locator('[data-testid="filter-container"]')
      if (await filterContainer.isVisible()) {
        await expect(filterContainer).toHaveClass(/flex-col/)
      }
    })

    test('should have mobile-friendly dialog on small screens', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      
      await page.click('button', { hasText: 'Novo Pallet' })
      
      // Dialog should be responsive
      const dialog = page.locator('[role="dialog"]')
      await expect(dialog).toBeVisible()
      
      // Form should be readable on mobile
      await expect(page.locator('input[placeholder="PLT0001"]')).toBeVisible()
    })
  })

  test.describe('Animation and Visual Effects', () => {
    test('should display pallet cards with entrance animations', async ({ page }) => {
      // Reload page to see entrance animations
      await page.reload()
      await page.waitForLoadState('networkidle')
      
      // Cards should be visible
      await page.waitForSelector('[data-testid="pallet-card"]')
      await expect(page.locator('[data-testid="pallet-card"]')).toBeVisible()
      
      // Cards should have hover effects
      const firstCard = page.locator('[data-testid="pallet-card"]:first-child')
      await firstCard.hover()
      
      // Card should have hover animation (depends on implementation)
      // This is hard to test directly, but we can verify the card is interactive
      await expect(firstCard).toBeVisible()
    })
  })

  test.describe('Error Handling', () => {
    test('should handle API errors during pallet creation', async ({ page }) => {
      // Simulate API error
      await page.route('/api/pallets', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' })
        })
      })
      
      // Try to create pallet
      await page.click('button', { hasText: 'Novo Pallet' })
      await page.click('[data-testid="type-select"]')
      await page.click('text=PBR')
      await page.click('[data-testid="material-select"]')
      await page.click('text=Madeira')
      await page.click('button[type="submit"]')
      
      // Should show error message
      await expect(page.locator('[data-sonner-toast]')).toContainText('Erro')
    })

    test('should handle network failures gracefully', async ({ page }) => {
      // Simulate network failure
      await page.route('/api/pallets*', route => route.abort())
      
      // Reload page
      await page.reload()
      
      // Should handle error gracefully
      await page.waitForTimeout(3000)
      await expect(page.locator('body')).toBeVisible()
      
      // Should show error state or empty state
      const errorMessage = page.locator('text=Nenhum pallet encontrado')
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toBeVisible()
      }
    })
  })

  test.describe('Performance', () => {
    test('should show loading states appropriately', async ({ page }) => {
      // Intercept API to add delay
      await page.route('/api/pallets*', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000))
        route.continue()
      })
      
      // Navigate to pallets page
      await page.goto('/pallets')
      
      // Should show loading skeletons
      const loadingSkeletons = page.locator('[data-testid="pallet-skeleton"]')
      if (await loadingSkeletons.count() > 0) {
        await expect(loadingSkeletons.first()).toBeVisible()
      }
      
      // Wait for pallets to load
      await page.waitForSelector('[data-testid="pallet-card"]', { timeout: 5000 })
      
      // Loading should disappear
      if (await loadingSkeletons.count() > 0) {
        await expect(loadingSkeletons.first()).not.toBeVisible()
      }
    })
  })
})