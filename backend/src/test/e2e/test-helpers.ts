import { Page, expect } from '@playwright/test'

/**
 * E2E Test Helper Functions for WMS Application
 * Provides reusable functions for common test operations
 */

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Authentication Helpers
   */
  async loginAsAdmin() {
    await this.page.goto('/auth')
    await this.page.fill('input[type="email"]', 'admin@warehouse.com')
    await this.page.fill('input[type="password"]', 'admin123')
    await this.page.click('button[type="submit"]')
    await this.page.waitForURL('/')
  }

  async loginAsUser() {
    await this.page.goto('/auth')
    await this.page.fill('input[type="email"]', 'user@warehouse.com')
    await this.page.fill('input[type="password"]', 'user123')
    await this.page.click('button[type="submit"]')
    await this.page.waitForURL('/')
  }

  async loginAsMobile() {
    await this.page.goto('/auth')
    await this.page.fill('input[type="email"]', 'mobile@warehouse.com')
    await this.page.fill('input[type="password"]', 'mobile123')
    await this.page.click('button[type="submit"]')
    await this.page.waitForURL('/')
  }

  async logout() {
    // Clear browser storage
    await this.page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await this.page.goto('/auth')
  }

  /**
   * Navigation Helpers
   */
  async navigateToProducts() {
    await this.page.goto('/products')
    await this.page.waitForLoadState('networkidle')
  }

  async navigateToPallets() {
    await this.page.goto('/pallets')
    await this.page.waitForLoadState('networkidle')
  }

  async navigateToDashboard() {
    await this.page.goto('/')
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Wait Helpers
   */
  async waitForToast(message?: string) {
    const toast = this.page.locator('[data-sonner-toast]')
    await expect(toast).toBeVisible()
    
    if (message) {
      await expect(toast).toContainText(message)
    }
    
    return toast
  }

  async waitForSuccessToast() {
    return await this.waitForToast('sucesso')
  }

  async waitForErrorToast() {
    return await this.waitForToast('Erro')
  }

  async waitForDialog(title?: string) {
    const dialog = this.page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    
    if (title) {
      await expect(dialog.locator('h2, h3')).toContainText(title)
    }
    
    return dialog
  }

  async waitForLoadingToComplete() {
    // Wait for loading spinners to disappear
    await this.page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10000 })
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Form Helpers
   */
  async fillForm(fields: Record<string, string>) {
    for (const [selector, value] of Object.entries(fields)) {
      await this.page.fill(selector, value)
    }
  }

  async selectFromDropdown(triggerSelector: string, optionText: string) {
    await this.page.click(triggerSelector)
    await this.page.click(`text=${optionText}`)
  }

  async submitForm(buttonText = 'submit') {
    if (buttonText === 'submit') {
      await this.page.click('button[type="submit"]')
    } else {
      await this.page.click(`button:has-text("${buttonText}")`)
    }
  }

  async cancelForm(buttonText = 'Cancelar') {
    await this.page.click(`button:has-text("${buttonText}")`)
  }

  /**
   * Product Helpers
   */
  async createProduct(productData: {
    sku: string
    name: string
    description?: string
    category?: string
    brand?: string
    weight?: string
    dimensions?: { length: string; width: string; height: string }
    barcode?: string
    minStock?: string
    maxStock?: string
  }) {
    await this.page.click('button', { hasText: 'Novo Produto' })
    await this.waitForDialog('Novo Produto')

    // Fill required fields
    await this.page.fill('input[placeholder="PRD-001"]', productData.sku)
    await this.page.fill('input[placeholder="Nome do produto"]', productData.name)

    // Fill optional fields
    if (productData.description) {
      await this.page.fill('textarea[placeholder="Descrição detalhada do produto"]', productData.description)
    }

    if (productData.brand) {
      await this.page.fill('input[placeholder="Nome da marca"]', productData.brand)
    }

    if (productData.weight) {
      await this.page.fill('input[placeholder="0.000"]', productData.weight)
    }

    if (productData.dimensions) {
      const dimensionInputs = this.page.locator('input[placeholder="0.00"]')
      await dimensionInputs.nth(0).fill(productData.dimensions.length)
      await dimensionInputs.nth(1).fill(productData.dimensions.width)
      await dimensionInputs.nth(2).fill(productData.dimensions.height)
    }

    if (productData.barcode) {
      await this.page.fill('input[placeholder="1234567890123"]', productData.barcode)
    }

    if (productData.minStock) {
      await this.page.fill('input[type="number"]:first-of-type', productData.minStock)
    }

    if (productData.maxStock) {
      await this.page.fill('input[type="number"]:last-of-type', productData.maxStock)
    }

    await this.submitForm()
    await this.waitForSuccessToast()
  }

  async searchProducts(searchTerm: string) {
    await this.page.fill('input[placeholder="Buscar produtos..."]', searchTerm)
    await this.page.waitForTimeout(1000) // Debounce
  }

  async getProductCard(sku: string) {
    return this.page.locator(`[data-testid="product-card"]:has-text("${sku}")`)
  }

  async editProduct(sku: string, updates: Record<string, string>) {
    const productCard = await this.getProductCard(sku)
    await productCard.locator('[title="Editar produto"]').click()
    await this.waitForDialog('Editar Produto')

    for (const [field, value] of Object.entries(updates)) {
      await this.page.fill(field, value)
    }

    await this.submitForm()
    await this.waitForSuccessToast()
  }

  async deleteProduct(sku: string) {
    this.page.on('dialog', async dialog => {
      await dialog.accept()
    })

    const productCard = await this.getProductCard(sku)
    await productCard.locator('[title="Desativar produto"]').click()
    await this.waitForSuccessToast()
  }

  /**
   * Pallet Helpers
   */
  async createPallet(palletData: {
    code?: string
    type: string
    material: string
    observations?: string
  }) {
    await this.page.click('button', { hasText: 'Novo Pallet' })
    await this.waitForDialog('Nova Layers')

    // Code is usually auto-generated, but can be overridden
    if (palletData.code) {
      await this.page.fill('input[placeholder="PLT0001"]', palletData.code)
    }

    // Select type
    await this.selectFromDropdown('[data-testid="type-select"]', palletData.type)

    // Select material
    await this.selectFromDropdown('[data-testid="material-select"]', palletData.material)

    // Add observations
    if (palletData.observations) {
      await this.page.fill('textarea', palletData.observations)
    }

    await this.submitForm()
    await this.waitForSuccessToast()
  }

  async searchPallets(searchTerm: string) {
    await this.page.fill('input[placeholder="Buscar pallets..."]', searchTerm)
    await this.page.keyboard.press('Enter')
    await this.page.waitForTimeout(1000)
  }

  async filterPalletsByStatus(status: string) {
    await this.selectFromDropdown('[data-testid="status-filter"]', status)
    await this.page.waitForTimeout(1000)
  }

  async getPalletCard(code: string) {
    return this.page.locator(`[data-testid="pallet-card"]:has-text("${code}")`)
  }

  async generateQRCode(palletCode: string) {
    const palletCard = await this.getPalletCard(palletCode)
    await palletCard.locator('[title="Gerar QR Code"]').click()
    return this.page.locator('[data-testid="qr-code-dialog"]')
  }

  async editPallet(code: string, updates: Record<string, string>) {
    const palletCard = await this.getPalletCard(code)
    await palletCard.locator('[title="Editar"]').click()
    await this.waitForDialog('Editar Layers')

    for (const [field, value] of Object.entries(updates)) {
      if (field.includes('select')) {
        await this.selectFromDropdown(field, value)
      } else {
        await this.page.fill(field, value)
      }
    }

    await this.submitForm()
    await this.waitForSuccessToast()
  }

  async deletePallet(code: string) {
    this.page.on('dialog', async dialog => {
      await dialog.accept()
    })

    const palletCard = await this.getPalletCard(code)
    await palletCard.locator('[title="Excluir"]').click()
    await this.waitForSuccessToast()
  }

  /**
   * Responsive Testing Helpers
   */
  async setMobileViewport() {
    await this.page.setViewportSize({ width: 375, height: 667 })
  }

  async setTabletViewport() {
    await this.page.setViewportSize({ width: 768, height: 1024 })
  }

  async setDesktopViewport() {
    await this.page.setViewportSize({ width: 1920, height: 1080 })
  }

  /**
   * Mock API Helpers
   */
  async mockApiSuccess(endpoint: string, responseData: any) {
    await this.page.route(endpoint, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseData)
      })
    })
  }

  async mockApiError(endpoint: string, status = 500, message = 'Internal server error') {
    await this.page.route(endpoint, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ message })
      })
    })
  }

  async mockApiDelay(endpoint: string, delay = 2000) {
    await this.page.route(endpoint, async route => {
      await new Promise(resolve => setTimeout(resolve, delay))
      route.continue()
    })
  }

  async mockNetworkFailure(endpoint: string) {
    await this.page.route(endpoint, route => route.abort())
  }

  /**
   * Accessibility Helpers
   */
  async checkTabNavigation(selectors: string[]) {
    for (const selector of selectors) {
      await this.page.keyboard.press('Tab')
      await expect(this.page.locator(selector)).toBeFocused()
    }
  }

  async checkAriaLabels(elements: Array<{ selector: string, expectedLabel: string }>) {
    for (const { selector, expectedLabel } of elements) {
      await expect(this.page.locator(selector)).toHaveAttribute('aria-label', expectedLabel)
    }
  }

  /**
   * Screenshot Helpers
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}.png`,
      fullPage: true 
    })
  }

  async takeElementScreenshot(selector: string, name: string) {
    await this.page.locator(selector).screenshot({ 
      path: `test-results/screenshots/${name}.png` 
    })
  }

  /**
   * Performance Helpers
   */
  async measurePageLoadTime() {
    const start = Date.now()
    await this.page.waitForLoadState('networkidle')
    const end = Date.now()
    return end - start
  }

  async waitForApiCall(endpoint: string, timeout = 10000) {
    return this.page.waitForResponse(
      response => response.url().includes(endpoint) && response.status() === 200,
      { timeout }
    )
  }

  /**
   * Data Generation Helpers
   */
  generateUniqueId() {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  generateProductData() {
    const id = this.generateUniqueId()
    return {
      sku: `PRD-${id}`,
      name: `Test Product ${id}`,
      description: `Test product created for E2E testing - ${id}`,
      brand: 'Test Brand',
      weight: '2.5',
      dimensions: { length: '10', width: '8', height: '5' },
      barcode: `${Date.now()}`,
      minStock: '10',
      maxStock: '100'
    }
  }

  generatePalletData() {
    const id = this.generateUniqueId()
    return {
      type: 'PBR',
      material: 'Madeira',
      observations: `Test pallet created for E2E testing - ${id}`
    }
  }

  /**
   * Cleanup Helpers
   */
  async cleanupTestData() {
    // This would clean up any test data created during tests
    // Implementation depends on available cleanup endpoints
    console.log('Cleanup test data - implementation needed')
  }
}

/**
 * Test Data Factory
 */
export class TestDataFactory {
  static createTestProduct(overrides: Partial<any> = {}) {
    const timestamp = Date.now()
    return {
      sku: `E2E-PROD-${timestamp}`,
      name: `E2E Test Product ${timestamp}`,
      description: 'Created by E2E tests',
      category: 'Test Category',
      brand: 'Test Brand',
      unit: 'un',
      weight: 2.5,
      dimensions: JSON.stringify({ length: 10, width: 8, height: 5 }),
      barcode: `${timestamp}123`,
      requiresLot: false,
      requiresExpiry: false,
      minStock: 10,
      maxStock: 100,
      isActive: true,
      ...overrides
    }
  }

  static createTestPallet(overrides: Partial<any> = {}) {
    const timestamp = Date.now()
    return {
      code: `E2E-PAL-${timestamp}`,
      type: 'PBR',
      material: 'Madeira',
      width: 100,
      length: 120,
      height: 14,
      maxWeight: '1500',
      status: 'disponivel',
      observations: 'Created by E2E tests',
      ...overrides
    }
  }

  static createTestUser(overrides: Partial<any> = {}) {
    const timestamp = Date.now()
    return {
      name: `E2E Test User ${timestamp}`,
      email: `e2e-test-${timestamp}@warehouse.com`,
      password: 'testpassword123',
      role: 'operator',
      isActive: true,
      ...overrides
    }
  }
}

/**
 * Assertion Helpers
 */
export class TestAssertions {
  constructor(private page: Page) {}

  async assertProductExists(sku: string) {
    await expect(this.page.locator(`text=${sku}`)).toBeVisible()
  }

  async assertProductNotExists(sku: string) {
    await expect(this.page.locator(`text=${sku}`)).not.toBeVisible()
  }

  async assertPalletExists(code: string) {
    await expect(this.page.locator(`text=${code}`)).toBeVisible()
  }

  async assertPalletStatus(code: string, status: string) {
    const palletCard = this.page.locator(`[data-testid="pallet-card"]:has-text("${code}")`)
    await expect(palletCard.locator('[data-testid="pallet-status"]')).toContainText(status)
  }

  async assertPageTitle(title: string) {
    await expect(this.page.locator('h1')).toContainText(title)
  }

  async assertSuccessMessage(message?: string) {
    const toast = this.page.locator('[data-sonner-toast]')
    await expect(toast).toBeVisible()
    
    if (message) {
      await expect(toast).toContainText(message)
    }
  }

  async assertErrorMessage(message?: string) {
    const toast = this.page.locator('[data-sonner-toast]')
    await expect(toast).toBeVisible()
    
    if (message) {
      await expect(toast).toContainText(message)
    }
  }

  async assertGridItemCount(selector: string, expectedCount: number) {
    const items = this.page.locator(selector)
    await expect(items).toHaveCount(expectedCount)
  }

  async assertDialogOpen(title?: string) {
    const dialog = this.page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    
    if (title) {
      await expect(dialog.locator('h2, h3')).toContainText(title)
    }
  }

  async assertDialogClosed() {
    await expect(this.page.locator('[role="dialog"]')).not.toBeVisible()
  }
}