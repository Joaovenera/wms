import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown,
  Activity,
  Clock,
  Target,
  Zap,
  BarChart3,
  PieChart,
  Users,
  Package,
  AlertTriangle,
  CheckCircle,
  Timer,
  Award,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingItem {
  id: number;
  productName: string;
  productSku: string;
  requestedQuantity: string;
  loadedQuantity: string;
  scannedAt?: string;
  confirmedAt?: string;
  divergenceReason?: string;
}

interface ExecutionData {
  id: number;
  transferRequestCode: string;
  operatorName: string;
  startedAt: string;
  finishedAt?: string;
  status: string;
  items: LoadingItem[];
}

interface PerformanceMetricsProps {
  execution: ExecutionData;
  historicalData?: ExecutionData[];
  className?: string;
}

interface MetricData {
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  label: string;
  format: 'percentage' | 'number' | 'time' | 'rate';
}

export function PerformanceMetrics({ 
  execution, 
  historicalData = [], 
  className 
}: PerformanceMetricsProps) {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const currentMetrics = calculateCurrentMetrics(execution);
  const comparisonMetrics = calculateComparisonMetrics(execution, historicalData);
  const timeSeriesData = generateTimeSeriesData(execution);

  // Auto-refresh for live executions
  useEffect(() => {
    if (execution.status === 'em_andamento') {
      const interval = setInterval(() => {
        // Force re-render to update time-based metrics
        setSelectedTab(prev => prev);
      }, 30000); // Update every 30 seconds

      setRefreshInterval(interval);
      return () => clearInterval(interval);
    }
  }, [execution.status]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Métricas de Performance
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <Badge 
                variant={execution.status === 'em_andamento' ? 'default' : 'secondary'}
                className="flex items-center gap-1"
              >
                <Activity className="h-3 w-3" />
                {execution.status === 'em_andamento' ? 'Ao Vivo' : 'Histórico'}
              </Badge>
              
              {execution.status === 'em_andamento' && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  Auto-atualiza 30s
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Metrics Dashboard */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="efficiency">Eficiência</TabsTrigger>
          <TabsTrigger value="quality">Qualidade</TabsTrigger>
          <TabsTrigger value="trends">Tendências</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewMetrics 
            current={currentMetrics}
            comparison={comparisonMetrics}
          />
        </TabsContent>

        <TabsContent value="efficiency" className="space-y-6">
          <EfficiencyMetrics 
            execution={execution}
            historical={historicalData}
          />
        </TabsContent>

        <TabsContent value="quality" className="space-y-6">
          <QualityMetrics 
            execution={execution}
            historical={historicalData}
          />
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <TrendAnalysis 
            timeSeries={timeSeriesData}
            historical={historicalData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface OverviewMetricsProps {
  current: any;
  comparison: any;
}

function OverviewMetrics({ current, comparison }: OverviewMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Taxa de Progresso"
        metric={{
          value: current.progressRate,
          change: comparison.progressRate?.change || 0,
          trend: comparison.progressRate?.trend || 'stable',
          label: 'itens/min',
          format: 'rate'
        }}
        icon={Target}
        color="blue"
      />

      <MetricCard
        title="Eficiência Operacional"
        metric={{
          value: current.efficiency,
          change: comparison.efficiency?.change || 0,
          trend: comparison.efficiency?.trend || 'stable',
          label: 'eficiência geral',
          format: 'percentage'
        }}
        icon={Zap}
        color="green"
      />

      <MetricCard
        title="Tempo Médio/Item"
        metric={{
          value: current.avgTimePerItem,
          change: comparison.avgTimePerItem?.change || 0,
          trend: comparison.avgTimePerItem?.trend || 'stable',
          label: 'segundos',
          format: 'time'
        }}
        icon={Clock}
        color="purple"
      />

      <MetricCard
        title="Taxa de Precisão"
        metric={{
          value: current.accuracy,
          change: comparison.accuracy?.change || 0,
          trend: comparison.accuracy?.trend || 'stable',
          label: 'precisão',
          format: 'percentage'
        }}
        icon={Award}
        color="yellow"
      />
    </div>
  );
}

interface EfficiencyMetricsProps {
  execution: ExecutionData;
  historical: ExecutionData[];
}

function EfficiencyMetrics({ execution, historical }: EfficiencyMetricsProps) {
  const efficiency = calculateEfficiencyMetrics(execution);
  const benchmark = calculateBenchmarkMetrics(historical);

  return (
    <div className="space-y-6">
      {/* Efficiency Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Velocidade de Escaneamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{efficiency.scanRate.toFixed(1)}</span>
              <span className="text-sm text-gray-500">itens/min</span>
            </div>
            <Progress value={Math.min((efficiency.scanRate / 5) * 100, 100)} />
            <div className="text-xs text-gray-500 mt-1">
              Meta: 3-5 itens/min
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Tempo de Confirmação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{efficiency.confirmationTime.toFixed(0)}</span>
              <span className="text-sm text-gray-500">segundos</span>
            </div>
            <Progress value={Math.max(100 - (efficiency.confirmationTime / 60) * 100, 0)} />
            <div className="text-xs text-gray-500 mt-1">
              Meta: &lt; 30 segundos
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Utilização do Tempo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{efficiency.timeUtilization.toFixed(0)}</span>
              <span className="text-sm text-gray-500">%</span>
            </div>
            <Progress value={efficiency.timeUtilization} />
            <div className="text-xs text-gray-500 mt-1">
              Tempo ativo vs. total
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Benchmark Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Comparação com Histórico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-medium mb-3">Performance Atual vs. Média</div>
              <div className="space-y-3">
                {Object.entries(benchmark).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-sm">{getBenchmarkLabel(key)}:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatBenchmarkValue(key, value.current)}</span>
                      <Badge variant={value.isGood ? 'default' : 'secondary'} className="text-xs">
                        {value.isGood ? '👍' : '📈'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium mb-3">Rankings de Performance</div>
              <div className="space-y-2">
                <PerformanceRanking
                  label="Velocidade"
                  current={efficiency.scanRate}
                  historical={historical.map(h => calculateEfficiencyMetrics(h).scanRate)}
                  format="rate"
                />
                <PerformanceRanking
                  label="Precisão"
                  current={efficiency.accuracy}
                  historical={historical.map(h => calculateEfficiencyMetrics(h).accuracy)}
                  format="percentage"
                />
                <PerformanceRanking
                  label="Consistência"
                  current={efficiency.consistency}
                  historical={historical.map(h => calculateEfficiencyMetrics(h).consistency)}
                  format="percentage"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface QualityMetricsProps {
  execution: ExecutionData;
  historical: ExecutionData[];
}

function QualityMetrics({ execution, historical }: QualityMetricsProps) {
  const quality = calculateQualityMetrics(execution);

  return (
    <div className="space-y-6">
      {/* Quality Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Pontuação de Qualidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-8 border-gray-200 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold">{quality.overallScore}</div>
                  <div className="text-sm text-gray-500">/ 100</div>
                </div>
              </div>
              <div 
                className="absolute top-0 left-0 w-32 h-32 rounded-full border-8 border-transparent"
                style={{
                  borderTopColor: quality.overallScore >= 90 ? '#10b981' : quality.overallScore >= 70 ? '#f59e0b' : '#ef4444',
                  transform: `rotate(${(quality.overallScore / 100) * 360}deg)`,
                  transition: 'transform 0.5s ease-in-out'
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QualityMetricItem
              label="Precisão"
              value={quality.accuracy}
              icon={Target}
              color="green"
            />
            <QualityMetricItem
              label="Completude"
              value={quality.completeness}
              icon={CheckCircle}
              color="blue"
            />
            <QualityMetricItem
              label="Consistência"
              value={quality.consistency}
              icon={Activity}
              color="purple"
            />
            <QualityMetricItem
              label="Pontualidade"
              value={quality.timeliness}
              icon={Clock}
              color="yellow"
            />
          </div>
        </CardContent>
      </Card>

      {/* Error Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Análise de Divergências
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-medium mb-3">Tipos de Divergências</div>
              <div className="space-y-2">
                {quality.divergenceBreakdown.map(item => (
                  <div key={item.type} className="flex justify-between items-center p-2 rounded bg-gray-50">
                    <span className="text-sm">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.count}</span>
                      <div className="w-16 h-2 bg-gray-200 rounded">
                        <div 
                          className="h-full bg-red-500 rounded"
                          style={{ width: `${(item.count / Math.max(...quality.divergenceBreakdown.map(d => d.count))) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-3">Impacto das Divergências</div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Itens Afetados:</span>
                  <span className="font-medium">{quality.affectedItems} / {execution.items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Impacto no Tempo:</span>
                  <span className="font-medium">+{quality.timeImpact} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Taxa de Resolução:</span>
                  <span className="font-medium">{quality.resolutionRate}%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface TrendAnalysisProps {
  timeSeries: any[];
  historical: ExecutionData[];
}

function TrendAnalysis({ timeSeries, historical }: TrendAnalysisProps) {
  const trends = calculateTrendMetrics(historical);

  return (
    <div className="space-y-6">
      {/* Trend Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TrendCard
          title="Velocidade Média"
          current={trends.averageSpeed.current}
          previous={trends.averageSpeed.previous}
          format="rate"
          icon={Zap}
        />
        <TrendCard
          title="Qualidade Média"
          current={trends.averageQuality.current}
          previous={trends.averageQuality.previous}
          format="percentage"
          icon={Award}
        />
        <TrendCard
          title="Eficiência Geral"
          current={trends.averageEfficiency.current}
          previous={trends.averageEfficiency.previous}
          format="percentage"
          icon={TrendingUp}
        />
      </div>

      {/* Historical Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Histórica (Últimas 10 Execuções)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end justify-between gap-2">
            {historical.slice(-10).map((execution, index) => {
              const metrics = calculateCurrentMetrics(execution);
              const height = (metrics.efficiency / 100) * 200;
              
              return (
                <div key={execution.id} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${height}px`, minHeight: '10px' }}
                  />
                  <div className="text-xs text-gray-500 mt-1 text-center">
                    {new Date(execution.startedAt).toLocaleDateString('pt-BR', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper Components
interface MetricCardProps {
  title: string;
  metric: MetricData;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'yellow';
}

function MetricCard({ title, metric, icon: Icon, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    yellow: 'text-yellow-600'
  };

  const TrendIcon = metric.trend === 'up' ? ArrowUp : metric.trend === 'down' ? ArrowDown : Minus;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">
                {formatMetricValue(metric.value, metric.format)}
              </p>
              {metric.change !== 0 && (
                <div className={cn(
                  "flex items-center gap-1 text-xs",
                  metric.trend === 'up' ? "text-green-600" : 
                  metric.trend === 'down' ? "text-red-600" : "text-gray-600"
                )}>
                  <TrendIcon className="h-3 w-3" />
                  {Math.abs(metric.change).toFixed(1)}%
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">{metric.label}</p>
          </div>
          <Icon className={cn("h-8 w-8", colorClasses[color])} />
        </div>
      </CardContent>
    </Card>
  );
}

interface QualityMetricItemProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'yellow';
}

function QualityMetricItem({ label, value, icon: Icon, color }: QualityMetricItemProps) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
    yellow: 'text-yellow-600 bg-yellow-50'
  };

  return (
    <div className="text-center">
      <div className={cn("w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center", colorClasses[color])}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

interface PerformanceRankingProps {
  label: string;
  current: number;
  historical: number[];
  format: 'rate' | 'percentage' | 'time';
}

function PerformanceRanking({ label, current, historical, format }: PerformanceRankingProps) {
  const sortedValues = [...historical, current].sort((a, b) => b - a);
  const rank = sortedValues.indexOf(current) + 1;
  const percentile = ((sortedValues.length - rank + 1) / sortedValues.length) * 100;

  return (
    <div className="flex justify-between items-center p-2 rounded bg-gray-50">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {formatMetricValue(current, format)}
        </span>
        <Badge 
          variant={percentile >= 75 ? 'default' : percentile >= 50 ? 'secondary' : 'outline'}
          className="text-xs"
        >
          Top {percentile.toFixed(0)}%
        </Badge>
      </div>
    </div>
  );
}

interface TrendCardProps {
  title: string;
  current: number;
  previous: number;
  format: 'rate' | 'percentage' | 'time';
  icon: React.ComponentType<{ className?: string }>;
}

function TrendCard({ title, current, previous, format, icon: Icon }: TrendCardProps) {
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-600">{title}</div>
          <Icon className="h-5 w-5 text-gray-400" />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">
            {formatMetricValue(current, format)}
          </span>
          {change !== 0 && (
            <div className={cn(
              "flex items-center gap-1",
              trend === 'up' ? "text-green-600" : 
              trend === 'down' ? "text-red-600" : "text-gray-600"
            )}>
              <TrendIcon className="h-4 w-4" />
              <span className="text-sm font-medium">
                {Math.abs(change).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        
        <div className="text-xs text-gray-500 mt-1">
          vs. período anterior
        </div>
      </CardContent>
    </Card>
  );
}

// Utility functions (implement these based on your specific metric calculations)
function calculateCurrentMetrics(execution: ExecutionData) {
  const startTime = new Date(execution.startedAt);
  const now = new Date();
  const elapsedMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);
  
  const completedItems = execution.items.filter(item => item.confirmedAt).length;
  const totalItems = execution.items.length;
  const divergences = execution.items.filter(item => item.divergenceReason).length;
  
  const progressRate = completedItems / Math.max(elapsedMinutes, 1);
  const efficiency = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  const avgTimePerItem = elapsedMinutes / Math.max(completedItems, 1) * 60; // in seconds
  const accuracy = totalItems > 0 ? ((totalItems - divergences) / totalItems) * 100 : 100;

  return {
    progressRate,
    efficiency,
    avgTimePerItem,
    accuracy
  };
}

function calculateComparisonMetrics(execution: ExecutionData, historical: ExecutionData[]) {
  if (historical.length === 0) return {};
  
  const current = calculateCurrentMetrics(execution);
  const historicalAvg = historical.reduce((acc, h) => {
    const metrics = calculateCurrentMetrics(h);
    return {
      progressRate: acc.progressRate + metrics.progressRate,
      efficiency: acc.efficiency + metrics.efficiency,
      avgTimePerItem: acc.avgTimePerItem + metrics.avgTimePerItem,
      accuracy: acc.accuracy + metrics.accuracy
    };
  }, { progressRate: 0, efficiency: 0, avgTimePerItem: 0, accuracy: 0 });

  Object.keys(historicalAvg).forEach(key => {
    historicalAvg[key as keyof typeof historicalAvg] /= historical.length;
  });

  return {
    progressRate: {
      change: historicalAvg.progressRate > 0 ? ((current.progressRate - historicalAvg.progressRate) / historicalAvg.progressRate) * 100 : 0,
      trend: current.progressRate > historicalAvg.progressRate ? 'up' : current.progressRate < historicalAvg.progressRate ? 'down' : 'stable'
    },
    efficiency: {
      change: historicalAvg.efficiency > 0 ? ((current.efficiency - historicalAvg.efficiency) / historicalAvg.efficiency) * 100 : 0,
      trend: current.efficiency > historicalAvg.efficiency ? 'up' : current.efficiency < historicalAvg.efficiency ? 'down' : 'stable'
    },
    avgTimePerItem: {
      change: historicalAvg.avgTimePerItem > 0 ? ((current.avgTimePerItem - historicalAvg.avgTimePerItem) / historicalAvg.avgTimePerItem) * 100 : 0,
      trend: current.avgTimePerItem < historicalAvg.avgTimePerItem ? 'up' : current.avgTimePerItem > historicalAvg.avgTimePerItem ? 'down' : 'stable' // Lower time is better
    },
    accuracy: {
      change: historicalAvg.accuracy > 0 ? ((current.accuracy - historicalAvg.accuracy) / historicalAvg.accuracy) * 100 : 0,
      trend: current.accuracy > historicalAvg.accuracy ? 'up' : current.accuracy < historicalAvg.accuracy ? 'down' : 'stable'
    }
  };
}

function calculateEfficiencyMetrics(execution: ExecutionData) {
  const startTime = new Date(execution.startedAt);
  const now = new Date();
  const elapsedMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);
  
  const completedItems = execution.items.filter(item => item.confirmedAt).length;
  const scannedItems = execution.items.filter(item => item.scannedAt).length;
  const divergences = execution.items.filter(item => item.divergenceReason).length;
  
  const scanRate = scannedItems / Math.max(elapsedMinutes, 1);
  const confirmationTime = completedItems > 0 ? (elapsedMinutes * 60) / completedItems : 0;
  const timeUtilization = Math.min((completedItems * 30) / (elapsedMinutes * 60) * 100, 100); // Assuming 30s per item as ideal
  const accuracy = execution.items.length > 0 ? ((execution.items.length - divergences) / execution.items.length) * 100 : 100;
  const consistency = 85; // Placeholder - would need more complex calculation

  return {
    scanRate,
    confirmationTime,
    timeUtilization,
    accuracy,
    consistency
  };
}

function calculateBenchmarkMetrics(historical: ExecutionData[]) {
  if (historical.length === 0) return {};
  
  // Placeholder implementation
  return {
    scanRate: { current: 2.3, average: 2.1, isGood: true },
    accuracy: { current: 95, average: 92, isGood: true },
    efficiency: { current: 87, average: 85, isGood: true }
  };
}

function calculateQualityMetrics(execution: ExecutionData) {
  const totalItems = execution.items.length;
  const completedItems = execution.items.filter(item => item.confirmedAt).length;
  const divergences = execution.items.filter(item => item.divergenceReason).length;
  
  const accuracy = totalItems > 0 ? ((totalItems - divergences) / totalItems) * 100 : 100;
  const completeness = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  const consistency = 85; // Placeholder
  const timeliness = 90; // Placeholder
  
  const overallScore = Math.round((accuracy + completeness + consistency + timeliness) / 4);
  
  const divergenceBreakdown = [
    { type: 'falta_espaco', label: 'Falta de Espaço', count: 0 },
    { type: 'item_avariado', label: 'Item Avariado', count: 0 },
    { type: 'divergencia_estoque', label: 'Divergência de Estoque', count: 0 },
    { type: 'item_nao_localizado', label: 'Item Não Localizado', count: 0 }
  ];
  
  execution.items.forEach(item => {
    if (item.divergenceReason) {
      const breakdown = divergenceBreakdown.find(d => d.type === item.divergenceReason);
      if (breakdown) breakdown.count++;
    }
  });

  return {
    overallScore,
    accuracy,
    completeness,
    consistency,
    timeliness,
    divergenceBreakdown,
    affectedItems: divergences,
    timeImpact: divergences * 2, // Placeholder: 2 minutes per divergence
    resolutionRate: 100 // Placeholder
  };
}

function calculateTrendMetrics(historical: ExecutionData[]) {
  if (historical.length < 2) {
    return {
      averageSpeed: { current: 0, previous: 0 },
      averageQuality: { current: 0, previous: 0 },
      averageEfficiency: { current: 0, previous: 0 }
    };
  }

  const recent = historical.slice(-5).map(h => calculateCurrentMetrics(h));
  const older = historical.slice(-10, -5).map(h => calculateCurrentMetrics(h));

  const avgRecent = recent.reduce((acc, m) => ({
    progressRate: acc.progressRate + m.progressRate,
    accuracy: acc.accuracy + m.accuracy,
    efficiency: acc.efficiency + m.efficiency
  }), { progressRate: 0, accuracy: 0, efficiency: 0 });

  const avgOlder = older.reduce((acc, m) => ({
    progressRate: acc.progressRate + m.progressRate,
    accuracy: acc.accuracy + m.accuracy,
    efficiency: acc.efficiency + m.efficiency
  }), { progressRate: 0, accuracy: 0, efficiency: 0 });

  return {
    averageSpeed: {
      current: avgRecent.progressRate / recent.length,
      previous: avgOlder.progressRate / Math.max(older.length, 1)
    },
    averageQuality: {
      current: avgRecent.accuracy / recent.length,
      previous: avgOlder.accuracy / Math.max(older.length, 1)
    },
    averageEfficiency: {
      current: avgRecent.efficiency / recent.length,
      previous: avgOlder.efficiency / Math.max(older.length, 1)
    }
  };
}

function generateTimeSeriesData(execution: ExecutionData) {
  // Placeholder - would generate time series data for charts
  return [];
}

function formatMetricValue(value: number, format: string): string {
  switch (format) {
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'rate':
      return value.toFixed(1);
    case 'time':
      return `${value.toFixed(0)}s`;
    default:
      return value.toFixed(0);
  }
}

function getBenchmarkLabel(key: string): string {
  const labels = {
    scanRate: 'Taxa de Escaneamento',
    accuracy: 'Precisão',
    efficiency: 'Eficiência'
  };
  return labels[key as keyof typeof labels] || key;
}

function formatBenchmarkValue(key: string, value: number): string {
  if (key === 'scanRate') return `${value.toFixed(1)}/min`;
  if (key === 'accuracy' || key === 'efficiency') return `${value.toFixed(0)}%`;
  return value.toString();
}