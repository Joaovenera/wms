/**
 * Comprehensive Health Check System for WMS
 * Monitors all critical system components and composition system
 */

import { Request, Response } from 'express';
import postgres from 'postgres';
import Redis from 'ioredis';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    [key: string]: {
      status: 'healthy' | 'unhealthy' | 'degraded';
      responseTime?: number;
      error?: string;
      details?: any;
    };
  };
  performance: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu?: number;
  };
}

class HealthChecker {
  private sql: postgres.Sql | null = null;
  private redis: Redis | null = null;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.initializeConnections();
  }

  private initializeConnections() {
    try {
      // Initialize database connection
      if (process.env.DATABASE_URL) {
        this.sql = postgres(process.env.DATABASE_URL, {
          max: 1, // Single connection for health checks
          idle_timeout: 5,
          connect_timeout: 10,
        });
      }

      // Initialize Redis connection
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL as string, {
          enableReadyCheck: false,
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        } as any);
      }
    } catch (error) {
      console.error('Failed to initialize health check connections:', error);
    }
  }

  /**
   * Basic health check endpoint - fast response
   */
  async basicHealth(_req: Request, res: Response): Promise<void> {
    const result: Partial<HealthCheckResult> = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    res.status(200).json(result);
  }

  /**
   * Comprehensive health check - includes all dependencies
   */
  async comprehensiveHealth(_req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const checks: HealthCheckResult['checks'] = {};
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    // Check database connection
    const dbResult = await this.checkDatabase();
    checks.database = dbResult;
    if (dbResult.status === 'unhealthy') overallStatus = 'unhealthy';
    else if (dbResult.status === 'degraded' && overallStatus === 'healthy') overallStatus = 'degraded';

    // Check Redis connection
    const redisResult = await this.checkRedis();
    checks.redis = redisResult;
    if (redisResult.status === 'unhealthy') overallStatus = 'unhealthy';
    else if (redisResult.status === 'degraded' && overallStatus === 'healthy') overallStatus = 'degraded';

    // Check composition system
    const compositionResult = await this.checkCompositionSystem();
    checks.composition_system = compositionResult;
    if (compositionResult.status === 'unhealthy') overallStatus = 'unhealthy';
    else if (compositionResult.status === 'degraded' && overallStatus === 'healthy') overallStatus = 'degraded';

    // Check file system
    const fsResult = await this.checkFileSystem();
    checks.filesystem = fsResult;
    if (fsResult.status === 'unhealthy') overallStatus = 'unhealthy';

    // Check external dependencies
    const externalResult = await this.checkExternalDependencies();
    checks.external = externalResult;
    if (externalResult.status === 'degraded' && overallStatus === 'healthy') overallStatus = 'degraded';

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      performance: {
        uptime: Date.now() - this.startTime,
        memory: process.memoryUsage(),
      },
    };

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    res.status(statusCode).json(result);
  }

  /**
   * Readiness probe - indicates if the service is ready to receive traffic
   */
  async readinessProbe(_req: Request, res: Response): Promise<void> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const isReady = checks.every(check => check.status !== 'unhealthy');
    
    if (isReady) {
      res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
    } else {
      res.status(503).json({ 
        status: 'not_ready', 
        timestamp: new Date().toISOString(),
        failures: checks.filter(check => check.status === 'unhealthy'),
      });
    }
  }

  /**
   * Liveness probe - indicates if the service is alive
   */
  async livenessProbe(_req: Request, res: Response): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const memoryThreshold = 1024 * 1024 * 1024; // 1GB threshold

    if (memoryUsage.heapUsed > memoryThreshold) {
      res.status(503).json({ 
        status: 'unhealthy', 
        reason: 'memory_threshold_exceeded',
        memory: memoryUsage,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(200).json({ 
        status: 'alive', 
        uptime: Date.now() - this.startTime,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async checkDatabase(): Promise<HealthCheckResult['checks'][string]> {
    const startTime = Date.now();
    
    try {
      if (!this.sql) {
        return { status: 'unhealthy', error: 'Database connection not initialized' };
      }

      // Test basic connectivity
      await this.sql`SELECT 1 as test`;
      
      // Test composition system tables
      const compositionCheck = await this.sql`
        SELECT COUNT(*) as count FROM composition_definitions WHERE is_active = true
      `;
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime > 1000 ? 'degraded' : 'healthy',
        responseTime,
        details: {
          active_compositions: compositionCheck[0]?.count || 0,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  private async checkRedis(): Promise<HealthCheckResult['checks'][string]> {
    const startTime = Date.now();
    
    try {
      if (!this.redis) {
        return { status: 'unhealthy', error: 'Redis connection not initialized' };
      }

      // Test basic connectivity
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        throw new Error('Redis ping failed');
      }

      // Test cache operations
      const testKey = 'health_check_' + Date.now();
      await this.redis.setex(testKey, 5, 'test');
      const value = await this.redis.get(testKey);
      await this.redis.del(testKey);

      if (value !== 'test') {
        throw new Error('Redis cache test failed');
      }

      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime > 500 ? 'degraded' : 'healthy',
        responseTime,
        details: {
          connected: true,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown Redis error',
      };
    }
  }

  private async checkCompositionSystem(): Promise<HealthCheckResult['checks'][string]> {
    const startTime = Date.now();
    
    try {
      if (!this.sql) {
        return { status: 'unhealthy', error: 'Database connection required for composition system check' };
      }

      // Check composition tables exist and are accessible
      const tablesCheck = await this.sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('composition_definitions', 'composition_instances', 'composition_relationships')
      `;

      if (tablesCheck.length !== 3) {
        return {
          status: 'unhealthy',
          error: 'Composition system tables not found',
          details: { found_tables: tablesCheck.length, expected_tables: 3 },
        };
      }

      // Check system performance
      const performanceCheck = await this.sql`
        SELECT 
          COUNT(*) as total_definitions,
          SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_definitions
        FROM composition_definitions
      `;

      const instanceCheck = await this.sql`
        SELECT 
          COUNT(*) as total_instances,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_instances,
          COUNT(CASE WHEN status = 'error' THEN 1 END) as error_instances
        FROM composition_instances
      `;

      const responseTime = Date.now() - startTime;
      const errorRate = instanceCheck[0]?.error_instances / Math.max(instanceCheck[0]?.total_instances, 1) || 0;

      return {
        status: errorRate > 0.1 ? 'degraded' : 'healthy',
        responseTime,
        details: {
          definitions: {
            total: performanceCheck[0]?.total_definitions || 0,
            active: performanceCheck[0]?.active_definitions || 0,
          },
          instances: {
            total: instanceCheck[0]?.total_instances || 0,
            active: instanceCheck[0]?.active_instances || 0,
            errors: instanceCheck[0]?.error_instances || 0,
            error_rate: errorRate,
          },
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown composition system error',
      };
    }
  }

  private async checkFileSystem(): Promise<HealthCheckResult['checks'][string]> {
    const startTime = Date.now();
    
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Check critical directories
      const directories = ['./logs', './uploads', './temp'];
      const checks = await Promise.all(
        directories.map(async (dir) => {
          try {
            await fs.access(dir);
            return { path: dir, accessible: true };
          } catch {
            return { path: dir, accessible: false };
          }
        })
      );

      const inaccessibleDirs = checks.filter(check => !check.accessible);
      
      return {
        status: inaccessibleDirs.length > 0 ? 'degraded' : 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          directories: checks,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown filesystem error',
      };
    }
  }

  private async checkExternalDependencies(): Promise<HealthCheckResult['checks'][string]> {
    const startTime = Date.now();
    
    try {
      // Add checks for external services if any
      // For now, return healthy as we don't have external dependencies
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          external_services: 'none_configured',
        },
      };
    } catch (error) {
      return {
        status: 'degraded',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown external dependency error',
      };
    }
  }

  /**
   * Cleanup connections
   */
  async cleanup(): Promise<void> {
    try {
      if (this.sql) {
        await this.sql.end();
      }
      if (this.redis) {
        this.redis.disconnect();
      }
    } catch (error) {
      console.error('Error cleaning up health checker connections:', error);
    }
  }
}

export const healthChecker = new HealthChecker();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await healthChecker.cleanup();
});

process.on('SIGINT', async () => {
  await healthChecker.cleanup();
});