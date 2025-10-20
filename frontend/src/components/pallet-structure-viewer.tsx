import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Package, CheckCircle, Warehouse } from "lucide-react";
import { type Position } from "@/types/api";

interface PalletStructureViewerProps {
  structure: {
    id: number;
    name: string;
    street: string;
    side: string;
    maxPositions: number;
    maxLevels: number;
  };
  positions: Position[];
  compact?: boolean;
  onPositionClick?: (position: Position) => void;
}

export default function PalletStructureViewer({ 
  structure, 
  positions, 
  compact = false,
  onPositionClick,
}: PalletStructureViewerProps) {
  // Organizar posições por nível e posição (invertido - térreo embaixo)
  const organizedPositions = useMemo(() => {
    const levels = Array.from({ length: structure.maxLevels + 1 }, (_, level) => {
      const actualLevel = structure.maxLevels - level; // Inverte a ordem
      return Array.from({ length: structure.maxPositions }, (_, pos) => {
        const position = positions.find(p => p.level === actualLevel && p.position === pos + 1);
        return { position, level: actualLevel };
      });
    });
    return levels;
  }, [positions, structure.maxLevels, structure.maxPositions]);

  const getPositionStatus = (position: Position | null) => {
    if (!position) {
      return { 
        status: 'empty', 
        color: 'bg-gray-100 border-gray-300', 
        textColor: 'text-gray-500',
        icon: null,
        label: 'Vazio'
      };
    }
    
    if (position.status === 'ocupada' || position.currentPalletId) {
      return { 
        status: 'occupied', 
        color: 'bg-red-100 border-red-400', 
        textColor: 'text-red-700',
        icon: <Package className="h-3 w-3" />,
        label: 'Ocupada'
      };
    }
    
    if (position.status === 'reservada') {
      return { 
        status: 'reserved', 
        color: 'bg-yellow-100 border-yellow-400', 
        textColor: 'text-yellow-700',
        icon: <Package className="h-3 w-3" />,
        label: 'Reservada'
      };
    }
    
    if (position.status === 'manutencao') {
      return { 
        status: 'maintenance', 
        color: 'bg-blue-100 border-blue-400', 
        textColor: 'text-blue-700',
        icon: <Package className="h-3 w-3" />,
        label: 'Manutenção'
      };
    }
    
    return { 
      status: 'available', 
      color: 'bg-green-100 border-green-400', 
      textColor: 'text-green-700',
      icon: <CheckCircle className="h-3 w-3" />,
      label: 'Disponível'
    };
  };

  const occupiedCount = positions.filter(p => p.status === 'ocupada' || p.currentPalletId).length;
  const reservedCount = positions.filter(p => p.status === 'reservada').length;
  const maintenanceCount = positions.filter(p => p.status === 'manutencao').length; // reserved for future analytics
  const availableCount = positions.filter(p => p.status === 'disponivel').length;
  const totalPositions = structure.maxPositions * (structure.maxLevels + 1);
  const occupancyRate = totalPositions > 0 ? Math.round((occupiedCount / totalPositions) * 100) : 0;

  // Cada nível será uma única linha com exatamente maxPositions colunas

  if (compact) {
    return (
      <div className="border rounded-lg p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-sm">{structure.name}</h4>
          <Badge variant="outline" className="text-xs">
            {occupancyRate}% ocupado
          </Badge>
        </div>
        
        <div className="relative space-y-2">
          {/* Uprights */}
          <div className="pointer-events-none absolute left-0 top-2 bottom-2 w-0.5 bg-orange-400 rounded" />
          <div className="pointer-events-none absolute right-0 top-2 bottom-2 w-0.5 bg-orange-400 rounded" />
          {organizedPositions.map((levelData, levelIndex) => (
            <div key={levelIndex} className="space-y-1 relative">
              {/* Beam */}
              <div className="pointer-events-none absolute left-0 right-0 top-5 h-0.5 bg-orange-300/80" />
              <div className="text-xs text-gray-500 font-medium">
                {levelData[0].level === 0 ? 'Térreo' : `Nível ${levelData[0].level}`}
              </div>
              <div className="flex gap-1 flex-wrap">
                {levelData.map(({ position }, posIndex) => {
                  const { color, label } = getPositionStatus(position || null);
                  return (
                    <div
                      key={`${levelIndex}-${posIndex}`}
                      className={`w-4 h-3 rounded-[2px] border ${color} flex-shrink-0`}
                      title={position ? `${position.code} - ${label}` : 'Posição não definida'}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex items-center gap-3 mt-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-100 border border-green-400 rounded-sm"></div>
            <span>Disponível</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-100 border border-red-400 rounded-sm"></div>
            <span>Ocupado</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">{structure.name}</CardTitle>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">
              Rua {structure.street} - {structure.side === 'E' ? 'Esquerdo' : 'Direito'}
            </Badge>
            <Badge variant={occupancyRate >= 90 ? "destructive" : occupancyRate >= 70 ? "secondary" : "outline"}>
              {occupancyRate}% ocupado
            </Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-5 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total:</span>
            <span className="ml-2 font-medium">{totalPositions} posições</span>
          </div>
          <div>
            <span className="text-green-600">Disponível:</span>
            <span className="ml-2 font-medium">{availableCount}</span>
          </div>
          <div>
            <span className="text-red-600">Ocupado:</span>
            <span className="ml-2 font-medium">{occupiedCount}</span>
          </div>
          <div>
            <span className="text-yellow-600">Reservado:</span>
            <span className="ml-2 font-medium">{reservedCount}</span>
          </div>
          <div>
            <span className="text-blue-600">Manutenção:</span>
            <span className="ml-2 font-medium">{maintenanceCount}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Layout Visual do Porta-Pallet
          </h4>
          <div className="relative bg-white p-4 rounded-lg border">
            <div className="space-y-6">
              {organizedPositions.map((levelData, levelIndex) => {
                const level = levelData[0].level;
                const tileSizeClass = structure.maxPositions <= 8 ? 'h-12' : structure.maxPositions <= 12 ? 'h-10' : 'h-9';
                return (
                  <div key={levelIndex} className="relative">
                    {/* Level label at left */}
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full bg-gray-50 border px-2 py-1 rounded text-xs font-medium text-gray-700 whitespace-nowrap">
                      {level === 0 ? 'Térreo' : `Nível ${level}`}
                    </div>
                    {/* Beam line */}
                    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-orange-300" />
                    {/* Single-row grid */}
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${structure.maxPositions}, minmax(0, 1fr))` }}>
                      <TooltipProvider>
                        {levelData.map(({ position }, posIndex) => {
                          const { color, textColor, icon, label } = getPositionStatus(position || null);
                          return (
                            <Tooltip key={`${levelIndex}-${posIndex}`}>
                              <TooltipTrigger asChild>
                                <div
                                  className={`rounded-md border-2 ${color} ${textColor} ${tileSizeClass} flex flex-col items-center justify-center transition-all duration-200 cursor-pointer hover:shadow-sm`}
                                  onClick={() => position && onPositionClick?.(position)}
                                >
                                  {position ? (
                                    <>
                                      <div className="flex items-center gap-1">
                                        {icon}
                                        <span className="text-xs font-bold">{position.position}</span>
                                      </div>
                                      <span className="text-[10px] opacity-70 leading-tight">
                                        {position.code}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-gray-400">-</span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="center">
                                <div className="space-y-1">
                                  <div className="font-medium text-sm">{position ? position.code : 'Posição não definida'}</div>
                                  {position && (
                                    <>
                                      <div className="text-xs text-muted-foreground">Status: {label}</div>
                                      {position.currentPalletId && (
                                        <div className="text-xs text-muted-foreground">Pallet: #{position.currentPalletId}</div>
                                      )}
                                      {position.observations && (
                                        <div className="text-xs text-muted-foreground max-w-[220px] truncate">Obs: {position.observations}</div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </TooltipProvider>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border-2 border-green-400 rounded"></div>
            <span>Disponível</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border-2 border-red-400 rounded"></div>
            <span>Ocupado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-400 rounded"></div>
            <span>Reservado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border-2 border-blue-400 rounded"></div>
            <span>Manutenção</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
            <span>Vazio</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}