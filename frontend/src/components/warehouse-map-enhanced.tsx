import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Package, 
  MapPin, 
  BarChart3, 
  RefreshCw, 
  Activity, 
  Eye,
  EyeOff,
  Zap,
  TrendingUp,
  Clock,
  Navigation,
  Filter,
  Wifi,
  WifiOff
} from "lucide-react";
import { Position, Ucp, Pallet } from "@/types/api";
import { useRealtimeWarehouse } from "@/hooks/useRealtimeWarehouse";

interface UcpWithDetails extends Ucp {
  pallet?: Pallet;
  position?: Position;
}

interface Movement {
  id: number;
  ucpId: number;
  fromPositionId: number | null;
  toPositionId: number | null;
  timestamp: string;
  reason: string;
  ucp?: UcpWithDetails;
  fromPosition?: Position;
  toPosition?: Position;
}

const statusConfig = {
  disponivel: {
    color: "bg-green-100 hover:bg-green-200 border-green-300",
    textColor: "text-green-800",
    icon: "🟢",
    label: "Disponível",
    bgColor: "bg-green-50"
  },
  ocupada: {
    color: "bg-red-100 hover:bg-red-200 border-red-300", 
    textColor: "text-red-800",
    icon: "🔴",
    label: "Ocupado",
    bgColor: "bg-red-50"
  },
  reservada: {
    color: "bg-yellow-100 hover:bg-yellow-200 border-yellow-300",
    textColor: "text-yellow-800", 
    icon: "🟡",
    label: "Reservado",
    bgColor: "bg-yellow-50"
  },
  manutencao: {
    color: "bg-orange-100 hover:bg-orange-200 border-orange-300",
    textColor: "text-orange-800",
    icon: "🟠", 
    label: "Manutenção",
    bgColor: "bg-orange-50"
  },
  bloqueada: {
    color: "bg-gray-100 hover:bg-gray-200 border-gray-300",
    textColor: "text-gray-800",
    icon: "⚫",
    label: "Bloqueado",
    bgColor: "bg-gray-50"
  }
};

interface WarehouseMapEnhancedProps {
  enableRealtime?: boolean;
}

export default function WarehouseMapEnhanced({ enableRealtime = true }: WarehouseMapEnhancedProps) {
  const [location] = useLocation();
  
  // Don't render the component at all if not on warehouse-tracking page
  if (location !== '/warehouse-tracking') {
    return null;
  }

  const [selectedStreet, setSelectedStreet] = useState<string | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<Position | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showUcpDetails, setShowUcpDetails] = useState(true);
  const [showMovements, setShowMovements] = useState(true);
  const [activeTab, setActiveTab] = useState("map");
  const [realtimeUpdates, setRealtimeUpdates] = useState<any[]>([]);

  // Real-time WebSocket connection (now we know we're on the right page)
  const { isConnected, lastUpdate, connectionError } = useRealtimeWarehouse({ 
    enabled: enableRealtime 
  });

  // Fetch positions with real-time updates
  const { data: positions, isLoading: positionsLoading, refetch: refetchPositions } = useQuery<Position[]>({
    queryKey: ['/api/positions'],
    refetchInterval: 10000 // More frequent updates for real-time tracking
  });

  // Fetch UCPs with real-time updates
  const { data: ucps, isLoading: ucpsLoading, refetch: refetchUcps } = useQuery<UcpWithDetails[]>({
    queryKey: ['/api/ucps'],
    refetchInterval: 10000
  });

  // Fetch recent movements
  const { data: movements, isLoading: movementsLoading, refetch: refetchMovements } = useQuery<Movement[]>({
    queryKey: ['/api/movements'],
    refetchInterval: 5000 // Most frequent for movement tracking
  });

  // Handle real-time updates
  useEffect(() => {
    if (lastUpdate) {
      setRealtimeUpdates(prev => [lastUpdate, ...prev.slice(0, 9)]); // Keep last 10 updates
      
      // Force refresh data when receiving updates
      setTimeout(() => {
        refetchPositions();
        refetchUcps();
        refetchMovements();
      }, 500);
    }
  }, [lastUpdate, refetchPositions, refetchUcps, refetchMovements]);

  // Auto-refresh all data (less frequent when WebSocket is connected)
  useEffect(() => {
    const interval = setInterval(() => {
      refetchPositions();
      refetchUcps();
      refetchMovements();
    }, isConnected ? 30000 : 15000); // 30s when connected, 15s when not

    return () => clearInterval(interval);
  }, [refetchPositions, refetchUcps, refetchMovements, isConnected]);

  const handlePositionClick = (position: Position) => {
    setSelectedPosition(position);
  };

  function getStatusInfo(status: string) {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.disponivel;
  }

  // Get UCPs for a specific position
  function getUcpsForPosition(positionId: number) {
    return ucps?.filter(ucp => ucp.positionId === positionId) || [];
  }

  // Get recent movements for a position
  function getRecentMovementsForPosition(positionId: number) {
    return movements?.filter(movement => 
      movement.fromPositionId === positionId || movement.toPositionId === positionId
    ).slice(0, 3) || [];
  }

  const isLoading = positionsLoading || ucpsLoading || movementsLoading;

  if (isLoading) {
    return (
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
              Mapa do Armazém - Rastreamento em Tempo Real
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600">Carregando mapa do armazém...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group positions by street
  const streetGroups = positions?.reduce((acc, position) => {
    const codeParts = position.code.split('-');
    const street = codeParts[1];
    if (!acc[street]) acc[street] = [];
    acc[street].push(position);
    return acc;
  }, {} as Record<string, Position[]>) || {};

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
              Mapa do Armazém - Rastreamento em Tempo Real
              <Badge 
                variant="outline" 
                className={`ml-2 ${isConnected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}
              >
                {isConnected ? (
                  <>
                    <Wifi className="w-3 h-3 mr-1" />
                    Conectado
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 mr-1" />
                    Desconectado
                  </>
                )}
              </Badge>
              {connectionError && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  Erro de conexão
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUcpDetails(!showUcpDetails)}
              >
                {showUcpDetails ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                UCPs
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMovements(!showMovements)}
              >
                {showMovements ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Movimentos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchPositions();
                  refetchUcps();
                  refetchMovements();
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Posições</p>
                <p className="text-2xl font-bold text-blue-800">{positions?.length || 0}</p>
              </div>
              <MapPin className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">UCPs Ativas</p>
                <p className="text-2xl font-bold text-green-800">{ucps?.filter(u => u.status === 'active').length || 0}</p>
              </div>
              <Package className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Posições Ocupadas</p>
                <p className="text-2xl font-bold text-yellow-800">
                  {positions?.filter(p => p.status === 'occupied').length || 0}
                </p>
              </div>
              <Activity className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Movimentos Hoje</p>
                <p className="text-2xl font-bold text-purple-800">{movements?.length || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="map">Mapa Visual</TabsTrigger>
          <TabsTrigger value="movements">Movimentos Recentes</TabsTrigger>
          <TabsTrigger value="analytics">Análise</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="space-y-4">
          <Card className="bg-white shadow-lg">
            <CardContent className="pt-6">
              {!positions || positions.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma posição encontrada</h3>
                  <p className="text-gray-600">Configure posições para visualizar o mapa do armazém</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(streetGroups).map(([street, streetPositions], streetIndex) => (
                    <div 
                      key={street}
                      className="border border-gray-200 rounded-lg p-6 bg-gradient-to-r from-blue-50 to-green-50"
                      style={{ 
                        animationDelay: `${streetIndex * 100}ms`,
                        animation: 'fadeInUp 0.4s ease-out forwards'
                      }}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                          <MapPin className="w-6 h-6 mr-2 text-blue-600" />
                          Rua {street}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary" className="text-sm">
                            {streetPositions.length} posições
                          </Badge>
                          <Badge variant="outline" className="text-sm">
                            {streetPositions.filter(p => p.status === 'occupied').length} ocupadas
                          </Badge>
                          <Button
                            variant={selectedStreet === street ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedStreet(selectedStreet === street ? null : street)}
                            className="text-xs"
                          >
                            <Filter className="w-3 h-3 mr-1" />
                            {selectedStreet === street ? "Mostrar Todas" : "Filtrar"}
                          </Button>
                        </div>
                      </div>

                      {(!selectedStreet || selectedStreet === street) && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-8 items-start">
                            {/* Left Side */}
                            <div className="space-y-4">
                              <div className="text-center font-semibold text-gray-600 mb-2">LADO ESQUERDO</div>
                              {Object.entries(
                                streetPositions
                                  .filter(p => p.side === 'E')
                                  .sort((a, b) => a.position - b.position)
                                  .reduce((acc, position) => {
                                    const key = `${position.position}`;
                                    if (!acc[key]) acc[key] = [];
                                    acc[key].push(position);
                                    return acc;
                                  }, {} as Record<string, typeof streetPositions>)
                              ).map(([positionNum, positions]) => {
                                const sortedPositions = positions.sort((a, b) => Number(a.level) - Number(b.level));
                                
                                return (
                                  <div key={`left-${positionNum}`} className="flex items-center gap-3">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="relative border-2 border-black bg-white rounded-lg p-2 shadow-md hover:shadow-lg transition-shadow">
                                            <div className="space-y-1">
                                              {sortedPositions.map((position) => {
                                                const statusInfo = getStatusInfo(position.status);
                                                const positionUcps = getUcpsForPosition(position.id);
                                                const recentMovements = getRecentMovementsForPosition(position.id);
                                                
                                                return (
                                                  <div
                                                    key={position.id}
                                                    className={`
                                                      relative h-4 w-full border-2 cursor-pointer transition-all duration-200
                                                      ${statusInfo.color} rounded-sm
                                                      ${hoveredPosition?.id === position.id ? 'ring-2 ring-blue-400 scale-105' : ''}
                                                      ${selectedPosition?.id === position.id ? 'ring-2 ring-purple-400' : ''}
                                                    `}
                                                    onClick={() => handlePositionClick(position)}
                                                    onMouseEnter={() => setHoveredPosition(position)}
                                                    onMouseLeave={() => setHoveredPosition(null)}
                                                  >
                                                    {/* UCP indicator */}
                                                    {showUcpDetails && positionUcps.length > 0 && (
                                                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                                                        <span className="text-xs font-bold text-white">
                                                          {positionUcps.length}
                                                        </span>
                                                      </div>
                                                    )}
                                                    
                                                    {/* Movement indicator */}
                                                    {showMovements && recentMovements.length > 0 && (
                                                      <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                                                        <Zap className="w-2 h-2 text-white" />
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="space-y-1">
                                            <p className="font-semibold">Posição {positionNum}</p>
                                            {sortedPositions.map(pos => (
                                              <p key={pos.id} className="text-sm">
                                                {pos.code} - {getStatusInfo(pos.status).label}
                                              </p>
                                            ))}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    
                                    <div className="text-3xl font-bold text-gray-800">
                                      {positionNum}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {/* Central Corridor */}
                            <div className="flex items-center justify-center h-full">
                              <div className="bg-gray-100 rounded-lg p-6 shadow-inner">
                                <div className="transform rotate-90 text-2xl font-bold text-gray-600 tracking-widest">
                                  CORREDOR
                                </div>
                              </div>
                            </div>
                            
                            {/* Right Side */}
                            <div className="space-y-4">
                              <div className="text-center font-semibold text-gray-600 mb-2">LADO DIREITO</div>
                              {Object.entries(
                                streetPositions
                                  .filter(p => p.side === 'D')
                                  .sort((a, b) => a.position - b.position)
                                  .reduce((acc, position) => {
                                    const key = `${position.position}`;
                                    if (!acc[key]) acc[key] = [];
                                    acc[key].push(position);
                                    return acc;
                                  }, {} as Record<string, typeof streetPositions>)
                              ).map(([positionNum, positions]) => {
                                const sortedPositions = positions.sort((a, b) => Number(a.level) - Number(b.level));
                                
                                return (
                                  <div key={`right-${positionNum}`} className="flex items-center gap-3">
                                    <div className="text-3xl font-bold text-gray-800">
                                      {positionNum}
                                    </div>
                                    
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="relative border-2 border-black bg-white rounded-lg p-2 shadow-md hover:shadow-lg transition-shadow">
                                            <div className="space-y-1">
                                              {sortedPositions.map((position) => {
                                                const statusInfo = getStatusInfo(position.status);
                                                const positionUcps = getUcpsForPosition(position.id);
                                                const recentMovements = getRecentMovementsForPosition(position.id);
                                                
                                                return (
                                                  <div
                                                    key={position.id}
                                                    className={`
                                                      relative h-4 w-full border-2 cursor-pointer transition-all duration-200
                                                      ${statusInfo.color} rounded-sm
                                                      ${hoveredPosition?.id === position.id ? 'ring-2 ring-blue-400 scale-105' : ''}
                                                      ${selectedPosition?.id === position.id ? 'ring-2 ring-purple-400' : ''}
                                                    `}
                                                    onClick={() => handlePositionClick(position)}
                                                    onMouseEnter={() => setHoveredPosition(position)}
                                                    onMouseLeave={() => setHoveredPosition(null)}
                                                  >
                                                    {/* UCP indicator */}
                                                    {showUcpDetails && positionUcps.length > 0 && (
                                                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                                                        <span className="text-xs font-bold text-white">
                                                          {positionUcps.length}
                                                        </span>
                                                      </div>
                                                    )}
                                                    
                                                    {/* Movement indicator */}
                                                    {showMovements && recentMovements.length > 0 && (
                                                      <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                                                        <Zap className="w-2 h-2 text-white" />
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="space-y-1">
                                            <p className="font-semibold">Posição {positionNum}</p>
                                            {sortedPositions.map(pos => (
                                              <p key={pos.id} className="text-sm">
                                                {pos.code} - {getStatusInfo(pos.status).label}
                                              </p>
                                            ))}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Movements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Navigation className="w-5 h-5 mr-2" />
                  Movimentos Recentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {movements && movements.length > 0 ? (
                  <div className="space-y-3">
                    {movements.slice(0, 10).map((movement, index) => (
                      <div 
                        key={movement.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Navigation className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              UCP {movement.ucp?.code || movement.ucpId}
                            </p>
                            <p className="text-sm text-gray-600">
                              {movement.fromPosition?.code || 'Entrada'} → {movement.toPosition?.code || 'Saída'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {movement.reason}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {new Date(movement.timestamp).toLocaleTimeString('pt-BR')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(movement.timestamp).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Nenhum movimento recente encontrado</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Real-time Updates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="w-5 h-5 mr-2" />
                  Atualizações em Tempo Real
                  {isConnected && (
                    <div className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {realtimeUpdates.length > 0 ? (
                  <div className="space-y-3">
                    {realtimeUpdates.map((update, index) => (
                      <div 
                        key={`${update.timestamp}-${index}`}
                        className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            {update.type === 'movement_created' && <Navigation className="w-4 h-4 text-blue-600" />}
                            {update.type === 'ucp_status_changed' && <Package className="w-4 h-4 text-green-600" />}
                            {update.type === 'position_status_changed' && <MapPin className="w-4 h-4 text-orange-600" />}
                            {update.type === 'connection' && <Wifi className="w-4 h-4 text-blue-600" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {update.type === 'movement_created' && 'Novo Movimento'}
                              {update.type === 'ucp_status_changed' && 'Status UCP Alterado'}
                              {update.type === 'position_status_changed' && 'Status Posição Alterado'}
                              {update.type === 'connection' && 'Sistema Conectado'}
                            </p>
                            <p className="text-xs text-gray-600">
                              {update.data?.message || 'Atualização recebida'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {new Date(update.timestamp).toLocaleTimeString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">
                      {isConnected ? 'Aguardando atualizações...' : 'Conectando ao sistema...'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Análise de Ocupação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Status das Posições</h4>
                  <div className="space-y-2">
                    {Object.entries(statusConfig).map(([status, config]) => {
                      const count = positions?.filter(p => p.status === status).length || 0;
                      const percentage = positions?.length ? (count / positions.length * 100).toFixed(1) : 0;
                      
                      return (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className={`w-4 h-4 rounded-full ${config.color}`}></div>
                            <span className="text-sm">{config.label}</span>
                          </div>
                          <div className="text-sm font-medium">
                            {count} ({percentage}%)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">UCPs por Status</h4>
                  <div className="space-y-2">
                    {['active', 'empty', 'dismantled', 'archived'].map(status => {
                      const count = ucps?.filter(u => u.status === status).length || 0;
                      const percentage = ucps?.length ? (count / ucps.length * 100).toFixed(1) : 0;
                      
                      return (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className={`w-4 h-4 rounded-full ${
                              status === 'active' ? 'bg-green-500' :
                              status === 'empty' ? 'bg-yellow-500' :
                              status === 'dismantled' ? 'bg-red-500' :
                              'bg-gray-500'
                            }`}></div>
                            <span className="text-sm capitalize">{status}</span>
                          </div>
                          <div className="text-sm font-medium">
                            {count} ({percentage}%)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Selected Position Details */}
      {selectedPosition && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                Detalhes da Posição: {selectedPosition.code}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedPosition(null)}>
                ✕
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Informações da Posição</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Código:</strong> {selectedPosition.code}</p>
                  <p><strong>Status:</strong> {getStatusInfo(selectedPosition.status).label}</p>
                  <p><strong>Rua:</strong> {selectedPosition.code.split('-')[1]}</p>
                  <p><strong>Lado:</strong> {selectedPosition.side === 'E' ? 'Esquerdo' : 'Direito'}</p>
                  <p><strong>Posição:</strong> {selectedPosition.position}</p>
                  <p><strong>Nível:</strong> {selectedPosition.level}</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">UCPs nesta Posição</h4>
                <div className="space-y-2">
                  {getUcpsForPosition(selectedPosition.id).map(ucp => (
                    <div key={ucp.id} className="p-2 bg-white rounded border">
                      <p className="font-medium text-sm">{ucp.code}</p>
                      <p className="text-xs text-gray-600">Status: {ucp.status}</p>
                      {ucp.pallet && (
                        <p className="text-xs text-gray-600">Pallet: {ucp.pallet.code}</p>
                      )}
                    </div>
                  ))}
                  {getUcpsForPosition(selectedPosition.id).length === 0 && (
                    <p className="text-sm text-gray-500">Nenhuma UCP nesta posição</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}