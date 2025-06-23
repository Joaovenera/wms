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

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'available': 
        return { 
          color: 'bg-emerald-500 hover:bg-emerald-600 border-emerald-400', 
          label: 'Disponível', 
          icon: '✅',
          textColor: 'text-emerald-700',
          gradient: 'from-emerald-400 to-emerald-600'
        };
      case 'occupied': 
        return { 
          color: 'bg-red-500 hover:bg-red-600 border-red-400', 
          label: 'Ocupado', 
          icon: '📦',
          textColor: 'text-red-700',
          gradient: 'from-red-400 to-red-600'
        };
      case 'reserved': 
        return { 
          color: 'bg-amber-500 hover:bg-amber-600 border-amber-400', 
          label: 'Reservado', 
          icon: '⏳',
          textColor: 'text-amber-700',
          gradient: 'from-amber-400 to-amber-600'
        };
      case 'maintenance': 
        return { 
          color: 'bg-gray-500 hover:bg-gray-600 border-gray-400', 
          label: 'Manutenção', 
          icon: '🔧',
          textColor: 'text-gray-700',
          gradient: 'from-gray-400 to-gray-600'
        };
      case 'blocked': 
        return { 
          color: 'bg-slate-600 hover:bg-slate-700 border-slate-500', 
          label: 'Bloqueado', 
          icon: '🚫',
          textColor: 'text-slate-700',
          gradient: 'from-slate-500 to-slate-700'
        };
      default: 
        return { 
          color: 'bg-gray-300 hover:bg-gray-400 border-gray-200', 
          label: status, 
          icon: '❓',
          textColor: 'text-gray-600',
          gradient: 'from-gray-300 to-gray-400'
        };
    }
  };

  const getStatusLabel = (status: string) => getStatusInfo(status).label;

  return (
    <div className="space-y-6">
      {/* Cabeçalho com controles */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-800">
                  Mapa do Armazém
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Visualização em tempo real das posições
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'compact' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('compact')}
              >
                <BarChart3 className="w-4 h-4 mr-1" />
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
        </CardHeader>
      </Card>

      {/* Mapa principal */}
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          {Object.keys(streetGroups).length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                Nenhuma posição configurada
              </h3>
              <p className="text-gray-500">
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
                    <div className="grid gap-2">
                      {/* Agrupar por lado */}
                      {['E', 'D'].map(side => {
                        const sidePositions = streetPositions.filter(p => p.side === side);
                        if (sidePositions.length === 0) return null;

                        return (
                          <div key={side} className="space-y-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-sm font-medium text-gray-700">
                                Lado {side === 'E' ? 'Esquerdo' : 'Direito'}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {sidePositions.length}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(60px,1fr))] gap-1">
                              {sidePositions
                                .sort((a, b) => a.position - b.position || Number(a.level) - Number(b.level))
                                .map((position, index) => {
                                  const statusInfo = getStatusInfo(position.status);
                                  return (
                                    <div
                                      key={position.id}
                                      className={`
                                        relative cursor-pointer rounded-md border transition-all duration-200
                                        transform hover:scale-110 hover:shadow-md hover:z-10
                                        ${statusInfo.color} ${viewMode === 'compact' ? 'p-1.5' : 'p-2'}
                                        ${hoveredPosition?.id === position.id ? 'ring-2 ring-blue-400 z-20' : ''}
                                      `}
                                      style={{ 
                                        animationDelay: `${index * 30}ms`,
                                        animation: 'bounceIn 0.4s ease-out forwards'
                                      }}
                                      onClick={() => handlePositionClick(position)}
                                      onMouseEnter={() => setHoveredPosition(position)}
                                      onMouseLeave={() => setHoveredPosition(null)}
                                      title={`${position.code} - ${statusInfo.label}`}
                                    >
                                      <div className="text-center">
                                        {viewMode === 'compact' ? (
                                          <>
                                            <div className="text-sm">{statusInfo.icon}</div>
                                            <div className="text-xs font-bold text-white leading-tight">
                                              {position.code.split('-').slice(-2).join('-')}
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="text-base mb-1">{statusInfo.icon}</div>
                                            <div className="text-xs font-semibold text-white">
                                              {position.code.split('-').slice(-2).join('-')}
                                            </div>
                                            <div className="text-xs text-white/80 mt-1">
                                              {statusInfo.label}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                      
                                      {/* Indicador de nível - menor no modo compacto */}
                                      <div className="absolute top-0.5 right-0.5">
                                        <div className={`bg-white/30 rounded-full ${viewMode === 'compact' ? 'w-1.5 h-1.5' : 'w-2 h-2'}`}></div>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        );
                      })}
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

        {/* Resumo rápido */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <BarChart3 className="w-4 h-4 mr-2" />
              Resumo Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-emerald-50 rounded-lg">
                <div className="text-2xl font-bold text-emerald-600">
                  {statusStats.available || 0}
                </div>
                <div className="text-xs text-emerald-700">Disponíveis</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {statusStats.occupied || 0}
                </div>
                <div className="text-xs text-red-700">Ocupadas</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {Object.keys(streetGroups).length}
                </div>
                <div className="text-xs text-blue-700">Ruas</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {positions?.length || 0}
                </div>
                <div className="text-xs text-purple-700">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Informação da posição selecionada */}
      {hoveredPosition && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-blue-900">
                  {getStatusInfo(hoveredPosition.status).icon} Posição {hoveredPosition.code}
                </h4>
                <p className="text-sm text-blue-700">
                  Status: {getStatusLabel(hoveredPosition.status)} • 
                  Tipo: {hoveredPosition.rackType || 'Padrão'}
                </p>
              </div>
              <Badge className={getStatusInfo(hoveredPosition.status).textColor}>
                {getStatusLabel(hoveredPosition.status)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
