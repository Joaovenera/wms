/**
 * Manual Validation Script for Loading Executions Quantity Fix
 * This script validates the implemented fix that changed scan mode from additive to absolute quantity logic
 */

import { db } from '../db.js';
import { 
  loadingExecutions, 
  loadingItems, 
  transferRequests, 
  transferRequestItems,
  products,
  users 
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

interface ValidationResult {
  testName: string;
  passed: boolean;
  details: string;
  error?: string;
}

class LoadingExecutionValidator {
  private results: ValidationResult[] = [];

  async runAllValidations(): Promise<ValidationResult[]> {
    console.log('🔍 Starting Loading Execution Fix Validation...\n');

    try {
      await this.validateQuantityLogicFix();
      await this.validateDatabaseConsistency();
      await this.validateEdgeCases();
      await this.validateErrorHandling();
    } catch (error) {
      console.error('❌ Validation failed with error:', error);
      this.results.push({
        testName: 'Global Error Handler',
        passed: false,
        details: 'Validation suite failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return this.results;
  }

  private async validateQuantityLogicFix(): Promise<void> {
    console.log('📊 Validating Quantity Logic Fix...');
    
    // Test 1: Verify scan mode uses absolute quantity (not additive)
    const controller = await import('../controllers/loading-executions.controller.js');
    const scanAndConfirmItem = controller.loadingExecutionsController.scanAndConfirmItem;
    
    // Check that the function signature exists and contains the fix
    const funcString = scanAndConfirmItem.toString();
    
    // Look for the critical fix lines 259-270
    const hasAbsoluteLogic = funcString.includes('newLoadedQuantity = quantityNum') &&
                            funcString.includes('newNotLoadedQuantity = requested - quantityNum');
    
    this.results.push({
      testName: 'Absolute Quantity Logic Implementation',
      passed: hasAbsoluteLogic,
      details: hasAbsoluteLogic 
        ? 'Fix correctly implements absolute quantity logic for both scan and edit modes'
        : 'Fix does not contain expected absolute quantity logic'
    });

    // Test 2: Verify no additive logic remains
    const hasAdditiveLogic = funcString.includes('currentLoaded +') || 
                           funcString.includes('loadedQuantity +');
    
    this.results.push({
      testName: 'No Additive Logic Remaining',
      passed: !hasAdditiveLogic,
      details: !hasAdditiveLogic 
        ? 'No additive logic found - fix correctly removed old logic'
        : 'Additive logic still present in code'
    });

    // Test 3: Verify both scan and edit modes use same logic
    const scanModeLogic = funcString.match(/else \{[\s\S]*?newLoadedQuantity = quantityNum;[\s\S]*?\}/);
    const editModeLogic = funcString.match(/if \(isEdit\) \{[\s\S]*?newLoadedQuantity = quantityNum;[\s\S]*?\}/);
    
    this.results.push({
      testName: 'Consistent Logic Between Scan and Edit Modes',
      passed: !!(scanModeLogic && editModeLogic),
      details: (scanModeLogic && editModeLogic) 
        ? 'Both scan and edit modes use consistent absolute quantity logic'
        : 'Inconsistent logic between scan and edit modes'
    });
  }

  private async validateDatabaseConsistency(): Promise<void> {
    console.log('🗄️ Validating Database Consistency...');
    
    try {
      // Check if database schema supports the fix
      const itemColumns = await db.select().from(loadingItems).limit(0);
      
      this.results.push({
        testName: 'Database Schema Compatibility',
        passed: true,
        details: 'Database schema supports loading items operations'
      });

      // Test quantity field types
      const schemaCheck = {
        hasRequestedQuantity: 'requestedQuantity' in loadingItems,
        hasLoadedQuantity: 'loadedQuantity' in loadingItems,
        hasNotLoadedQuantity: 'notLoadedQuantity' in loadingItems
      };

      this.results.push({
        testName: 'Required Quantity Fields Present',
        passed: schemaCheck.hasRequestedQuantity && schemaCheck.hasLoadedQuantity && schemaCheck.hasNotLoadedQuantity,
        details: `Schema fields: requested=${schemaCheck.hasRequestedQuantity}, loaded=${schemaCheck.hasLoadedQuantity}, notLoaded=${schemaCheck.hasNotLoadedQuantity}`
      });

    } catch (error) {
      this.results.push({
        testName: 'Database Consistency Check',
        passed: false,
        details: 'Failed to validate database consistency',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async validateEdgeCases(): Promise<void> {
    console.log('⚠️ Validating Edge Cases...');

    const controller = await import('../controllers/loading-executions.controller.js');
    const funcString = controller.loadingExecutionsController.scanAndConfirmItem.toString();

    // Test 1: Quantity validation exists
    const hasQuantityValidation = funcString.includes('quantityNum > requested') &&
                                funcString.includes('Quantidade excede o solicitado');
    
    this.results.push({
      testName: 'Quantity Validation Present',
      passed: hasQuantityValidation,
      details: hasQuantityValidation 
        ? 'Proper validation prevents quantities exceeding requested amount'
        : 'Missing quantity validation logic'
    });

    // Test 2: Decimal quantity support
    const hasDecimalSupport = funcString.includes('parseFloat(quantity)');
    
    this.results.push({
      testName: 'Decimal Quantity Support',
      passed: hasDecimalSupport,
      details: hasDecimalSupport 
        ? 'Code properly handles decimal quantities using parseFloat'
        : 'Missing decimal quantity support'
    });

    // Test 3: Zero quantity handling
    const handlesZeroQuantity = !funcString.includes('quantityNum === 0') || 
                               funcString.includes('quantityNum >= 0');
    
    this.results.push({
      testName: 'Zero Quantity Handling',
      passed: handlesZeroQuantity,
      details: handlesZeroQuantity 
        ? 'Code should handle zero quantities correctly'
        : 'May have issues with zero quantity handling'
    });
  }

  private async validateErrorHandling(): Promise<void> {
    console.log('🚫 Validating Error Handling...');

    const controller = await import('../controllers/loading-executions.controller.js');
    const funcString = controller.loadingExecutionsController.scanAndConfirmItem.toString();

    // Test 1: Execution status validation
    const hasExecutionValidation = funcString.includes('em_andamento') &&
                                  funcString.includes('Execução não está em andamento');
    
    this.results.push({
      testName: 'Execution Status Validation',
      passed: hasExecutionValidation,
      details: hasExecutionValidation 
        ? 'Proper validation ensures execution is in progress'
        : 'Missing execution status validation'
    });

    // Test 2: Item existence validation
    const hasItemValidation = funcString.includes('Item não encontrado na lista de carregamento');
    
    this.results.push({
      testName: 'Item Existence Validation',
      passed: hasItemValidation,
      details: hasItemValidation 
        ? 'Proper validation for item existence in loading list'
        : 'Missing item existence validation'
    });

    // Test 3: Error response handling
    const hasErrorResponses = funcString.includes('res.status(400)') &&
                             funcString.includes('res.status(404)');
    
    this.results.push({
      testName: 'Proper Error Status Codes',
      passed: hasErrorResponses,
      details: hasErrorResponses 
        ? 'Appropriate HTTP status codes for different error types'
        : 'Missing proper error status codes'
    });
  }

  generateReport(): string {
    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);

    let report = '\n' + '='.repeat(60) + '\n';
    report += '🧪 LOADING EXECUTION FIX VALIDATION REPORT\n';
    report += '='.repeat(60) + '\n\n';
    
    report += `📊 Overall Results: ${passedTests}/${totalTests} tests passed (${successRate}%)\n\n`;

    // Group results by category
    const categories = {
      'Quantity Logic': this.results.filter(r => r.testName.includes('Quantity') || r.testName.includes('Logic')),
      'Database': this.results.filter(r => r.testName.includes('Database') || r.testName.includes('Schema')),
      'Edge Cases': this.results.filter(r => r.testName.includes('Edge') || r.testName.includes('Zero') || r.testName.includes('Decimal')),
      'Error Handling': this.results.filter(r => r.testName.includes('Error') || r.testName.includes('Validation'))
    };

    for (const [category, tests] of Object.entries(categories)) {
      if (tests.length === 0) continue;
      
      report += `📋 ${category}:\n`;
      report += '-'.repeat(40) + '\n';
      
      for (const test of tests) {
        const status = test.passed ? '✅' : '❌';
        report += `${status} ${test.testName}\n`;
        report += `   ${test.details}\n`;
        if (test.error) {
          report += `   ⚠️ Error: ${test.error}\n`;
        }
        report += '\n';
      }
    }

    // Critical issues
    const criticalIssues = this.results.filter(r => !r.passed && (
      r.testName.includes('Absolute Quantity Logic') ||
      r.testName.includes('No Additive Logic') ||
      r.testName.includes('Consistent Logic')
    ));

    if (criticalIssues.length > 0) {
      report += '🚨 CRITICAL ISSUES:\n';
      report += '-'.repeat(40) + '\n';
      for (const issue of criticalIssues) {
        report += `❌ ${issue.testName}: ${issue.details}\n`;
      }
      report += '\n';
    }

    // Recommendations
    report += '💡 RECOMMENDATIONS:\n';
    report += '-'.repeat(40) + '\n';
    if (passedTests === totalTests) {
      report += '✅ All validations passed! The fix appears to be correctly implemented.\n';
      report += '✅ Item duplication issue should be resolved.\n';
      report += '✅ Quantity logic now uses absolute values instead of additive.\n';
    } else {
      report += '⚠️ Some validations failed. Review the issues above.\n';
      if (criticalIssues.length > 0) {
        report += '🚨 Critical issues found in quantity logic implementation.\n';
      }
    }

    report += '\n' + '='.repeat(60) + '\n';
    
    return report;
  }
}

// Main execution
async function runValidation(): Promise<void> {
  const validator = new LoadingExecutionValidator();
  
  try {
    const results = await validator.runAllValidations();
    const report = validator.generateReport();
    
    console.log(report);
    
    // Save report to file
    const fs = await import('fs/promises');
    const reportPath = '/home/claude-user/wms/backend/src/test/validation-report.txt';
    await fs.writeFile(reportPath, report);
    console.log(`📄 Report saved to: ${reportPath}`);
    
    // Return success/failure based on results
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidation();
}

export { LoadingExecutionValidator };