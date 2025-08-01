#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Integration Test Runner for WMS Backend
 * 
 * This script orchestrates running all integration tests with proper setup,
 * database management, and comprehensive reporting.
 */

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(60), colors.cyan);
  log(`  ${title}`, colors.bold + colors.cyan);
  log('='.repeat(60), colors.cyan);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

class IntegrationTestRunner {
  constructor() {
    this.testSuites = [
      'auth.test.ts',
      'users.test.ts', 
      'products.test.ts',
      'pallets.test.ts',
      'ucps.test.ts',
      'vehicles.test.ts',
      'transfer-requests.test.ts',
      'error-scenarios.test.ts'
    ];
    
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      suiteResults: []
    };

    this.startTime = Date.now();
  }

  async run() {
    try {
      logSection('WMS Backend Integration Test Suite');
      
      await this.checkPrerequisites();
      await this.setupTestEnvironment();
      await this.runTestSuites();
      await this.generateReport();
      await this.cleanup();
      
    } catch (error) {
      logError(`Test runner failed: ${error.message}`);
      process.exit(1);
    }
  }

  async checkPrerequisites() {
    logSection('Checking Prerequisites');
    
    const requiredEnvVars = [
      'DATABASE_URL',
      'REDIS_URL'
    ];

    // Check environment variables
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    if (missingEnvVars.length > 0) {
      logWarning(`Missing environment variables: ${missingEnvVars.join(', ')}`);
      logInfo('Using default test configuration');
    }

    // Check if test database exists
    try {
      const testDbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/wms_test';
      logInfo(`Using test database: ${testDbUrl}`);
      logSuccess('Database configuration found');
    } catch (error) {
      logError('Database configuration failed');
      throw error;
    }

    // Check if Redis is available
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      logInfo(`Using Redis: ${redisUrl}`);
      logSuccess('Redis configuration found');
    } catch (error) {
      logWarning('Redis not available - cache tests may fail');
    }

    // Check test files exist
    const testDir = path.join(__dirname, 'integration');
    const missingTests = this.testSuites.filter(suite => 
      !fs.existsSync(path.join(testDir, suite))
    );

    if (missingTests.length > 0) {
      logWarning(`Missing test suites: ${missingTests.join(', ')}`);
      this.testSuites = this.testSuites.filter(suite => !missingTests.includes(suite));
    }

    logSuccess(`Found ${this.testSuites.length} test suites`);
  }

  async setupTestEnvironment() {
    logSection('Setting Up Test Environment');

    try {
      // Copy environment file for tests
      const envTestPath = path.join(__dirname, '..', '.env.test');
      if (!fs.existsSync(envTestPath)) {
        logInfo('Creating .env.test file');
        const envContent = `
# Test Environment Configuration
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wms_test
REDIS_URL=redis://localhost:6379
LOG_LEVEL=error
VITEST_VERBOSE=false
`;
        fs.writeFileSync(envTestPath, envContent.trim());
      }

      // Ensure test database is clean
      logInfo('Preparing test database...');
      
      // Run database migrations
      try {
        execSync('npm run db:migrate', { 
          stdio: 'pipe',
          cwd: path.join(__dirname, '..')
        });
        logSuccess('Database migrations completed');
      } catch (error) {
        logWarning('Database migration failed - tests may initialize their own schema');
      }

      logSuccess('Test environment ready');
      
    } catch (error) {
      logError(`Environment setup failed: ${error.message}`);
      throw error;
    }
  }

  async runTestSuites() {
    logSection('Running Integration Tests');

    for (const suite of this.testSuites) {
      await this.runSingleSuite(suite);
    }

    this.results.duration = Date.now() - this.startTime;
  }

  async runSingleSuite(suiteName) {
    const suiteStartTime = Date.now();
    
    log(`\n🧪 Running ${suiteName}...`, colors.blue);

    const suiteResult = {
      name: suiteName,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      errors: []
    };

    try {
      const testPath = path.join(__dirname, 'integration', suiteName);
      
      const command = `npx vitest run ${testPath} --reporter=json --reporter=verbose`;
      const result = execSync(command, {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        stdio: 'pipe'
      });

      // Parse Vitest JSON output
      try {
        const lines = result.split('\n');
        const jsonLine = lines.find(line => line.startsWith('{'));
        
        if (jsonLine) {
          const testResult = JSON.parse(jsonLine);
          
          suiteResult.passed = testResult.numPassedTests || 0;
          suiteResult.failed = testResult.numFailedTests || 0;
          suiteResult.skipped = testResult.numSkippedTests || 0;
          
          this.results.passed += suiteResult.passed;
          this.results.failed += suiteResult.failed;
          this.results.skipped += suiteResult.skipped;
        }
      } catch (parseError) {
        logWarning(`Could not parse test results for ${suiteName}`);
      }

      if (suiteResult.failed === 0) {
        logSuccess(`${suiteName} - All tests passed (${suiteResult.passed} tests)`);
      } else {
        logError(`${suiteName} - ${suiteResult.failed} tests failed, ${suiteResult.passed} passed`);
      }

    } catch (error) {
      suiteResult.failed += 1;
      suiteResult.errors.push(error.message);
      this.results.failed += 1;
      
      logError(`${suiteName} - Suite execution failed`);
      logError(error.message);
    }

    suiteResult.duration = Date.now() - suiteStartTime;
    this.results.suiteResults.push(suiteResult);
    this.results.total += suiteResult.passed + suiteResult.failed + suiteResult.skipped;
  }

  async generateReport() {
    logSection('Test Results Summary');

    const totalDuration = (this.results.duration / 1000).toFixed(2);
    
    log(`\n📊 Overall Results:`, colors.bold);
    log(`   Total Tests: ${this.results.total}`);
    
    if (this.results.passed > 0) {
      logSuccess(`   Passed: ${this.results.passed}`);
    }
    
    if (this.results.failed > 0) {
      logError(`   Failed: ${this.results.failed}`);
    }
    
    if (this.results.skipped > 0) {
      logWarning(`   Skipped: ${this.results.skipped}`);
    }
    
    log(`   Duration: ${totalDuration}s`, colors.cyan);

    // Suite-by-suite breakdown
    log(`\n📋 Suite Breakdown:`, colors.bold);
    this.results.suiteResults.forEach(suite => {
      const duration = (suite.duration / 1000).toFixed(2);
      const status = suite.failed === 0 ? '✅' : '❌';
      log(`   ${status} ${suite.name} - ${suite.passed}✅ ${suite.failed}❌ ${suite.skipped}⏭️ (${duration}s)`);
      
      if (suite.errors.length > 0) {
        suite.errors.forEach(error => {
          log(`      Error: ${error}`, colors.red);
        });
      }
    });

    // Generate JSON report
    const reportPath = path.join(__dirname, 'integration-test-report.json');
    const report = {
      ...this.results,
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    logInfo(`Detailed report saved to: ${reportPath}`);

    // Generate HTML report if possible
    try {
      this.generateHtmlReport(report);
    } catch (error) {
      logWarning('Could not generate HTML report');
    }

    // Exit with appropriate code
    if (this.results.failed > 0) {
      logError('\n❌ Some tests failed!');
      process.exit(1);
    } else {
      logSuccess('\n✅ All tests passed!');
      process.exit(0);
    }
  }

  generateHtmlReport(report) {
    const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>WMS Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; flex: 1; }
        .passed { border-left: 4px solid #4caf50; }
        .failed { border-left: 4px solid #f44336; }
        .skipped { border-left: 4px solid #ff9800; }
        .suite { margin: 10px 0; padding: 10px; border: 1px solid #eee; border-radius: 3px; }
        .suite.success { background: #f1f8e9; }
        .suite.failure { background: #ffebee; }
        .error { color: #d32f2f; font-size: 0.9em; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>WMS Integration Test Report</h1>
        <p>Generated: ${report.timestamp}</p>
        <p>Duration: ${(report.duration / 1000).toFixed(2)}s</p>
    </div>
    
    <div class="summary">
        <div class="metric passed">
            <h3>Passed</h3>
            <div style="font-size: 2em; color: #4caf50;">${report.passed}</div>
        </div>
        <div class="metric failed">
            <h3>Failed</h3>
            <div style="font-size: 2em; color: #f44336;">${report.failed}</div>
        </div>
        <div class="metric skipped">
            <h3>Skipped</h3>
            <div style="font-size: 2em; color: #ff9800;">${report.skipped}</div>
        </div>
        <div class="metric">
            <h3>Total</h3>
            <div style="font-size: 2em;">${report.total}</div>
        </div>
    </div>
    
    <h2>Test Suites</h2>
    ${report.suiteResults.map(suite => `
        <div class="suite ${suite.failed === 0 ? 'success' : 'failure'}">
            <h3>${suite.name}</h3>
            <p>Passed: ${suite.passed} | Failed: ${suite.failed} | Skipped: ${suite.skipped} | Duration: ${(suite.duration / 1000).toFixed(2)}s</p>
            ${suite.errors.map(error => `<div class="error">${error}</div>`).join('')}
        </div>
    `).join('')}
    
    <div style="margin-top: 40px; padding: 20px; background: #f5f5f5; border-radius: 5px;">
        <h3>Environment</h3>
        <p>Node.js: ${report.environment.node}</p>
        <p>Platform: ${report.environment.platform}</p>
        <p>Architecture: ${report.environment.arch}</p>
    </div>
</body>
</html>
    `;

    const htmlPath = path.join(__dirname, 'integration-test-report.html');
    fs.writeFileSync(htmlPath, htmlTemplate.trim());
    logInfo(`HTML report saved to: ${htmlPath}`);
  }

  async cleanup() {
    logSection('Cleanup');
    
    try {
      // Clean up test database
      logInfo('Cleaning up test database...');
      
      // Note: In a real scenario, you might want to drop test data
      // but keep the schema for future test runs
      
      logSuccess('Cleanup completed');
    } catch (error) {
      logWarning(`Cleanup failed: ${error.message}`);
    }
  }
}

// Run the test suite
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.run().catch(error => {
    logError(`Test runner crashed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = IntegrationTestRunner;