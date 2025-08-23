import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Ship,
  Clock, 
  Truck,
  Camera,
  Package,
  CheckCircle,
  Calendar,
  User,
  FileText,
  Eye,
  Edit3,
  Trash2,
  MapPin,
  Shield,
  AlertTriangle,
  MoreVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONTAINER_STATUS_CONFIG, ContainerArrival } from "@/types/container";

interface ContainerCardProps {
  container: ContainerArrival & {
    photo_count?: number;
    item_count?: number;
    total_quantity?: number;
  };
  onView?: (container: ContainerArrival) => void;
  onEdit?: (container: ContainerArrival) => void;
  onDelete?: (container: ContainerArrival) => void;
  onStatusChange?: (container: ContainerArrival, newStatus: string) => void;
  compact?: boolean;
  showActions?: boolean;
  className?: string;
}

export function ContainerCard({
  container,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
  compact = false,
  showActions = true,
  className = ""
}: ContainerCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const statusConfig = CONTAINER_STATUS_CONFIG[container.status];
  
  const getStatusIcon = () => {
    const icons = {
      Clock,
      Truck,
      Camera,
      Package,
      CheckCircle
    };
    return icons[statusConfig?.icon as keyof typeof icons] || Clock;
  };

  const StatusIcon = getStatusIcon();
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getProgressInfo = () => {
    const photoProgress = (container.photo_count || 0) / 4 * 100;
    const hasItems = (container.item_count || 0) > 0;
    
    return {
      photoProgress,
      photoComplete: photoProgress === 100,
      hasItems,
      itemCount: container.item_count || 0,
      totalQuantity: container.total_quantity || 0
    };
  };

  const progress = getProgressInfo();

  const handleStatusChange = (newStatus: string) => {
    if (onStatusChange) {
      onStatusChange(container, newStatus);
    }
  };

  const availableStatusTransitions = () => {
    const currentStatus = container.status;
    const transitions: Record<string, string[]> = {
      'awaiting': ['arrived'],
      'arrived': ['documenting'],
      'documenting': ['unloading'],
      'unloading': ['completed'],
      'completed': []
    };
    
    return transitions[currentStatus] || [];
  };

  if (compact) {
    return (
      <Card className={`hover:bg-gray-50 transition-colors cursor-pointer ${className}`} onClick={() => onView?.(container)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full bg-${statusConfig?.color || 'gray'}-100 flex items-center justify-center`}>
                <StatusIcon className={`h-4 w-4 text-${statusConfig?.color || 'gray'}-600`} />
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{container.containerNumber}</h3>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs bg-${statusConfig?.color || 'gray'}-100 text-${statusConfig?.color || 'gray'}-800`}
                  >
                    {statusConfig?.label || container.status}
                  </Badge>
                </div>
                <div className="text-xs text-gray-600">
                  {container.supplierName}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-xs text-gray-500">
                {container.photo_count || 0}/4 fotos • {container.item_count || 0} itens
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`hover:shadow-md transition-all duration-200 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full bg-${statusConfig?.color || 'gray'}-100 flex items-center justify-center`}>
              <StatusIcon className={`h-6 w-6 text-${statusConfig?.color || 'gray'}-600`} />
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold">{container.containerNumber}</h3>
                <Badge 
                  variant="secondary" 
                  className={`bg-${statusConfig?.color || 'gray'}-100 text-${statusConfig?.color || 'gray'}-800`}
                >
                  {statusConfig?.label || container.status}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>{container.supplierName}</span>
                </div>
                
                {container.sealNumber && (
                  <div className="flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    <span>{container.sealNumber}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onView && (
                  <DropdownMenuItem onClick={() => onView(container)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizar
                  </DropdownMenuItem>
                )}
                
                {onEdit && container.status !== 'completed' && (
                  <DropdownMenuItem onClick={() => onEdit(container)}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                )}
                
                {availableStatusTransitions().map((nextStatus) => {
                  const nextConfig = CONTAINER_STATUS_CONFIG[nextStatus];
                  return (
                    <DropdownMenuItem 
                      key={nextStatus}
                      onClick={() => handleStatusChange(nextStatus)}
                    >
                      <Truck className="h-4 w-4 mr-2" />
                      Marcar como {nextConfig?.label}
                    </DropdownMenuItem>
                  );
                })}
                
                {onDelete && container.status === 'awaiting' && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(container)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Datas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Previsão de Chegada</span>
            </div>
            <div className="text-sm">
              {formatDate(container.estimatedArrival)}
            </div>
          </div>
          
          {container.actualArrival && (
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Chegada Real</span>
              </div>
              <div className="text-sm">
                {formatDate(container.actualArrival)}
              </div>
            </div>
          )}
        </div>

        {/* Informações de Transporte */}
        {(container.transporterName || container.vehicleInfo || container.driverName) && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm text-gray-700 mb-2">Transporte</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {container.transporterName && (
                <div>
                  <span className="text-gray-600">Transportadora:</span> {container.transporterName}
                </div>
              )}
              
              {container.vehicleInfo && (
                <div>
                  <span className="text-gray-600">Veículo:</span> {container.vehicleInfo}
                </div>
              )}
              
              {container.driverName && (
                <div>
                  <span className="text-gray-600">Motorista:</span> {container.driverName}
                </div>
              )}
              
              {container.driverDocument && (
                <div>
                  <span className="text-gray-600">Documento:</span> {container.driverDocument}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress indicators */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Photo progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Documentação Fotográfica</span>
                </div>
                <span className="text-sm text-gray-600">
                  {container.photo_count || 0}/4
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all ${
                    progress.photoComplete ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${progress.photoProgress}%` }}
                />
              </div>
            </div>

            {/* Items info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Itens Registrados</span>
                </div>
                <span className="text-sm text-gray-600">
                  {progress.itemCount} itens
                </span>
              </div>
              {progress.totalQuantity > 0 && (
                <div className="text-xs text-gray-500">
                  Quantidade total: {progress.totalQuantity.toLocaleString('pt-BR')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Warnings */}
        {(container.status === 'arrived' && !progress.photoComplete) && (
          <div className="border-t pt-4">
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-yellow-800">
                  Documentação Pendente
                </div>
                <div className="text-yellow-700">
                  Container chegou mas faltam {4 - (container.photo_count || 0)} foto(s) obrigatória(s)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {container.notes && (
          <div className="border-t pt-4">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-gray-600 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">Observações</div>
                <div className="text-sm text-gray-600">
                  {isExpanded ? container.notes : `${container.notes.substring(0, 100)}${container.notes.length > 100 ? '...' : ''}`}
                </div>
                {container.notes.length > 100 && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                  >
                    {isExpanded ? 'Ver menos' : 'Ver mais'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action buttons for mobile */}
        {showActions && (
          <div className="border-t pt-4 flex gap-2 md:hidden">
            {onView && (
              <Button variant="outline" size="sm" onClick={() => onView(container)} className="flex-1">
                <Eye className="h-4 w-4 mr-2" />
                Ver
              </Button>
            )}
            
            {onEdit && container.status !== 'completed' && (
              <Button variant="outline" size="sm" onClick={() => onEdit(container)} className="flex-1">
                <Edit3 className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
          </div>
        )}

        {/* Footer with timestamps */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div>
              Criado: {formatDate(container.createdAt)}
              {container.createdByName && (
                <span> por {container.createdByName}</span>
              )}
            </div>
            
            {container.completedAt && (
              <div>
                Finalizado: {formatDate(container.completedAt)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}