import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, 
  MapPin, 
  BarChart3, 
  RefreshCw, 
  Search, 
  Filter, 
  Eye,
  EyeOff,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { type Position, type Ucp, type Movement } from "@shared/schema";

interface WarehouseMapProps {
  positions: Position[];
  ucps: Ucp[];
  movements: Movement[];
  onRefresh: () => void;
  isLoading: boolean;
}

export function WarehouseMapEnhanced({ 
  positions, 
  ucps, 
  movements, 
  onRefresh, 
  isLoading 
}: WarehouseMapProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStreet, setSelectedStreet] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<Position | null>(null);
  const [showMovements, setShowMovements] = useState(false);
  const [showOnlyOccupied, setShowOnlyOccupied] = useState(false);

  // Utility functions
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'available':
        return { 
          label: 'Disponível', 
          color: 'bg-green-200 border-green-400', 
          iconColor: 'text-green-600' 
        };
      case 'occupied':
        return { 
          label: 'Ocupado', 
          color: 'bg-orange-200 border-orange-400', 
          iconColor: 'text-orange-600' 
        };
      case 'maintenance':
        return { 
          label: 'Manutenção', 
          color: 'bg-red-200 border-red-400', 
          iconColor: 'text-red-600' 
        };
      case 'blocked':
        return { 
          label: 'Bloqueado', 
          color: 'bg-gray-200 border-gray-400', 
          iconColor: 'text-gray-600' 
        };
      default:
        return { 
          label: 'Desconhecido', 
          color: 'bg-gray-200 border-gray-400', 
          iconColor: 'text-gray-600' 
        };
    }
  };

  const getUcpsForPosition = (positionId: number) => {
    return ucps.filter(ucp => ucp.positionId === positionId);
  };

  const getRecentMovementsForPosition = (positionId: number) => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return movements.filter(movement => 
      (movement.fromPositionId === positionId || movement.toPositionId === positionId) &&
      new Date(movement.timestamp) > fiveMinutesAgo
    );
  };

  // Filter and group positions
  const filteredPositions = useMemo(() => {
    return positions.filter(position => {
      const matchesSearch = position.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStreet = !selectedStreet || position.code.includes(selectedStreet);
      const matchesOccupied = !showOnlyOccupied || position.status === 'occupied';
      
      return matchesSearch && matchesStreet && matchesOccupied;
    });
  }, [positions, searchTerm, selectedStreet, showOnlyOccupied]);

  const groupedPositions = useMemo(() => {
    const grouped: { [key: string]: Position[] } = {};
    
    filteredPositions.forEach(position => {
      const parts = position.code.split('-');
      if (parts.length >= 4) {
        const streetKey = parts[1]; // RUA
        if (!grouped[streetKey]) {
          grouped[streetKey] = [];
        }
        grouped[streetKey].push(position);
      }
    });
    
    return grouped;
  }, [filteredPositions]);

  // Statistics
  const stats = useMemo(() => {
    const total = positions.length;
    const available = positions.filter(p => p.status === 'available').length;
    const occupied = positions.filter(p => p.status === 'occupied').length;
    const maintenance = positions.filter(p => p.status === 'maintenance').length;
    const blocked = positions.filter(p => p.status === 'blocked').length;
    
    return { total, available, occupied, maintenance, blocked };
  }, [positions]);

  const streets = useMemo(() => {
    const streetSet = new Set<string>();
    positions.forEach(position => {
      const parts = position.code.split('-');
      if (parts.length >= 4) {
        streetSet.add(parts[1]);
      }
    });
    return Array.from(streetSet).sort();
  }, [positions]);

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Mapa do Armazém
          </h1>
          <p className="text-muted-foreground">
            Visualização em tempo real das posições do armazém
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Disponível</p>
                <p className="text-2xl font-bold text-green-600">{stats.available}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ocupado</p>
                <p className="text-2xl font-bold text-orange-600">{stats.occupied}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Manutenção</p>
                <p className="text-2xl font-bold text-red-600">{stats.maintenance}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bloqueado</p>
                <p className="text-2xl font-bold text-gray-600">{stats.blocked}</p>
              </div>
              <XCircle className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar posições..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Label htmlFor="movements-toggle">Movimentos</Label>
            <Switch
              id="movements-toggle"
              checked={showMovements}
              onCheckedChange={setShowMovements}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Label htmlFor="occupied-toggle">Só ocupados</Label>
            <Switch
              id="occupied-toggle"
              checked={showOnlyOccupied}
              onCheckedChange={setShowOnlyOccupied}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'compact' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('compact')}
          >
            Compacto
          </Button>
          <Button
            variant={viewMode === 'detailed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('detailed')}
          >
            Detalhado
          </Button>
        </div>
      </div>

      {/* Street Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedStreet === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedStreet(null)}
        >
          Todas as Ruas
        </Button>
        {streets.map(street => (
          <Button
            key={street}
            variant={selectedStreet === street ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedStreet(street)}
          >
            Rua {street}
          </Button>
        ))}
      </div>

      {/* Warehouse Map */}
      <Card>
        <CardHeader>
          <CardTitle>Mapa do Armazém</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {Object.entries(groupedPositions)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([streetNum, streetPositions]) => (
                <div key={streetNum} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Rua {streetNum}</h3>
                    <Badge variant="secondary">
                      {streetPositions.length} posições
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Left side positions */}
                    <div className="space-y-4">
                      <div className="text-center font-semibold text-sm bg-gray-100 p-2 rounded">
                        ESQ
                      </div>
                      {streetPositions
                        .filter(pos => pos.code.includes('-E-'))
                        .sort((a, b) => {
                          const aNum = parseInt(a.code.split('-')[3]);
                          const bNum = parseInt(b.code.split('-')[3]);
                          return aNum - bNum;
                        })
                        .map(position => {
                          const statusInfo = getStatusInfo(position.status);
                          const positionUcps = getUcpsForPosition(position.id);
                          const recentMovements = getRecentMovementsForPosition(position.id);
                          
                          return (
                            <div
                              key={position.id}
                              className={`
                                relative border-2 border-black bg-white rounded-lg p-2 shadow-md hover:shadow-lg transition-shadow cursor-pointer
                                ${hoveredPosition?.id === position.id ? 'ring-2 ring-blue-400 scale-105' : ''}
                                ${selectedPosition?.id === position.id ? 'ring-2 ring-purple-400' : ''}
                              `}
                              onMouseEnter={() => setHoveredPosition(position)}
                              onMouseLeave={() => setHoveredPosition(null)}
                              onClick={() => setSelectedPosition(position)}
                              title={`${position.code} - ${statusInfo.label}`}
                            >
                              <div className="space-y-1">
                                <div
                                  className={`
                                    relative h-4 w-full border-2 cursor-pointer transition-all duration-200
                                    ${statusInfo.color} rounded-sm
                                  `}
                                >
                                  <div className="text-xs font-bold text-black absolute inset-0 flex items-center justify-center">
                                    {position.code.split('-').slice(-2).join('-')}
                                  </div>
                                  
                                  {/* UCP count indicator */}
                                  {positionUcps.length > 0 && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
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
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Central corridor */}
                    <div className="flex items-center justify-center">
                      <div className="bg-gray-200 p-4 rounded-lg shadow-sm">
                        <p className="text-sm font-medium text-gray-700 writing-mode-vertical-lr transform rotate-180">
                          CORREDOR CENTRAL
                        </p>
                      </div>
                    </div>

                    {/* Right side positions */}
                    <div className="space-y-4">
                      <div className="text-center font-semibold text-sm bg-gray-100 p-2 rounded">
                        DIR
                      </div>
                      {streetPositions
                        .filter(pos => pos.code.includes('-D-'))
                        .sort((a, b) => {
                          const aNum = parseInt(a.code.split('-')[3]);
                          const bNum = parseInt(b.code.split('-')[3]);
                          return aNum - bNum;
                        })
                        .map(position => {
                          const statusInfo = getStatusInfo(position.status);
                          const positionUcps = getUcpsForPosition(position.id);
                          const recentMovements = getRecentMovementsForPosition(position.id);
                          
                          return (
                            <div
                              key={position.id}
                              className={`
                                relative border-2 border-black bg-white rounded-lg p-2 shadow-md hover:shadow-lg transition-shadow cursor-pointer
                                ${hoveredPosition?.id === position.id ? 'ring-2 ring-blue-400 scale-105' : ''}
                                ${selectedPosition?.id === position.id ? 'ring-2 ring-purple-400' : ''}
                              `}
                              onMouseEnter={() => setHoveredPosition(position)}
                              onMouseLeave={() => setHoveredPosition(null)}
                              onClick={() => setSelectedPosition(position)}
                              title={`${position.code} - ${statusInfo.label}`}
                            >
                              <div className="space-y-1">
                                <div
                                  className={`
                                    relative h-4 w-full border-2 cursor-pointer transition-all duration-200
                                    ${statusInfo.color} rounded-sm
                                  `}
                                >
                                  <div className="text-xs font-bold text-black absolute inset-0 flex items-center justify-center">
                                    {position.code.split('-').slice(-2).join('-')}
                                  </div>
                                  
                                  {/* UCP count indicator */}
                                  {positionUcps.length > 0 && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
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
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Position Details */}
      {selectedPosition && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhes da Posição</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Informações Gerais</h4>
                <div className="space-y-2">
                  <p><strong>Código:</strong> {selectedPosition.code}</p>
                  <p><strong>Status:</strong> {getStatusInfo(selectedPosition.status).label}</p>
                  <p><strong>Capacidade:</strong> {selectedPosition.capacity || 'N/A'}</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">UCPs Ativos</h4>
                <div className="space-y-1">
                  {getUcpsForPosition(selectedPosition.id).map(ucp => (
                    <div key={ucp.id} className="text-sm bg-gray-100 p-2 rounded">
                      {ucp.code}
                    </div>
                  ))}
                  {getUcpsForPosition(selectedPosition.id).length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum UCP ativo</p>
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