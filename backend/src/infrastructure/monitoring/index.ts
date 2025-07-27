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
export { healthService, HealthService } from './health.service.js';
export type { 
  HealthStatus, 
  HealthCheck, 
  SystemMetrics 
} from './health.service.js';

// Metrics exports
export { metricsService, MetricsService } from './metrics.service.js';
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
    check: healthService.performHealthCheck.bind(healthService),
    quick: healthService.getQuickHealth.bind(healthService),
    last: healthService.getLastHealthCheck.bind(healthService),
    start: healthService.startMonitoring.bind(healthService),
    stop: healthService.stopMonitoring.bind(healthService),
    uptime: healthService.getUptime.bind(healthService),
  },
  
  // Metrics collection
  metrics: {
    recordRequest: metricsService.recordRequest.bind(metricsService),
    recordError: metricsService.recordError.bind(metricsService),
    updateBusiness: metricsService.updateBusinessMetrics.bind(metricsService),
    getAggregated: metricsService.getAggregatedMetrics.bind(metricsService),
    getPerformance: metricsService.getPerformanceSnapshot.bind(metricsService),
    getErrors: metricsService.getErrorSummary.bind(metricsService),
    export: metricsService.exportMetrics.bind(metricsService),
    cleanup: metricsService.cleanup.bind(metricsService),
  },
} as const;

export default monitoring;