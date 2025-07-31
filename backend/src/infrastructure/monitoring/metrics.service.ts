/**
 * Metrics Collection Service
 * 
 * Collects and aggregates application metrics:
 * - Performance metrics
 * - Business metrics
 * - Error tracking
 * - Request analytics
 */

import { logInfo, logError } from '../../utils/logger.js';
import { cache } from '../cache/index.js';

export interface RequestMetrics {
  method: string;
  route: string;
  statusCode: number;
  responseTime: number;
  timestamp: string;
  userAgent?: string;
  ip?: string;
  userId?: number;
}

export interface ErrorMetrics {
  error: string;
  stack?: string;
  route?: string;
  method?: string;
  userId?: number;
  timestamp: string;
  count: number;
}

export interface BusinessMetrics {
  palletsCreated: number;
  palletsMovedToday: number;
  ucpsCreated: number;
  itemTransfers: number;
  productsAdded: number;
  activeUsers: number;
  timestamp: string;
}

export interface PerformanceMetrics {
  avgResponseTime: number;
  requestsPerMinute: number;
  errorRate: number;
  databaseLatency: number;
  cacheHitRate: number;
  memoryUsage: number;
  timestamp: string;
}

export interface AggregatedMetrics {
  performance: PerformanceMetrics;
  business: BusinessMetrics;
  errors: ErrorMetrics[];
  requests: {
    total: number;
    byStatus: Record<string, number>;
    byRoute: Record<string, number>;
    byMethod: Record<string, number>;
  };
  timeWindow: {
    start: string;
    end: string;
    durationMs: number;
  };
}

export class MetricsService {
  private requestMetrics: RequestMetrics[] = [];
  private errorMetrics: Map<string, ErrorMetrics> = new Map();
  private businessMetrics: BusinessMetrics | null = null;
  private metricsStartTime = Date.now();

  /**
   * Record a request metric
   */
  recordRequest(metrics: RequestMetrics): void {
    this.requestMetrics.push(metrics);
    
    // Keep only last 1000 requests in memory
    if (this.requestMetrics.length > 1000) {
      this.requestMetrics = this.requestMetrics.slice(-1000);
    }

    // Cache recent metrics for quick access
    this.cacheRecentMetrics();
  }

  /**
   * Record an error metric
   */
  recordError(error: Omit<ErrorMetrics, 'count' | 'timestamp'>): void {
    const errorKey = `${error.error}-${error.route || 'unknown'}-${error.method || 'unknown'}`;
    const existing = this.errorMetrics.get(errorKey);
    
    if (existing) {
      existing.count++;
      existing.timestamp = new Date().toISOString();
    } else {
      this.errorMetrics.set(errorKey, {
        ...error,
        count: 1,
        timestamp: new Date().toISOString(),
      });
    }

    logError('Error metric recorded', {
      error: error.error,
      route: error.route,
      method: error.method,
      userId: error.userId,
    });
  }

  /**
   * Update business metrics
   */
  updateBusinessMetrics(metrics: Partial<BusinessMetrics>): void {
    const timestamp = new Date().toISOString();
    
    this.businessMetrics = {
      palletsCreated: 0,
      palletsMovedToday: 0,
      ucpsCreated: 0,
      itemTransfers: 0,
      productsAdded: 0,
      activeUsers: 0,
      timestamp,
      ...this.businessMetrics,
      ...metrics,
    };

    logInfo('Business metrics updated', metrics);
  }

  /**
   * Get aggregated metrics for a time window
   */
  getAggregatedMetrics(windowMs: number = 300000): AggregatedMetrics { // Default 5 minutes
    const now = Date.now();
    const windowStart = now - windowMs;
    const startTime = new Date(windowStart).toISOString();
    const endTime = new Date(now).toISOString();

    // Filter requests within time window
    const recentRequests = this.requestMetrics.filter(
      req => new Date(req.timestamp).getTime() >= windowStart
    );

    // Calculate performance metrics
    const performance = this.calculatePerformanceMetrics(recentRequests);
    
    // Get business metrics
    const business = this.businessMetrics || {
      palletsCreated: 0,
      palletsMovedToday: 0,
      ucpsCreated: 0,
      itemTransfers: 0,
      productsAdded: 0,
      activeUsers: 0,
      timestamp: new Date().toISOString(),
    };

    // Get recent errors
    const errors = Array.from(this.errorMetrics.values())
      .filter(error => new Date(error.timestamp).getTime() >= windowStart)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 errors

    // Calculate request aggregations
    const requests = this.aggregateRequestMetrics(recentRequests);

    return {
      performance,
      business,
      errors,
      requests,
      timeWindow: {
        start: startTime,
        end: endTime,
        durationMs: windowMs,
      },
    };
  }

  /**
   * Get performance metrics for dashboard
   */
  async getPerformanceSnapshot(): Promise<PerformanceMetrics> {
    const recentRequests = this.requestMetrics.slice(-100); // Last 100 requests
    return this.calculatePerformanceMetrics(recentRequests);
  }

  /**
   * Get error summary
   */
  getErrorSummary(limit: number = 20): ErrorMetrics[] {
    return Array.from(this.errorMetrics.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Clear old metrics (cleanup)
   */
  cleanup(maxAgeMs: number = 3600000): void { // Default 1 hour
    const cutoff = Date.now() - maxAgeMs;
    const cutoffTime = new Date(cutoff).toISOString();

    // Clean request metrics
    this.requestMetrics = this.requestMetrics.filter(
      req => new Date(req.timestamp).getTime() > cutoff
    );

    // Clean error metrics
    for (const [key, error] of this.errorMetrics.entries()) {
      if (new Date(error.timestamp).getTime() <= cutoff) {
        this.errorMetrics.delete(key);
      }
    }

    logInfo('Metrics cleanup completed', {
      cutoffTime,
      remainingRequests: this.requestMetrics.length,
      remainingErrors: this.errorMetrics.size,
    });
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    requests: RequestMetrics[];
    errors: ErrorMetrics[];
    business: BusinessMetrics | null;
    summary: AggregatedMetrics;
  } {
    return {
      requests: [...this.requestMetrics],
      errors: Array.from(this.errorMetrics.values()),
      business: this.businessMetrics,
      summary: this.getAggregatedMetrics(),
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.requestMetrics = [];
    this.errorMetrics.clear();
    this.businessMetrics = null;
    this.metricsStartTime = Date.now();
    
    logInfo('Metrics service reset');
  }

  /**
   * Get service uptime
   */
  getUptime(): number {
    return Date.now() - this.metricsStartTime;
  }

  /**
   * Calculate performance metrics from request data
   */
  private calculatePerformanceMetrics(requests: RequestMetrics[]): PerformanceMetrics {
    if (requests.length === 0) {
      return {
        avgResponseTime: 0,
        requestsPerMinute: 0,
        errorRate: 0,
        databaseLatency: 0,
        cacheHitRate: 0,
        memoryUsage: 0,
        timestamp: new Date().toISOString(),
      };
    }

    // Calculate averages
    const avgResponseTime = requests.reduce((sum, req) => sum + req.responseTime, 0) / requests.length;
    
    // Calculate requests per minute
    const timeSpanMs = Math.max(1, Date.now() - new Date(requests[0].timestamp).getTime());
    const requestsPerMinute = (requests.length / timeSpanMs) * 60000;
    
    // Calculate error rate
    const errorRequests = requests.filter(req => req.statusCode >= 400);
    const errorRate = (errorRequests.length / requests.length) * 100;
    
    // Get system metrics
    const memUsage = process.memoryUsage();
    const memoryUsage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    return {
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      requestsPerMinute: Math.round(requestsPerMinute * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      databaseLatency: 0, // Will be updated by external service
      cacheHitRate: 0, // Will be updated by cache service
      memoryUsage: Math.round(memoryUsage * 100) / 100,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Aggregate request metrics by various dimensions
   */
  private aggregateRequestMetrics(requests: RequestMetrics[]): AggregatedMetrics['requests'] {
    const total = requests.length;
    const byStatus: Record<string, number> = {};
    const byRoute: Record<string, number> = {};
    const byMethod: Record<string, number> = {};

    for (const request of requests) {
      // By status code
      const statusGroup = `${Math.floor(request.statusCode / 100)}xx`;
      byStatus[statusGroup] = (byStatus[statusGroup] || 0) + 1;

      // By route
      byRoute[request.route] = (byRoute[request.route] || 0) + 1;

      // By method
      byMethod[request.method] = (byMethod[request.method] || 0) + 1;
    }

    return {
      total,
      byStatus,
      byRoute,
      byMethod,
    };
  }

  /**
   * Cache recent metrics for quick access
   */
  private async cacheRecentMetrics(): Promise<void> {
    try {
      const recent = this.getAggregatedMetrics(60000); // Last minute
      await cache.set('metrics:recent', recent, { ttl: 60 }); // Cache for 1 minute
    } catch (error) {
      // Don't throw, just log the error
      logError('Failed to cache recent metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsService();