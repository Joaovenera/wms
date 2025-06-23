import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, MapPin, BarChart3, RefreshCw } from "lucide-react";
import { Position } from "@shared/schema";

const statusConfig = {
  available: {
    color: "bg-green-100 hover:bg-green-200",
    textColor: "text-green-800",
    icon: "🟢",
    label: "Disponível"
  },
  occupied: {
    color: "bg-red-100 hover:bg-red-200", 
    textColor: "text-red-800",
    icon: "🔴",
    label: "Ocupado"
  },
  reserved: {
    color: "bg-yellow-100 hover:bg-yellow-200",
    textColor: "text-yellow-800", 
    icon: "🟡",
    label: "Reservado"
  },
  maintenance: {
    color: "bg-orange-100 hover:bg-orange-200",
    textColor: "text-orange-800",
    icon: "🟠", 
    label: "Manutenção"
  },
  blocked: {
    color: "bg-gray-100 hover:bg-gray-200",
    textColor: "text-gray-800",
    icon: "⚫",
    label: "Bloqueado"
  }
};

export default function WarehouseMap() {
  const [selectedStreet, setSelectedStreet] = useState<string | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<Position | null>(null);

  const { data: positions, isLoading, refetch } = useQuery<Position[]>({
    queryKey: ['/api/positions'],
    refetchInterval: 30000
  });

  const handlePositionClick = (position: Position) => {
    console.log('Position clicked:', position);
  };

  function getStatusLabel(status: string) {
    return statusConfig[status as keyof typeof statusConfig]?.label || status;
  }

  function getStatusInfo(status: string) {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.available;
  }

  if (isLoading) {
    return (
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
              Layout do Armazém
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

  // Agrupar posições por rua
  const streetGroups = positions?.reduce((acc, position) => {
    const street = position.code.split('-')[1];
    if (!acc[street]) acc[street] = [];
    acc[street].push(position);
    return acc;
  }, {} as Record<string, Position[]>) || {};

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
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
                className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-green-50"
                style={{ 
                  animationDelay: `${streetIndex * 100}ms`,
                  animation: 'fadeInUp 0.4s ease-out forwards'
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                    Rua {street}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="text-sm">
                      {streetPositions.length} posições
                    </Badge>
                    <Button
                      variant={selectedStreet === street ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedStreet(selectedStreet === street ? null : street)}
                      className="text-xs"
                    >
                      {selectedStreet === street ? "Mostrar Todas" : "Filtrar"}
                    </Button>
                  </div>
                </div>

                {(!selectedStreet || selectedStreet === street) && (
                  <div className="space-y-2">
                    {/* Layout como na imagem - duas colunas com corredor central */}
                    <div className="grid grid-cols-3 gap-4 items-start">
                      {/* Lado Esquerdo */}
                      <div className="space-y-3">
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
                            <div key={`left-${positionNum}`} className="flex items-center gap-2">
                              {/* Estrutura do porta-pallet */}
                              <div className="relative border-2 border-black bg-white w-16 p-1">
                                {/* Prateleiras empilhadas */}
                                <div className="space-y-0.5">
                                  {sortedPositions.map((position) => {
                                    const statusInfo = getStatusInfo(position.status);
                                    
                                    return (
                                      <div
                                        key={position.id}
                                        className={`
                                          h-3 w-full border border-black cursor-pointer transition-all duration-150
                                          ${statusInfo.color} hover:scale-105
                                          ${hoveredPosition?.id === position.id ? 'ring-2 ring-blue-400' : ''}
                                        `}
                                        onClick={() => handlePositionClick(position)}
                                        onMouseEnter={() => setHoveredPosition(position)}
                                        onMouseLeave={() => setHoveredPosition(null)}
                                        title={`${position.code} - ${statusInfo.label}`}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                              
                              {/* Número da posição */}
                              <div className="text-2xl font-bold text-black">
                                {positionNum}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Corredor Central */}
                      <div className="flex items-center justify-center h-full">
                        <div className="transform rotate-90 text-xl font-bold text-gray-600 tracking-widest">
                          CORREDOR
                        </div>
                      </div>
                      
                      {/* Lado Direito */}
                      <div className="space-y-3">
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
                            <div key={`right-${positionNum}`} className="flex items-center gap-2">
                              {/* Número da posição */}
                              <div className="text-2xl font-bold text-black">
                                {positionNum}
                              </div>
                              
                              {/* Estrutura do porta-pallet */}
                              <div className="relative border-2 border-black bg-white w-16 p-1">
                                {/* Prateleiras empilhadas */}
                                <div className="space-y-0.5">
                                  {sortedPositions.map((position) => {
                                    const statusInfo = getStatusInfo(position.status);
                                    
                                    return (
                                      <div
                                        key={position.id}
                                        className={`
                                          h-3 w-full border border-black cursor-pointer transition-all duration-150
                                          ${statusInfo.color} hover:scale-105
                                          ${hoveredPosition?.id === position.id ? 'ring-2 ring-blue-400' : ''}
                                        `}
                                        onClick={() => handlePositionClick(position)}
                                        onMouseEnter={() => setHoveredPosition(position)}
                                        onMouseLeave={() => setHoveredPosition(null)}
                                        title={`${position.code} - ${statusInfo.label}`}
                                      />
                                    );
                                  })}
                                </div>
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
  );
}