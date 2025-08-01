import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '../../src/db/schema';
import { databaseConfig } from '../../src/config/database.config';

export class DatabaseTestHelper {
  private client: postgres.Sql | null = null;
  private db: ReturnType<typeof drizzle> | null = null;
  private testDatabaseUrl: string;

  constructor() {
    // Force load test environment with absolute path
    const { config } = require('dotenv');
    const path = require('path');
    const envPath = path.resolve(process.cwd(), '.env.test');
    config({ path: envPath });
    
    this.testDatabaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/wms_test';
    console.log('🔧 Using test database URL:', this.testDatabaseUrl.replace(/(:)[^:]*(@)/, '$1***$2'));
    console.log('🔧 Loaded .env.test from:', envPath);
  }

  async initialize(): Promise<void> {
    try {
      // Create connection to test database
      this.client = postgres(this.testDatabaseUrl, {
        max: 5, // Smaller pool for tests
        idle_timeout: 20,
        connect_timeout: 10,
        prepare: false, // Disable prepared statements in tests
      });

      // Initialize Drizzle with test database
      this.db = drizzle(this.client, { schema });

      // Run migrations on test database
      await this.runMigrations();

      console.log('✅ Test database initialized');
    } catch (error) {
      console.error('❌ Failed to initialize test database:', error);
      throw error;
    }
  }

  async runMigrations(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Skip migrations for now to test basic connectivity
      console.log('⚠️ Skipping migrations for test environment');
      // await migrate(this.db, { migrationsFolder: './drizzle' });
      console.log('✅ Test database setup complete (migrations skipped)');
    } catch (error) {
      console.error('❌ Test database migration failed:', error);
      throw error;
    }
  }

  async clearAllTables(): Promise<void> {
    if (!this.client) {
      throw new Error('Database client not initialized');
    }

    try {
      // Get all table names from the public schema
      const tables = await this.client`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE '__drizzle%'
      `;

      // Disable foreign key checks temporarily
      await this.client`SET session_replication_role = replica`;

      // Truncate all tables
      for (const table of tables) {
        await this.client`TRUNCATE TABLE ${this.client(table.tablename)} CASCADE`;
      }

      // Re-enable foreign key checks
      await this.client`SET session_replication_role = DEFAULT`;

      console.log(`🧹 Cleared ${tables.length} test tables`);
    } catch (error) {
      console.error('❌ Failed to clear test tables:', error);
      // Re-enable foreign key checks even if truncation failed
      if (this.client) {
        await this.client`SET session_replication_role = DEFAULT`;
      }
      throw error;
    }
  }

  async seedTestData(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Insert test users
      await this.db.insert(schema.users).values([
        {
          id: 'test-user-1',
          username: 'testuser1',
          email: 'test1@example.com',
          firstName: 'Test',
          lastName: 'User1',
          role: 'operator',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'test-user-2',
          username: 'testadmin',
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ]);

      // Insert test products
      await this.db.insert(schema.products).values([
        {
          id: 'test-product-1',
          code: 'TEST001',
          name: 'Test Product 1',
          description: 'A test product for testing',
          dimensions: { width: 10, height: 20, depth: 30 },
          weight: 1.5,
          category: 'electronics',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'test-product-2',
          code: 'TEST002',
          name: 'Test Product 2',
          description: 'Another test product',
          dimensions: { width: 15, height: 25, depth: 35 },
          weight: 2.0,
          category: 'furniture',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ]);

      console.log('✅ Test data seeded');
    } catch (error) {
      console.error('❌ Failed to seed test data:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.client) {
        await this.client.end();
        console.log('✅ Test database connection closed');
      }
    } catch (error) {
      console.error('❌ Failed to cleanup test database:', error);
    }
  }

  getDb() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  getClient() {
    if (!this.client) {
      throw new Error('Database client not initialized');
    }
    return this.client;
  }

  async executeRaw(query: string): Promise<any> {
    if (!this.client) {
      throw new Error('Database client not initialized');
    }
    return await this.client.unsafe(query);
  }

  async countRecords(tableName: string): Promise<number> {
    if (!this.client) {
      throw new Error('Database client not initialized');
    }
    
    const result = await this.client`
      SELECT COUNT(*) as count 
      FROM ${this.client(tableName)}
    `;
    
    return parseInt(result[0].count);
  }
}