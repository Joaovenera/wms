import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, CheckCircle, AlertCircle } from "lucide-react";

interface Position {
  id: number;
  code: string;
  level: number;
  position: number;
  currentPalletId?: number | null;
  status: string;
  occupied: boolean;
}

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
  const organizedPositions = Array.from({ length: structure.maxLevels + 1 }, (_, level) =>
    Array.from({ length: structure.maxPositions }, (_, pos) => {
      const position = positions.find(p => p.level === level && p.position === pos + 1);
      return position || null;
    })
  );

  const getPositionStatus = (position: Position | null) => {
    if (!position) return { status: 'empty', color: 'bg-gray-100 border-gray-200', icon: null };
    
    if (position.occupied && position.currentPalletId) {
      return { 
        status: 'occupied', 
        color: 'bg-orange-100 border-orange-300 text-orange-800', 
        icon: <Package className="h-3 w-3" />
      };
    }
    
    return { 
      status: 'available', 
      color: 'bg-green-100 border-green-300 text-green-800', 
      icon: <CheckCircle className="h-3 w-3" />
    };
  };

  const occupiedCount = positions.filter(p => p.occupied).length;
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
              <div className="flex gap-1 flex-wrap">
                {levelPositions.map((position, posIndex) => {
                  const { color, icon } = getPositionStatus(position);
                  return (
                    <div
                      key={`${level}-${posIndex}`}
                      className={`w-8 h-6 rounded border text-xs flex items-center justify-center ${color}`}
                      title={position ? `${position.code} - ${position.occupied ? 'Ocupado' : 'Disponível'}` : 'Sem posição'}
                    >
                      {icon || (position ? (posIndex + 1) : '-')}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-between mt-2 text-xs text-gray-600">
          <span>{positions.length} posições</span>
          <span>{availableCount} livres</span>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{structure.name}</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">
              Rua {structure.street} • Lado {structure.side === 'E' ? 'Esquerdo' : 'Direito'}
            </Badge>
            <Badge variant={occupancyRate > 80 ? "destructive" : occupancyRate > 50 ? "default" : "secondary"}>
              {occupancyRate}% Ocupado
            </Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mt-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{positions.length}</div>
            <div className="text-sm text-gray-600">Total Posições</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{availableCount}</div>
            <div className="text-sm text-gray-600">Disponíveis</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{occupiedCount}</div>
            <div className="text-sm text-gray-600">Ocupadas</div>
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
                  <div className="text-sm font-medium text-gray-700 w-8 flex-shrink-0">
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
                            transition-all duration-200 hover:shadow-md cursor-pointer
                            ${color}
                          `}
                          title={position ? 
                            `${position.code}\nStatus: ${position.occupied ? 'Ocupado' : 'Disponível'}` : 
                            'Posição não criada'
                          }
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
            <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded"></div>
            <span>Não configurado</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}