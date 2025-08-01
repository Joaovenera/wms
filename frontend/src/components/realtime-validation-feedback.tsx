import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Alert, AlertDescription } from "./ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown,
  Zap,
  RefreshCw,
  Eye,
  EyeOff,
  Settings,
  BarChart3,
  Scale,
  Package,
  Ruler,
  Clock,
  Activity,
  Target,
  Lightbulb,
  X
} from "lucide-react";
import { 
  ValidationResult, 
  ValidationViolation,
  CompositionRequest,
  CompositionResult 
} from "../types/api";
import { useRealtimeCompositionValidation } from "../hooks/useComposition";

interface RealtimeValidationFeedbackProps {
  compositionRequest: CompositionRequest | null;
  onValidationChange?: (validation: ValidationResult | null) => void;
  onQuickFix?: (fixAction: QuickFixAction) => void;
  showAdvanced?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  className?: string;
}

interface QuickFixAction {
  id: string;
  type: 'constraint' | 'product' | 'packaging' | 'pallet';
  title: string;
  description: string;
  impact: string;
  action: () => void;
  confidence: number;
}

interface ValidationMetrics {
  score: number;
  trend: 'up' | 'down' | 'stable';
  previousScore?: number;
  violations: number;
  warnings: number;
  recommendations: number;
}

interface PerformanceMetrics {
  responseTime: number;
  validationCount: number;
  lastValidated: Date;
  averageResponseTime: number;
}

export function RealtimeValidationFeedback({
  compositionRequest,
  onValidationChange,
  onQuickFix,
  showAdvanced = false,
  autoRefresh = true,
  refreshInterval = 2000,
  className
}: RealtimeValidationFeedbackProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [validationHistory, setValidationHistory] = useState<ValidationResult[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    responseTime: 0,
    validationCount: 0,
    lastValidated: new Date(),
    averageResponseTime: 0
  });

  // Real-time validation with custom intervals
  const { 
    data: validationData, 
    isLoading: isValidating,
    dataUpdatedAt,
    error: validationError
  } = useRealtimeCompositionValidation(
    compositionRequest,
    !!compositionRequest && autoRefresh
  );

  // Track validation history and performance
  useEffect(() => {
    if (validationData) {
      const now = new Date();
      const responseTime = now.getTime() - dataUpdatedAt;
      
      setValidationHistory(prev => {
        const newHistory = [validationData, ...prev.slice(0, 9)]; // Keep last 10
        return newHistory;
      });

      setPerformanceMetrics(prev => ({
        responseTime,
        validationCount: prev.validationCount + 1,
        lastValidated: now,
        averageResponseTime: (prev.averageResponseTime * prev.validationCount + responseTime) / (prev.validationCount + 1)
      }));

      onValidationChange?.(validationData);
    }
  }, [validationData, dataUpdatedAt, onValidationChange]);

  // Calculate validation metrics
  const validationMetrics = useMemo((): ValidationMetrics => {
    if (!validationData) {
      return {
        score: 0,
        trend: 'stable',
        violations: 0,
        warnings: 0,
        recommendations: 0
      };
    }

    const currentScore = validationData.metrics.efficiency;
    const previousValidation = validationHistory[1];
    const previousScore = previousValidation?.metrics.efficiency;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (previousScore) {
      if (currentScore > previousScore + 0.05) trend = 'up';
      else if (currentScore < previousScore - 0.05) trend = 'down';
    }

    return {
      score: currentScore,
      trend,
      previousScore,
      violations: validationData.violations.filter(v => v.severity === 'error').length,
      warnings: validationData.violations.filter(v => v.severity === 'warning').length + validationData.warnings.length,
      recommendations: validationData.violations.length + validationData.warnings.length
    };
  }, [validationData, validationHistory]);

  // Generate quick fix suggestions
  const quickFixes = useMemo((): QuickFixAction[] => {
    if (!validationData || validationData.isValid) return [];

    const fixes: QuickFixAction[] = [];

    // Weight violations
    const weightViolations = validationData.violations.filter(v => v.type === 'weight');
    if (weightViolations.length > 0) {
      fixes.push({
        id: 'reduce-weight',
        type: 'constraint',
        title: 'Reduzir peso total',
        description: 'Diminuir quantidades ou usar embalagens menores',
        impact: `-${((validationData.metrics.totalWeight - (validationData.metrics.totalWeight * 0.9)) * 1).toFixed(1)}kg`,
        confidence: 0.8,
        action: () => onQuickFix?.({
          id: 'reduce-weight',
          type: 'constraint',
          title: 'Reduzir peso total',
          description: 'Diminuir quantidades ou usar embalagens menores',
          impact: `Redução de peso`,
          confidence: 0.8,
          action: () => {}
        })
      });
    }

    // Volume violations
    const volumeViolations = validationData.violations.filter(v => v.type === 'volume');
    if (volumeViolations.length > 0) {
      fixes.push({
        id: 'optimize-volume',
        type: 'packaging',
        title: 'Otimizar embalagens',
        description: 'Escolher embalagens mais compactas',
        impact: `+15% eficiência`,
        confidence: 0.9,
        action: () => onQuickFix?.({
          id: 'optimize-volume',
          type: 'packaging',
          title: 'Otimizar embalagens',
          description: 'Escolher embalagens mais compactas',
          impact: `Melhoria de volume`,
          confidence: 0.9,
          action: () => {}
        })
      });
    }

    // Height violations
    const heightViolations = validationData.violations.filter(v => v.type === 'height');
    if (heightViolations.length > 0) {
      fixes.push({
        id: 'reduce-height',
        type: 'product',
        title: 'Reorganizar produtos',
        description: 'Ajustar layout para reduzir altura',
        impact: `-${Math.round((validationData.metrics.totalHeight - (validationData.metrics.totalHeight * 0.8)))}cm`,
        confidence: 0.7,
        action: () => onQuickFix?.({
          id: 'reduce-height',
          type: 'product',
          title: 'Reorganizar produtos',
          description: 'Ajustar layout para reduzir altura',
          impact: `Redução de altura`,
          confidence: 0.7,
          action: () => {}
        })
      });
    }

    // Low efficiency
    if (validationData.metrics.efficiency < 0.6) {
      fixes.push({
        id: 'suggest-alternatives',
        type: 'pallet',
        title: 'Pallet alternativo',
        description: 'Sugerir pallet mais adequado',
        impact: `+${Math.round((0.8 - validationData.metrics.efficiency) * 100)}% eficiência`,
        confidence: 0.85,
        action: () => onQuickFix?.({
          id: 'suggest-alternatives',
          type: 'pallet',
          title: 'Pallet alternativo',
          description: 'Sugerir pallet mais adequado',
          impact: `Melhoria de eficiência`,
          confidence: 0.85,
          action: () => {}
        })
      });
    }

    return fixes.sort((a, b) => b.confidence - a.confidence);
  }, [validationData, onQuickFix]);

  const getStatusColor = (isValid: boolean | undefined) => {
    if (isValid === undefined) return "text-gray-400";
    return isValid ? "text-green-600" : "text-red-600";
  };

  const getStatusIcon = (isValid: boolean | undefined) => {
    if (isValid === undefined) return <Activity className="h-4 w-4 text-gray-400" />;
    return isValid ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: 'error' | 'warning') => {
    return severity === 'error' ? 'text-red-600' : 'text-yellow-600';
  };

  const getSeverityIcon = (severity: 'error' | 'warning') => {
    return severity === 'error' ? (
      <XCircle className="h-4 w-4 text-red-600" />
    ) : (
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
    );
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (!compositionRequest) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Activity className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p>Aguardando dados da composição...</p>
        </CardContent>
      </Card>
    );
  }

  if (isCollapsed) {
    return (
      <Card className={`${className} cursor-pointer`} onClick={() => setIsCollapsed(false)}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(validationData?.isValid)}
              <span className="text-sm font-medium">
                {validationData?.isValid === undefined 
                  ? 'Validando...' 
                  : validationData.isValid 
                    ? 'Válida' 
                    : 'Inválida'
                }
              </span>
              {validationData && (
                <Badge variant="outline" className="text-xs">
                  {(validationData.metrics.efficiency * 100).toFixed(1)}%
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isValidating && <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />}
              <Eye className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Validação em Tempo Real
            {isValidating && (
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main status */}
        <div className={`p-4 rounded-lg border-2 ${
          validationData?.isValid 
            ? 'border-green-200 bg-green-50' 
            : validationData 
              ? 'border-red-200 bg-red-50'
              : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(validationData?.isValid)}
              <div>
                <div className={`font-semibold ${getStatusColor(validationData?.isValid)}`}>
                  {validationData?.isValid === undefined 
                    ? 'Processando validação...'
                    : validationData.isValid 
                      ? 'Composição Válida'
                      : 'Composição Inválida'
                  }
                </div>
                {validationData && (
                  <div className="text-sm text-muted-foreground">
                    {validationData.isValid 
                      ? `Eficiência: ${(validationData.metrics.efficiency * 100).toFixed(1)}%`
                      : `${validationMetrics.violations} erro(s), ${validationMetrics.warnings} aviso(s)`
                    }
                  </div>
                )}
              </div>
            </div>
            
            {validationData && (
              <div className="flex items-center gap-2">
                {getTrendIcon(validationMetrics.trend)}
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getStatusColor(validationData.isValid)}`}>
                    {(validationData.metrics.efficiency * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Eficiência</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick metrics */}
        {validationData && (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Scale className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Peso</span>
              </div>
              <div className="text-lg font-bold">
                {validationData.metrics.totalWeight.toFixed(1)}kg
              </div>
              <div className="text-xs text-muted-foreground">
                {validationData.metrics.totalWeight > 0 ? 'Dentro do limite' : 'Vazio'}
              </div>
            </div>

            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Package className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Volume</span>
              </div>
              <div className="text-lg font-bold">
                {validationData.metrics.totalVolume.toFixed(3)}m³
              </div>
              <div className="text-xs text-muted-foreground">
                {validationData.metrics.totalVolume > 0 ? 'Calculado' : 'Vazio'}
              </div>
            </div>

            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Ruler className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Altura</span>
              </div>
              <div className="text-lg font-bold">
                {validationData.metrics.totalHeight.toFixed(1)}cm
              </div>
              <div className="text-xs text-muted-foreground">
                {validationData.metrics.totalHeight > 0 ? 'Empilhamento' : 'Base'}
              </div>
            </div>
          </div>
        )}

        {/* Quick fixes */}
        {quickFixes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Correções Rápidas</span>
            </div>
            <div className="space-y-2">
              {quickFixes.slice(0, 3).map((fix) => (
                <div key={fix.id} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{fix.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(fix.confidence * 100)}%
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {fix.impact}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fix.description}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fix.action()}
                    disabled={isValidating}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Aplicar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed information */}
        {showDetails && validationData && (
          <Tabs defaultValue="violations" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="violations">
                Problemas
                {validationMetrics.violations + validationMetrics.warnings > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {validationMetrics.violations + validationMetrics.warnings}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="metrics">Métricas</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="violations" className="space-y-3">
              {validationData.violations.length === 0 && validationData.warnings.length === 0 ? (
                <div className="text-center py-4 text-green-600">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Nenhum problema encontrado</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {validationData.violations.map((violation, index) => (
                    <Alert key={index} className="border-red-200 bg-red-50">
                      <div className="flex items-start gap-2">
                        {getSeverityIcon(violation.severity)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={violation.severity === 'error' ? 'destructive' : 'outline'} className="text-xs">
                              {violation.severity === 'error' ? 'Erro' : 'Aviso'}
                            </Badge>
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">
                              {violation.type}
                            </span>
                          </div>
                          <AlertDescription className={getSeverityColor(violation.severity)}>
                            {violation.message}
                          </AlertDescription>
                          {violation.affectedProducts.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Produtos: {violation.affectedProducts.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </Alert>
                  ))}

                  {validationData.warnings.map((warning, index) => (
                    <Alert key={`warning-${index}`} className="border-yellow-200 bg-yellow-50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800">
                        {warning}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4">
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Eficiência Geral</span>
                    <span className={getStatusColor(validationData.isValid)}>
                      {(validationData.metrics.efficiency * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={validationData.metrics.efficiency * 100} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Peso Total:</span>
                    <span className="ml-2 font-medium">{validationData.metrics.totalWeight.toFixed(1)}kg</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Volume Total:</span>
                    <span className="ml-2 font-medium">{validationData.metrics.totalVolume.toFixed(3)}m³</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Altura Total:</span>
                    <span className="ml-2 font-medium">{validationData.metrics.totalHeight.toFixed(1)}cm</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <span className={`ml-2 font-medium ${getStatusColor(validationData.isValid)}`}>
                      {validationData.isValid ? 'Válida' : 'Inválida'}
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Tempo de Validação</span>
                  </div>
                  <div className="text-lg font-bold">
                    {formatDuration(performanceMetrics.responseTime)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Média: {formatDuration(performanceMetrics.averageResponseTime)}
                  </div>
                </div>

                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <BarChart3 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Validações</span>
                  </div>
                  <div className="text-lg font-bold">
                    {performanceMetrics.validationCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Última: {performanceMetrics.lastValidated.toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {validationHistory.length > 1 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Histórico de Validações</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {validationHistory.slice(0, 5).map((validation, index) => (
                      <div key={index} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(validation.isValid)}
                          <span>Validação #{validationHistory.length - index}</span>
                        </div>
                        <span className={getStatusColor(validation.isValid)}>
                          {(validation.metrics.efficiency * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Error handling */}
        {validationError && (
          <Alert className="border-red-200 bg-red-50">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Erro na validação: {validationError.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}