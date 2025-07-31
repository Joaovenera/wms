import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Truck, Package, Weight, Info, Ruler } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Vehicle {
  id: number;
  code: string;
  name: string;
  brand: string;
  model: string;
  licensePlate: string;
  type: string;
  weightCapacity: string;
  cargoAreaLength: number;
  cargoAreaWidth: number;
  cargoAreaHeight: number;
  status: string;
  observations?: string;
}

interface VehicleSelectorProps {
  selectedVehicleId?: number;
  onVehicleSelect: (vehicle: Vehicle) => void;
  disabled?: boolean;
}

export function VehicleSelector({ selectedVehicleId, onVehicleSelect, disabled = false }: VehicleSelectorProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Fetch available vehicles
  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['/api/vehicles/available'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/vehicles/available');
      return await res.json();
    },
  });

  const handleVehicleChange = (vehicleId: string) => {
    const vehicle = vehicles?.find((v: Vehicle) => v.id.toString() === vehicleId);
    if (vehicle) {
      setSelectedVehicle(vehicle);
      onVehicleSelect(vehicle);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'disponivel': { label: 'Disponível', variant: 'default' as const },
      'em_uso': { label: 'Em Uso', variant: 'secondary' as const },
      'manutencao': { label: 'Manutenção', variant: 'destructive' as const },
      'inativo': { label: 'Inativo', variant: 'outline' as const },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || 
      { label: status, variant: 'outline' as const };
    
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  // Calculate cargo volume for display
  const calculateCargoVolume = (vehicle: Vehicle) => {
    return (vehicle.cargoAreaLength * vehicle.cargoAreaWidth * vehicle.cargoAreaHeight).toFixed(2);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Seleção de Veículo
        </CardTitle>
        <CardDescription>
          Escolha o veículo que será utilizado para a transferência
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Veículo Disponível</label>
          <Select
            onValueChange={handleVehicleChange}
            value={selectedVehicleId?.toString() || ""}
            disabled={disabled || isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um veículo..." />
            </SelectTrigger>
            <SelectContent>
              {vehicles?.map((vehicle: Vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    <span className="font-medium">{vehicle.code}</span>
                    <span className="text-sm text-gray-500">- {vehicle.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedVehicle && (
          <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-lg">{selectedVehicle.name}</h4>
              {getStatusBadge(selectedVehicle.status)}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-500" />
                <span className="text-gray-600">Código:</span>
                <span className="font-mono">{selectedVehicle.code}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-green-500" />
                <span className="text-gray-600">Marca/Modelo:</span>
                <span>{selectedVehicle.brand} {selectedVehicle.model}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Weight className="h-4 w-4 text-purple-500" />
                <span className="text-gray-600">Capacidade Peso:</span>
                <span className="font-semibold">{selectedVehicle.weightCapacity}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-orange-500" />
                <span className="text-gray-600">Área de Carga:</span>
                <span className="font-semibold">{calculateCargoVolume(selectedVehicle)} m³</span>
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="text-sm">
                <span className="text-gray-600">Dimensões da carga:</span>
                <div className="font-mono text-xs mt-1">
                  {selectedVehicle.cargoAreaLength}m × {selectedVehicle.cargoAreaWidth}m × {selectedVehicle.cargoAreaHeight}m
                </div>
              </div>
            </div>

            {selectedVehicle.observations && (
              <div className="flex items-start gap-2 pt-2 border-t">
                <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                <div>
                  <span className="text-sm font-medium text-gray-600">Observações:</span>
                  <p className="text-sm text-gray-700 mt-1">{selectedVehicle.observations}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="text-sm text-gray-500">Carregando veículos disponíveis...</div>
          </div>
        )}

        {!isLoading && vehicles?.length === 0 && (
          <div className="text-center py-4">
            <Truck className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Nenhum veículo disponível no momento</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}