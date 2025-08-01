#!/usr/bin/env node

/**
 * Master Performance Testing Script
 * Orchestrates all performance validation tasks
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PerformanceTestOrchestrator {
  constructor() {
    this.results = {
      validation: null,
      lighthouse: null,
      bundleAnalysis: null,
      unitTests: null
    };
    this.startTime = Date.now();
  }

  async runAll() {
    console.log('🚀 Starting Complete Performance Validation Suite');
    console.log('===============================================');
    
    try {
      // Run all tests in parallel for faster execution
      const [validation, lighthouse, bundle] = await Promise.allSettled([
        this.runPerformanceValidation(),
        this.runLighthouseAudit(),
        this.runBundleAnalysis()
      ]);

      // Run unit tests sequentially (they're faster and don't interfere)
      const unitTests = await this.runPerformanceUnitTests();

      // Store results
      this.results.validation = validation;
      this.results.lighthouse = lighthouse;
      this.results.bundleAnalysis = bundle;
      this.results.unitTests = unitTests;

      // Generate final report
      this.generateFinalReport();

    } catch (error) {
      console.error('❌ Performance test suite failed:', error);
      process.exit(1);
    }
  }

  async runPerformanceValidation() {
    console.log('\n📊 Running Performance Validation...');
    return this.runScript('performance-validation.js', ['full']);
  }

  async runLighthouseAudit() {
    console.log('\n🏆 Running Lighthouse Audit...');
    return this.runScript('lighthouse-audit.js', ['audit']);
  }

  async runBundleAnalysis() {
    console.log('\n📦 Running Bundle Analysis...');
    return this.runScript('bundle-analyzer.js', ['full']);
  }

  async runPerformanceUnitTests() {
    console.log('\n🧪 Running Performance Unit Tests...');
    return this.runCommand('npm', ['run', 'test:performance']);
  }

  async runScript(scriptName, args = []) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, scriptName);
      const child = spawn('node', [scriptPath, ...args], {
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data); // Show real-time output
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, stdout, stderr });
        } else {
          resolve({ success: false, stdout, stderr, code });
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  async runCommand(command, args = []) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, stdout, stderr });
        } else {
          resolve({ success: false, stdout, stderr, code });
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  generateFinalReport() {
    const duration = Date.now() - this.startTime;
    
    console.log('\n📋 PERFORMANCE VALIDATION SUMMARY');
    console.log('==================================');
    console.log(`⏱️  Total Duration: ${Math.round(duration / 1000)}s`);
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    
    // Check each test result
    const testResults = [
      { name: 'Performance Validation', result: this.results.validation },
      { name: 'Lighthouse Audit', result: this.results.lighthouse },
      { name: 'Bundle Analysis', result: this.results.bundleAnalysis },
      { name: 'Unit Tests', result: this.results.unitTests }
    ];

    let passedTests = 0;
    let totalTests = testResults.length;

    console.log('\n📊 Test Results:');
    for (const test of testResults) {
      const status = this.getTestStatus(test.result);
      const icon = status === 'PASSED' ? '✅' : status === 'WARNING' ? '⚠️' : '❌';
      console.log(`  ${icon} ${test.name}: ${status}`);
      
      if (status === 'PASSED') passedTests++;
    }

    // Overall score
    const overallScore = Math.round((passedTests / totalTests) * 100);
    console.log(`\n🎯 Overall Score: ${overallScore}%`);

    // Performance budgets summary
    this.generateBudgetSummary();

    // Recommendations
    this.generateRecommendations();

    // Save detailed report
    this.saveDetailedReport(overallScore, testResults, duration);

    // Exit with appropriate code
    if (overallScore >= 80) {
      console.log('\n✅ Performance validation completed successfully!');
      process.exit(0);
    } else if (overallScore >= 60) {
      console.log('\n⚠️  Performance validation completed with warnings.');
      process.exit(0); // Don't fail CI for warnings
    } else {
      console.log('\n❌ Performance validation failed.');
      process.exit(1);
    }
  }

  getTestStatus(result) {
    if (!result || result.status === 'rejected') {
      return 'FAILED';
    }

    const testResult = result.value || result;
    
    if (!testResult.success) {
      return 'FAILED';
    }

    // Check for warnings in output
    if (testResult.stdout && testResult.stdout.includes('⚠️')) {
      return 'WARNING';
    }

    return 'PASSED';
  }

  generateBudgetSummary() {
    console.log('\n💰 Performance Budget Status:');
    
    // Try to read budget results from files
    const resultsDir = path.join(__dirname, '../performance-results');
    const budgetFiles = [
      'baseline.json',
      'current.json',
      'comparison-report.json'
    ];

    for (const file of budgetFiles) {
      const filePath = path.join(resultsDir, file);
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (data.bundleSize) {
            console.log(`  📦 Bundle Size: ${data.bundleSize.totalSizeKB}KB / 1000KB`);
          }
          if (data.overallImprovement !== undefined) {
            const icon = data.overallImprovement >= 0 ? '✅' : '❌';
            console.log(`  ${icon} Performance Change: ${data.overallImprovement.toFixed(1)}%`);
          }
        } catch (error) {
          // Ignore parsing errors
        }
      }
    }
  }

  generateRecommendations() {
    console.log('\n💡 Performance Recommendations:');
    
    const recommendations = [];
    
    // Analyze test results for recommendations
    if (this.getTestStatus(this.results.validation) !== 'PASSED') {
      recommendations.push('Review performance validation results and optimize slow components');
    }
    
    if (this.getTestStatus(this.results.lighthouse) !== 'PASSED') {
      recommendations.push('Check Lighthouse audit for specific optimization opportunities');
    }
    
    if (this.getTestStatus(this.results.bundleAnalysis) !== 'PASSED') {
      recommendations.push('Analyze bundle size and consider code splitting or tree shaking');
    }

    if (recommendations.length === 0) {
      console.log('  ✅ All tests passed! No immediate recommendations.');
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }
  }

  saveDetailedReport(overallScore, testResults, duration) {
    const report = {
      timestamp: new Date().toISOString(),
      duration: duration,
      overallScore: overallScore,
      testResults: testResults.map(test => ({
        name: test.name,
        status: this.getTestStatus(test.result),
        success: test.result?.value?.success || false
      })),
      files: {
        performanceResults: 'performance-results/',
        lighthouseResults: 'lighthouse-results/',
        bundleAnalysis: 'bundle-analysis/'
      }
    };

    const reportPath = path.join(__dirname, '../performance-final-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Detailed report saved: ${reportPath}`);
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const orchestrator = new PerformanceTestOrchestrator();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'full':
    case undefined:
      await orchestrator.runAll();
      break;
    case 'validation':
      await orchestrator.runPerformanceValidation();
      break;
    case 'lighthouse':
      await orchestrator.runLighthouseAudit();
      break;
    case 'bundle':
      await orchestrator.runBundleAnalysis();
      break;
    case 'tests':
      await orchestrator.runPerformanceUnitTests();
      break;
    default:
      console.log(`
Usage: node run-performance-tests.js [command]

Commands:
  full        - Run complete performance validation suite (default)
  validation  - Run performance validation only
  lighthouse  - Run Lighthouse audit only
  bundle      - Run bundle analysis only
  tests       - Run performance unit tests only

Examples:
  node run-performance-tests.js
  node run-performance-tests.js full
  node run-performance-tests.js validation
      `);
  }
}