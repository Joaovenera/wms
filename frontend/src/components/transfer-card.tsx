import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Truck, Package, CheckCircle, Clock, AlertTriangle, Eye, Edit, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TransferRequest {
  id: number;
  code: string;
  status: string;
  fromLocation: string;
  toLocation: string;
  totalCubicVolume: string;
  effectiveCapacity: string;
  capacityUsagePercent: string;
  createdAt: string;
  vehicleName: string;
  vehicleCode: string;
  createdByName: string;
}

interface TransferCardProps {
  request: TransferRequest;
  onViewDetails: (id: number) => void;
  onEdit?: (id: number) => void;
  showActions?: boolean;
}

export function TransferCard({ request, onViewDetails, onEdit, showActions = true }: TransferCardProps) {
  const getStatusBadge = (status: string) => {
    const statusMap = {
      'planejamento': { label: 'Planejamento', variant: 'secondary' as const, icon: Clock, color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      'aprovado': { label: 'Aprovado', variant: 'default' as const, icon: CheckCircle, color: 'bg-green-100 text-green-800 border-green-200' },
      'carregamento': { label: 'Carregamento', variant: 'outline' as const, icon: Package, color: 'bg-blue-100 text-blue-800 border-blue-200' },
      'transito': { label: 'Em Trânsito', variant: 'default' as const, icon: Truck, color: 'bg-purple-100 text-purple-800 border-purple-200' },
      'finalizado': { label: 'Finalizado', variant: 'default' as const, icon: CheckCircle, color: 'bg-gray-100 text-gray-800 border-gray-200' },
      'cancelado': { label: 'Cancelado', variant: 'destructive' as const, icon: AlertTriangle, color: 'bg-red-100 text-red-800 border-red-200' },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || 
      { label: status, variant: 'outline' as const, icon: Clock, color: 'bg-gray-100 text-gray-800 border-gray-200' };
    
    const Icon = statusInfo.icon;
    
    return (
      <Badge className={`flex items-center gap-1.5 px-2.5 py-1 ${statusInfo.color} font-medium`}>
        <Icon className="h-3.5 w-3.5" />
        {statusInfo.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCapacityColor = (percent: number) => {
    if (percent >= 90) return 'text-red-600 font-semibold';
    if (percent >= 75) return 'text-orange-600 font-medium';
    if (percent >= 50) return 'text-blue-600 font-medium';
    return 'text-green-600 font-medium';
  };

  const capacityPercent = parseFloat(request.capacityUsagePercent);

  return (
    <Card className="transition-all duration-200 hover:shadow-md hover:bg-gray-50/50 border-l-4 border-l-blue-500">
      <CardContent className="p-6">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1">
            <h3 className="font-bold text-lg text-gray-900">{request.code}</h3>
            <div className="flex items-center text-sm text-gray-600 space-x-2">
              <span className="font-medium">{request.fromLocation}</span>
              <span className="text-gray-400">→</span>
              <span className="font-medium">{request.toLocation}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {getStatusBadge(request.status)}
            {showActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Abrir menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => onViewDetails(request.id)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Ver Detalhes
                  </DropdownMenuItem>
                  {onEdit && request.status === 'planejamento' && (
                    <DropdownMenuItem onClick={() => onEdit(request.id)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <Separator className="my-4" />

        {/* Details Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Veículo</span>
            <div>
              <p className="font-semibold text-gray-900">{request.vehicleName}</p>
              <p className="text-xs text-gray-500">{request.vehicleCode}</p>
            </div>
          </div>
          
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cubagem</span>
            <div>
              <p className="font-semibold text-gray-900">
                {parseFloat(request.totalCubicVolume).toFixed(2)} m³
              </p>
              <p className="text-xs text-gray-500">Volume total</p>
            </div>
          </div>
          
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Utilização</span>
            <div>
              <p className={`font-semibold ${getCapacityColor(capacityPercent)}`}>
                {capacityPercent.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">
                {capacityPercent >= 90 ? 'Crítico' : 
                 capacityPercent >= 75 ? 'Alto' : 
                 capacityPercent >= 50 ? 'Médio' : 'Baixo'}
              </p>
            </div>
          </div>
          
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Criado em</span>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{formatDate(request.createdAt)}</p>
              <p className="text-xs text-gray-500">por {request.createdByName}</p>
            </div>
          </div>
        </div>

        {/* Capacity Bar */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-600">Capacidade do veículo</span>
            <span className="font-medium">{capacityPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                capacityPercent >= 100 ? 'bg-red-500' :
                capacityPercent >= 90 ? 'bg-orange-500' :
                capacityPercent >= 75 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(capacityPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Quick Action Button */}
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails(request.id)}
            className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-300"
          >
            <Eye className="h-3.5 w-3.5" />
            Ver Detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}