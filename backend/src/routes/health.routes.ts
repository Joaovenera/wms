import express from 'express';
import { isRedisConnected, getRedisStats, clearCache } from '../config/redis.js';
import { isPostgresConnected, getPostgresStats, checkDatabaseHealth } from '../config/postgres.js';
import { performHealthCheck, quickHealthCheck } from '../config/database-health.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Health check básico
router.get('/health', async (req, res) => {
  try {
    const [redisConnected, postgresConnected] = await Promise.all([
      Promise.resolve(isRedisConnected()),
      isPostgresConnected(),
    ]);

    const health = {
      status: redisConnected && postgresConnected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        redis: {
          connected: redisConnected,
          status: redisConnected ? 'healthy' : 'unhealthy',
        },
        postgres: {
          connected: postgresConnected,
          status: postgresConnected ? 'healthy' : 'unhealthy',
        },
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100,
      },
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// Health check detalhado
router.get('/health/detailed', async (req, res) => {
  try {
    const [redisStats, postgresStats, dbHealth] = await Promise.all([
      getRedisStats(),
      getPostgresStats(),
      checkDatabaseHealth(),
    ]);

    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        redis: {
          ...redisStats,
          status: redisStats?.connected ? 'healthy' : 'unhealthy',
        },
        postgres: {
          ...postgresStats,
          health: dbHealth,
          status: postgresStats?.connected ? 'healthy' : 'unhealthy',
        },
      },
      system: {
        uptime: process.uptime(),
        memory: {
          usage: process.memoryUsage(),
          formatted: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100 + ' MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100 + ' MB',
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100 + ' MB',
          },
        },
        process: {
          pid: process.pid,
          platform: process.platform,
          node_version: process.version,
        },
      },
    };

    // Determinar status geral
    const servicesHealthy = 
      detailedHealth.services.redis.status === 'healthy' &&
      detailedHealth.services.postgres.status === 'healthy' &&
      dbHealth.status === 'healthy';

    detailedHealth.status = servicesHealthy ? 'healthy' : 'degraded';

    const statusCode = detailedHealth.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(detailedHealth);
  } catch (error) {
    logger.error('Detailed health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Verificação específica do Redis
router.get('/health/redis', async (req, res) => {
  try {
    const redisStats = await getRedisStats();
    
    if (redisStats?.connected) {
      res.json({
        status: 'healthy',
        ...redisStats,
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        connected: false,
      });
    }
  } catch (error) {
    logger.error('Redis health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Redis health check failed',
    });
  }
});

// Verificação específica do PostgreSQL
router.get('/health/postgres', async (req, res) => {
  try {
    const [postgresStats, dbHealth] = await Promise.all([
      getPostgresStats(),
      checkDatabaseHealth(),
    ]);

    if (postgresStats?.connected) {
      res.json({
        status: 'healthy',
        stats: postgresStats,
        health: dbHealth,
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        connected: false,
        health: dbHealth,
      });
    }
  } catch (error) {
    logger.error('PostgreSQL health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'PostgreSQL health check failed',
    });
  }
});

// Endpoint para testar conectividade do banco
router.get('/health/database/test', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    if (dbHealth.status === 'healthy') {
      res.json({
        ...dbHealth,
        status: 'success',
        message: 'Database connection test successful',
      });
    } else {
      res.status(503).json({
        ...dbHealth,
        status: 'error',
        message: 'Database connection test failed',
      });
    }
  } catch (error) {
    logger.error('Database test error:', error);
    res.status(503).json({
      status: 'error',
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Endpoint to clear cache (temporary for debugging)
router.post('/health/cache/clear', async (req, res) => {
  try {
    await clearCache();
    res.json({
      status: 'success',
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    logger.error('Cache clear error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear cache'
    });
  }
});

// Comprehensive database health check endpoint
router.get('/health/database/comprehensive', async (req, res) => {
  try {
    const healthResult = await performHealthCheck();
    
    const statusCode = healthResult.status === 'healthy' ? 200 : 
                      healthResult.status === 'degraded' ? 206 : 503;
    
    res.status(statusCode).json({
      ...healthResult,
      endpoint: 'comprehensive',
      message: `Database health check completed - Status: ${healthResult.status.toUpperCase()}`
    });
  } catch (error) {
    logger.error('Comprehensive health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      endpoint: 'comprehensive',
      error: 'Comprehensive health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Quick database validation endpoint
router.get('/health/database/quick', async (req, res) => {
  try {
    const quickResult = await quickHealthCheck();
    
    if (quickResult.healthy) {
      res.json({
        status: 'healthy',
        endpoint: 'quick',
        message: 'Quick health check passed',
        issues: [],
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        endpoint: 'quick',
        message: 'Quick health check found issues',
        issues: quickResult.criticalIssues,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Quick health check error:', error);
    res.status(503).json({
      status: 'error',
      endpoint: 'quick',
      message: 'Quick health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Database readiness endpoint for container orchestration
router.get('/health/database/ready', async (req, res) => {
  try {
    const healthResult = await performHealthCheck();
    
    // More strict readiness criteria
    const isReady = healthResult.status === 'healthy' && 
                   healthResult.overall.tablesExisting >= 40 && // At least 40 tables
                   healthResult.overall.tablesWithData >= 5 &&   // At least 5 tables with data
                   healthResult.details.errors.length === 0;
    
    if (isReady) {
      res.json({
        status: 'ready',
        endpoint: 'readiness',
        message: 'Database is ready for operations',
        tablesCount: healthResult.overall.tablesExisting,
        tablesWithData: healthResult.overall.tablesWithData,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        endpoint: 'readiness',
        message: 'Database is not ready for operations',
        issues: healthResult.recommendations.slice(0, 3),
        tablesCount: healthResult.overall.tablesExisting,
        expectedTables: healthResult.overall.tablesTotal,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Database readiness check error:', error);
    res.status(503).json({
      status: 'error',
      endpoint: 'readiness',
      message: 'Database readiness check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Manual migration trigger endpoint (POST for safety)
router.post('/health/database/migrate', async (req, res) => {
  try {
    logger.info('🔄 Manual migration triggered via API...');
    
    // Import migration functions
    const { autoMigrate } = await import('../scripts/auto-migrate.js');
    const { setupCompleteDatabase } = await import('../scripts/setup-complete-database.js');
    
    // Run migration
    const migrationResult = await autoMigrate();
    if (!migrationResult.success) {
      return res.status(500).json({
        status: 'error',
        endpoint: 'migrate',
        message: 'Migration failed',
        error: migrationResult.error,
        timestamp: new Date().toISOString()
      });
    }
    
    // Run initial data setup
    const setupResult = await setupCompleteDatabase();
    const totalItems = Object.values(setupResult.itemsCreated).reduce((a, b) => a + b, 0);
    
    // Final health check
    const finalHealth = await quickHealthCheck();
    
    res.json({
      status: 'success',
      endpoint: 'migrate',
      message: 'Manual migration completed successfully',
      results: {
        migration: {
          tablesCreated: migrationResult.tablesCreated,
          timeElapsed: migrationResult.timeElapsed
        },
        setup: {
          itemsCreated: totalItems,
          timeElapsed: setupResult.timeElapsed,
          errors: setupResult.errors
        },
        finalHealth: {
          healthy: finalHealth.healthy,
          issues: finalHealth.criticalIssues
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Manual migration error:', error);
    res.status(500).json({
      status: 'error',
      endpoint: 'migrate',
      message: 'Manual migration failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Database statistics endpoint
router.get('/health/database/stats', async (req, res) => {
  try {
    const healthResult = await performHealthCheck();
    
    // Calculate statistics
    const stats = {
      tables: {
        total: healthResult.overall.tablesTotal,
        existing: healthResult.overall.tablesExisting,
        withData: healthResult.overall.tablesWithData,
        missing: healthResult.details.missingTables.length,
        completionPercentage: Math.round((healthResult.overall.tablesExisting / healthResult.overall.tablesTotal) * 100)
      },
      categories: {
        coreSystem: {
          total: healthResult.details.coreSystemTables.length,
          existing: healthResult.details.coreSystemTables.filter(t => t.exists).length,
          withData: healthResult.details.coreSystemTables.filter(t => t.hasData).length
        },
        waveManagement: {
          total: healthResult.details.waveManagementTables.length,
          existing: healthResult.details.waveManagementTables.filter(t => t.exists).length,
          withData: healthResult.details.waveManagementTables.filter(t => t.hasData).length
        },
        qualityControl: {
          total: healthResult.details.qualityControlTables.length,
          existing: healthResult.details.qualityControlTables.filter(t => t.exists).length,
          withData: healthResult.details.qualityControlTables.filter(t => t.hasData).length
        },
        stockManagement: {
          total: healthResult.details.stockManagementTables.length,
          existing: healthResult.details.stockManagementTables.filter(t => t.exists).length,
          withData: healthResult.details.stockManagementTables.filter(t => t.hasData).length
        },
        resourcePlanning: {
          total: healthResult.details.resourcePlanningTables.length,
          existing: healthResult.details.resourcePlanningTables.filter(t => t.exists).length,
          withData: healthResult.details.resourcePlanningTables.filter(t => t.hasData).length
        }
      },
      integrity: {
        foreignKeys: healthResult.overall.foreignKeysValid,
        indexes: healthResult.overall.indexesPresent,
        extensions: healthResult.overall.extensionsActive
      },
      performance: {
        queryTime: healthResult.performance.queryTime,
        connectionPool: healthResult.performance.connectionPoolStats
      }
    };
    
    res.json({
      status: healthResult.status,
      endpoint: 'stats',
      message: 'Database statistics retrieved successfully',
      statistics: stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Database statistics error:', error);
    res.status(500).json({
      status: 'error',
      endpoint: 'stats',
      message: 'Failed to retrieve database statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;