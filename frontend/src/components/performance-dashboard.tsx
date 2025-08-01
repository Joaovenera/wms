/**
 * Performance Dashboard Component
 * Real-time performance metrics visualization
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, Clock, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { usePerformanceMonitor } from '@/utils/performance-monitor';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  budget: number;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
}

interface ChartDataPoint {
  timestamp: number;
  [key: string]: number;
}

const PERFORMANCE_BUDGETS = {
  fcp: { budget: 1800, unit: 'ms', name: 'First Contentful Paint' },
  lcp: { budget: 2500, unit: 'ms', name: 'Largest Contentful Paint' },
  fid: { budget: 100, unit: 'ms', name: 'First Input Delay' },
  cls: { budget: 0.1, unit: 'score', name: 'Cumulative Layout Shift' },
  ttfb: { budget: 800, unit: 'ms', name: 'Time to First Byte' },
  bundleSize: { budget: 1000, unit: 'KB', name: 'Bundle Size' },
  renderTime: { budget: 16, unit: 'ms', name: 'Render Time' }
};

export default function PerformanceDashboard() {
  const { getStats, getReport, recordMetric } = usePerformanceMonitor();
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d'>('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Update metrics periodically
  useEffect(() => {
    const updateMetrics = () => {
      const newMetrics: PerformanceMetric[] = [];
      const timestamp = Date.now();
      const newDataPoint: ChartDataPoint = { timestamp };

      for (const [key, config] of Object.entries(PERFORMANCE_BUDGETS)) {
        const stats = getStats(key);
        if (stats.count > 0) {
          const value = stats.p95; // Use 95th percentile
          const status = getMetricStatus(value, config.budget, key === 'cls' ? false : true);
          const trend = getTrend(key, value);

          newMetrics.push({
            name: config.name,
            value,
            unit: config.unit,
            budget: config.budget,
            status,
            trend
          });

          newDataPoint[key] = value;
        }
      }

      setMetrics(newMetrics);
      
      // Add to chart data
      setChartData(prev => {
        const updated = [...prev, newDataPoint];
        // Keep only last 100 data points
        return updated.slice(-100);
      });
    };

    updateMetrics();

    if (autoRefresh) {
      const interval = setInterval(updateMetrics, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, getStats]);

  const getMetricStatus = (value: number, budget: number, lowerIsBetter: boolean): 'good' | 'warning' | 'critical' => {
    const ratio = lowerIsBetter ? value / budget : budget / value;
    if (ratio <= 0.8) return 'good';
    if (ratio <= 1.0) return 'warning';
    return 'critical';
  };

  const getTrend = (metric: string, currentValue: number): 'up' | 'down' | 'stable' => {
    // Simple trend calculation based on last few values
    const stats = getStats(metric);
    if (stats.count < 5) return 'stable';
    
    // Compare current value with recent average
    const recentValues = stats.count > 10 ? 
      stats.mean : // Use mean for small samples
      currentValue; // Use current for very small samples
    
    const diff = (currentValue - recentValues) / recentValues;
    if (Math.abs(diff) < 0.05) return 'stable';
    return diff > 0 ? 'up' : 'down';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-green-500" />;
      default: return null;
    }
  };

  const coreWebVitals = metrics.filter(m => 
    ['First Contentful Paint', 'Largest Contentful Paint', 'First Input Delay', 'Cumulative Layout Shift'].includes(m.name)
  );

  const performanceScore = useMemo(() => {
    if (metrics.length === 0) return 0;
    const goodMetrics = metrics.filter(m => m.status === 'good').length;
    return Math.round((goodMetrics / metrics.length) * 100);
  }, [metrics]);

  const formatValue = (value: number, unit: string) => {
    if (unit === 'ms') return `${Math.round(value)}ms`;
    if (unit === 'KB') return `${Math.round(value)}KB`;
    if (unit === 'score') return value.toFixed(3);
    return value.toString();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Dashboard</h1>
          <p className="text-muted-foreground">Real-time performance monitoring and optimization</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "Auto Refresh On" : "Auto Refresh Off"}
          </Button>
          <Badge variant="outline" className="text-lg">
            Score: {performanceScore}%
          </Badge>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {coreWebVitals.map((metric) => (
          <Card key={metric.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.name}
              </CardTitle>
              <div className="flex items-center space-x-1">
                {getStatusIcon(metric.status)}
                {getTrendIcon(metric.trend)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatValue(metric.value, metric.unit)}
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Budget: {formatValue(metric.budget, metric.unit)}
                </p>
                <Badge variant={metric.status === 'good' ? 'default' : 
                              metric.status === 'warning' ? 'secondary' : 'destructive'}>
                  {metric.status}
                </Badge>
              </div>
              <Progress 
                value={Math.min((metric.value / metric.budget) * 100, 100)} 
                className="mt-2"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Metrics */}
      <Tabs defaultValue="vitals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vitals">Core Web Vitals</TabsTrigger>
          <TabsTrigger value="loading">Loading Performance</TabsTrigger>
          <TabsTrigger value="runtime">Runtime Performance</TabsTrigger>
          <TabsTrigger value="bundle">Bundle Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="vitals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Core Web Vitals Trends</CardTitle>
              <CardDescription>
                Performance metrics over time (95th percentile)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: number, name: string) => [
                        formatValue(value, PERFORMANCE_BUDGETS[name as keyof typeof PERFORMANCE_BUDGETS]?.unit || 'ms'),
                        PERFORMANCE_BUDGETS[name as keyof typeof PERFORMANCE_BUDGETS]?.name || name
                      ]}
                    />
                    <Line type="monotone" dataKey="fcp" stroke="#8884d8" strokeWidth={2} />
                    <Line type="monotone" dataKey="lcp" stroke="#82ca9d" strokeWidth={2} />
                    <Line type="monotone" dataKey="fid" stroke="#ffc658" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loading" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Loading Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.filter(m => 
                    ['Time to First Byte', 'First Contentful Paint'].includes(m.name)
                  ).map((metric) => (
                    <div key={metric.name} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{metric.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Budget: {formatValue(metric.budget, metric.unit)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${getStatusColor(metric.status)}`}>
                          {formatValue(metric.value, metric.unit)}
                        </p>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(metric.status)}
                          {getTrendIcon(metric.trend)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resource Loading</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.slice(-10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="ttfb" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="runtime" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Runtime Performance</CardTitle>
              <CardDescription>
                Application performance during user interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatValue(getStats('renderTime').mean, 'ms')}
                  </div>
                  <p className="text-sm text-muted-foreground">Avg Render Time</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {getStats('fid').count}
                  </div>
                  <p className="text-sm text-muted-foreground">User Interactions</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(1000 / Math.max(getStats('renderTime').mean, 16))}fps
                  </div>
                  <p className="text-sm text-muted-foreground">Estimated FPS</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bundle" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bundle Analysis</CardTitle>
              <CardDescription>
                Application bundle size and optimization status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2">Bundle Size</h3>
                    <div className="text-2xl font-bold">
                      {formatValue(getStats('bundleSize').mean || 0, 'KB')}
                    </div>
                    <Progress 
                      value={Math.min((getStats('bundleSize').mean / 1000) * 100, 100)} 
                      className="mt-2"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Budget: 1000KB
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Optimization Score</h3>
                    <div className="text-2xl font-bold text-green-600">
                      {performanceScore}%
                    </div>
                    <Progress value={performanceScore} className="mt-2" />
                    <p className="text-sm text-muted-foreground mt-1">
                      Based on performance budgets
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="h-5 w-5 mr-2" />
            Performance Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {metrics.filter(m => m.status === 'critical').length > 0 && (
              <div className="p-3 border-l-4 border-red-500 bg-red-50">
                <h4 className="font-semibold text-red-800">Critical Issues</h4>
                <ul className="text-sm text-red-700 mt-1">
                  {metrics.filter(m => m.status === 'critical').map(m => (
                    <li key={m.name}>
                      {m.name} exceeds budget by {Math.round(((m.value / m.budget) - 1) * 100)}%
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {metrics.filter(m => m.status === 'warning').length > 0 && (
              <div className="p-3 border-l-4 border-yellow-500 bg-yellow-50">
                <h4 className="font-semibold text-yellow-800">Warnings</h4>
                <ul className="text-sm text-yellow-700 mt-1">
                  {metrics.filter(m => m.status === 'warning').map(m => (
                    <li key={m.name}>
                      {m.name} is approaching budget limit
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {metrics.filter(m => m.status === 'critical' || m.status === 'warning').length === 0 && (
              <div className="p-3 border-l-4 border-green-500 bg-green-50">
                <h4 className="font-semibold text-green-800">All Good!</h4>
                <p className="text-sm text-green-700 mt-1">
                  All performance metrics are within budget. Keep up the good work!
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}