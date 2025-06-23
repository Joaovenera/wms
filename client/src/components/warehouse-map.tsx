import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { type Position } from "@shared/schema";

export default function WarehouseMap() {
  const { toast } = useToast();
  
  const { data: positions, isLoading } = useQuery<Position[]>({
    queryKey: ['/api/positions'],
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  // Group positions by street and level for display
  const positionMap = new Map<string, Position[]>();
  
  positions?.forEach(position => {
    const key = `${position.street}-${position.side}`;
    if (!positionMap.has(key)) {
      positionMap.set(key, []);
    }
    positionMap.get(key)!.push(position);
  });

  // Sort positions within each group
  positionMap.forEach(positions => {
    positions.sort((a, b) => {
      if (a.level !== b.level) {
        return a.level.localeCompare(b.level);
      }
      return a.corridor.localeCompare(b.corridor);
    });
  });

  const handlePositionClick = (position: Position) => {
    toast({
      title: `Posição ${position.code}`,
      description: `Status: ${getStatusLabel(position.status)} - ${position.rackType || 'N/A'}`,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-success hover:bg-success/90';
      case 'occupied': return 'bg-destructive hover:bg-destructive/90';
      case 'reserved': return 'bg-warning hover:bg-warning/90';
      case 'maintenance': return 'bg-gray-400 hover:bg-gray-400/90';
      case 'blocked': return 'bg-gray-600 hover:bg-gray-600/90';
      default: return 'bg-gray-400 hover:bg-gray-400/90';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Disponível';
      case 'occupied': return 'Ocupado';
      case 'reserved': return 'Reservado';
      case 'maintenance': return 'Manutenção';
      case 'blocked': return 'Bloqueado';
      default: return status;
    }
  };

  // Create a simplified view showing first 4 streets
  const streets = ['RUA01', 'RUA02', 'RUA03', 'RUA04'];
  const sides = ['E', 'D'];
  const levels = ['N01', 'N02', 'N03'];
  const corridors = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07'];

  return (
    <div className="space-y-4">
      {/* Warehouse Grid */}
      <div className="space-y-3">
        {streets.map(street => (
          <div key={street} className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">{street}</h4>
            <div className="grid grid-cols-2 gap-2">
              {sides.map(side => (
                <div key={`${street}-${side}`} className="space-y-1">
                  <div className="text-xs text-gray-500 text-center">
                    {side === 'E' ? 'Esquerdo' : 'Direito'}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {corridors.map(corridor => {
                      // Find position for this street-side-corridor-level combination
                      const positionCode = `${street}-${side}-${corridor}-N01`;
                      const position = positions?.find(p => p.code === positionCode);
                      
                      return (
                        <div
                          key={corridor}
                          className={`warehouse-position ${
                            position ? getStatusColor(position.status) : 'bg-gray-200'
                          }`}
                          title={position ? `${position.code} - ${getStatusLabel(position.status)}` : 'Posição não configurada'}
                          onClick={() => position && handlePositionClick(position)}
                        >
                          {corridor.slice(-2)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm border-t pt-4">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-success rounded"></div>
          <span>Disponível</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-destructive rounded"></div>
          <span>Ocupado</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-warning rounded"></div>
          <span>Reservado</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-400 rounded"></div>
          <span>Manutenção</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-600 rounded"></div>
          <span>Bloqueado</span>
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-success">
                {positions?.filter(p => p.status === 'available').length || 0}
              </div>
              <div className="text-xs text-gray-600">Disponível</div>
            </div>
            <div>
              <div className="text-lg font-bold text-destructive">
                {positions?.filter(p => p.status === 'occupied').length || 0}
              </div>
              <div className="text-xs text-gray-600">Ocupado</div>
            </div>
            <div>
              <div className="text-lg font-bold text-warning">
                {positions?.filter(p => p.status === 'reserved').length || 0}
              </div>
              <div className="text-xs text-gray-600">Reservado</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-600">
                {positions?.filter(p => p.status === 'maintenance').length || 0}
              </div>
              <div className="text-xs text-gray-600">Manutenção</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-800">
                {positions?.length || 0}
              </div>
              <div className="text-xs text-gray-600">Total</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
