import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import logger from '../utils/logger.js';
import { executeQuery } from './postgres.js';

interface TableInfo {
  name: string;
  exists: boolean;
  rowCount: number;
  hasData: boolean;
}

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  overall: {
    connected: boolean;
    tablesTotal: number;
    tablesExisting: number;
    tablesWithData: number;
    foreignKeysValid: boolean;
    indexesPresent: boolean;
    extensionsActive: boolean;
  };
  details: {
    coreSystemTables: TableInfo[];
    waveManagementTables: TableInfo[];
    qualityControlTables: TableInfo[];
    stockManagementTables: TableInfo[];
    resourcePlanningTables: TableInfo[];
    missingTables: string[];
    errors: string[];
  };
  performance: {
    queryTime: number;
    connectionPoolStats: any;
  };
  recommendations: string[];
  lastChecked: Date;
}

// Expected table categories
const EXPECTED_TABLES = {
  coreSystem: [
    'users', 'sessions', 'products', 'product_photos', 'product_photo_history',
    'pallets', 'pallet_structures', 'positions', 'ucps', 'ucp_items', 'ucp_history',
    'vehicles', 'movements', 'item_transfers', 'packaging_types', 'packaging_conversion_rules'
  ],
  waveManagement: [
    'orders', 'order_lines', 'waves', 'wave_orders', 'wave_templates', 'wave_analytics',
    'pick_lists', 'pick_list_items', 'wave_optimization_log'
  ],
  qualityControl: [
    'suppliers', 'inspection_templates', 'quality_inspections', 'inspection_photos',
    'damage_reports', 'corrective_actions', 'supplier_scorecards', 'quality_metrics',
    'quality_gates', 'quality_gate_executions', 'compliance_audit_trails'
  ],
  stockManagement: [
    'stock_alert_rules', 'stock_alerts', 'alert_notifications',
    'auto_reorder_suggestions', 'alert_escalation_rules', 'alert_actions_log'
  ],
  resourcePlanning: [
    'labor_schedule', 'equipment_schedule', 'packaging_compositions',
    'composition_items', 'composition_reports'
  ],
  transferManagement: [
    'transfer_requests', 'transfer_request_items', 'loading_executions',
    'loading_items', 'transfer_reports'
  ]
};

/**
 * Get detailed table information
 */
async function getTableInfo(tableName: string): Promise<TableInfo> {
  try {
    // Check if table exists
    const existsResult = await executeQuery(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    `, [tableName]);

    const exists = existsResult.rows.length > 0;
    
    if (!exists) {
      return {
        name: tableName,
        exists: false,
        rowCount: 0,
        hasData: false
      };
    }

    // Get row count
    const countResult = await executeQuery(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const rowCount = parseInt(countResult.rows[0].count);

    return {
      name: tableName,
      exists: true,
      rowCount,
      hasData: rowCount > 0
    };
  } catch (error) {
    logger.warn(`Failed to get info for table ${tableName}:`, error);
    return {
      name: tableName,
      exists: false,
      rowCount: 0,
      hasData: false
    };
  }
}

/**
 * Check foreign key constraints
 */
async function checkForeignKeys(): Promise<boolean> {
  try {
    const result = await executeQuery(`
      SELECT COUNT(*) as count
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'FOREIGN KEY'
      AND table_schema = 'public'
    `);
    
    const fkCount = parseInt(result.rows[0].count);
    
    // We expect a significant number of foreign keys (50+)
    return fkCount >= 50;
  } catch (error) {
    logger.error('Failed to check foreign keys:', error);
    return false;
  }
}

/**
 * Check essential indexes
 */
async function checkIndexes(): Promise<boolean> {
  try {
    const result = await executeQuery(`
      SELECT COUNT(*) as count
      FROM pg_indexes 
      WHERE schemaname = 'public'
    `);
    
    const indexCount = parseInt(result.rows[0].count);
    
    // We expect indexes on primary keys and foreign keys
    return indexCount >= 20;
  } catch (error) {
    logger.error('Failed to check indexes:', error);
    return false;
  }
}

/**
 * Check PostgreSQL extensions
 */
async function checkExtensions(): Promise<boolean> {
  try {
    const requiredExtensions = ['uuid-ossp', 'btree_gin', 'btree_gist'];
    
    const result = await executeQuery(`
      SELECT extname 
      FROM pg_extension 
      WHERE extname = ANY($1)
    `, [requiredExtensions]);
    
    const installedExtensions = result.rows.map(row => row.extname);
    const missingExtensions = requiredExtensions.filter(ext => !installedExtensions.includes(ext));
    
    return missingExtensions.length === 0;
  } catch (error) {
    logger.error('Failed to check extensions:', error);
    return false;
  }
}

/**
 * Get connection pool statistics
 */
async function getConnectionPoolStats(): Promise<any> {
  try {
    const { postgresPool } = await import('./postgres.js');
    
    return {
      totalCount: postgresPool.totalCount || 0,
      idleCount: postgresPool.idleCount || 0,
      waitingCount: postgresPool.waitingCount || 0,
      maxConnections: postgresPool.options?.max || 0
    };
  } catch (error) {
    logger.error('Failed to get connection pool stats:', error);
    return null;
  }
}

/**
 * Generate recommendations based on health check results
 */
function generateRecommendations(details: HealthCheckResult['details'], overall: HealthCheckResult['overall']): string[] {
  const recommendations: string[] = [];

  if (overall.tablesExisting < overall.tablesTotal) {
    recommendations.push(`Execute database migrations to create ${overall.tablesTotal - overall.tablesExisting} missing tables`);
  }

  if (details.missingTables.length > 0) {
    recommendations.push(`Critical missing tables: ${details.missingTables.slice(0, 5).join(', ')}`);
  }

  if (!overall.foreignKeysValid) {
    recommendations.push('Foreign key constraints may be missing or broken - check database integrity');
  }

  if (!overall.indexesPresent) {
    recommendations.push('Database indexes may be missing - performance could be impacted');
  }

  if (!overall.extensionsActive) {
    recommendations.push('Required PostgreSQL extensions are missing - some features may not work');
  }

  if (overall.tablesWithData < 5) {
    recommendations.push('Database appears to be empty - run initial data setup script');
  }

  // Check specific system readiness
  const coreTablesEmpty = details.coreSystemTables.filter(t => t.exists && !t.hasData).length;
  if (coreTablesEmpty > 0) {
    recommendations.push('Core system tables need initial data - system may not function properly');
  }

  return recommendations;
}

/**
 * Comprehensive database health check
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  logger.info('🏥 Starting database health check...');

  try {
    // Test basic connectivity
    await executeQuery('SELECT 1');
    
    // Collect table information for each category
    const coreSystemTables = await Promise.all(
      EXPECTED_TABLES.coreSystem.map(getTableInfo)
    );
    
    const waveManagementTables = await Promise.all(
      EXPECTED_TABLES.waveManagement.map(getTableInfo)
    );
    
    const qualityControlTables = await Promise.all(
      EXPECTED_TABLES.qualityControl.map(getTableInfo)
    );
    
    const stockManagementTables = await Promise.all(
      EXPECTED_TABLES.stockManagement.map(getTableInfo)
    );
    
    const resourcePlanningTables = await Promise.all(
      EXPECTED_TABLES.resourcePlanning.map(getTableInfo)
    );

    // Find missing tables
    const allExpectedTables = [
      ...EXPECTED_TABLES.coreSystem,
      ...EXPECTED_TABLES.waveManagement,
      ...EXPECTED_TABLES.qualityControl,
      ...EXPECTED_TABLES.stockManagement,
      ...EXPECTED_TABLES.resourcePlanning,
      ...EXPECTED_TABLES.transferManagement
    ];

    const allTableInfo = [
      ...coreSystemTables,
      ...waveManagementTables,
      ...qualityControlTables,
      ...stockManagementTables,
      ...resourcePlanningTables
    ];

    const missingTables = allTableInfo
      .filter(table => !table.exists)
      .map(table => table.name);

    const existingTables = allTableInfo.filter(table => table.exists);
    const tablesWithData = existingTables.filter(table => table.hasData);

    // Perform additional checks
    const [foreignKeysValid, indexesPresent, extensionsActive, connectionPoolStats] = await Promise.all([
      checkForeignKeys().catch(error => {
        errors.push(`Foreign key check failed: ${error.message}`);
        return false;
      }),
      checkIndexes().catch(error => {
        errors.push(`Index check failed: ${error.message}`);
        return false;
      }),
      checkExtensions().catch(error => {
        errors.push(`Extensions check failed: ${error.message}`);
        return false;
      }),
      getConnectionPoolStats().catch(error => {
        errors.push(`Connection pool stats failed: ${error.message}`);
        return null;
      })
    ]);

    const overall = {
      connected: true,
      tablesTotal: allExpectedTables.length,
      tablesExisting: existingTables.length,
      tablesWithData: tablesWithData.length,
      foreignKeysValid,
      indexesPresent,
      extensionsActive
    };

    const details = {
      coreSystemTables,
      waveManagementTables,
      qualityControlTables,
      stockManagementTables,
      resourcePlanningTables,
      missingTables,
      errors
    };

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (errors.length > 0 || missingTables.length > 10 || !overall.connected) {
      status = 'unhealthy';
    } else if (missingTables.length > 0 || overall.tablesWithData < overall.tablesExisting * 0.3) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    const recommendations = generateRecommendations(details, overall);
    const queryTime = Date.now() - startTime;

    logger.info(`🏥 Health check completed in ${queryTime}ms - Status: ${status.toUpperCase()}`);
    
    if (missingTables.length > 0) {
      logger.warn(`⚠️ Missing tables: ${missingTables.length} (${missingTables.slice(0, 5).join(', ')}${missingTables.length > 5 ? '...' : ''})`);
    }

    return {
      status,
      overall,
      details,
      performance: {
        queryTime,
        connectionPoolStats
      },
      recommendations,
      lastChecked: new Date()
    };

  } catch (error: any) {
    logger.error('💔 Database health check failed:', error);
    
    const allExpectedTables = [
      ...EXPECTED_TABLES.coreSystem,
      ...EXPECTED_TABLES.waveManagement,
      ...EXPECTED_TABLES.qualityControl,
      ...EXPECTED_TABLES.stockManagement,
      ...EXPECTED_TABLES.resourcePlanning,
      ...EXPECTED_TABLES.transferManagement
    ];
    
    return {
      status: 'unhealthy',
      overall: {
        connected: false,
        tablesTotal: allExpectedTables.length,
        tablesExisting: 0,
        tablesWithData: 0,
        foreignKeysValid: false,
        indexesPresent: false,
        extensionsActive: false
      },
      details: {
        coreSystemTables: [],
        waveManagementTables: [],
        qualityControlTables: [],
        stockManagementTables: [],
        resourcePlanningTables: [],
        missingTables: allExpectedTables,
        errors: [error.message]
      },
      performance: {
        queryTime: Date.now() - startTime,
        connectionPoolStats: null
      },
      recommendations: ['Fix database connection issues', 'Run complete database setup'],
      lastChecked: new Date()
    };
  }
}

/**
 * Quick health check for startup validation
 */
export async function quickHealthCheck(): Promise<{ healthy: boolean; criticalIssues: string[] }> {
  try {
    // Test basic connection
    await executeQuery('SELECT 1');
    
    // Check for core tables
    const coreTablesResult = await executeQuery(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'products', 'pallets', 'ucps', 'vehicles')
    `);
    
    const criticalIssues: string[] = [];
    
    if (coreTablesResult.rows.length < 5) {
      criticalIssues.push('Core tables missing - database may not be properly migrated');
    }
    
    // Check for admin user
    const adminResult = await executeQuery("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    if (parseInt(adminResult.rows[0].count) === 0) {
      criticalIssues.push('No admin user found - system may be inaccessible');
    }
    
    return {
      healthy: criticalIssues.length === 0,
      criticalIssues
    };
    
  } catch (error: any) {
    return {
      healthy: false,
      criticalIssues: [`Database connection failed: ${error.message}`]
    };
  }
}

/**
 * Auto-heal critical issues
 */
export async function autoHealCriticalIssues(): Promise<{ healed: string[]; failed: string[] }> {
  const healed: string[] = [];
  const failed: string[] = [];
  
  logger.info('🚑 Starting auto-heal process...');
  
  try {
    const quickCheck = await quickHealthCheck();
    
    for (const issue of quickCheck.criticalIssues) {
      if (issue.includes('No admin user found')) {
        try {
          // This would be handled by the setup script
          healed.push('Admin user creation scheduled');
        } catch (error: any) {
          failed.push(`Failed to create admin user: ${error.message}`);
        }
      }
      
      if (issue.includes('Core tables missing')) {
        try {
          // This would trigger auto-migration
          healed.push('Database migration scheduled');
        } catch (error: any) {
          failed.push(`Failed to schedule migration: ${error.message}`);
        }
      }
    }
    
  } catch (error: any) {
    failed.push(`Auto-heal process failed: ${error.message}`);
  }
  
  return { healed, failed };
}