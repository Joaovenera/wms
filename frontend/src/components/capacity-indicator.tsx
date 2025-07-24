import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, CheckCircle, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface CapacityIndicatorProps {
  totalCubicVolume: number; // m³ utilizados
  effectiveCapacity: number; // m³ capacidade efetiva (90% do total)
  vehicleName?: string;
  className?: string;
}

export function CapacityIndicator({
  totalCubicVolume,
  effectiveCapacity,
  vehicleName,
  className
}: CapacityIndicatorProps) {
  
  // Calcular percentual de utilização
  const usagePercent = effectiveCapacity > 0 ? (totalCubicVolume / effectiveCapacity) * 100 : 0;
  
  // Determinar status baseado no percentual
  const getStatusInfo = () => {
    if (usagePercent <= 70) {
      return {
        status: 'safe',
        label: 'Seguro',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: CheckCircle,
        progressColor: 'bg-green-500',
        description: 'Capacidade dentro do limite recomendado'
      };
    } else if (usagePercent <= 90) {
      return {
        status: 'warning',
        label: 'Atenção',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        icon: AlertTriangle,
        progressColor: 'bg-yellow-500',
        description: 'Aproximando do limite de capacidade'
      };
    } else if (usagePercent <= 100) {
      return {
        status: 'critical',
        label: 'Limite',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        icon: TrendingUp,
        progressColor: 'bg-orange-500',
        description: 'Capacidade máxima atingida'
      };
    } else {
      return {
        status: 'exceeded',
        label: 'Excedido',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        icon: AlertTriangle,
        progressColor: 'bg-red-500',
        description: 'Capacidade excedida - revisar carregamento'
      };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Utilização do Caminhão
          </div>
          <Badge variant={
            statusInfo.status === 'safe' ? 'default' :
            statusInfo.status === 'warning' ? 'secondary' :
            statusInfo.status === 'critical' ? 'outline' : 'destructive'
          }>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusInfo.label}
          </Badge>
        </CardTitle>
        {vehicleName && (
          <p className="text-sm text-gray-600">{vehicleName}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Barra de Progresso Visual */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Capacidade Utilizada</span>
            <span className="font-semibold">
              {usagePercent.toFixed(1)}%
            </span>
          </div>
          
          <div className="relative">
            <Progress 
              value={Math.min(usagePercent, 100)} 
              className="h-3"
            />
            {/* Linha indicadora do limite recomendado (90%) */}
            <div 
              className="absolute top-0 h-3 w-0.5 bg-gray-400 opacity-70"
              style={{ left: '90%' }}
              title="Limite recomendado (90%)"
            />
          </div>
          
          <div className="flex justify-between text-xs text-gray-500">
            <span>0 m³</span>
            <span className="text-gray-400">90%</span>
            <span>{effectiveCapacity.toFixed(1)} m³</span>
          </div>
        </div>

        {/* Informações Detalhadas */}
        <div className={cn(
          "rounded-lg p-3 border",
          statusInfo.bgColor,
          statusInfo.borderColor
        )}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600 mb-1">Volume Carregado</p>
              <p className="text-lg font-bold">
                {totalCubicVolume.toFixed(2)} m³
              </p>
            </div>
            
            <div>
              <p className="text-gray-600 mb-1">Capacidade Efetiva</p>
              <p className="text-lg font-bold">
                {effectiveCapacity.toFixed(2)} m³
              </p>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <StatusIcon className={cn("h-4 w-4", statusInfo.color)} />
              <p className={cn("text-sm font-medium", statusInfo.color)}>
                {statusInfo.description}
              </p>
            </div>
          </div>
        </div>

        {/* Volume disponível restante */}
        <div className="text-center text-sm text-gray-600">
          <p>
            <span className="font-medium">
              {Math.max(0, effectiveCapacity - totalCubicVolume).toFixed(2)} m³
            </span>{" "}
            {totalCubicVolume <= effectiveCapacity ? "disponíveis" : "em excesso"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}