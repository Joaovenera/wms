import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface PerformanceMetrics {
  // Core metrics
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  totalRenderTime: number;

  // Network metrics
  apiCallCount: number;
  apiErrorCount: number;
  averageApiResponseTime: number;
  lastApiCallTime: number;
  networkStatus: 'online' | 'offline' | 'slow';

  // User interaction metrics
  scanCount: number;
  divergenceCount: number;
  completionRate: number;
  averageItemProcessingTime: number;

  // Memory metrics
  memoryUsage: number;
  cacheSize: number;
  
  // Performance scores
  overallScore: number;
  renderScore: number;
  networkScore: number;
  uxScore: number;
}

interface PerformanceEvent {
  type: 'render' | 'api_call' | 'api_error' | 'scan' | 'divergence' | 'completion';
  timestamp: number;
  duration?: number;
  metadata?: any;
}

interface UseLoadingPerformanceOptions {
  enabled?: boolean;
  trackingInterval?: number; // ms
  historyLimit?: number; // number of events to keep
  performanceThresholds?: {
    maxRenderTime?: number;
    maxApiResponseTime?: number;
    minOverallScore?: number;
  };
  onPerformanceAlert?: (alert: {
    type: 'warning' | 'error';
    metric: string;
    value: number;
    threshold: number;
    message: string;
  }) => void;
}

export function useLoadingPerformance(options: UseLoadingPerformanceOptions = {}) {
  const {
    enabled = true,
    trackingInterval = 5000,
    historyLimit = 100,
    performanceThresholds = {
      maxRenderTime: 100,
      maxApiResponseTime: 2000,
      minOverallScore: 70
    },
    onPerformanceAlert
  } = options;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    totalRenderTime: 0,
    apiCallCount: 0,
    apiErrorCount: 0,
    averageApiResponseTime: 0,
    lastApiCallTime: 0,
    networkStatus: 'online',
    scanCount: 0,
    divergenceCount: 0,
    completionRate: 0,
    averageItemProcessingTime: 0,
    memoryUsage: 0,
    cacheSize: 0,
    overallScore: 100,
    renderScore: 100,
    networkScore: 100,
    uxScore: 100
  });

  const [isTracking, setIsTracking] = useState(enabled);
  const [events, setEvents] = useState<PerformanceEvent[]>([]);
  
  const queryClient = useQueryClient();
  const metricsRef = useRef<PerformanceMetrics>(metrics);
  const eventsRef = useRef<PerformanceEvent[]>([]);
  const startTimeRef = useRef<number>(Date.now());
  const renderStartRef = useRef<number>(0);
  const apiStartTimes = useRef<Map<string, number>>(new Map());

  // Update refs when state changes
  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // Track render performance
  const trackRender = useCallback((renderStartTime?: number) => {
    if (!enabled) return;

    const now = performance.now();
    const startTime = renderStartTime || renderStartRef.current || now;
    const renderTime = now - startTime;

    const event: PerformanceEvent = {
      type: 'render',
      timestamp: Date.now(),
      duration: renderTime,
      metadata: { renderTime }
    };

    setEvents(prev => [...prev.slice(-(historyLimit - 1)), event]);
    
    setMetrics(prev => {
      const newRenderCount = prev.renderCount + 1;
      const newTotalRenderTime = prev.totalRenderTime + renderTime;
      const newAverageRenderTime = newTotalRenderTime / newRenderCount;

      // Check performance threshold
      if (renderTime > performanceThresholds.maxRenderTime! && onPerformanceAlert) {
        onPerformanceAlert({
          type: renderTime > performanceThresholds.maxRenderTime! * 2 ? 'error' : 'warning',
          metric: 'renderTime',
          value: renderTime,
          threshold: performanceThresholds.maxRenderTime!,
          message: `Render time (${renderTime.toFixed(1)}ms) exceeds threshold`
        });
      }

      return {
        ...prev,
        renderCount: newRenderCount,
        lastRenderTime: renderTime,
        averageRenderTime: newAverageRenderTime,
        totalRenderTime: newTotalRenderTime,
        renderScore: Math.max(0, 100 - (newAverageRenderTime / performanceThresholds.maxRenderTime!) * 50)
      };
    });

    renderStartRef.current = 0;
  }, [enabled, historyLimit, performanceThresholds, onPerformanceAlert]);

  // Track API calls
  const trackApiCall = useCallback((endpoint: string, method: string = 'GET') => {
    if (!enabled) return () => {};

    const callId = `${method}:${endpoint}:${Date.now()}`;
    const startTime = performance.now();
    apiStartTimes.current.set(callId, startTime);

    return (success: boolean, error?: any) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      apiStartTimes.current.delete(callId);

      const event: PerformanceEvent = {
        type: success ? 'api_call' : 'api_error',
        timestamp: Date.now(),
        duration,
        metadata: { endpoint, method, success, error }
      };

      setEvents(prev => [...prev.slice(-(historyLimit - 1)), event]);

      setMetrics(prev => {
        const newApiCallCount = prev.apiCallCount + 1;
        const newApiErrorCount = success ? prev.apiErrorCount : prev.apiErrorCount + 1;
        const errorRate = newApiErrorCount / newApiCallCount;
        
        // Update average response time
        const totalResponseTime = prev.averageApiResponseTime * (newApiCallCount - 1) + duration;
        const newAverageApiResponseTime = totalResponseTime / newApiCallCount;

        // Check performance threshold
        if (duration > performanceThresholds.maxApiResponseTime! && onPerformanceAlert) {
          onPerformanceAlert({
            type: duration > performanceThresholds.maxApiResponseTime! * 2 ? 'error' : 'warning',
            metric: 'apiResponseTime',
            value: duration,
            threshold: performanceThresholds.maxApiResponseTime!,
            message: `API response time (${duration.toFixed(0)}ms) exceeds threshold`
          });
        }

        return {
          ...prev,
          apiCallCount: newApiCallCount,
          apiErrorCount: newApiErrorCount,
          averageApiResponseTime: newAverageApiResponseTime,
          lastApiCallTime: duration,
          networkScore: Math.max(0, 100 - (errorRate * 100) - Math.max(0, (newAverageApiResponseTime - 1000) / 10))
        };
      });
    };
  }, [enabled, historyLimit, performanceThresholds, onPerformanceAlert]);

  // Track user interactions
  const trackScan = useCallback(() => {
    if (!enabled) return;

    const event: PerformanceEvent = {
      type: 'scan',
      timestamp: Date.now(),
      metadata: { action: 'item_scan' }
    };

    setEvents(prev => [...prev.slice(-(historyLimit - 1)), event]);
    setMetrics(prev => ({ ...prev, scanCount: prev.scanCount + 1 }));
  }, [enabled, historyLimit]);

  const trackDivergence = useCallback((reason?: string) => {
    if (!enabled) return;

    const event: PerformanceEvent = {
      type: 'divergence',
      timestamp: Date.now(),
      metadata: { reason }
    };

    setEvents(prev => [...prev.slice(-(historyLimit - 1)), event]);
    setMetrics(prev => ({ ...prev, divergenceCount: prev.divergenceCount + 1 }));
  }, [enabled, historyLimit]);

  const trackCompletion = useCallback((itemsCompleted: number, totalItems: number) => {
    if (!enabled) return;

    const completionRate = totalItems > 0 ? (itemsCompleted / totalItems) * 100 : 0;
    const sessionTime = Date.now() - startTimeRef.current;
    const avgItemTime = itemsCompleted > 0 ? sessionTime / itemsCompleted : 0;

    const event: PerformanceEvent = {
      type: 'completion',
      timestamp: Date.now(),
      metadata: { itemsCompleted, totalItems, completionRate, avgItemTime }
    };

    setEvents(prev => [...prev.slice(-(historyLimit - 1)), event]);
    setMetrics(prev => ({
      ...prev,
      completionRate,
      averageItemProcessingTime: avgItemTime,
      uxScore: Math.min(100, completionRate + (prev.scanCount > 0 ? 10 : 0) - (prev.divergenceCount * 5))
    }));
  }, [enabled, historyLimit]);

  // Monitor network status
  useEffect(() => {
    if (!enabled) return;

    const updateNetworkStatus = () => {
      const connection = (navigator as any).connection;
      let status: 'online' | 'offline' | 'slow' = navigator.onLine ? 'online' : 'offline';
      
      if (connection && navigator.onLine) {
        if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
          status = 'slow';
        }
      }

      setMetrics(prev => ({ ...prev, networkStatus: status }));
    };

    const handleOnline = () => updateNetworkStatus();
    const handleOffline = () => updateNetworkStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Monitor connection changes if supported
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateNetworkStatus);
    }

    updateNetworkStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateNetworkStatus);
      }
    };
  }, [enabled]);

  // Monitor memory usage
  useEffect(() => {
    if (!enabled) return;

    const updateMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const memoryUsage = memory.usedJSHeapSize;
        
        // Get cache size from React Query
        const cache = queryClient.getQueryCache();
        const cacheSize = cache.getAll().length;

        setMetrics(prev => ({
          ...prev,
          memoryUsage,
          cacheSize
        }));
      }
    };

    const interval = setInterval(updateMemoryUsage, trackingInterval);
    updateMemoryUsage();

    return () => clearInterval(interval);
  }, [enabled, trackingInterval, queryClient]);

  // Calculate overall performance score
  useEffect(() => {
    const { renderScore, networkScore, uxScore } = metricsRef.current;
    const overallScore = (renderScore + networkScore + uxScore) / 3;

    setMetrics(prev => ({ ...prev, overallScore }));

    // Check overall performance threshold
    if (overallScore < performanceThresholds.minOverallScore! && onPerformanceAlert) {
      onPerformanceAlert({
        type: overallScore < performanceThresholds.minOverallScore! * 0.5 ? 'error' : 'warning',
        metric: 'overallScore',
        value: overallScore,
        threshold: performanceThresholds.minOverallScore!,
        message: `Overall performance score (${overallScore.toFixed(0)}) is below threshold`
      });
    }
  }, [metrics.renderScore, metrics.networkScore, metrics.uxScore, performanceThresholds, onPerformanceAlert]);

  // Performance analysis utilities
  const getPerformanceReport = useCallback(() => {
    const recentEvents = eventsRef.current.slice(-50); // Last 50 events
    const renderEvents = recentEvents.filter(e => e.type === 'render');
    const apiEvents = recentEvents.filter(e => e.type === 'api_call' || e.type === 'api_error');
    
    return {
      summary: {
        totalEvents: eventsRef.current.length,
        recentEvents: recentEvents.length,
        sessionDuration: Date.now() - startTimeRef.current,
        ...metricsRef.current
      },
      trends: {
        recentRenderTime: renderEvents.length > 0 
          ? renderEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / renderEvents.length 
          : 0,
        recentApiResponseTime: apiEvents.length > 0
          ? apiEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / apiEvents.length
          : 0,
        errorRate: apiEvents.length > 0
          ? apiEvents.filter(e => e.type === 'api_error').length / apiEvents.length
          : 0
      },
      recommendations: generateRecommendations(metricsRef.current, recentEvents)
    };
  }, []);

  const clearMetrics = useCallback(() => {
    setMetrics({
      renderCount: 0,
      lastRenderTime: 0,
      averageRenderTime: 0,
      totalRenderTime: 0,
      apiCallCount: 0,
      apiErrorCount: 0,
      averageApiResponseTime: 0,
      lastApiCallTime: 0,
      networkStatus: 'online',
      scanCount: 0,
      divergenceCount: 0,
      completionRate: 0,
      averageItemProcessingTime: 0,
      memoryUsage: 0,
      cacheSize: 0,
      overallScore: 100,
      renderScore: 100,
      networkScore: 100,
      uxScore: 100
    });
    setEvents([]);
    startTimeRef.current = Date.now();
  }, []);

  // Mark render start (call before rendering)
  const markRenderStart = useCallback(() => {
    if (enabled) {
      renderStartRef.current = performance.now();
    }
  }, [enabled]);

  return {
    metrics,
    events: events.slice(-20), // Return last 20 events for UI
    isTracking,
    trackRender,
    trackApiCall,
    trackScan,
    trackDivergence,
    trackCompletion,
    markRenderStart,
    getPerformanceReport,
    clearMetrics,
    setIsTracking
  };
}

// Helper function to generate performance recommendations
function generateRecommendations(metrics: PerformanceMetrics, recentEvents: PerformanceEvent[]): string[] {
  const recommendations: string[] = [];

  if (metrics.averageRenderTime > 50) {
    recommendations.push('Consider enabling virtualization for large item lists');
  }

  if (metrics.averageApiResponseTime > 2000) {
    recommendations.push('API response times are slow - check network connectivity');
  }

  if (metrics.apiErrorCount / Math.max(1, metrics.apiCallCount) > 0.1) {
    recommendations.push('High API error rate detected - implement retry mechanisms');
  }

  if (metrics.memoryUsage > 50 * 1024 * 1024) {
    recommendations.push('High memory usage - consider implementing cleanup strategies');
  }

  if (metrics.divergenceCount > metrics.scanCount * 0.3) {
    recommendations.push('High divergence rate - review scanning workflow');
  }

  if (recommendations.length === 0) {
    recommendations.push('Performance is optimal');
  }

  return recommendations;
}

export default useLoadingPerformance;