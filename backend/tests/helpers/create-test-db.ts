#!/usr/bin/env tsx

/**
 * Script to create test database
 * Run this before running tests to ensure test database exists
 */

import postgres from 'postgres';
import { config } from 'dotenv';

// Load test environment
config({ path: '.env.test' });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_NAME = process.env.DB_NAME || 'wms_test';

async function createTestDatabase() {
  let adminClient: postgres.Sql | null = null;
  
  try {
    console.log('🔧 Creating test database...');
    
    // Connect to PostgreSQL server (not specific database)
    adminClient = postgres({
      host: DB_HOST,
      port: DB_PORT,
      username: DB_USER,
      password: DB_PASSWORD,
      database: 'postgres', // Connect to default postgres database
      prepare: false,
    });

    // Check if test database exists
    const databases = await adminClient`
      SELECT datname FROM pg_catalog.pg_database 
      WHERE datname = ${DB_NAME}
    `;

    if (databases.length === 0) {
      // Create test database
      await adminClient.unsafe(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`✅ Test database '${DB_NAME}' created successfully`);
    } else {
      console.log(`✅ Test database '${DB_NAME}' already exists`);
    }

    // Connect to test database to ensure it's accessible
    const testClient = postgres({
      host: DB_HOST,
      port: DB_PORT,
      username: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      prepare: false,
    });

    // Test connection
    await testClient`SELECT 1`;
    console.log(`✅ Test database connection successful`);
    
    await testClient.end();

  } catch (error) {
    console.error('❌ Failed to create test database:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('role') && error.message.includes('does not exist')) {
        console.error('💡 Make sure PostgreSQL user exists and has CREATEDB privileges');
        console.error(`   Run: CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}' CREATEDB;`);
      } else if (error.message.includes('authentication failed')) {
        console.error('💡 Check your database credentials in .env.test');
      } else if (error.message.includes('connection refused')) {
        console.error('💡 Make sure PostgreSQL server is running');
      }
    }
    
    process.exit(1);
  } finally {
    if (adminClient) {
      await adminClient.end();
    }
  }
}

async function dropTestDatabase() {
  let adminClient: postgres.Sql | null = null;
  
  try {
    console.log('🗑️ Dropping test database...');
    
    adminClient = postgres({
      host: DB_HOST,
      port: DB_PORT,
      username: DB_USER,
      password: DB_PASSWORD,
      database: 'postgres',
      prepare: false,
    });

    // Terminate existing connections to test database
    await adminClient.unsafe(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid()
    `);

    // Drop test database if it exists
    await adminClient.unsafe(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
    console.log(`✅ Test database '${DB_NAME}' dropped successfully`);

  } catch (error) {
    console.error('❌ Failed to drop test database:', error);
    process.exit(1);
  } finally {
    if (adminClient) {
      await adminClient.end();
    }
  }
}

// Handle command line arguments
const command = process.argv[2];

async function main() {
  switch (command) {
    case 'drop':
      await dropTestDatabase();
      break;
    case 'recreate':
      await dropTestDatabase();
      await createTestDatabase();
      break;
    default:
      await createTestDatabase();
      break;
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}