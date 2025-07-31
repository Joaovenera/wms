import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

interface Vehicle {
  id: number;
  code: string;
  name: string;
  brand: string;
  model: string;
  licensePlate: string;
}

interface VehicleSelectorFilterProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
}

export function VehicleSelectorFilter({ 
  value, 
  onValueChange, 
  label = "Veículo" 
}: VehicleSelectorFilterProps) {
  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['/api/vehicles'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/vehicles');
      return await res.json();
    }
  });

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Carregando..." : "Todos os veículos"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todos os veículos</SelectItem>
          {vehicles?.map((vehicle: Vehicle) => (
            <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
              {vehicle.name} - {vehicle.licensePlate} ({vehicle.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
} 