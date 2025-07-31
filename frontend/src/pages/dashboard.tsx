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


  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'disponivel': return 'Disponível';
      case 'em_uso': return 'Em Uso';
      case 'defeituoso': return 'Defeituoso';
      case 'manutencao': return 'Recuperação';
      case 'descarte': return 'Descarte';
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
        <Card className="card-hover overflow-hidden relative group animate-fadeInUp" style={{ animationDelay: '100ms' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Pallets</p>
                <p className="text-3xl font-bold text-gray-900 animate-countUp">{stats?.totalPallets.toLocaleString()}</p>
                <p className="text-sm text-success mt-1">
                  <TrendingUp className="inline h-4 w-4 mr-1 animate-bounce" />
                  Sistema ativo
                </p>
              </div>
              <div className="bg-primary/10 p-3 rounded-full group-hover:bg-primary/20 transition-colors duration-300 group-hover:shadow-lg">
                <Layers className="h-6 w-6 text-primary group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover overflow-hidden relative group animate-fadeInUp" style={{ animationDelay: '200ms' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">UCPs Ativas</p>
                <p className="text-3xl font-bold text-gray-900 animate-countUp" style={{ animationDelay: '200ms' }}>{stats?.activeUcps.toLocaleString()}</p>
                <p className="text-sm text-success mt-1">
                  <TrendingUp className="inline h-4 w-4 mr-1 animate-bounce" style={{ animationDelay: '300ms' }} />
                  Em operação
                </p>
              </div>
              <div className="bg-success/10 p-3 rounded-full group-hover:bg-success/20 transition-colors duration-300 group-hover:shadow-lg">
                <Box className="h-6 w-6 text-success group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover overflow-hidden relative group animate-fadeInUp" style={{ animationDelay: '300ms' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Taxa de Ocupação</p>
                <p className="text-3xl font-bold text-gray-900 animate-countUp" style={{ animationDelay: '300ms' }}>{stats?.occupancyRate}%</p>
                <p className="text-sm text-warning mt-1">
                  <Activity className="inline h-4 w-4 mr-1 animate-bounce" style={{ animationDelay: '400ms' }} />
                  Capacidade atual
                </p>
              </div>
              <div className="bg-warning/10 p-3 rounded-full group-hover:bg-warning/20 transition-colors duration-300 group-hover:shadow-lg">
                <Warehouse className="h-6 w-6 text-warning group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover overflow-hidden relative group animate-fadeInUp" style={{ animationDelay: '400ms' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Movimentações/Dia</p>
                <p className="text-3xl font-bold text-gray-900 animate-countUp" style={{ animationDelay: '400ms' }}>{stats?.dailyMovements}</p>
                <p className="text-sm text-secondary mt-1">
                  <Activity className="inline h-4 w-4 mr-1 animate-bounce" style={{ animationDelay: '500ms' }} />
                  Atividade hoje
                </p>
              </div>
              <div className="bg-secondary/10 p-3 rounded-full group-hover:bg-secondary/20 transition-colors duration-300 group-hover:shadow-lg">
                <Truck className="h-6 w-6 text-secondary group-hover:scale-110 transition-transform duration-300" />
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
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="flex items-center text-gray-800">
              <Package className="h-5 w-5 mr-2 text-blue-600" />
              Status dos Pallets
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {stats?.palletsByStatus.map((item, index) => {
                const percentage = stats.totalPallets > 0 ? (item.count / stats.totalPallets) * 100 : 0;
                const statusConfig = {
                  disponivel: { color: 'bg-emerald-500', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50', icon: '✓' },
                  em_uso: { color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50', icon: '🔥' },
                  defeituoso: { color: 'bg-yellow-500', textColor: 'text-yellow-700', bgColor: 'bg-yellow-50', icon: '⚠️' },
                  manutencao: { color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50', icon: '🔧' },
                  descarte: { color: 'bg-gray-500', textColor: 'text-gray-700', bgColor: 'bg-gray-50', icon: '🗑️' }
                };
                const config = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.disponivel;
                
                return (
                  <div 
                    key={item.status} 
                    className={`p-4 rounded-lg ${config.bgColor} border border-gray-100 hover:shadow-md transition-all duration-300 hover:scale-[1.02] cursor-pointer group animate-fadeInUp`}
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center text-white font-bold shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110`}>
                          <span className="text-sm animate-bounce" style={{ animationDelay: `${index * 100}ms` }}>{config.icon}</span>
                        </div>
                        <div>
                          <span className={`text-sm font-semibold ${config.textColor}`}>
                            {getStatusLabel(item.status)}
                          </span>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {percentage.toFixed(1)}% do total
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${config.textColor} group-hover:scale-110 transition-transform duration-200`}>
                          {item.count.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide">
                          pallets
                        </div>
                      </div>
                    </div>
                    
                    {/* Barra de progresso animada */}
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-2 ${config.color} rounded-full transition-all duration-1000 ease-out shadow-sm animate-fillProgress`}
                        style={{ 
                          width: `${percentage}%`,
                          animationDelay: `${index * 200 + 500}ms`
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              {!stats?.palletsByStatus.length && (
                <div className="text-center text-gray-500 py-8 animate-fadeIn">
                  <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Nenhum dado disponível</p>
                </div>
              )}
            </div>
            
            {/* Resumo total */}
            <div className="mt-6 pt-4 border-t border-gray-200 animate-fadeInUp" style={{ animationDelay: '800ms' }}>
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg hover:shadow-sm transition-all duration-200">
                <div className="flex items-center space-x-2">
                  <Layers className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-700">Total de Pallets</span>
                </div>
                <div className="text-2xl font-bold text-gray-800 animate-countUp">
                  {stats?.totalPallets.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
