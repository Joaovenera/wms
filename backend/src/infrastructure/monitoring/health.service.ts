/**
 * Health Monitoring Service
 * 
 * Comprehensive health checks for all system components:
 * - Database connectivity and performance
 * - Redis cache health
 * - System resources
 * - Application metrics
 */

import { checkDatabaseHealth, getDatabaseMetrics } from '../database/database.js';
import { cache } from '../cache/index.js';
import { logInfo, logError, logWarn } from '../../utils/logger.js';
import { appConfig } from '../../config/app.config.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: HealthCheck;
    cache: HealthCheck;
    memory: HealthCheck;
    disk: HealthCheck;
    application: HealthCheck;
  };
  metrics: SystemMetrics;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  details?: Record<string, any>;
  lastChecked: string;
}

export interface SystemMetrics {
  database: {
    connections: {
      total: number;
      idle: number;
      waiting: number;
    };
    latency: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    latency: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  process: {
    uptime: number;
    pid: number;
    cpuUsage: NodeJS.CpuUsage;
  };
}

export class HealthService {
  private startTime = Date.now();
  private lastHealthCheck: HealthStatus | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Start continuous health monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      this.stopMonitoring();
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logError('Health check error during monitoring', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, intervalMs);

    logInfo('Health monitoring started', {
      interval: `${intervalMs}ms`,
    });
  }

  /**
   * Stop continuous health monitoring
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      
      logInfo('Health monitoring stopped');
    }
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;

    logInfo('Starting health check');

    // Perform all health checks in parallel
    const [databaseCheck, cacheCheck, memoryCheck, diskCheck, applicationCheck] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkCache(),
      this.checkMemory(),
      this.checkDisk(),
      this.checkApplication(),
    ]);

    // Extract results with error handling
    const checks = {
      database: this.extractHealthCheck(databaseCheck, 'database'),
      cache: this.extractHealthCheck(cacheCheck, 'cache'),
      memory: this.extractHealthCheck(memoryCheck, 'memory'),
      disk: this.extractHealthCheck(diskCheck, 'disk'),
      application: this.extractHealthCheck(applicationCheck, 'application'),
    };

    // Collect metrics
    const metrics = await this.collectMetrics();

    // Determine overall status
    const overallStatus = this.determineOverallStatus(checks);

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp,
      uptime,
      version: appConfig.version,
      environment: appConfig.nodeEnv,
      checks,
      metrics,
    };

    this.lastHealthCheck = healthStatus;

    logInfo('Health check completed', {
      status: overallStatus,
      checks: Object.fromEntries(
        Object.entries(checks).map(([key, check]) => [key, check.status])
      ),
    });

    return healthStatus;
  }

  /**
   * Get last health check result
   */
  getLastHealthCheck(): HealthStatus | null {
    return this.lastHealthCheck;
  }

  /**
   * Get quick health status
   */
  async getQuickHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    timestamp: string;
  }> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;

    // Quick checks (without detailed metrics)
    try {
      await checkDatabaseHealth();
      await cache.healthCheck();
      
      return {
        status: 'healthy',
        uptime,
        timestamp,
      };
    } catch (error) {
      logError('Quick health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return {
        status: 'unhealthy',
        uptime,
        timestamp,
      };
    }
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      const health = await checkDatabaseHealth();
      const latency = Date.now() - start;

      return {
        status: health.status === 'healthy' ? 'healthy' : 'unhealthy',
        latency,
        details: health.poolStats,
        lastChecked: new Date().toISOString(),
        error: health.error,
      };
    } catch (error) {
      const latency = Date.now() - start;
      
      return {
        status: 'unhealthy',
        latency,
        error: error instanceof Error ? error.message : 'Unknown database error',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check cache health
   */
  private async checkCache(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      const health = await cache.healthCheck();
      const latency = Date.now() - start;

      return {
        status: health.status === 'healthy' ? 'healthy' : 'unhealthy',
        latency,
        lastChecked: new Date().toISOString(),
        error: health.error,
      };
    } catch (error) {
      const latency = Date.now() - start;
      
      return {
        status: 'unhealthy',
        latency,
        error: error instanceof Error ? error.message : 'Unknown cache error',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<HealthCheck> {
    try {
      const memUsage = process.memoryUsage();
      const total = memUsage.heapTotal;
      const used = memUsage.heapUsed;
      const percentage = (used / total) * 100;

      // Consider unhealthy if using more than 90% of heap
      const status = percentage > 90 ? 'unhealthy' : percentage > 75 ? 'degraded' : 'healthy';

      return {
        status,
        details: {
          heapUsed: used,
          heapTotal: total,
          percentage: Math.round(percentage * 100) / 100,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers,
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown memory error',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check disk usage (simplified for Docker/cloud environments)
   */
  private async checkDisk(): Promise<HealthCheck> {
    try {
      // In production, you might want to check actual disk usage
      // For now, just return healthy
      return {
        status: 'healthy',
        details: {
          note: 'Disk check not implemented for containerized environment',
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown disk error',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check application-specific health
   */
  private async checkApplication(): Promise<HealthCheck> {
    try {
      // Check if essential services are running
      const uptime = Date.now() - this.startTime;
      const pid = process.pid;

      return {
        status: 'healthy',
        details: {
          uptime,
          pid,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown application error',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Collect system metrics
   */
  private async collectMetrics(): Promise<SystemMetrics> {
    const [dbMetrics, cacheStats, memUsage, cpuUsage] = await Promise.allSettled([
      getDatabaseMetrics(),
      cache.getStats(),
      Promise.resolve(process.memoryUsage()),
      Promise.resolve(process.cpuUsage()),
    ]);

    const database = dbMetrics.status === 'fulfilled' ? dbMetrics.value : {
      connections: { total: 0, idle: 0, waiting: 0 },
      latency: 0,
    };

    const cacheData = cacheStats.status === 'fulfilled' ? cacheStats.value : {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      avgLatency: 0,
    };

    const memory = memUsage.status === 'fulfilled' ? memUsage.value : {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      arrayBuffers: 0,
      rss: 0,
    };

    const cpu = cpuUsage.status === 'fulfilled' ? cpuUsage.value : {
      user: 0,
      system: 0,
    };

    const hitRate = cacheData.hits + cacheData.misses > 0 
      ? (cacheData.hits / (cacheData.hits + cacheData.misses)) * 100 
      : 0;

    return {
      database: {
        connections: database.connections,
        latency: 0, // Will be set from health check
      },
      cache: {
        hits: cacheData.hits,
        misses: cacheData.misses,
        hitRate: Math.round(hitRate * 100) / 100,
        latency: cacheData.avgLatency,
      },
      memory: {
        used: memory.heapUsed,
        total: memory.heapTotal,
        percentage: Math.round((memory.heapUsed / memory.heapTotal) * 10000) / 100,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
      },
      process: {
        uptime: Date.now() - this.startTime,
        pid: process.pid,
        cpuUsage: cpu,
      },
    };
  }

  /**
   * Extract health check result from Promise.allSettled result
   */
  private extractHealthCheck(
    result: PromiseSettledResult<HealthCheck>,
    checkName: string
  ): HealthCheck {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      logError(`Health check failed: ${checkName}`, {
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      });

      return {
        status: 'unhealthy',
        error: result.reason instanceof Error ? result.reason.message : `Unknown ${checkName} error`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Determine overall system status based on individual checks
   */
  private determineOverallStatus(checks: HealthStatus['checks']): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(checks).map(check => check.status);
    
    if (statuses.some(status => status === 'unhealthy')) {
      return 'unhealthy';
    }
    
    if (statuses.some(status => status === 'degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Get service uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Reset monitoring (useful for testing)
   */
  reset(): void {
    this.stopMonitoring();
    this.startTime = Date.now();
    this.lastHealthCheck = null;
  }
}

// Export singleton instance
export const healthService = new HealthService();