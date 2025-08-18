import React, { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Clock, Zap, AlertTriangle, CheckCircle, Info } from "lucide-react";

interface PerformanceMetrics {
  navigation: number;
  paint: number;
  contentfulPaint: number;
  domInteractive: number;
  domComplete: number;
  loadComplete: number;
  firstInputDelay?: number;
  cumulativeLayoutShift?: number;
  largestContentfulPaint?: number;
  memoryUsage?: {
    used: number;
    total: number;
    limit: number;
  };
  renderCount: number;
  apiCalls: number;
  errorCount: number;
}

interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
}

interface PerformanceMonitorProps {
  enabled?: boolean;
  showDetails?: boolean;
  onAlert?: (alert: PerformanceAlert) => void;
  thresholds?: {
    navigation?: number;
    paint?: number;
    contentfulPaint?: number;
    firstInputDelay?: number;
    cumulativeLayoutShift?: number;
    largestContentfulPaint?: number;
    memoryUsage?: number;
  };
}

export function PerformanceMonitor({ 
  enabled = true, 
  showDetails = false,
  onAlert,
  thresholds = {
    navigation: 2000,
    paint: 1500,
    contentfulPaint: 2500,
    firstInputDelay: 100,
    cumulativeLayoutShift: 0.1,
    largestContentfulPaint: 2500,
    memoryUsage: 50 * 1024 * 1024, // 50MB
  }
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const metricsRef = useRef<PerformanceMetrics>();

  const collectMetrics = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;

    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      let paintTime = 0;
      let contentfulPaintTime = 0;
      
      paint.forEach((entry) => {
        if (entry.name === 'first-paint') {
          paintTime = entry.startTime;
        }
        if (entry.name === 'first-contentful-paint') {
          contentfulPaintTime = entry.startTime;
        }
      });

      // Get memory info if available
      let memoryUsage;
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        memoryUsage = {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
        };
      }

      // Get Web Vitals if available
      let firstInputDelay;
      let cumulativeLayoutShift;
      let largestContentfulPaint;

      // FID - First Input Delay
      if ('addEventListener' in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'first-input') {
              firstInputDelay = (entry as any).processingStart - entry.startTime;
            }
            if (entry.entryType === 'layout-shift') {
              if (!(entry as any).hadRecentInput) {
                cumulativeLayoutShift = (cumulativeLayoutShift || 0) + (entry as any).value;
              }
            }
            if (entry.entryType === 'largest-contentful-paint') {
              largestContentfulPaint = entry.startTime;
            }
          });
        });

        try {
          observer.observe({ entryTypes: ['first-input', 'layout-shift', 'largest-contentful-paint'] });
        } catch (e) {
          // Some browsers might not support all entry types
        }
      }

      const currentMetrics: PerformanceMetrics = {
        navigation: navigation.loadEventEnd - navigation.navigationStart,
        paint: paintTime,
        contentfulPaint: contentfulPaintTime,
        domInteractive: navigation.domInteractive - navigation.navigationStart,
        domComplete: navigation.domComplete - navigation.navigationStart,
        loadComplete: navigation.loadEventEnd - navigation.navigationStart,
        firstInputDelay,
        cumulativeLayoutShift,
        largestContentfulPaint,
        memoryUsage,
        renderCount: metricsRef.current ? metricsRef.current.renderCount + 1 : 1,
        apiCalls: metricsRef.current ? metricsRef.current.apiCalls : 0,
        errorCount: metricsRef.current ? metricsRef.current.errorCount : 0,
      };

      // Check for performance alerts
      checkPerformanceThresholds(currentMetrics);

      metricsRef.current = currentMetrics;
      setMetrics(currentMetrics);
    } catch (error) {
      console.error('Error collecting performance metrics:', error);
    }
  }, [enabled, thresholds]);

  const checkPerformanceThresholds = useCallback((metrics: PerformanceMetrics) => {
    const newAlerts: PerformanceAlert[] = [];

    const checks = [
      {
        metric: 'navigation',
        value: metrics.navigation,
        threshold: thresholds.navigation!,
        message: 'Page load time is slower than expected',
      },
      {
        metric: 'paint',
        value: metrics.paint,
        threshold: thresholds.paint!,
        message: 'First paint is taking too long',
      },
      {
        metric: 'contentfulPaint',
        value: metrics.contentfulPaint,
        threshold: thresholds.contentfulPaint!,
        message: 'First contentful paint is delayed',
      },
      {
        metric: 'firstInputDelay',
        value: metrics.firstInputDelay || 0,
        threshold: thresholds.firstInputDelay!,
        message: 'Input responsiveness is poor',
      },
      {
        metric: 'cumulativeLayoutShift',
        value: metrics.cumulativeLayoutShift || 0,
        threshold: thresholds.cumulativeLayoutShift!,
        message: 'Layout is shifting unexpectedly',
      },
      {
        metric: 'largestContentfulPaint',
        value: metrics.largestContentfulPaint || 0,
        threshold: thresholds.largestContentfulPaint!,
        message: 'Largest content element is loading slowly',
      },
    ];

    checks.forEach(({ metric, value, threshold, message }) => {
      if (value > threshold) {
        const alert: PerformanceAlert = {
          id: `${metric}-${Date.now()}`,
          type: value > threshold * 1.5 ? 'error' : 'warning',
          metric,
          value,
          threshold,
          message,
          timestamp: Date.now(),
        };
        newAlerts.push(alert);
        onAlert?.(alert);
      }
    });

    // Memory usage check
    if (metrics.memoryUsage && metrics.memoryUsage.used > thresholds.memoryUsage!) {
      const alert: PerformanceAlert = {
        id: `memory-${Date.now()}`,
        type: 'warning',
        metric: 'memoryUsage',
        value: metrics.memoryUsage.used,
        threshold: thresholds.memoryUsage!,
        message: 'Memory usage is high',
        timestamp: Date.now(),
      };
      newAlerts.push(alert);
      onAlert?.(alert);
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...prev, ...newAlerts].slice(-10)); // Keep last 10 alerts
    }
  }, [thresholds, onAlert]);

  // Track API calls
  const trackApiCall = useCallback(() => {
    if (metricsRef.current) {
      metricsRef.current.apiCalls += 1;
    }
  }, []);

  // Track errors
  const trackError = useCallback(() => {
    if (metricsRef.current) {
      metricsRef.current.errorCount += 1;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    setIsCollecting(true);
    
    // Initial collection
    collectMetrics();

    // Set up periodic collection
    intervalRef.current = setInterval(collectMetrics, 5000);

    // Listen for navigation changes
    const handleNavigation = () => {
      setTimeout(collectMetrics, 1000);
    };

    window.addEventListener('load', handleNavigation);
    window.addEventListener('beforeunload', handleNavigation);

    // Listen for errors
    const handleError = () => {
      trackError();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);

    return () => {
      setIsCollecting(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('load', handleNavigation);
      window.removeEventListener('beforeunload', handleNavigation);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, [enabled, collectMetrics, trackError]);

  const formatTime = (time: number) => {
    return `${time.toFixed(0)}ms`;
  };

  const formatMemory = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getPerformanceScore = (metrics: PerformanceMetrics): { score: number; label: string; color: string } => {
    let score = 100;

    // Deduct points based on thresholds
    if (metrics.navigation > thresholds.navigation!) score -= 20;
    if (metrics.contentfulPaint > thresholds.contentfulPaint!) score -= 15;
    if (metrics.firstInputDelay && metrics.firstInputDelay > thresholds.firstInputDelay!) score -= 15;
    if (metrics.cumulativeLayoutShift && metrics.cumulativeLayoutShift > thresholds.cumulativeLayoutShift!) score -= 10;
    if (metrics.largestContentfulPaint && metrics.largestContentfulPaint > thresholds.largestContentfulPaint!) score -= 15;
    if (metrics.memoryUsage && metrics.memoryUsage.used > thresholds.memoryUsage!) score -= 10;

    score = Math.max(0, score);

    if (score >= 90) return { score, label: 'Excellent', color: 'text-green-600' };
    if (score >= 70) return { score, label: 'Good', color: 'text-blue-600' };
    if (score >= 50) return { score, label: 'Needs Improvement', color: 'text-yellow-600' };
    return { score, label: 'Poor', color: 'text-red-600' };
  };

  if (!enabled || !metrics) {
    return null;
  }

  const performanceScore = getPerformanceScore(metrics);

  if (!showDetails) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="w-64">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="text-sm font-medium">Performance</span>
              </div>
              <Badge variant={performanceScore.score >= 70 ? "default" : "destructive"}>
                {performanceScore.score}
              </Badge>
            </div>
            {alerts.length > 0 && (
              <div className="mt-2 text-xs text-yellow-600">
                {alerts.length} alerts
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Performance Monitor
            </CardTitle>
            <CardDescription>
              Real-time performance metrics and Web Vitals
            </CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${performanceScore.color}`}>
              {performanceScore.score}
            </div>
            <div className="text-sm text-gray-500">{performanceScore.label}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Core Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span className="text-xs text-gray-500">Page Load</span>
            </div>
            <div className="text-lg font-semibold">{formatTime(metrics.navigation)}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              <span className="text-xs text-gray-500">First Paint</span>
            </div>
            <div className="text-lg font-semibold">{formatTime(metrics.paint)}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              <span className="text-xs text-gray-500">Renders</span>
            </div>
            <div className="text-lg font-semibold">{metrics.renderCount}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              <span className="text-xs text-gray-500">API Calls</span>
            </div>
            <div className="text-lg font-semibold">{metrics.apiCalls}</div>
          </div>
        </div>

        {/* Web Vitals */}
        {(metrics.firstInputDelay || metrics.cumulativeLayoutShift || metrics.largestContentfulPaint) && (
          <div>
            <h4 className="text-sm font-medium mb-3">Web Vitals</h4>
            <div className="grid grid-cols-3 gap-4">
              {metrics.firstInputDelay && (
                <div className="space-y-1">
                  <span className="text-xs text-gray-500">FID</span>
                  <div className="text-sm font-medium">{formatTime(metrics.firstInputDelay)}</div>
                </div>
              )}
              {metrics.cumulativeLayoutShift && (
                <div className="space-y-1">
                  <span className="text-xs text-gray-500">CLS</span>
                  <div className="text-sm font-medium">{metrics.cumulativeLayoutShift.toFixed(3)}</div>
                </div>
              )}
              {metrics.largestContentfulPaint && (
                <div className="space-y-1">
                  <span className="text-xs text-gray-500">LCP</span>
                  <div className="text-sm font-medium">{formatTime(metrics.largestContentfulPaint)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Memory Usage */}
        {metrics.memoryUsage && (
          <div>
            <h4 className="text-sm font-medium mb-3">Memory Usage</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used: {formatMemory(metrics.memoryUsage.used)}</span>
                <span>Total: {formatMemory(metrics.memoryUsage.total)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${(metrics.memoryUsage.used / metrics.memoryUsage.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Recent Alerts
            </h4>
            <div className="space-y-2">
              {alerts.slice(-3).map((alert) => (
                <div
                  key={alert.id}
                  className={`p-2 rounded text-xs ${
                    alert.type === 'error'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : alert.type === 'warning'
                      ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  <div className="font-medium">{alert.message}</div>
                  <div className="text-xs opacity-75">
                    {alert.metric}: {formatTime(alert.value)} (threshold: {formatTime(alert.threshold)})
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>
            {isCollecting ? 'Collecting metrics...' : 'Monitoring paused'}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={collectMetrics}
            className="h-6 px-2 text-xs"
          >
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Hook for using performance monitoring in components
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  const trackRender = useCallback(() => {
    // This would be called in useEffect of components to track renders
  }, []);

  const trackApiCall = useCallback(() => {
    // This would be called when making API requests
  }, []);

  const trackError = useCallback(() => {
    // This would be called when errors occur
  }, []);

  return {
    metrics,
    trackRender,
    trackApiCall,
    trackError,
  };
}

export default PerformanceMonitor;