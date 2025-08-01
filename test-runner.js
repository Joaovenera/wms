#!/usr/bin/env node

/**
 * Comprehensive Test Runner for WMS System
 * 
 * This script orchestrates running all tests across backend and frontend
 * with proper coordination, coverage reporting, and performance monitoring.
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for better terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Test configuration
const config = {
  backend: {
    path: './backend',
    testCommand: 'npm run test:unit',
    coverageCommand: 'npm run test:coverage',
    integrationCommand: 'npm run test:integration',
  },
  frontend: {
    path: './frontend',
    testCommand: 'npm run test:run',
    coverageCommand: 'npm run test:coverage',
    uiCommand: 'npm run test:ui',
  },
  coverageThreshold: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80,
  },
};

// Utility functions
const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const logSection = (title) => {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`${title}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
};

const logSubsection = (title) => {
  log(`\n${'-'.repeat(40)}`, 'blue');
  log(`${title}`, 'blue');
  log(`${'-'.repeat(40)}`, 'blue');
};

const runCommand = async (command, cwd, options = {}) => {
  return new Promise((resolve, reject) => {
    log(`Running: ${command}`, 'yellow');
    
    const child = spawn(command, [], {
      cwd,
      shell: true,
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });

    let stdout = '';
    let stderr = '';

    if (options.silent) {
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject({ stdout, stderr, code });
      }
    });

    child.on('error', (error) => {
      reject({ error, stdout, stderr });
    });
  });
};

const checkDependencies = async () => {
  logSection('🔍 CHECKING DEPENDENCIES');
  
  try {
    // Check Node.js version
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    log(`✅ Node.js: ${nodeVersion}`, 'green');

    // Check npm version
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    log(`✅ npm: ${npmVersion}`, 'green');

    // Check if backend dependencies are installed
    if (fs.existsSync(path.join(config.backend.path, 'node_modules'))) {
      log('✅ Backend dependencies installed', 'green');
    } else {
      log('⚠️  Backend dependencies missing, installing...', 'yellow');
      await runCommand('npm install', config.backend.path);
    }

    // Check if frontend dependencies are installed
    if (fs.existsSync(path.join(config.frontend.path, 'node_modules'))) {
      log('✅ Frontend dependencies installed', 'green');
    } else {
      log('⚠️  Frontend dependencies missing, installing...', 'yellow');
      await runCommand('npm install', config.frontend.path);
    }

    return true;
  } catch (error) {
    log('❌ Dependency check failed', 'red');
    console.error(error);
    return false;
  }
};

const runLinting = async () => {
  logSection('🧹 LINTING AND CODE QUALITY');
  
  const results = { backend: false, frontend: false };

  try {
    logSubsection('Backend Linting');
    await runCommand('npm run lint', config.backend.path);
    log('✅ Backend linting passed', 'green');
    results.backend = true;
  } catch (error) {
    log('❌ Backend linting failed', 'red');
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.log(error.stderr);
  }

  try {
    logSubsection('Frontend Linting');
    await runCommand('npm run lint', config.frontend.path);
    log('✅ Frontend linting passed', 'green');
    results.frontend = true;
  } catch (error) {
    log('❌ Frontend linting failed', 'red');
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.log(error.stderr);
  }

  return results;
};

const runTypeChecking = async () => {
  logSection('🔍 TYPE CHECKING');
  
  const results = { backend: false, frontend: false };

  try {
    logSubsection('Backend Type Checking');
    await runCommand('npm run check', config.backend.path);
    log('✅ Backend type checking passed', 'green');
    results.backend = true;
  } catch (error) {
    log('❌ Backend type checking failed', 'red');
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.log(error.stderr);
  }

  try {
    logSubsection('Frontend Type Checking');
    await runCommand('npm run check', config.frontend.path);
    log('✅ Frontend type checking passed', 'green');
    results.frontend = true;
  } catch (error) {
    log('❌ Frontend type checking failed', 'red');
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.log(error.stderr);
  }

  return results;
};

const runUnitTests = async (coverage = false) => {
  logSection(`🧪 UNIT TESTS ${coverage ? '(WITH COVERAGE)' : ''}`);
  
  const results = { 
    backend: { passed: false, coverage: null }, 
    frontend: { passed: false, coverage: null } 
  };

  try {
    logSubsection('Backend Unit Tests');
    const command = coverage ? config.backend.coverageCommand : config.backend.testCommand;
    const result = await runCommand(command, config.backend.path, { silent: coverage });
    
    log('✅ Backend unit tests passed', 'green');
    results.backend.passed = true;

    if (coverage) {
      // Parse coverage from output
      const coverageMatch = result.stdout.match(/All files\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)/);
      if (coverageMatch) {
        results.backend.coverage = {
          statements: parseFloat(coverageMatch[1]),
          branches: parseFloat(coverageMatch[2]),
          functions: parseFloat(coverageMatch[3]),
          lines: parseFloat(coverageMatch[4]),
        };
      }
    }
  } catch (error) {
    log('❌ Backend unit tests failed', 'red');
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.log(error.stderr);
  }

  try {
    logSubsection('Frontend Unit Tests');
    const command = coverage ? config.frontend.coverageCommand : config.frontend.testCommand;
    const result = await runCommand(command, config.frontend.path, { silent: coverage });
    
    log('✅ Frontend unit tests passed', 'green');
    results.frontend.passed = true;

    if (coverage) {
      // Parse coverage from Vitest output
      const coverageMatch = result.stdout.match(/All files\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)\s+\|\s+(\d+\.?\d*)/);
      if (coverageMatch) {
        results.frontend.coverage = {
          statements: parseFloat(coverageMatch[1]),
          branches: parseFloat(coverageMatch[2]),
          functions: parseFloat(coverageMatch[3]),
          lines: parseFloat(coverageMatch[4]),
        };
      }
    }
  } catch (error) {
    log('❌ Frontend unit tests failed', 'red');
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.log(error.stderr);
  }

  return results;
};

const runIntegrationTests = async () => {
  logSection('🔗 INTEGRATION TESTS');
  
  const results = { backend: false, frontend: false };

  try {
    logSubsection('Backend Integration Tests');
    await runCommand(config.backend.integrationCommand, config.backend.path);
    log('✅ Backend integration tests passed', 'green');
    results.backend = true;
  } catch (error) {
    log('❌ Backend integration tests failed', 'red');
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.log(error.stderr);
  }

  // Frontend integration tests (if any)
  log('ℹ️  Frontend integration tests not configured', 'yellow');

  return results;
};

const generateReport = (results) => {
  logSection('📊 TEST REPORT');
  
  const { linting, typeChecking, unitTests, integrationTests } = results;

  // Summary table
  log('\n📋 Test Summary:', 'bright');
  log('┌─────────────────────┬──────────┬──────────┐', 'cyan');
  log('│ Test Type           │ Backend  │ Frontend │', 'cyan');
  log('├─────────────────────┼──────────┼──────────┤', 'cyan');
  log(`│ Linting             │ ${linting?.backend ? '✅ Pass' : '❌ Fail'}  │ ${linting?.frontend ? '✅ Pass' : '❌ Fail'}  │`);
  log(`│ Type Checking       │ ${typeChecking?.backend ? '✅ Pass' : '❌ Fail'}  │ ${typeChecking?.frontend ? '✅ Pass' : '❌ Fail'}  │`);
  log(`│ Unit Tests          │ ${unitTests?.backend?.passed ? '✅ Pass' : '❌ Fail'}  │ ${unitTests?.frontend?.passed ? '✅ Pass' : '❌ Fail'}  │`);
  log(`│ Integration Tests   │ ${integrationTests?.backend ? '✅ Pass' : '❌ Fail'}  │ ${integrationTests?.frontend ? '✅ Pass' : '❌ Fail'}  │`);
  log('└─────────────────────┴──────────┴──────────┘', 'cyan');

  // Coverage report
  if (unitTests?.backend?.coverage || unitTests?.frontend?.coverage) {
    log('\n📈 Coverage Report:', 'bright');
    
    if (unitTests.backend?.coverage) {
      const { coverage } = unitTests.backend;
      log('\nBackend Coverage:', 'blue');
      log(`  Statements: ${coverage.statements}% ${coverage.statements >= config.coverageThreshold.statements ? '✅' : '❌'}`);
      log(`  Branches:   ${coverage.branches}% ${coverage.branches >= config.coverageThreshold.branches ? '✅' : '❌'}`);
      log(`  Functions:  ${coverage.functions}% ${coverage.functions >= config.coverageThreshold.functions ? '✅' : '❌'}`);
      log(`  Lines:      ${coverage.lines}% ${coverage.lines >= config.coverageThreshold.lines ? '✅' : '❌'}`);
    }

    if (unitTests.frontend?.coverage) {
      const { coverage } = unitTests.frontend;
      log('\nFrontend Coverage:', 'blue');
      log(`  Statements: ${coverage.statements}% ${coverage.statements >= config.coverageThreshold.statements ? '✅' : '❌'}`);
      log(`  Branches:   ${coverage.branches}% ${coverage.branches >= config.coverageThreshold.branches ? '✅' : '❌'}`);
      log(`  Functions:  ${coverage.functions}% ${coverage.functions >= config.coverageThreshold.functions ? '✅' : '❌'}`);
      log(`  Lines:      ${coverage.lines}% ${coverage.lines >= config.coverageThreshold.lines ? '✅' : '❌'}`);
    }
  }

  // Overall result
  const allPassed = 
    linting?.backend && linting?.frontend &&
    typeChecking?.backend && typeChecking?.frontend &&
    unitTests?.backend?.passed && unitTests?.frontend?.passed &&
    integrationTests?.backend;

  log('\n🎯 Overall Result:', 'bright');
  if (allPassed) {
    log('✅ ALL TESTS PASSED! 🎉', 'green');
  } else {
    log('❌ SOME TESTS FAILED', 'red');
  }

  return allPassed;
};

const main = async () => {
  const startTime = Date.now();
  
  log('🚀 Starting WMS Comprehensive Test Suite', 'bright');
  log(`Started at: ${new Date().toISOString()}`, 'cyan');

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const coverage = args.includes('--coverage');
    const skipLinting = args.includes('--skip-lint');
    const skipTypes = args.includes('--skip-types');
    const skipIntegration = args.includes('--skip-integration');
    const onlyUnit = args.includes('--unit-only');

    // Check dependencies
    const depsOk = await checkDependencies();
    if (!depsOk) {
      process.exit(1);
    }

    const results = {};

    // Run linting
    if (!skipLinting && !onlyUnit) {
      results.linting = await runLinting();
    }

    // Run type checking
    if (!skipTypes && !onlyUnit) {
      results.typeChecking = await runTypeChecking();
    }

    // Run unit tests
    results.unitTests = await runUnitTests(coverage);

    // Run integration tests
    if (!skipIntegration && !onlyUnit) {
      results.integrationTests = await runIntegrationTests();
    }

    // Generate report
    const allPassed = generateReport(results);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    log(`\n⏱️  Total execution time: ${duration}s`, 'cyan');
    log(`Finished at: ${new Date().toISOString()}`, 'cyan');

    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    log('💥 Test runner encountered an error:', 'red');
    console.error(error);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', () => {
  log('\n\n⚠️  Test runner interrupted by user', 'yellow');
  process.exit(130);
});

process.on('SIGTERM', () => {
  log('\n\n⚠️  Test runner terminated', 'yellow');
  process.exit(143);
});

// Run the test suite
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main, runUnitTests, runIntegrationTests };