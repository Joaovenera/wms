import { Request, Response, NextFunction } from 'express';
import { intelligentCache } from '../infrastructure/cache/intelligent-cache.service';
import { compositionCacheService } from '../infrastructure/cache/composition-cache.service';

/**
 * Performance monitoring middleware for packaging composition operations
 * Tracks response times, cache hit rates, and system performance metrics
 */

interface PerformanceMetrics {
  requestStart: number;
  dbQueryTime?: number;
  cacheHitTime?: number;
  calculationTime?: number;
  totalResponseTime: number;
  cacheHit: boolean;
  algorithmUsed: 'standard' | 'enhanced';
  complexity: 'low' | 'medium' | 'high';
}

interface RequestPerformanceContext {
  startTime: number;
  metrics: Partial<PerformanceMetrics>;
  requestId: string;
}

// Store performance metrics in memory (in production, use a proper monitoring system)
const performanceStore = new Map<string, PerformanceMetrics[]>();
const activeRequests = new Map<string, RequestPerformanceContext>();

/**
 * Initialize performance monitoring for composition requests
 */
export function initializePerformanceMonitoring(req: Request, res: Response, next: NextFunction) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // Add performance context to request
  (req as any).performanceContext = {
    startTime,
    requestId,
    metrics: {
      requestStart: startTime,
      cacheHit: false,
      algorithmUsed: 'standard',
      complexity: 'medium'
    }
  };

  // Store active request
  activeRequests.set(requestId, {
    startTime,
    requestId,
    metrics: {}
  });

  // Override res.json to capture response time
  const originalJson = res.json;
  res.json = function(data: any) {
    const context = (req as any).performanceContext;
    if (context) {
      const totalTime = Date.now() - context.startTime;
      recordPerformanceMetrics(requestId, {
        ...context.metrics,
        totalResponseTime: totalTime
      });
    }
    
    return originalJson.call(this, data);
  };

  next();
}

/**
 * Monitor database query performance
 */
export function monitorDatabaseQueries(req: Request, res: Response, next: NextFunction) {
  const context = (req as any).performanceContext;
  if (!context) return next();

  // Intercept database queries (this would integrate with your ORM/query builder)
  const dbStart = Date.now();
  
  // Add database monitoring hook
  res.on('finish', () => {
    if (context.metrics) {
      context.metrics.dbQueryTime = Date.now() - dbStart;
    }
  });

  next();
}

/**
 * Monitor cache performance
 */
export function monitorCachePerformance(req: Request, res: Response, next: NextFunction) {
  const context = (req as any).performanceContext;
  if (!context) return next();

  // Override cache methods to track performance
  const originalGet = (intelligentCache as any).get;
  (intelligentCache as any).get = async function(key: string, options?: any) {
    const cacheStart = Date.now();
    const result = await originalGet.call(this, key, options);
    
    if (context.metrics) {
      context.metrics.cacheHitTime = Date.now() - cacheStart;
      context.metrics.cacheHit = result !== null;
    }
    
    return result;
  };

  // Restore original method after request
  res.on('finish', () => {
    (intelligentCache as any).get = originalGet;
  });

  next();
}

/**
 * Monitor calculation complexity and performance
 */
export function monitorCalculationComplexity(req: Request, res: Response, next: NextFunction) {
  const context = (req as any).performanceContext;
  if (!context) return next();

  // Analyze request complexity
  const { products, constraints } = req.body || {};
  
  if (products && Array.isArray(products)) {
    const productCount = products.length;
    const totalQuantity = products.reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
    const hasConstraints = constraints && Object.keys(constraints).length > 0;
    
    let complexity: 'low' | 'medium' | 'high' = 'low';
    
    if (productCount > 10 || totalQuantity > 100 || hasConstraints) {
      complexity = 'medium';
    }
    if (productCount > 20 || totalQuantity > 500) {
      complexity = 'high';
    }
    
    context.metrics.complexity = complexity;
    
    // Track algorithm preference based on complexity
    if (req.body.useEnhancedAlgorithm !== false && complexity !== 'low') {
      context.metrics.algorithmUsed = 'enhanced';
    }
  }

  next();
}

/**
 * Generate performance reports
 */
export function generatePerformanceReport(req: Request, res: Response, next: NextFunction) {
  // Only for admin endpoints
  if (!req.path.includes('/admin/performance')) {
    return next();
  }

  try {
    const { timeframe = '1h', metric = 'all' } = req.query;
    const report = generateReport(timeframe as string, metric as string);
    
    res.json({
      success: true,
      data: report,
      generated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating performance report:', error);
    res.status(500).json({
      error: 'Failed to generate performance report'
    });
  }
}

/**
 * Real-time performance monitoring endpoint
 */
export function realTimeMonitoring(req: Request, res: Response, next: NextFunction) {
  if (!req.path.includes('/admin/monitoring/realtime')) {
    return next();
  }

  const activeRequestsData = Array.from(activeRequests.values()).map(context => ({
    requestId: context.requestId,
    elapsed: Date.now() - context.startTime,
    complexity: context.metrics.complexity || 'unknown'
  }));

  const recentMetrics = getRecentMetrics(60000); // Last minute
  
  res.json({
    success: true,
    data: {
      activeRequests: activeRequestsData.length,
      requestDetails: activeRequestsData,
      recentMetrics: {
        averageResponseTime: calculateAverageResponseTime(recentMetrics),
        cacheHitRate: calculateCacheHitRate(recentMetrics),
        requestsPerMinute: recentMetrics.length,
        algorithmDistribution: calculateAlgorithmDistribution(recentMetrics)
      },
      systemHealth: {
        cacheHealth: 'healthy', // Would check actual cache health
        databaseHealth: 'healthy', // Would check actual DB health
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    },
    timestamp: new Date().toISOString()
  });
}

// Helper functions

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function recordPerformanceMetrics(requestId: string, metrics: PerformanceMetrics) {
  const endpoint = 'composition'; // Would extract from request path
  
  if (!performanceStore.has(endpoint)) {
    performanceStore.set(endpoint, []);
  }
  
  const endpointMetrics = performanceStore.get(endpoint)!;
  endpointMetrics.push(metrics);
  
  // Keep only last 1000 metrics per endpoint
  if (endpointMetrics.length > 1000) {
    endpointMetrics.splice(0, endpointMetrics.length - 1000);
  }
  
  // Clean up active request
  activeRequests.delete(requestId);
  
  // Log slow requests
  if (metrics.totalResponseTime > 5000) { // 5 seconds
    console.warn('Slow request detected:', {
      requestId,
      responseTime: metrics.totalResponseTime,
      complexity: metrics.complexity,
      algorithm: metrics.algorithmUsed,
      cacheHit: metrics.cacheHit
    });
  }
}

function generateReport(timeframe: string, metric: string) {
  const timeMs = parseTimeframe(timeframe);
  const cutoff = Date.now() - timeMs;
  
  const allMetrics: PerformanceMetrics[] = [];
  for (const metrics of performanceStore.values()) {
    allMetrics.push(...metrics.filter(m => m.requestStart > cutoff));
  }
  
  if (allMetrics.length === 0) {
    return {
      message: 'No data available for the specified timeframe',
      timeframe,
      dataPoints: 0
    };
  }

  const report: any = {
    timeframe,
    dataPoints: allMetrics.length,
    averageResponseTime: calculateAverageResponseTime(allMetrics),
    medianResponseTime: calculateMedianResponseTime(allMetrics),
    cacheHitRate: calculateCacheHitRate(allMetrics),
    algorithmDistribution: calculateAlgorithmDistribution(allMetrics),
    complexityDistribution: calculateComplexityDistribution(allMetrics)
  };

  // Add specific metrics based on request
  if (metric === 'database' || metric === 'all') {
    report.database = {
      averageQueryTime: calculateAverageQueryTime(allMetrics),
      slowQueries: allMetrics.filter(m => (m.dbQueryTime || 0) > 1000).length
    };
  }

  if (metric === 'cache' || metric === 'all') {
    report.cache = {
      hitRate: calculateCacheHitRate(allMetrics),
      averageHitTime: calculateAverageCacheTime(allMetrics),
      efficiency: calculateCacheEfficiency(allMetrics)
    };
  }

  if (metric === 'performance' || metric === 'all') {
    report.performance = {
      slowRequests: allMetrics.filter(m => m.totalResponseTime > 5000).length,
      fastRequests: allMetrics.filter(m => m.totalResponseTime < 1000).length,
      p95ResponseTime: calculatePercentile(allMetrics.map(m => m.totalResponseTime), 95),
      p99ResponseTime: calculatePercentile(allMetrics.map(m => m.totalResponseTime), 99)
    };
  }

  return report;
}

function parseTimeframe(timeframe: string): number {
  const unit = timeframe.slice(-1);
  const value = parseInt(timeframe.slice(0, -1));
  
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 60 * 60 * 1000; // Default 1 hour
  }
}

function getRecentMetrics(timeMs: number): PerformanceMetrics[] {
  const cutoff = Date.now() - timeMs;
  const allMetrics: PerformanceMetrics[] = [];
  
  for (const metrics of performanceStore.values()) {
    allMetrics.push(...metrics.filter(m => m.requestStart > cutoff));
  }
  
  return allMetrics;
}

function calculateAverageResponseTime(metrics: PerformanceMetrics[]): number {
  if (metrics.length === 0) return 0;
  return metrics.reduce((sum, m) => sum + m.totalResponseTime, 0) / metrics.length;
}

function calculateMedianResponseTime(metrics: PerformanceMetrics[]): number {
  if (metrics.length === 0) return 0;
  const sorted = metrics.map(m => m.totalResponseTime).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function calculateCacheHitRate(metrics: PerformanceMetrics[]): number {
  if (metrics.length === 0) return 0;
  const hits = metrics.filter(m => m.cacheHit).length;
  return (hits / metrics.length) * 100;
}

function calculateAlgorithmDistribution(metrics: PerformanceMetrics[]): any {
  const distribution = { standard: 0, enhanced: 0 };
  metrics.forEach(m => {
    distribution[m.algorithmUsed]++;
  });
  return distribution;
}

function calculateComplexityDistribution(metrics: PerformanceMetrics[]): any {
  const distribution = { low: 0, medium: 0, high: 0 };
  metrics.forEach(m => {
    distribution[m.complexity]++;
  });
  return distribution;
}

function calculateAverageQueryTime(metrics: PerformanceMetrics[]): number {
  const withQueryTime = metrics.filter(m => m.dbQueryTime !== undefined);
  if (withQueryTime.length === 0) return 0;
  return withQueryTime.reduce((sum, m) => sum + (m.dbQueryTime || 0), 0) / withQueryTime.length;
}

function calculateAverageCacheTime(metrics: PerformanceMetrics[]): number {
  const withCacheTime = metrics.filter(m => m.cacheHitTime !== undefined);
  if (withCacheTime.length === 0) return 0;
  return withCacheTime.reduce((sum, m) => sum + (m.cacheHitTime || 0), 0) / withCacheTime.length;
}

function calculateCacheEfficiency(metrics: PerformanceMetrics[]): any {
  const cacheHits = metrics.filter(m => m.cacheHit);
  const cacheMisses = metrics.filter(m => !m.cacheHit);
  
  return {
    hitRate: calculateCacheHitRate(metrics),
    averageHitTime: calculateAverageCacheTime(cacheHits),
    averageMissTime: calculateAverageCacheTime(cacheMisses),
    efficiency: cacheHits.length > 0 ? 
      (calculateAverageCacheTime(cacheMisses) / calculateAverageCacheTime(cacheHits)) : 0
  };
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

// Export performance data getter for external monitoring
export function getPerformanceData() {
  return {
    activeRequests: activeRequests.size,
    totalMetrics: Array.from(performanceStore.values()).reduce((sum, metrics) => sum + metrics.length, 0),
    endpoints: Array.from(performanceStore.keys()),
    recentActivity: getRecentMetrics(300000) // Last 5 minutes
  };
}