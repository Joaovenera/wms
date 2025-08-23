import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Ship,
  Clock, 
  Truck,
  Camera,
  Package,
  CheckCircle,
  AlertTriangle,
  Activity,
  TrendingUp,
  Calendar,
  Users,
  FileText,
  BarChart3
} from "lucide-react";
import { ContainerArrivalStats, CONTAINER_STATUS_CONFIG } from "@/types/container";
import { apiRequest } from "@/lib/queryClient";

interface ContainerDashboardProps {
  onNewContainer?: () => void;
}

export function ContainerDashboard({ onNewContainer }: ContainerDashboardProps) {
  // Fetch container statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/container-arrivals/stats'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/container-arrivals/stats');
      return await res.json() as ContainerArrivalStats;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch recent containers
  const { data: recentContainers, isLoading: containersLoading } = useQuery({
    queryKey: ['/api/container-arrivals', { limit: 5 }],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/container-arrivals?limit=5');
      return await res.json();
    },
    refetchInterval: 30000,
  });

  const getStatusIcon = (status: string) => {
    const config = CONTAINER_STATUS_CONFIG[status as keyof typeof CONTAINER_STATUS_CONFIG];
    if (!config) return Clock;
    
    const icons = {
      Clock,
      Truck,
      Camera,
      Package,
      CheckCircle
    };
    
    return icons[config.icon as keyof typeof icons] || Clock;
  };

  const getStatusColor = (status: string) => {
    const config = CONTAINER_STATUS_CONFIG[status as keyof typeof CONTAINER_STATUS_CONFIG];
    return config?.color || 'gray';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const completionRate = stats ? (stats.completed / stats.total) * 100 : 0;
  const processingRate = stats ? ((stats.documenting + stats.unloading) / stats.total) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Ship className="h-7 w-7 text-blue-600" />
            Dashboard de Containers
          </h2>
          <p className="text-gray-600">
            Visão geral e métricas dos containers em processamento
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Containers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Containers</CardTitle>
            <Ship className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : stats?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Containers registrados
            </p>
          </CardContent>
        </Card>

        {/* Awaiting */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-700">
              {statsLoading ? "..." : stats?.awaiting || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Programados para chegada
            </p>
          </CardContent>
        </Card>

        {/* In Process */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Processo</CardTitle>
            <Activity className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">
              {statsLoading ? "..." : (stats?.arrived || 0) + (stats?.documenting || 0) + (stats?.unloading || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Chegados e sendo processados
            </p>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finalizados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {statsLoading ? "..." : stats?.completed || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Containers processados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completion Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Taxa de Conclusão
            </CardTitle>
            <CardDescription>
              Containers finalizados vs total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-green-700">
                  {completionRate.toFixed(1)}%
                </span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {stats?.completed || 0} de {stats?.total || 0}
                </Badge>
              </div>
              <Progress value={completionRate} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Processing Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-yellow-600" />
              Taxa de Processamento
            </CardTitle>
            <CardDescription>
              Containers em documentação/descarregamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-yellow-700">
                  {processingRate.toFixed(1)}%
                </span>
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  {((stats?.documenting || 0) + (stats?.unloading || 0))} em processo
                </Badge>
              </div>
              <Progress value={processingRate} className="h-3" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Distribuição por Status
          </CardTitle>
          <CardDescription>
            Quantidade de containers por status atual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {Object.entries(CONTAINER_STATUS_CONFIG).map(([status, config]) => {
              const count = stats ? stats[status as keyof ContainerArrivalStats] || 0 : 0;
              const percentage = stats?.total ? (count / stats.total) * 100 : 0;
              const StatusIcon = getStatusIcon(status);
              
              return (
                <div key={status} className="text-center space-y-2">
                  <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center bg-${config.color}-100`}>
                    <StatusIcon className={`h-6 w-6 text-${config.color}-600`} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-gray-600">{config.label}</div>
                    <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Containers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Containers Recentes
          </CardTitle>
          <CardDescription>
            Últimos containers registrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {containersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : !recentContainers || recentContainers.length === 0 ? (
            <div className="text-center py-8">
              <Ship className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum container encontrado</p>
              <p className="text-sm text-gray-400">
                Os containers recentes aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentContainers.map((container: any) => {
                const StatusIcon = getStatusIcon(container.status);
                const statusConfig = CONTAINER_STATUS_CONFIG[container.status as keyof typeof CONTAINER_STATUS_CONFIG];
                
                return (
                  <div key={container.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full bg-${statusConfig?.color || 'gray'}-100 flex items-center justify-center`}>
                          <StatusIcon className={`h-5 w-5 text-${statusConfig?.color || 'gray'}-600`} />
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{container.container_number}</h3>
                            <Badge 
                              variant="secondary" 
                              className={`bg-${statusConfig?.color || 'gray'}-100 text-${statusConfig?.color || 'gray'}-800`}
                            >
                              {statusConfig?.label || container.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Fornecedor:</span> {container.supplier_name}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {formatDate(container.created_at)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {container.photo_count || 0}/4 fotos • {container.item_count || 0} itens
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:bg-blue-50 transition-colors border-blue-200" onClick={onNewContainer}>
          <CardContent className="flex items-center justify-center p-6">
            <div className="text-center space-y-2">
              <Ship className="h-8 w-8 text-blue-600 mx-auto" />
              <h3 className="font-semibold text-blue-900">Novo Container</h3>
              <p className="text-sm text-blue-700">Registrar chegada de container</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-green-50 transition-colors border-green-200">
          <CardContent className="flex items-center justify-center p-6">
            <div className="text-center space-y-2">
              <FileText className="h-8 w-8 text-green-600 mx-auto" />
              <h3 className="font-semibold text-green-900">Relatórios</h3>
              <p className="text-sm text-green-700">Gerar relatórios com fotos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-purple-50 transition-colors border-purple-200">
          <CardContent className="flex items-center justify-center p-6">
            <div className="text-center space-y-2">
              <Users className="h-8 w-8 text-purple-600 mx-auto" />
              <h3 className="font-semibold text-purple-900">Fornecedores</h3>
              <p className="text-sm text-purple-700">Histórico por fornecedor</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {stats && (stats.documenting > 0 || stats.arrived > 0) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900">
                  Containers Aguardando Processamento
                </h3>
                <p className="text-yellow-700 text-sm mt-1">
                  {stats.arrived > 0 && `${stats.arrived} container(s) chegaram e aguardam documentação. `}
                  {stats.documenting > 0 && `${stats.documenting} container(s) estão sendo documentados.`}
                </p>
                <p className="text-yellow-600 text-xs mt-2">
                  Certifique-se de que todas as fotos obrigatórias sejam registradas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}