import express from 'express';
import { isRedisConnected, getRedisStats, clearCache } from '../config/redis.js';
import { isPostgresConnected, getPostgresStats, checkDatabaseHealth } from '../config/postgres.js';
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

export default router;