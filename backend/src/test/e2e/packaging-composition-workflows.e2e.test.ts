import { test, expect, Page, Browser } from '@playwright/test';
import { setupE2EDatabase, cleanupE2EDatabase } from '../helpers/e2e-database-helper';
import { createE2ETestData, E2ETestDataFactory } from '../helpers/e2e-test-data-factory';

interface CompositionWorkflowContext {
  page: Page;
  testData: E2ETestDataFactory;
  authToken: string;
  baseUrl: string;
}

test.describe('Packaging Composition E2E Workflows', () => {
  let context: CompositionWorkflowContext;

  test.beforeAll(async ({ browser }) => {
    // Setup test database and data
    await setupE2EDatabase();
    const testData = await createE2ETestData();

    // Create a new page for E2E tests
    const page = await browser.newPage();
    const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';

    // Login and get auth token
    await page.goto(`${baseUrl}/login`);
    await page.fill('[data-testid="email-input"]', testData.users.admin.email);
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="login-button"]');
    
    // Wait for login to complete and extract token
    await page.waitForURL(`${baseUrl}/dashboard`);
    const authToken = await page.evaluate(() => localStorage.getItem('authToken')) || '';

    context = {
      page,
      testData,
      authToken,
      baseUrl
    };
  });

  test.afterAll(async () => {
    await context.page.close();
    await cleanupE2EDatabase();
  });

  test.describe('Complete Composition Lifecycle', () => {
    test('should create, validate, approve, and execute composition end-to-end', async () => {
      const { page, baseUrl } = context;

      // Step 1: Navigate to Composition Manager
      await page.goto(`${baseUrl}/packaging/compositions`);
      await expect(page.locator('h1')).toContainText('Gerenciador de Composições');

      // Step 2: Create New Composition
      await page.click('[data-testid="new-composition-button"]');
      await expect(page.locator('[data-testid="composition-dialog"]')).toBeVisible();

      // Fill composition details
      await page.fill('[data-testid="composition-name"]', 'E2E Test Composition');
      await page.fill('[data-testid="composition-description"]', 'End-to-end test composition workflow');

      // Add products to composition
      await page.click('[data-testid="add-product-button"]');
      await page.selectOption('[data-testid="product-select"]', { value: '1' });
      await page.fill('[data-testid="quantity-input"]', '10');
      await page.selectOption('[data-testid="packaging-select"]', { value: '1' });
      await page.click('[data-testid="confirm-add-product"]');

      // Add second product
      await page.click('[data-testid="add-product-button"]');
      await page.selectOption('[data-testid="product-select"]', { value: '2' });
      await page.fill('[data-testid="quantity-input"]', '5');
      await page.selectOption('[data-testid="packaging-select"]', { value: '2' });
      await page.click('[data-testid="confirm-add-product"]');

      // Select pallet
      await page.selectOption('[data-testid="pallet-select"]', { value: '1' });

      // Step 3: Validate Composition
      await page.click('[data-testid="validate-composition-button"]');
      
      // Wait for validation results
      await expect(page.locator('[data-testid="validation-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="validation-status"]')).toContainText('Válida');

      // Check validation metrics
      const efficiency = await page.locator('[data-testid="efficiency-metric"]').textContent();
      expect(parseFloat(efficiency!.replace('%', ''))).toBeGreaterThan(60);

      // Step 4: Save Composition
      await page.click('[data-testid="save-composition-button"]');
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Composição criada com sucesso');

      // Step 5: Close dialog and verify composition appears in list
      await page.click('[data-testid="close-dialog"]');
      await expect(page.locator('[data-testid="composition-card"]').first()).toContainText('E2E Test Composition');

      // Step 6: Update Status to Validated
      const compositionCard = page.locator('[data-testid="composition-card"]').first();
      await compositionCard.locator('[data-testid="validate-status-button"]').click();
      await expect(compositionCard.locator('[data-testid="composition-status"]')).toContainText('Validado');

      // Step 7: Update Status to Approved
      await compositionCard.locator('[data-testid="approve-status-button"]').click();
      await expect(compositionCard.locator('[data-testid="composition-status"]')).toContainText('Aprovado');

      // Step 8: Execute Composition (Assembly)
      await compositionCard.locator('[data-testid="execute-button"]').click();
      
      // Fill assembly form
      await page.selectOption('[data-testid="target-ucp-select"]', { value: '1' });
      await page.click('[data-testid="confirm-assembly"]');
      
      // Wait for assembly completion
      await expect(page.locator('[data-testid="assembly-success"]')).toContainText('montada com sucesso');
      await expect(compositionCard.locator('[data-testid="composition-status"]')).toContainText('Executado');
    });

    test('should handle composition validation failures gracefully', async () => {
      const { page, baseUrl } = context;

      await page.goto(`${baseUrl}/packaging/compositions`);

      // Create composition with invalid constraints
      await page.click('[data-testid="new-composition-button"]');
      await page.fill('[data-testid="composition-name"]', 'Invalid Composition Test');

      // Add products that exceed pallet capacity
      await page.click('[data-testid="add-product-button"]');
      await page.selectOption('[data-testid="product-select"]', { value: '3' }); // Heavy product
      await page.fill('[data-testid="quantity-input"]', '100'); // Excessive quantity
      await page.click('[data-testid="confirm-add-product"]');

      // Select small pallet
      await page.selectOption('[data-testid="pallet-select"]', { value: '2' }); // Small capacity pallet

      // Try to validate
      await page.click('[data-testid="validate-composition-button"]');
      
      // Should show validation errors
      await expect(page.locator('[data-testid="validation-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="validation-status"]')).toContainText('Inválida');
      await expect(page.locator('[data-testid="validation-violations"]')).toBeVisible();

      // Should show specific error messages
      await expect(page.locator('[data-testid="weight-violation"]')).toContainText('Peso total excede limite');

      // Save button should be disabled or show warning
      const saveButton = page.locator('[data-testid="save-composition-button"]');
      await expect(saveButton).toBeDisabled();
    });

    test('should generate and download composition reports', async () => {
      const { page, baseUrl } = context;

      await page.goto(`${baseUrl}/packaging/compositions`);

      // Find an existing composition
      const compositionCard = page.locator('[data-testid="composition-card"]').first();
      
      // Generate report
      await compositionCard.locator('[data-testid="generate-report-button"]').click();
      
      // Fill report options
      await page.check('[data-testid="include-metrics-checkbox"]');
      await page.check('[data-testid="include-recommendations-checkbox"]');
      await page.check('[data-testid="include-cost-analysis-checkbox"]');
      
      // Generate report
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="confirm-generate-report"]')
      ]);

      // Verify download
      expect(download.suggestedFilename()).toMatch(/composition-report-\d+\.pdf/);
      
      // Verify success message
      await expect(page.locator('[data-testid="report-success"]')).toContainText('Relatório gerado com sucesso');
    });
  });

  test.describe('Bulk Operations Workflow', () => {
    test('should handle batch composition creation and processing', async () => {
      const { page, baseUrl } = context;

      await page.goto(`${baseUrl}/packaging/compositions`);

      // Create multiple compositions
      const compositionNames = ['Batch Test 1', 'Batch Test 2', 'Batch Test 3'];
      
      for (const name of compositionNames) {
        await page.click('[data-testid="new-composition-button"]');
        await page.fill('[data-testid="composition-name"]', name);
        
        // Quick product setup
        await page.click('[data-testid="quick-setup-button"]');
        await page.selectOption('[data-testid="quick-product-select"]', { value: '1' });
        await page.fill('[data-testid="quick-quantity"]', '5');
        await page.click('[data-testid="apply-quick-setup"]');
        
        // Save composition
        await page.click('[data-testid="save-composition-button"]');
        await page.click('[data-testid="close-dialog"]');
      }

      // Verify all compositions were created
      for (const name of compositionNames) {
        await expect(page.locator(`[data-testid="composition-card"]:has-text("${name}")`)).toBeVisible();
      }

      // Batch validate compositions
      await page.click('[data-testid="batch-operations-button"]');
      await page.check('[data-testid="select-all-checkbox"]');
      await page.click('[data-testid="batch-validate-button"]');
      
      // Wait for batch validation to complete
      await expect(page.locator('[data-testid="batch-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="batch-complete"]')).toContainText('Validação em lote concluída');

      // Verify all compositions are validated
      for (const name of compositionNames) {
        const card = page.locator(`[data-testid="composition-card"]:has-text("${name}")`);
        await expect(card.locator('[data-testid="composition-status"]')).toContainText('Validado');
      }
    });

    test('should handle batch status updates efficiently', async () => {
      const { page, baseUrl } = context;

      await page.goto(`${baseUrl}/packaging/compositions`);

      // Filter to show validated compositions
      await page.selectOption('[data-testid="status-filter"]', 'validated');
      
      // Select multiple compositions for batch approval
      const compositionCards = page.locator('[data-testid="composition-card"]');
      const cardCount = await compositionCards.count();
      
      // Select first 3 compositions
      for (let i = 0; i < Math.min(3, cardCount); i++) {
        await compositionCards.nth(i).locator('[data-testid="select-checkbox"]').check();
      }

      // Batch approve
      await page.click('[data-testid="batch-operations-button"]');
      await page.click('[data-testid="batch-approve-button"]');
      
      // Confirm batch operation
      await page.click('[data-testid="confirm-batch-approve"]');
      
      // Wait for completion
      await expect(page.locator('[data-testid="batch-success"]')).toContainText('Status atualizado para 3 composições');

      // Verify status changes
      await page.reload();
      await page.selectOption('[data-testid="status-filter"]', 'approved');
      
      // Should see at least the compositions we just approved
      await expect(page.locator('[data-testid="composition-card"]')).toHaveCount(Math.min(3, cardCount));
    });
  });

  test.describe('Error Recovery Workflow', () => {
    test('should handle network failures and retry operations', async () => {
      const { page, baseUrl } = context;

      await page.goto(`${baseUrl}/packaging/compositions`);

      // Simulate network failure
      await page.route('**/api/packaging/composition/calculate', route => {
        route.abort('failed');
      });

      // Try to create composition
      await page.click('[data-testid="new-composition-button"]');
      await page.fill('[data-testid="composition-name"]', 'Network Failure Test');
      
      // Add product and try to validate
      await page.click('[data-testid="add-product-button"]');
      await page.selectOption('[data-testid="product-select"]', { value: '1' });
      await page.fill('[data-testid="quantity-input"]', '5');
      await page.click('[data-testid="confirm-add-product"]');
      
      await page.click('[data-testid="validate-composition-button"]');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Erro de conexão');
      
      // Retry button should be available
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

      // Remove network simulation
      await page.unroute('**/api/packaging/composition/calculate');

      // Retry operation
      await page.click('[data-testid="retry-button"]');
      
      // Should succeed now
      await expect(page.locator('[data-testid="validation-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="validation-status"]')).toContainText('Válida');
    });

    test('should handle concurrent user modifications gracefully', async ({ browser }) => {
      const { baseUrl, testData } = context;

      // Create two browser contexts (simulate two users)
      const user1Page = await browser.newPage();
      const user2Page = await browser.newPage();

      try {
        // Login both users
        for (const page of [user1Page, user2Page]) {
          await page.goto(`${baseUrl}/login`);
          await page.fill('[data-testid="email-input"]', testData.users.admin.email);
          await page.fill('[data-testid="password-input"]', 'admin123');
          await page.click('[data-testid="login-button"]');
          await page.waitForURL(`${baseUrl}/dashboard`);
        }

        // Both users navigate to compositions
        await user1Page.goto(`${baseUrl}/packaging/compositions`);
        await user2Page.goto(`${baseUrl}/packaging/compositions`);

        // User 1 starts editing a composition
        await user1Page.locator('[data-testid="composition-card"]').first().locator('[data-testid="edit-button"]').click();
        await user1Page.fill('[data-testid="composition-name"]', 'Modified by User 1');

        // User 2 tries to edit the same composition
        await user2Page.locator('[data-testid="composition-card"]').first().locator('[data-testid="edit-button"]').click();
        
        // Should show conflict warning
        await expect(user2Page.locator('[data-testid="edit-conflict-warning"]')).toContainText('está sendo editada por outro usuário');
        
        // User 2 can choose to view read-only or take over
        await user2Page.click('[data-testid="view-readonly-button"]');
        
        // User 1 saves changes
        await user1Page.click('[data-testid="save-composition-button"]');
        await expect(user1Page.locator('[data-testid="save-success"]')).toBeVisible();

        // User 2 should see updated version
        await user2Page.reload();
        await expect(user2Page.locator('[data-testid="composition-card"]').first()).toContainText('Modified by User 1');

      } finally {
        await user1Page.close();
        await user2Page.close();
      }
    });
  });

  test.describe('Performance and Scale Workflow', () => {
    test('should handle large composition calculations efficiently', async () => {
      const { page, baseUrl } = context;

      await page.goto(`${baseUrl}/packaging/compositions`);

      // Create composition with many products
      await page.click('[data-testid="new-composition-button"]');
      await page.fill('[data-testid="composition-name"]', 'Large Scale Composition');

      // Add many products quickly using bulk import
      await page.click('[data-testid="bulk-import-button"]');
      
      // Upload CSV with 50 products
      const csvContent = Array.from({ length: 50 }, (_, i) => 
        `${i + 1},5,1`
      ).join('\n');
      
      const csvHeader = 'productId,quantity,packagingTypeId\n';
      const fullCsv = csvHeader + csvContent;
      
      // Create file and upload
      await page.setInputFiles('[data-testid="csv-upload"]', {
        name: 'products.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(fullCsv)
      });

      await page.click('[data-testid="process-csv"]');
      await expect(page.locator('[data-testid="import-success"]')).toContainText('50 produtos importados');

      // Select large pallet
      await page.selectOption('[data-testid="pallet-select"]', { value: '1' });

      // Measure validation time
      const startTime = Date.now();
      await page.click('[data-testid="validate-composition-button"]');
      
      // Wait for results with timeout
      await expect(page.locator('[data-testid="validation-results"]')).toBeVisible({ timeout: 10000 });
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (10 seconds)
      expect(duration).toBeLessThan(10000);

      // Should show performance metrics
      await expect(page.locator('[data-testid="calculation-time"]')).toBeVisible();
      const calculationTime = await page.locator('[data-testid="calculation-time"]').textContent();
      expect(parseFloat(calculationTime!.replace('ms', ''))).toBeLessThan(5000);
    });

    test('should maintain responsiveness during heavy operations', async () => {
      const { page, baseUrl } = context;

      await page.goto(`${baseUrl}/packaging/compositions`);

      // Start a heavy calculation
      await page.click('[data-testid="new-composition-button"]');
      await page.fill('[data-testid="composition-name"]', 'Heavy Calculation Test');
      
      // Add complex products
      for (let i = 0; i < 10; i++) {
        await page.click('[data-testid="add-product-button"]');
        await page.selectOption('[data-testid="product-select"]', { value: '1' });
        await page.fill('[data-testid="quantity-input"]', '10');
        await page.click('[data-testid="confirm-add-product"]');
      }

      // Start validation (should show loading state)
      await page.click('[data-testid="validate-composition-button"]');
      
      // UI should remain responsive
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
      
      // Should be able to interact with other UI elements
      await expect(page.locator('[data-testid="cancel-validation"]')).toBeEnabled();
      
      // Should be able to scroll
      await page.mouse.wheel(0, 100);
      
      // Loading should eventually complete
      await expect(page.locator('[data-testid="validation-results"]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
    });
  });

  test.describe('Integration with Other Systems', () => {
    test('should integrate with inventory management for stock validation', async () => {
      const { page, baseUrl } = context;

      await page.goto(`${baseUrl}/packaging/compositions`);

      // Create composition that requires stock validation
      await page.click('[data-testid="new-composition-button"]');
      await page.fill('[data-testid="composition-name"]', 'Stock Integration Test');

      // Add product with specific quantity
      await page.click('[data-testid="add-product-button"]');
      await page.selectOption('[data-testid="product-select"]', { value: '1' });
      await page.fill('[data-testid="quantity-input"]', '50'); // Large quantity
      await page.click('[data-testid="confirm-add-product"]');

      // Should show real-time stock availability
      await expect(page.locator('[data-testid="stock-availability"]')).toBeVisible();
      const stockInfo = await page.locator('[data-testid="available-stock"]').textContent();
      const availableStock = parseInt(stockInfo!.replace(/\D/g, ''));

      // If insufficient stock, should show warning
      if (availableStock < 50) {
        await expect(page.locator('[data-testid="insufficient-stock-warning"]')).toBeVisible();
        await expect(page.locator('[data-testid="max-available-quantity"]')).toContainText(availableStock.toString());
      }

      // Validate composition should check stock levels
      await page.click('[data-testid="validate-composition-button"]');
      
      if (availableStock < 50) {
        await expect(page.locator('[data-testid="stock-violation"]')).toContainText('Estoque insuficiente');
      } else {
        await expect(page.locator('[data-testid="validation-status"]')).toContainText('Válida');
      }
    });

    test('should integrate with warehouse management for UCP assignment', async () => {
      const { page, baseUrl } = context;

      // Navigate to an approved composition
      await page.goto(`${baseUrl}/packaging/compositions`);
      await page.selectOption('[data-testid="status-filter"]', 'approved');

      const compositionCard = page.locator('[data-testid="composition-card"]').first();
      
      // Execute composition
      await compositionCard.locator('[data-testid="execute-button"]').click();
      
      // Should show available UCPs
      await expect(page.locator('[data-testid="ucp-selection"]')).toBeVisible();
      
      // Should show UCP capacity and availability
      const ucpOptions = page.locator('[data-testid="ucp-option"]');
      const firstUcp = ucpOptions.first();
      
      await expect(firstUcp.locator('[data-testid="ucp-capacity"]')).toBeVisible();
      await expect(firstUcp.locator('[data-testid="ucp-availability"]')).toBeVisible();
      
      // Select UCP and execute
      await page.selectOption('[data-testid="target-ucp-select"]', { value: '1' });
      await page.click('[data-testid="confirm-assembly"]');
      
      // Should update warehouse records
      await expect(page.locator('[data-testid="warehouse-update-success"]')).toContainText('UCP atualizada com sucesso');
      
      // Should show updated composition status
      await expect(compositionCard.locator('[data-testid="composition-status"]')).toContainText('Executado');
    });
  });

  test.describe('Mobile Workflow Experience', () => {
    test('should work correctly on mobile devices', async ({ browser }) => {
      const mobileContext = await browser.newContext({
        viewport: { width: 375, height: 667 }, // iPhone SE size
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15'
      });

      const mobilePage = await mobileContext.newPage();
      const { baseUrl, testData } = context;

      try {
        // Login on mobile
        await mobilePage.goto(`${baseUrl}/login`);
        await mobilePage.fill('[data-testid="email-input"]', testData.users.admin.email);
        await mobilePage.fill('[data-testid="password-input"]', 'admin123');
        await mobilePage.tap('[data-testid="login-button"]');
        await mobilePage.waitForURL(`${baseUrl}/dashboard`);

        // Navigate to compositions
        await mobilePage.goto(`${baseUrl}/packaging/compositions`);

        // Mobile layout should be responsive
        await expect(mobilePage.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
        
        // Create composition on mobile
        await mobilePage.tap('[data-testid="new-composition-button"]');
        
        // Dialog should be mobile-friendly
        await expect(mobilePage.locator('[data-testid="mobile-dialog"]')).toBeVisible();
        
        // Fill form using mobile interactions
        await mobilePage.fill('[data-testid="composition-name"]', 'Mobile Test Composition');
        
        // Add product using touch interactions
        await mobilePage.tap('[data-testid="add-product-button"]');
        await mobilePage.selectOption('[data-testid="product-select"]', { value: '1' });
        
        // Use mobile number input
        await mobilePage.fill('[data-testid="quantity-input"]', '5');
        await mobilePage.tap('[data-testid="confirm-add-product"]');

        // Validate composition
        await mobilePage.tap('[data-testid="validate-composition-button"]');
        await expect(mobilePage.locator('[data-testid="validation-results"]')).toBeVisible();

        // Save composition
        await mobilePage.tap('[data-testid="save-composition-button"]');
        await expect(mobilePage.locator('[data-testid="mobile-success-toast"]')).toBeVisible();

      } finally {
        await mobileContext.close();
      }
    });
  });

  test.describe('Accessibility Workflow', () => {
    test('should be fully accessible with screen readers and keyboard navigation', async () => {
      const { page, baseUrl } = context;

      await page.goto(`${baseUrl}/packaging/compositions`);

      // Test keyboard navigation
      await page.keyboard.press('Tab'); // Focus first element
      await page.keyboard.press('Tab'); // Focus new composition button
      await page.keyboard.press('Enter'); // Activate button

      // Dialog should open and focus should move to it
      await expect(page.locator('[data-testid="composition-dialog"]')).toBeVisible();
      
      // Test form navigation with keyboard
      await page.keyboard.press('Tab'); // Focus composition name
      await page.keyboard.type('Accessibility Test Composition');
      
      await page.keyboard.press('Tab'); // Focus description
      await page.keyboard.type('Testing keyboard accessibility');
      
      // Test ARIA labels and roles
      const nameInput = page.locator('[data-testid="composition-name"]');
      await expect(nameInput).toHaveAttribute('aria-label', 'Nome da composição');
      
      const dialog = page.locator('[data-testid="composition-dialog"]');
      await expect(dialog).toHaveAttribute('role', 'dialog');
      await expect(dialog).toHaveAttribute('aria-labelledby');

      // Test screen reader announcements
      await page.click('[data-testid="add-product-button"]');
      await expect(page.locator('[aria-live="polite"]')).toContainText('Produto adicionado à lista');
      
      // Test error announcements
      await page.click('[data-testid="validate-composition-button"]'); // Should fail - no products
      await expect(page.locator('[aria-live="assertive"]')).toContainText('Erro: Nenhum produto na composição');
      
      // Test success announcements
      await page.selectOption('[data-testid="product-select"]', { value: '1' });
      await page.fill('[data-testid="quantity-input"]', '5');
      await page.click('[data-testid="confirm-add-product"]');
      await page.click('[data-testid="validate-composition-button"]');
      
      await expect(page.locator('[aria-live="polite"]')).toContainText('Composição validada com sucesso');
    });
  });
});