#!/usr/bin/env tsx

/**
 * Testing Setup Validation Script
 * Validates that all testing infrastructure is properly configured
 */

import { config } from 'dotenv';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

// Load test environment
config({ path: '.env.test' });

interface ValidationResult {
  category: string;
  test: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

const results: ValidationResult[] = [];

function addResult(category: string, test: string, status: 'pass' | 'fail' | 'warn', message: string) {
  results.push({ category, test, status, message });
}

async function validateFiles() {
  console.log('🔍 Validating test files...');
  
  const requiredFiles = [
    'jest.config.js',
    'tests/setup.ts',
    'tests/helpers/database-test-helper.ts',
    'tests/helpers/redis-test-helper.ts',
    'tests/helpers/api-test-helper.ts',
    'tests/helpers/mock-services.ts',
    'tests/helpers/create-test-db.ts',
    'tests/fixtures/test-data.ts',
    '.env.test.example',
    'tests/README.md'
  ];

  for (const file of requiredFiles) {
    const fullPath = join(process.cwd(), file);
    if (existsSync(fullPath)) {
      addResult('Files', file, 'pass', `File exists: ${file}`);
    } else {
      addResult('Files', file, 'fail', `Missing file: ${file}`);
    }
  }

  // Check test directories
  const testDirs = ['tests/unit', 'tests/integration', 'tests/helpers', 'tests/fixtures'];
  for (const dir of testDirs) {
    const fullPath = join(process.cwd(), dir);
    if (existsSync(fullPath)) {
      const files = readdirSync(fullPath);
      addResult('Directories', dir, 'pass', `Directory exists with ${files.length} files`);
    } else {
      addResult('Directories', dir, 'fail', `Missing directory: ${dir}`);
    }
  }
}

async function validateEnvironment() {
  console.log('🔍 Validating environment configuration...');
  
  const requiredEnvVars = [
    'NODE_ENV',
    'DATABASE_URL',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER'
  ];

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (value) {
      addResult('Environment', envVar, 'pass', `${envVar} is set`);
    } else {
      addResult('Environment', envVar, 'fail', `${envVar} is not set`);
    }
  }

  // Check optional environment variables
  const optionalEnvVars = ['REDIS_URL', 'REDIS_HOST'];
  for (const envVar of optionalEnvVars) {
    const value = process.env[envVar];
    if (value) {
      addResult('Environment', envVar, 'pass', `${envVar} is set (optional)`);
    } else {
      addResult('Environment', envVar, 'warn', `${envVar} is not set (optional)`);
    }
  }
}

async function validatePackageJson() {
  console.log('🔍 Validating package.json scripts...');
  
  try {
    const packageJson = require('../package.json');
    const requiredScripts = [
      'test',
      'test:watch',
      'test:coverage',
      'test:unit',
      'test:integration',
      'test:db',
      'test:setup',
      'test:ci'
    ];

    for (const script of requiredScripts) {
      if (packageJson.scripts[script]) {
        addResult('Scripts', script, 'pass', `Script '${script}' is defined`);
      } else {
        addResult('Scripts', script, 'fail', `Script '${script}' is missing`);
      }
    }

    // Check required dependencies
    const requiredDevDeps = [
      'jest',
      '@types/jest',
      'ts-jest',
      'supertest',
      '@types/supertest',
      'jest-environment-node'
    ];

    for (const dep of requiredDevDeps) {
      if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
        addResult('Dependencies', dep, 'pass', `Dependency '${dep}' is installed`);
      } else {
        addResult('Dependencies', dep, 'fail', `Dependency '${dep}' is missing`);
      }
    }

  } catch (error) {
    addResult('Package', 'package.json', 'fail', `Failed to read package.json: ${error.message}`);
  }
}

async function validateDatabaseConnection() {
  console.log('🔍 Validating database connection...');
  
  try {
    const { DatabaseTestHelper } = await import('./helpers/database-test-helper');
    const dbHelper = new DatabaseTestHelper();
    
    await dbHelper.initialize();
    addResult('Database', 'connection', 'pass', 'Database connection successful');
    
    await dbHelper.cleanup();
    addResult('Database', 'cleanup', 'pass', 'Database cleanup successful');
    
  } catch (error) {
    addResult('Database', 'connection', 'fail', `Database connection failed: ${error.message}`);
  }
}

async function validateRedisConnection() {
  console.log('🔍 Validating Redis connection...');
  
  try {
    const { RedisTestHelper } = await import('./helpers/redis-test-helper');
    const redisHelper = new RedisTestHelper();
    
    await redisHelper.initialize();
    const client = redisHelper.getClient();
    
    if (client) {
      addResult('Redis', 'connection', 'pass', 'Redis connection successful');
    } else {
      addResult('Redis', 'connection', 'warn', 'Redis not available (optional)');
    }
    
    await redisHelper.cleanup();
    
  } catch (error) {
    addResult('Redis', 'connection', 'warn', `Redis connection failed (optional): ${error.message}`);
  }
}

function printResults() {
  console.log('\n📊 Validation Results:');
  console.log('='.repeat(80));
  
  const categories = [...new Set(results.map(r => r.category))];
  
  for (const category of categories) {
    console.log(`\n📂 ${category}:`);
    const categoryResults = results.filter(r => r.category === category);
    
    for (const result of categoryResults) {
      const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
      console.log(`  ${icon} ${result.test}: ${result.message}`);
    }
  }
  
  // Summary
  const passed = results.filter(r => r.status === 'pass').length;
  const warnings = results.filter(r => r.status === 'warn').length;
  const failed = results.filter(r => r.status === 'fail').length;
  
  console.log('\n📈 Summary:');
  console.log('='.repeat(40));
  console.log(`✅ Passed: ${passed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Some critical validations failed. Please fix these issues before running tests.');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n⚠️  Some optional features have warnings. Tests should still run.');
  } else {
    console.log('\n🎉 All validations passed! Testing infrastructure is ready.');
  }
}

async function main() {
  console.log('🧪 WMS Backend Testing Setup Validation');
  console.log('=' .repeat(50));
  
  await validateFiles();
  await validateEnvironment();
  await validatePackageJson();
  await validateDatabaseConnection();
  await validateRedisConnection();
  
  printResults();
}

// Run validation if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
  });
}

export { main as validateTestingSetup };