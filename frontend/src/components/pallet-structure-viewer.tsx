import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, CheckCircle, AlertCircle } from "lucide-react";
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
}

export default function PalletStructureViewer({ 
  structure, 
  positions, 
  compact = false 
}: PalletStructureViewerProps) {
  // Organizar posições por nível e posição
  const organizedPositions = useMemo(() => 
    Array.from({ length: structure.maxLevels + 1 }, (_, level) =>
      Array.from({ length: structure.maxPositions }, (_, pos) => {
        const position = positions.find(p => p.level === level && p.position === pos + 1);
        return position || null;
      })
    ), [positions, structure.maxLevels, structure.maxPositions]
  );

  const getPositionStatus = (position: Position | null) => {
    if (!position) return { status: 'empty', color: 'bg-gray-100 border-gray-200', icon: null };
    
    if (position.status === 'occupied' || position.currentPalletId) {
      return { 
        status: 'occupied', 
        color: 'bg-orange-100 border-orange-300 text-orange-800', 
        icon: <Package className="h-3 w-3" />
      };
    }
    
    if (position.status === 'maintenance') {
      return { 
        status: 'maintenance', 
        color: 'bg-yellow-100 border-yellow-300 text-yellow-800', 
        icon: <AlertCircle className="h-3 w-3" />
      };
    }
    
    if (position.status === 'blocked') {
      return { 
        status: 'blocked', 
        color: 'bg-red-100 border-red-300 text-red-800', 
        icon: <AlertCircle className="h-3 w-3" />
      };
    }
    
    return { 
      status: 'available', 
      color: 'bg-green-100 border-green-300 text-green-800', 
      icon: <CheckCircle className="h-3 w-3" />
    };
  };

  const occupiedCount = positions.filter(p => p.status === 'occupied' || p.currentPalletId).length;
  const availableCount = positions.length - occupiedCount;
  const occupancyRate = positions.length > 0 ? Math.round((occupiedCount / positions.length) * 100) : 0;

  if (compact) {
    return (
      <div className="border rounded-lg p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-sm">{structure.name}</h4>
          <Badge variant="outline" className="text-xs">
            {occupancyRate}% ocupado
          </Badge>
        </div>
        
        <div className="grid gap-1 max-w-full overflow-hidden">
          {organizedPositions.map((levelPositions, level) => (
            <div key={level} className="flex gap-1 items-center">
              <div className="text-xs text-gray-500 w-6 flex-shrink-0">
                {level === 0 ? 'T' : level}
              </div>
              <div className="flex gap-1 overflow-x-auto">
                {levelPositions.map((position, posIndex) => {
                  const { color } = getPositionStatus(position);
                  return (
                    <div
                      key={`${level}-${posIndex}`}
                      className={`w-6 h-4 rounded-sm border ${color} flex-shrink-0`}
                      title={position ? `${position.code} - ${position.status}` : 'Posição não definida'}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex items-center gap-3 mt-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded-sm"></div>
            <span>Livre</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded-sm"></div>
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
          <CardTitle className="text-lg">{structure.name}</CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary">
              Rua {structure.street} - {structure.side === 'E' ? 'Esquerdo' : 'Direito'}
            </Badge>
            <Badge variant="outline">
              {occupancyRate}% ocupado
            </Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total:</span>
            <span className="ml-2 font-medium">{positions.length} posições</span>
          </div>
          <div>
            <span className="text-green-600">Disponível:</span>
            <span className="ml-2 font-medium">{availableCount}</span>
          </div>
          <div>
            <span className="text-orange-600">Ocupado:</span>
            <span className="ml-2 font-medium">{occupiedCount}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Layout Visual do Porta-Pallet</h4>
          <div className="bg-gray-50 p-4 rounded-lg border overflow-x-auto">
            <div className="space-y-2 min-w-fit">
              {organizedPositions.map((levelPositions, level) => (
                <div key={level} className="flex items-center gap-2">
                  <div className="text-sm font-medium text-gray-700 w-16 flex-shrink-0">
                    {level === 0 ? 'Térreo' : `Nível ${level}`}
                  </div>
                  <div className="flex gap-2">
                    {levelPositions.map((position, posIndex) => {
                      const { status, color, icon } = getPositionStatus(position);
                      return (
                        <div
                          key={`${level}-${posIndex}`}
                          className={`
                            w-16 h-12 rounded-lg border-2 flex flex-col items-center justify-center
                            ${color} transition-all duration-200 cursor-default
                          `}
                          title={position ? `${position.code} - Status: ${position.status}` : 'Posição não definida'}
                        >
                          {position ? (
                            <>
                              <div className="flex items-center gap-1">
                                {icon}
                                <span className="text-xs font-medium">
                                  {posIndex + 1}
                                </span>
                              </div>
                              <span className="text-xs opacity-75">
                                {position.code.split('-').pop()}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span>Disponível</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
            <span>Ocupado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span>Manutenção</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
            <span>Bloqueado</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}