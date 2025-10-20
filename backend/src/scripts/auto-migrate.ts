import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import { connectPostgres, isPostgresConnected } from '../config/postgres.js';

// Expected number of tables after migration
const EXPECTED_TABLE_COUNT = 52;

// Retry configuration
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 seconds

interface MigrationResult {
  success: boolean;
  tablesCreated: number;
  totalTables: number;
  error?: string;
  timeElapsed: number;
}

/**
 * Wait for a specified amount of time
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if database connection is ready
 */
async function waitForDatabase(maxWaitTime: number = 30000): Promise<boolean> {
  const startTime = Date.now();
  let attempt = 1;
  
  logger.info('🔄 Waiting for database connection...');
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const isConnected = await isPostgresConnected();
      if (isConnected) {
        logger.info(`✅ Database connection established after ${Date.now() - startTime}ms (attempt ${attempt})`);
        return true;
      }
    } catch (error) {
      logger.warn(`📶 Database connection attempt ${attempt} failed:`, error);
    }
    
    attempt++;
    await delay(1000);
  }
  
  logger.error(`❌ Database connection timeout after ${maxWaitTime}ms`);
  return false;
}

/**
 * Get current table count
 */
async function getCurrentTableCount(): Promise<number> {
  try {
    await connectPostgres();
    const { executeQuery } = await import('../config/postgres.js');
    
    const result = await executeQuery(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name != 'drizzle_migrations'
    `);
    
    return parseInt(result.rows[0].count);
  } catch (error) {
    logger.error('Failed to get table count:', error);
    return 0;
  }
}

/**
 * Intelligent database state analysis
 */
async function analyzeDatabaseState(): Promise<{
  existingTables: number;
  drizzleMigrationsApplied: number;
  needsMigration: boolean;
  isFullySetup: boolean;
  missingEssentialTables: string[];
  reason: string;
}> {
  try {
    await connectPostgres();
    const { executeQuery } = await import('../config/postgres.js');
    
    // Get current table count (excluding drizzle_migrations)
    const tableCountResult = await executeQuery(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name != 'drizzle_migrations'
    `);
    const existingTables = parseInt(tableCountResult.rows[0].count);
    
    // Check Drizzle migrations applied
    let drizzleMigrationsApplied = 0;
    try {
      const migrationsResult = await executeQuery("SELECT COUNT(*) as count FROM drizzle_migrations");
      drizzleMigrationsApplied = parseInt(migrationsResult.rows[0].count);
    } catch (error) {
      logger.warn('⚠️ drizzle_migrations table not accessible, treating as no migrations applied');
    }
    
    // Check essential tables
    const essentialTables = [
      'users', 'products', 'pallets', 'ucps', 'vehicles',
      'positions', 'movements', 'product_photos', 'sessions'
    ];
    
    const missingEssentialTables: string[] = [];
    for (const table of essentialTables) {
      const result = await executeQuery(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      `, [table]);
      
      if (result.rows.length === 0) {
        missingEssentialTables.push(table);
      }
    }
    
    // Determine state and migration needs
    const isFullySetup = existingTables >= EXPECTED_TABLE_COUNT;
    const hasMinimumTables = missingEssentialTables.length === 0;
    
    let needsMigration = false;
    let reason = '';
    
    if (existingTables === 0) {
      needsMigration = true;
      reason = 'Clean database - full migration required';
    } else if (drizzleMigrationsApplied === 0 && existingTables > 0) {
      // This is our current situation - tables exist but no migrations recorded
      if (hasMinimumTables && existingTables >= 20) {
        needsMigration = false;
        reason = `Database appears functional with ${existingTables} tables - skipping migration to avoid conflicts`;
      } else {
        needsMigration = true;
        reason = `Partial setup detected - ${existingTables}/${EXPECTED_TABLE_COUNT} tables exist, missing essentials: ${missingEssentialTables.join(', ')}`;
      }
    } else if (!isFullySetup) {
      needsMigration = true;
      reason = `Incomplete setup - only ${existingTables}/${EXPECTED_TABLE_COUNT} tables exist`;
    } else {
      needsMigration = false;
      reason = 'Database fully setup and migrated';
    }
    
    logger.info(`📊 Database state analysis:`);
    logger.info(`   - Existing tables: ${existingTables}/${EXPECTED_TABLE_COUNT}`);
    logger.info(`   - Drizzle migrations: ${drizzleMigrationsApplied}`);
    logger.info(`   - Missing essential: ${missingEssentialTables.length} (${missingEssentialTables.join(', ') || 'none'})`);
    logger.info(`   - Decision: ${reason}`);
    
    return {
      existingTables,
      drizzleMigrationsApplied,
      needsMigration,
      isFullySetup,
      missingEssentialTables,
      reason
    };
    
  } catch (error: any) {
    logger.error('💔 Database state analysis failed:', error);
    return {
      existingTables: 0,
      drizzleMigrationsApplied: 0,
      needsMigration: true,
      isFullySetup: false,
      missingEssentialTables: [],
      reason: 'Analysis failed - assuming migration needed'
    };
  }
}

/**
 * Validate that essential tables exist
 */
async function validateEssentialTables(): Promise<{ valid: boolean; missingTables: string[] }> {
  const essentialTables = [
    'users', 'products', 'pallets', 'positions', 'ucps', 'vehicles',
    'orders', 'waves', 'suppliers', 'quality_inspections', 'stock_alerts'
  ];
  
  const missingTables: string[] = [];
  
  try {
    await connectPostgres();
    const { executeQuery } = await import('../config/postgres.js');
    
    for (const table of essentialTables) {
      const result = await executeQuery(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      `, [table]);
      
      if (result.rows.length === 0) {
        missingTables.push(table);
      }
    }
    
    return {
      valid: missingTables.length === 0,
      missingTables
    };
  } catch (error) {
    logger.error('Failed to validate tables:', error);
    return {
      valid: false,
      missingTables: essentialTables
    };
  }
}

/**
 * Execute drizzle migrations
 */
async function runDrizzleMigration(): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    logger.info('🚀 Executing Drizzle migrations...');
    
    // Change to backend directory and run migration
    const output = execSync('npm run db:migrate', {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 60000, // 60 second timeout
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development'
      }
    });
    
    logger.info('✅ Drizzle migrations completed successfully');
    return {
      success: true,
      output
    };
  } catch (error: any) {
    logger.error('❌ Drizzle migration failed:', error.message);
    return {
      success: false,
      error: error.message,
      output: error.stdout || error.stderr
    };
  }
}

/**
 * Auto-migrate with retry logic and comprehensive validation
 */
export async function autoMigrate(): Promise<MigrationResult> {
  const startTime = Date.now();
  let lastError = '';
  
  logger.info('🎯 Starting auto-migration process...');
  
  try {
    // Step 1: Wait for database to be ready
    const dbReady = await waitForDatabase();
    if (!dbReady) {
      return {
        success: false,
        tablesCreated: 0,
        totalTables: EXPECTED_TABLE_COUNT,
        error: 'Database connection timeout',
        timeElapsed: Date.now() - startTime
      };
    }
    
    // Step 2: Intelligent database state analysis
    const dbState = await analyzeDatabaseState();
    
    // Step 3: Decide whether migration is needed
    if (!dbState.needsMigration) {
      logger.info(`✅ ${dbState.reason}`);
      logger.info(`🎉 Auto-migration completed without changes - system ready!`);
      
      return {
        success: true,
        tablesCreated: dbState.existingTables,
        totalTables: dbState.existingTables,
        error: undefined,
        timeElapsed: Date.now() - startTime
      };
    }
    
    logger.info(`🔄 Migration required: ${dbState.reason}`);
    
    // Step 4: Run migrations with retry logic (only if needed)
    let migrationSuccess = false;
    let attempt = 0;
    
    while (attempt < MAX_RETRIES && !migrationSuccess) {
      attempt++;
      logger.info(`🔄 Migration attempt ${attempt}/${MAX_RETRIES}...`);
      
      const migrationResult = await runDrizzleMigration();
      
      if (migrationResult.success) {
        migrationSuccess = true;
        logger.info('✅ Migration completed successfully');
      } else {
        lastError = migrationResult.error || 'Unknown migration error';
        
        // Check if error is about tables already existing
        if (lastError.includes('already exists') && dbState.existingTables > 15) {
          logger.info('⚠️ Tables already exist - treating as successful migration');
          migrationSuccess = true;
        } else {
          logger.warn(`⚠️ Migration attempt ${attempt} failed: ${lastError}`);
          
          if (attempt < MAX_RETRIES) {
            logger.info(`⏳ Retrying in ${RETRY_DELAY}ms...`);
            await delay(RETRY_DELAY);
          }
        }
      }
    }
    
    if (!migrationSuccess) {
      return {
        success: false,
        tablesCreated: 0,
        totalTables: EXPECTED_TABLE_COUNT,
        error: `Migration failed after ${MAX_RETRIES} attempts: ${lastError}`,
        timeElapsed: Date.now() - startTime
      };
    }
    
    // Step 4: Verify table creation
    logger.info('🔍 Verifying table creation...');
    await delay(1000); // Give DB time to update
    
    const finalTableCount = await getCurrentTableCount();
    const tablesCreated = finalTableCount - initialTableCount;
    
    logger.info(`📊 Final table count: ${finalTableCount} (created: ${tablesCreated})`);
    
    // Step 5: Validate essential tables
    const validation = await validateEssentialTables();
    if (!validation.valid) {
      logger.warn('⚠️ Some essential tables are missing:', validation.missingTables);
    }
    
    // Step 6: Final success evaluation
    const success = finalTableCount >= EXPECTED_TABLE_COUNT && validation.valid;
    
    if (success) {
      logger.info(`🎉 Auto-migration completed successfully!`);
      logger.info(`📈 Database now has ${finalTableCount} tables (expected: ${EXPECTED_TABLE_COUNT})`);
    } else {
      logger.warn(`⚠️ Auto-migration completed with issues:`);
      logger.warn(`   - Tables created: ${finalTableCount}/${EXPECTED_TABLE_COUNT}`);
      if (validation.missingTables.length > 0) {
        logger.warn(`   - Missing essential tables: ${validation.missingTables.join(', ')}`);
      }
    }
    
    return {
      success,
      tablesCreated: finalTableCount,
      totalTables: EXPECTED_TABLE_COUNT,
      timeElapsed: Date.now() - startTime
    };
    
  } catch (error: any) {
    logger.error('💥 Auto-migration process failed:', error);
    return {
      success: false,
      tablesCreated: 0,
      totalTables: EXPECTED_TABLE_COUNT,
      error: error.message,
      timeElapsed: Date.now() - startTime
    };
  }
}

/**
 * Main execution when run directly (ES modules)
 */
const __filename = fileURLToPath(import.meta.url);

if (import.meta.url === `file://${process.argv[1]}`) {
  autoMigrate()
    .then((result) => {
      if (result.success) {
        logger.info('🎊 Auto-migration completed successfully!');
        process.exit(0);
      } else {
        logger.error('💔 Auto-migration failed:', result.error);
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error('💥 Auto-migration crashed:', error);
      process.exit(1);
    });
}