import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Warehouse, 
  Package, 
  TrendingUp, 
  Activity,
  Layers,
  MapPin,
  Box,
  Truck
} from "lucide-react";
import WarehouseMap from "@/components/warehouse-map";

interface DashboardStats {
  totalPallets: number;
  activeUcps: number;
  occupancyRate: number;
  dailyMovements: number;
  palletsByStatus: { status: string; count: number }[];
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Visão geral do sistema de controle de estoque</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-success';
      case 'in_use': return 'text-destructive';
      case 'defective': return 'text-warning';
      case 'maintenance': return 'text-primary';
      case 'discard': return 'text-gray-500';
      default: return 'text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Disponível';
      case 'in_use': return 'Em Uso';
      case 'defective': return 'Defeituoso';
      case 'maintenance': return 'Recuperação';
      case 'discard': return 'Descarte';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Visão geral do sistema de controle de estoque</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Pallets</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalPallets.toLocaleString()}</p>
                <p className="text-sm text-success mt-1">
                  <TrendingUp className="inline h-4 w-4 mr-1" />
                  Sistema ativo
                </p>
              </div>
              <div className="bg-primary/10 p-3 rounded-full">
                <Layers className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">UCPs Ativas</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.activeUcps.toLocaleString()}</p>
                <p className="text-sm text-success mt-1">
                  <TrendingUp className="inline h-4 w-4 mr-1" />
                  Em operação
                </p>
              </div>
              <div className="bg-success/10 p-3 rounded-full">
                <Box className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Taxa de Ocupação</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.occupancyRate}%</p>
                <p className="text-sm text-warning mt-1">
                  <Activity className="inline h-4 w-4 mr-1" />
                  Capacidade atual
                </p>
              </div>
              <div className="bg-warning/10 p-3 rounded-full">
                <Warehouse className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Movimentações/Dia</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.dailyMovements}</p>
                <p className="text-sm text-secondary mt-1">
                  <Activity className="inline h-4 w-4 mr-1" />
                  Atividade hoje
                </p>
              </div>
              <div className="bg-secondary/10 p-3 rounded-full">
                <Truck className="h-6 w-6 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Warehouse Map */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Mapa do Armazém
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WarehouseMap />
          </CardContent>
        </Card>

        {/* Layers Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="h-5 w-5 mr-2" />
              Status dos Pallets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.palletsByStatus.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      item.status === 'available' ? 'bg-success' :
                      item.status === 'in_use' ? 'bg-destructive' :
                      item.status === 'defective' ? 'bg-warning' :
                      item.status === 'maintenance' ? 'bg-primary' :
                      'bg-gray-400'
                    }`}></div>
                    <span className="text-sm font-medium text-gray-700">
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{item.count.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">
                      {stats.totalPallets > 0 ? ((item.count / stats.totalPallets) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                </div>
              ))}
              {!stats?.palletsByStatus.length && (
                <div className="text-center text-gray-500 py-8">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
