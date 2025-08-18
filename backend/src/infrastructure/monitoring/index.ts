/**
 * Monitoring Infrastructure Barrel Export
 * 
 * Centralizes all monitoring functionality:
 * - Health checks
 * - Metrics collection
 * - Performance monitoring
 * - Error tracking
 */

// Health monitoring exports
import { healthService, HealthService } from './health.service.js';
export type { 
  HealthStatus, 
  HealthCheck, 
  SystemMetrics 
} from './health.service.js';

// Metrics exports
import { metricsService, MetricsService } from './metrics.service.js';
export type {
  RequestMetrics,
  ErrorMetrics,
  BusinessMetrics,
  PerformanceMetrics,
  AggregatedMetrics,
} from './metrics.service.js';

// Unified monitoring interface
export const monitoring = {
  // Health monitoring
  health: {
    check: () => healthService.performHealthCheck(),
    quick: () => healthService.getQuickHealth(),
    last: () => healthService.getLastHealthCheck(),
    start: () => healthService.startMonitoring(),
    stop: () => healthService.stopMonitoring(),
    uptime: () => healthService.getUptime(),
  },
  
  // Metrics collection
  metrics: {
    recordRequest: (data: any) => metricsService.recordRequest(data),
    recordError: (data: any) => metricsService.recordError(data),
    updateBusiness: (data: any) => metricsService.updateBusinessMetrics(data),
    getAggregated: () => metricsService.getAggregatedMetrics(),
    getPerformance: () => metricsService.getPerformanceSnapshot(),
    getErrors: () => metricsService.getErrorSummary(),
    export: () => metricsService.exportMetrics(),
    cleanup: () => metricsService.cleanup(),
  },
} as const;

export default monitoring;