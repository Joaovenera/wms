import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Package, Search, Maximize2, BarChart3, Filter } from "lucide-react";
import { type Position } from "@shared/schema";
import { useState } from "react";

export default function WarehouseMap() {
  const { toast } = useToast();
  const [selectedStreet, setSelectedStreet] = useState<string | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<Position | null>(null);
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');
  
  const { data: positions, isLoading } = useQuery<Position[]>({
    queryKey: ['/api/positions'],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // Agrupar posições por rua
  const streetGroups = positions?.reduce((acc, position) => {
    const street = position.street;
    if (!acc[street]) {
      acc[street] = [];
    }
    acc[street].push(position);
    return acc;
  }, {} as Record<string, Position[]>) || {};

  // Estatísticas por status
  const statusStats = positions?.reduce((acc, position) => {
    acc[position.status] = (acc[position.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const handlePositionClick = (position: Position) => {
    toast({
      title: `📍 Posição ${position.code}`,
      description: `${getStatusLabel(position.status)} • ${position.rackType || 'Padrão'}`,
    });
  };

  function getStatusLabel(status: string) {
    const statusLabels: Record<string, string> = {
      available: 'Disponível',
      occupied: 'Ocupado', 
      reserved: 'Reservado',
      maintenance: 'Manutenção',
      blocked: 'Bloqueado'
    };
    return statusLabels[status] || status;
  }

  function getStatusInfo(status: string) {
    const statusConfig = {
      available: {
        color: 'bg-green-500 hover:bg-green-600',
        textColor: 'text-green-700',
        icon: '✅',
        label: 'Disponível'
      },
      occupied: {
        color: 'bg-red-500 hover:bg-red-600',
        textColor: 'text-red-700',
        icon: '📦',
        label: 'Ocupado'
      },
      reserved: {
        color: 'bg-yellow-500 hover:bg-yellow-600',
        textColor: 'text-yellow-700',
        icon: '🔒',
        label: 'Reservado'
      },
      maintenance: {
        color: 'bg-orange-500 hover:bg-orange-600',
        textColor: 'text-orange-700',
        icon: '⚠️',
        label: 'Manutenção'
      },
      blocked: {
        color: 'bg-gray-500 hover:bg-gray-600',
        textColor: 'text-gray-700',
        icon: '❌',
        label: 'Bloqueado'
      }
    };
    return statusConfig[status] || statusConfig.available;
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <MapPin className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mapa do Armazém</h1>
            <p className="text-gray-600">Visualização em tempo real das posições do armazém</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'compact' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('compact')}
          >
            <Package className="w-4 h-4 mr-1" />
            Compacto
          </Button>
          <Button
            variant={viewMode === 'detailed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('detailed')}
          >
            <Maximize2 className="w-4 h-4 mr-1" />
            Detalhado
          </Button>
        </div>
      </div>

      {/* Mapa principal */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
              Layout do Armazém
            </CardTitle>
            <Badge variant="outline" className="text-sm">
              {positions?.length || 0} posições
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!positions || positions.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma posição encontrada</h3>
              <p className="text-gray-600">
                Configure posições para visualizar o mapa do armazém
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(streetGroups).map(([street, streetPositions], streetIndex) => (
                <div 
                  key={street} 
                  className="border rounded-lg p-2 bg-gradient-to-r from-gray-50 to-slate-50 hover:shadow-md transition-all duration-300"
                  style={{ 
                    animationDelay: `${streetIndex * 100}ms`,
                    animation: 'fadeInUp 0.6s ease-out forwards'
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="outline" 
                        className="px-2 py-0.5 text-xs font-medium bg-white border-blue-200 text-blue-700"
                      >
                        RUA {street}
                      </Badge>
                      <span className="text-xs text-gray-600">
                        {streetPositions.length} posições
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedStreet(selectedStreet === street ? null : street)}
                      className="text-xs h-6"
                    >
                      <Filter className="w-3 h-3 mr-1" />
                      {selectedStreet === street ? 'Ocultar' : 'Filtrar'}
                    </Button>
                  </div>

                  {(!selectedStreet || selectedStreet === street) && (
                    <div className="space-y-4">
                      {/* Layout do corredor com ambos os lados */}
                      <div className="relative">
                        {/* Corredor central */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-8 bg-yellow-50 border-l-2 border-r-2 border-dashed border-yellow-400 transform -translate-x-1/2 z-0">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs text-yellow-600 font-medium rotate-90 whitespace-nowrap">CORREDOR</span>
                          </div>
                        </div>
                        
                        {/* Container dos dois lados */}
                        <div className="grid grid-cols-2 gap-12 relative z-10">
                          {['E', 'D'].map(side => {
                            const sidePositions = streetPositions.filter(p => p.side === side);
                            if (sidePositions.length === 0) return <div key={side}></div>;

                            return (
                              <div key={side} className={`space-y-2 ${side === 'D' ? 'order-2' : 'order-1'}`}>
                                <div className="flex items-center justify-center space-x-2 mb-2">
                                  <div className={`w-3 h-3 rounded-full ${side === 'E' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                                  <span className="text-sm font-semibold text-gray-700">
                                    {side === 'E' ? 'LADO ESQUERDO' : 'LADO DIREITO'}
                                  </span>
                                  <Badge variant="secondary" className="text-xs">
                                    {sidePositions.length}
                                  </Badge>
                                </div>
                            
                                <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
                                  {/* Agrupar posições por posição física para criar estruturas */}
                                  {Object.entries(
                                    sidePositions
                                      .sort((a, b) => a.position - b.position || Number(a.level) - Number(b.level))
                                      .reduce((acc, position) => {
                                        const key = `${position.position}`;
                                        if (!acc[key]) acc[key] = [];
                                        acc[key].push(position);
                                        return acc;
                                      }, {} as Record<string, typeof sidePositions>)
                                  ).map(([positionNum, positions], index) => {
                                    // Organizar por nível (0 = térreo, 1+ = prateleiras superiores)
                                    const levelGroups = positions.reduce((acc, pos) => {
                                      const level = Number(pos.level);
                                      if (!acc[level]) acc[level] = [];
                                      acc[level].push(pos);
                                      return acc;
                                    }, {} as Record<number, typeof positions>);

                                    const maxLevels = Math.max(...Object.keys(levelGroups).map(Number)) + 1;
                                    
                                    return (
                                      <div
                                        key={`${side}-${positionNum}`}
                                        className="relative mb-6"
                                        style={{ 
                                          animationDelay: `${index * 40}ms`,
                                          animation: 'bounceIn 0.4s ease-out forwards'
                                        }}
                                      >
                                        {/* Estrutura do Porta-Pallet (vista de cima) */}
                                        <div className="border-2 border-slate-600 bg-slate-200 p-2 min-h-[100px] relative shadow-lg">
                                          {/* Estrutura metálica - pilares */}
                                          <div className="absolute left-1 top-1 bottom-1 w-0.5 bg-slate-700"></div>
                                          <div className="absolute right-1 top-1 bottom-1 w-0.5 bg-slate-700"></div>
                                          <div className="absolute left-1 top-1 right-1 h-0.5 bg-slate-700"></div>
                                          <div className="absolute left-1 bottom-1 right-1 h-0.5 bg-slate-700"></div>
                                          
                                          {/* Níveis do porta-pallet (de cima para baixo) */}
                                          <div className="space-y-1 h-full">
                                            {Array.from({ length: maxLevels }).map((_, levelIndex) => {
                                              const levelPositions = levelGroups[maxLevels - 1 - levelIndex] || [];
                                              const hasPosition = levelPositions.length > 0;
                                              const position = levelPositions[0];
                                              const statusInfo = hasPosition ? getStatusInfo(position.status) : null;
                                              
                                              return (
                                                <div
                                                  key={levelIndex}
                                                  className={`
                                                    relative h-5 cursor-pointer transition-all duration-200
                                                    ${hasPosition ? 'hover:scale-105 hover:shadow-md hover:z-10' : ''}
                                                    ${hoveredPosition?.id === position?.id ? 'ring-2 ring-blue-400 z-20' : ''}
                                                  `}
                                                  onClick={() => hasPosition && handlePositionClick(position)}
                                                  onMouseEnter={() => hasPosition && setHoveredPosition(position)}
                                                  onMouseLeave={() => setHoveredPosition(null)}
                                                  title={hasPosition ? `${position.code} - ${statusInfo?.label}` : 'Nível não utilizado'}
                                                >
                                                  {/* Representação da prateleira/nível */}
                                                  <div className={`
                                                    w-full h-full rounded-sm border-2 flex items-center justify-center
                                                    ${hasPosition 
                                                      ? `${statusInfo?.color} border-slate-400 shadow-sm` 
                                                      : 'bg-slate-100 border-dashed border-slate-300'
                                                    }
                                                  `}>
                                                    {/* Barras horizontais simulando estrutura */}
                                                    <div className="absolute left-0 top-0 w-full h-0.5 bg-slate-600 opacity-30"></div>
                                                    <div className="absolute left-0 bottom-0 w-full h-0.5 bg-slate-600 opacity-30"></div>
                                                    
                                                    {hasPosition ? (
                                                      <div className="flex items-center space-x-1">
                                                        <span className="text-sm">{statusInfo?.icon}</span>
                                                        <span className="text-xs font-bold text-white drop-shadow-sm">
                                                          N{position.level}
                                                        </span>
                                                      </div>
                                                    ) : (
                                                      <div className="flex items-center justify-center space-x-1 opacity-40">
                                                        <div className="w-6 h-0.5 bg-slate-400"></div>
                                                        <div className="w-6 h-0.5 bg-slate-400"></div>
                                                      </div>
                                                    )}
                                                  </div>
                                                  
                                                  {/* Conectores verticais entre níveis */}
                                                  {levelIndex < maxLevels - 1 && (
                                                    <>
                                                      <div className="absolute left-1 -bottom-1 w-0.5 h-2 bg-slate-600 opacity-50"></div>
                                                      <div className="absolute right-1 -bottom-1 w-0.5 h-2 bg-slate-600 opacity-50"></div>
                                                    </>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                          
                                          {/* Base do porta-pallet */}
                                          <div className="absolute -bottom-1 left-0 right-0 h-1 bg-slate-800 rounded-sm"></div>
                                          
                                          {/* Etiqueta da posição */}
                                          <div className="absolute -bottom-6 left-0 right-0 text-center">
                                            <span className="text-xs font-semibold text-slate-700 bg-yellow-100 px-2 py-0.5 rounded border border-yellow-300">
                                              POS {positionNum}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
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

      {/* Legenda e estatísticas */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Legenda */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              Legenda de Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {['available', 'occupied', 'reserved', 'maintenance', 'blocked'].map(status => {
              const statusInfo = getStatusInfo(status);
              const count = statusStats[status] || 0;
              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-md ${statusInfo.color.split(' ')[0]} border`}></div>
                    <span className="text-sm font-medium">{statusInfo.icon} {statusInfo.label}</span>
                  </div>
                  <Badge variant="outline" className={statusInfo.textColor}>
                    {count}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <BarChart3 className="w-4 h-4 mr-2 text-green-600" />
              Estatísticas Gerais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{positions?.length || 0}</div>
                <div className="text-xs text-blue-600 font-medium">Total Posições</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{statusStats.available || 0}</div>
                <div className="text-xs text-green-600 font-medium">Disponíveis</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{statusStats.occupied || 0}</div>
                <div className="text-xs text-red-600 font-medium">Ocupadas</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{statusStats.reserved || 0}</div>
                <div className="text-xs text-yellow-600 font-medium">Reservadas</div>
              </div>
            </div>
            
            {/* Taxa de ocupação */}
            <div className="pt-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">Taxa de Ocupação</span>
                <span className="text-sm text-gray-600">
                  {positions?.length ? Math.round(((statusStats.occupied || 0) / positions.length) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ 
                    width: `${positions?.length ? ((statusStats.occupied || 0) / positions.length) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}