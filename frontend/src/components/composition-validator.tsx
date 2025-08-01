import React from "react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X,
  Weight,
  Package,
  Ruler,
  TrendingUp
} from "lucide-react";
import { ValidationResult } from "../types/api";

interface CompositionValidatorProps {
  validationResults: ValidationResult;
  onDismiss?: () => void;
  className?: string;
}

export function CompositionValidator({ 
  validationResults, 
  onDismiss,
  className 
}: CompositionValidatorProps) {
  const { isValid, violations, warnings, metrics } = validationResults;

  const getSeverityIcon = (severity: 'error' | 'warning') => {
    return severity === 'error' ? (
      <XCircle className="h-4 w-4 text-red-500" />
    ) : (
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
    );
  };

  const getSeverityBadge = (severity: 'error' | 'warning') => {
    return severity === 'error' ? (
      <Badge variant="destructive" className="text-xs">Erro</Badge>
    ) : (
      <Badge variant="outline" className="text-xs">Aviso</Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, JSX.Element> = {
      weight: <Weight className="h-4 w-4" />,
      volume: <Package className="h-4 w-4" />,
      height: <Ruler className="h-4 w-4" />,
      compatibility: <AlertTriangle className="h-4 w-4" />,
    };
    return icons[type] || <Info className="h-4 w-4" />;
  };

  const formatMetric = (value: number, unit: string): string => {
    return `${value.toFixed(2)} ${unit}`;
  };

  const getUtilizationColor = (utilization: number): string => {
    if (utilization > 1) return "text-red-600";
    if (utilization > 0.9) return "text-yellow-600";
    if (utilization > 0.7) return "text-green-600";
    return "text-blue-600";
  };

  const getEfficiencyStatus = (efficiency: number): {
    label: string;
    color: string;
    description: string;
  } => {
    if (efficiency >= 0.9) {
      return {
        label: "Excelente",
        color: "text-green-600",
        description: "Otimização excepcional do espaço"
      };
    }
    if (efficiency >= 0.75) {
      return {
        label: "Bom",
        color: "text-green-500",
        description: "Boa utilização do espaço"
      };
    }
    if (efficiency >= 0.6) {
      return {
        label: "Regular",
        color: "text-yellow-600",
        description: "Utilização moderada do espaço"
      };
    }
    if (efficiency >= 0.4) {
      return {
        label: "Baixo",
        color: "text-orange-600",
        description: "Baixa utilização do espaço"
      };
    }
    return {
      label: "Muito Baixo",
      color: "text-red-600",
      description: "Utilização inadequada do espaço"
    };
  };

  const efficiencyStatus = getEfficiencyStatus(metrics.efficiency);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Status Alert */}
      <Alert className={isValid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isValid ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <div>
              <AlertTitle className={isValid ? "text-green-800" : "text-red-800"}>
                {isValid ? "Composição Válida" : "Composição Inválida"}
              </AlertTitle>
              <AlertDescription className={isValid ? "text-green-700" : "text-red-700"}>
                {isValid
                  ? `Composição atende todos os requisitos com ${(metrics.efficiency * 100).toFixed(1)}% de eficiência`
                  : `${violations.filter(v => v.severity === 'error').length} erro(s) e ${violations.filter(v => v.severity === 'warning').length} aviso(s) encontrados`
                }
              </AlertDescription>
            </div>
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Metrics Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Métricas da Composição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Efficiency */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Eficiência Geral</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${efficiencyStatus.color}`}>
                    {efficiencyStatus.label}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {(metrics.efficiency * 100).toFixed(1)}%
                  </Badge>
                </div>
              </div>
              <Progress 
                value={metrics.efficiency * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {efficiencyStatus.description}
              </p>
            </div>

            {/* Weight */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Weight className="h-3 w-3" />
                  <span className="text-sm">Peso Total</span>
                </div>
                <span className="text-sm font-medium">
                  {formatMetric(metrics.totalWeight, 'kg')}
                </span>
              </div>
            </div>

            {/* Volume */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Package className="h-3 w-3" />
                  <span className="text-sm">Volume Total</span>
                </div>
                <span className="text-sm font-medium">
                  {formatMetric(metrics.totalVolume, 'm³')}
                </span>
              </div>
            </div>

            {/* Height */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Ruler className="h-3 w-3" />
                  <span className="text-sm">Altura Total</span>
                </div>
                <span className="text-sm font-medium">
                  {formatMetric(metrics.totalHeight, 'cm')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Violations and Warnings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Problemas Identificados
              {violations.length > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {violations.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {violations.length === 0 && warnings.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm">Nenhum problema encontrado</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {violations.map((violation, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-start gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {getTypeIcon(violation.type)}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getSeverityBadge(violation.severity)}
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">
                              {violation.type}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-900">
                            {violation.message}
                          </p>
                          {violation.affectedProducts.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Produtos afetados: {violation.affectedProducts.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      {getSeverityIcon(violation.severity)}
                    </div>
                  </div>
                ))}

                {warnings.map((warning, index) => (
                  <div key={`warning-${index}`} className="border rounded-lg p-3 bg-yellow-50">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">Aviso</Badge>
                        </div>
                        <p className="text-sm text-yellow-800">{warning}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {!isValid && violations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Info className="h-4 w-4" />
              Recomendações para Correção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {violations
                .filter(v => v.severity === 'error')
                .map((violation, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 rounded-lg bg-blue-50">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <strong>Para {violation.type}:</strong> 
                      {violation.type === 'weight' && ' Considere reduzir quantidades ou usar embalagens menores'}
                      {violation.type === 'volume' && ' Reorganize os produtos ou considere um pallet maior'}
                      {violation.type === 'height' && ' Reduza o empilhamento ou use produtos de menor altura'}
                      {violation.type === 'compatibility' && ' Verifique se os produtos são compatíveis para empilhamento'}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}