import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Package, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Timer,
  Target,
  Activity,
  User,
  Truck,
  BarChart3,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingItem {
  id: number;
  productName: string;
  productSku: string;
  requestedQuantity: string;
  loadedQuantity: string;
  notLoadedQuantity: string;
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

interface ExecutionDashboardProps {
  execution: ExecutionData;
  className?: string;
}

export function ExecutionDashboard({ execution, className }: ExecutionDashboardProps) {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Calculate metrics
  const stats = calculateExecutionStats(execution);
  const timeMetrics = calculateTimeMetrics(execution);
  const efficiency = calculateEfficiencyMetrics(execution, stats);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Progresso Geral"
          value={`${stats.percentage.toFixed(1)}%`}
          subtitle={`${stats.completed}/${stats.total} itens`}
          icon={Target}
          color="blue"
          isSelected={selectedMetric === 'progress'}
          onClick={() => setSelectedMetric(selectedMetric === 'progress' ? null : 'progress')}
        >
          <Progress value={stats.percentage} className="mt-2" />
        </MetricCard>

        <MetricCard
          title="Tempo Decorrido"
          value={timeMetrics.elapsed}
          subtitle={`Iniciado às ${timeMetrics.startTime}`}
          icon={Timer}
          color="green"
          isSelected={selectedMetric === 'time'}
          onClick={() => setSelectedMetric(selectedMetric === 'time' ? null : 'time')}
        />

        <MetricCard
          title="Eficiência"
          value={`${efficiency.scanRate.toFixed(1)}/min`}
          subtitle="Itens por minuto"
          icon={TrendingUp}
          color="purple"
          trend={efficiency.trend}
          isSelected={selectedMetric === 'efficiency'}
          onClick={() => setSelectedMetric(selectedMetric === 'efficiency' ? null : 'efficiency')}
        />

        <MetricCard
          title="Divergências"
          value={stats.divergences.toString()}
          subtitle={stats.divergences > 0 ? "Requer atenção" : "Nenhuma detectada"}
          icon={AlertTriangle}
          color={stats.divergences > 0 ? "red" : "green"}
          isSelected={selectedMetric === 'divergences'}
          onClick={() => setSelectedMetric(selectedMetric === 'divergences' ? null : 'divergences')}
        />
      </div>

      {/* Detailed Progress Panel */}
      {selectedMetric === 'progress' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Target className="h-5 w-5" />
              Detalhamento do Progresso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-sm text-gray-600">Completos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.partial}</div>
                <div className="text-sm text-gray-600">Parciais</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.pending}</div>
                <div className="text-sm text-gray-600">Pendentes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Analysis Panel */}
      {selectedMetric === 'time' && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Clock className="h-5 w-5" />
              Análise de Tempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-lg font-semibold text-green-700">Tempo Decorrido</div>
                <div className="text-2xl font-bold">{timeMetrics.elapsed}</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-700">Tempo Estimado</div>
                <div className="text-2xl font-bold">{timeMetrics.estimated}</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-700">Previsão de Término</div>
                <div className="text-2xl font-bold">{timeMetrics.estimatedFinish}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Efficiency Analysis Panel */}
      {selectedMetric === 'efficiency' && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Activity className="h-5 w-5" />
              Métricas de Eficiência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-lg font-semibold text-purple-700 mb-3">Performance do Operador</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Taxa de Escaneamento:</span>
                    <span className="font-bold">{efficiency.scanRate.toFixed(1)}/min</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Precisão:</span>
                    <span className="font-bold">{efficiency.accuracy.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tempo Médio/Item:</span>
                    <span className="font-bold">{efficiency.avgTimePerItem}s</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-purple-700 mb-3">Tendência</div>
                <div className="flex items-center gap-2">
                  <TrendingUp className={cn(
                    "h-6 w-6",
                    efficiency.trend === 'up' ? "text-green-500" : 
                    efficiency.trend === 'down' ? "text-red-500" : "text-gray-500"
                  )} />
                  <span className="font-bold">
                    {efficiency.trend === 'up' ? 'Melhorando' :
                     efficiency.trend === 'down' ? 'Diminuindo' : 'Estável'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Divergences Panel */}
      {selectedMetric === 'divergences' && stats.divergences > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              Divergências Detectadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {execution.items
                .filter(item => item.divergenceReason)
                .map(item => (
                  <div key={item.id} className="p-3 bg-white rounded border-l-4 border-red-400">
                    <div className="font-medium">{item.productName}</div>
                    <div className="text-sm text-gray-600">SKU: {item.productSku}</div>
                    <div className="text-sm text-red-600 mt-1">
                      Motivo: {getDivergenceReasonLabel(item.divergenceReason)}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Status Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant={execution.status === 'em_andamento' ? 'default' : 'secondary'} className="px-3 py-1">
                <Activity className="h-3 w-3 mr-1" />
                {execution.status === 'em_andamento' ? 'Execução Ativa' : 'Finalizado'}
              </Badge>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                {execution.operatorName}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Truck className="h-4 w-4" />
                {execution.transferRequestCode}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">
                Atualizado agora
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'red';
  trend?: 'up' | 'down' | 'stable';
  isSelected?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color, 
  trend, 
  isSelected, 
  onClick,
  children 
}: MetricCardProps) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'text-blue-600'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200', 
      text: 'text-green-800',
      icon: 'text-green-600'
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-800', 
      icon: 'text-purple-600'
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: 'text-red-600'
    }
  };

  const classes = colorClasses[color];

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        isSelected && `${classes.bg} ${classes.border} shadow-md`
      )}
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <div className="flex items-center gap-2">
              <p className={cn("text-2xl font-bold", isSelected ? classes.text : "text-gray-900")}>
                {value}
              </p>
              {trend && (
                <TrendingUp className={cn(
                  "h-4 w-4",
                  trend === 'up' ? "text-green-500" : 
                  trend === 'down' ? "text-red-500 rotate-180" : "text-gray-400"
                )} />
              )}
            </div>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
          <Icon className={cn("h-8 w-8", isSelected ? classes.icon : "text-gray-400")} />
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// Helper functions
function calculateExecutionStats(execution: ExecutionData) {
  const total = execution.items.length;
  const completed = execution.items.filter(item => item.confirmedAt).length;
  const partial = execution.items.filter(item => {
    if (!item.confirmedAt) return false;
    const loaded = parseFloat(item.loadedQuantity);
    const requested = parseFloat(item.requestedQuantity);
    return loaded > 0 && loaded < requested;
  }).length;
  const pending = total - completed;
  const divergences = execution.items.filter(item => item.divergenceReason).length;
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return {
    total,
    completed,
    partial,
    pending,
    divergences,
    percentage
  };
}

function calculateTimeMetrics(execution: ExecutionData) {
  const startTime = new Date(execution.startedAt);
  const now = new Date();
  const elapsedMs = now.getTime() - startTime.getTime();
  const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const remainingMinutes = elapsedMinutes % 60;

  const elapsed = elapsedHours > 0 
    ? `${elapsedHours}h ${remainingMinutes}m`
    : `${elapsedMinutes}m`;

  // Estimate remaining time based on progress
  const stats = calculateExecutionStats(execution);
  const avgTimePerItem = elapsedMinutes / Math.max(stats.completed, 1);
  const estimatedTotalTime = avgTimePerItem * stats.total;
  const estimatedRemainingTime = Math.max(0, estimatedTotalTime - elapsedMinutes);
  
  const estimated = estimatedRemainingTime > 60
    ? `${Math.floor(estimatedRemainingTime / 60)}h ${Math.floor(estimatedRemainingTime % 60)}m`
    : `${Math.floor(estimatedRemainingTime)}m`;

  const estimatedFinishTime = new Date(now.getTime() + estimatedRemainingTime * 60 * 1000);
  const estimatedFinish = estimatedFinishTime.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return {
    elapsed,
    estimated,
    estimatedFinish,
    startTime: startTime.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  };
}

function calculateEfficiencyMetrics(execution: ExecutionData, stats: any) {
  const startTime = new Date(execution.startedAt);
  const now = new Date();
  const elapsedMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);
  
  const scanRate = stats.completed / Math.max(elapsedMinutes, 1);
  const accuracy = stats.total > 0 ? ((stats.total - stats.divergences) / stats.total) * 100 : 100;
  const avgTimePerItem = Math.round((elapsedMinutes * 60) / Math.max(stats.completed, 1));

  // Simple trend calculation (could be enhanced with historical data)
  const trend = scanRate > 2 ? 'up' : scanRate > 1 ? 'stable' : 'down';

  return {
    scanRate,
    accuracy,
    avgTimePerItem,
    trend
  };
}

function getDivergenceReasonLabel(reason?: string): string {
  const reasons = {
    'falta_espaco': 'Falta de espaço no caminhão',
    'item_avariado': 'Item avariado',
    'divergencia_estoque': 'Divergência de estoque',
    'item_nao_localizado': 'Item não localizado'
  };
  return reasons[reason as keyof typeof reasons] || reason || 'Não especificado';
}