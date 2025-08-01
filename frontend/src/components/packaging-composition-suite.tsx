import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Alert, AlertDescription } from "./ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMobile } from "@/hooks/use-mobile";
import { 
  Package,
  Brain,
  Activity,
  BarChart3,
  Settings,
  Zap,
  Users,
  Eye,
  TrendingUp,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  Target,
  Layers
} from "lucide-react";
import { 
  CompositionRequest,
  CompositionResult,
  ValidationResult,
  PackagingComposition,
  CompositionReport
} from "../types/api";
import { 
  useCompositions,
  useCreateComposition,
  useValidateComposition,
  useSaveComposition,
  useGenerateCompositionReport,
  useCompositionOptimization
} from "../hooks/useComposition";
import { IntelligentCompositionBuilder } from "./intelligent-composition-builder";
import { RealtimeValidationFeedback } from "./realtime-validation-feedback";
import { MobileResponsiveComposition } from "./mobile-responsive-composition";
import { CompositionManager } from "./composition-manager";
import { CompositionVisualization } from "./composition-visualization";

interface PackagingCompositionSuiteProps {
  initialView?: 'builder' | 'manager' | 'analytics';
  productId?: number;
  className?: string;
}

interface AnalyticsMetrics {
  totalCompositions: number;
  validCompositions: number;
  averageEfficiency: number;
  totalSavings: number;
  topPerformingCompositions: PackagingComposition[];
  efficiencyTrend: Array<{
    date: string;
    efficiency: number;
    count: number;
  }>;
  utilizationMetrics: {
    weight: number;
    volume: number;
    height: number;
  };
}

export function PackagingCompositionSuite({
  initialView = 'builder',
  productId,
  className
}: PackagingCompositionSuiteProps) {
  const { toast } = useToast();
  const isMobile = useMobile();
  
  // State management
  const [activeView, setActiveView] = useState<'builder' | 'manager' | 'analytics'>(initialView);
  const [currentComposition, setCurrentComposition] = useState<PackagingComposition | null>(null);
  const [validationData, setValidationData] = useState<ValidationResult | null>(null);
  const [showAdvancedMode, setShowAdvancedMode] = useState(false);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  // API hooks
  const { data: compositions, refetch: refetchCompositions } = useCompositions();
  const createCompositionMutation = useCreateComposition();
  const validateCompositionMutation = useValidateComposition();
  const saveCompositionMutation = useSaveComposition();
  const generateReportMutation = useGenerateCompositionReport();
  const optimizationMutation = useCompositionOptimization();

  // Analytics data (mock for now - would come from API)
  const [analyticsMetrics, setAnalyticsMetrics] = useState<AnalyticsMetrics>({
    totalCompositions: compositions?.length || 0,
    validCompositions: compositions?.filter(c => c.result.isValid).length || 0,
    averageEfficiency: compositions?.reduce((acc, c) => acc + c.result.efficiency, 0) / (compositions?.length || 1) || 0,
    totalSavings: 15420.50,
    topPerformingCompositions: compositions?.slice(0, 5) || [],
    efficiencyTrend: [
      { date: '2024-01-01', efficiency: 0.72, count: 15 },
      { date: '2024-01-02', efficiency: 0.75, count: 18 },
      { date: '2024-01-03', efficiency: 0.78, count: 22 },
      { date: '2024-01-04', efficiency: 0.81, count: 25 },
      { date: '2024-01-05', efficiency: 0.83, count: 28 },
    ],
    utilizationMetrics: {
      weight: 0.87,
      volume: 0.79,
      height: 0.92
    }
  });

  // Update analytics when compositions change
  useEffect(() => {
    if (compositions) {
      setAnalyticsMetrics(prev => ({
        ...prev,
        totalCompositions: compositions.length,
        validCompositions: compositions.filter(c => c.result.isValid).length,
        averageEfficiency: compositions.reduce((acc, c) => acc + c.result.efficiency, 0) / compositions.length,
        topPerformingCompositions: compositions
          .sort((a, b) => b.result.efficiency - a.result.efficiency)
          .slice(0, 5)
      }));
    }
  }, [compositions]);

  // Handle composition creation
  const handleCompositionCreate = useCallback(async (
    request: CompositionRequest, 
    metadata: { name: string; description?: string }
  ) => {
    try {
      const result = await createCompositionMutation.mutateAsync(request);
      
      if (result.isValid) {
        await saveCompositionMutation.mutateAsync({
          name: metadata.name,
          description: metadata.description,
          compositionData: result,
          products: request.products,
          palletId: request.palletId || 0,
          status: 'validated',
        });

        toast({
          title: "Composição criada com sucesso!",
          description: `"${metadata.name}" foi salva com eficiência de ${(result.efficiency * 100).toFixed(1)}%`,
        });

        refetchCompositions();
        setActiveView('manager');
      } else {
        toast({
          title: "Composição inválida",
          description: "A composição não atende aos requisitos. Verifique as recomendações.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao criar composição",
        description: error.message || "Falha na criação da composição",
        variant: "destructive",
      });
    }
  }, [createCompositionMutation, saveCompositionMutation, toast, refetchCompositions]);

  // Handle composition validation
  const handleCompositionValidate = useCallback(async (request: CompositionRequest) => {
    try {
      const validation = await validateCompositionMutation.mutateAsync(request);
      setValidationData(validation);
      
      if (validation.isValid) {
        toast({
          title: "Validação bem-sucedida",
          description: `Composição válida com eficiência de ${(validation.metrics.efficiency * 100).toFixed(1)}%`,
        });
      } else {
        toast({
          title: "Validação falhou",
          description: `${validation.violations.length} violação(ões) encontrada(s)`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro na validação",
        description: error.message || "Falha na validação da composição",
        variant: "destructive",
      });
    }
  }, [validateCompositionMutation, toast]);

  // Handle optimization application
  const handleOptimizationApply = useCallback(async (request: CompositionRequest) => {
    try {
      const optimization = await optimizationMutation.mutateAsync(request);
      
      if (optimization.alternativeCompositions.length > 0) {
        const bestAlternative = optimization.alternativeCompositions[0];
        
        toast({
          title: "Otimização aplicada",
          description: `Eficiência melhorada para ${(bestAlternative.efficiency * 100).toFixed(1)}%`,
        });

        // Apply optimizations to current composition
        // This would update the composition builder state
      }
    } catch (error: any) {
      toast({
        title: "Erro na otimização",
        description: error.message || "Falha na otimização da composição",
        variant: "destructive",
      });
    }
  }, [optimizationMutation, toast]);

  // Handle report generation
  const handleGenerateReport = useCallback(async (composition: PackagingComposition) => {
    try {
      const report = await generateReportMutation.mutateAsync({
        compositionId: composition.id,
        includeMetrics: true,
        includeRecommendations: true,
        includeCostAnalysis: true,
      });
      
      toast({
        title: "Relatório gerado",
        description: `Relatório da composição "${composition.name}" gerado com sucesso`,
      });

      // Here you would typically download or display the report
    } catch (error: any) {
      toast({
        title: "Erro ao gerar relatório",
        description: error.message || "Falha na geração do relatório",
        variant: "destructive",
      });
    }
  }, [generateReportMutation, toast]);

  // Navigation component
  const Navigation = () => (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Sistema de Composições WMS</h1>
        <p className="text-muted-foreground">
          Gerenciamento inteligente de composições de produtos em pallets
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvancedMode(!showAdvancedMode)}
        >
          <Settings className="h-4 w-4 mr-1" />
          {showAdvancedMode ? 'Básico' : 'Avançado'}
        </Button>
        
        {!isMobile && (
          <Tabs value={activeView} onValueChange={(value) => setActiveView(value as any)}>
            <TabsList>
              <TabsTrigger value="builder">
                <Brain className="h-4 w-4 mr-2" />
                Construtor
              </TabsTrigger>
              <TabsTrigger value="manager">
                <Package className="h-4 w-4 mr-2" />
                Gerenciador
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>
    </div>
  );

  // Quick stats component
  const QuickStats = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-2xl font-bold">{analyticsMetrics.totalCompositions}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <div className="text-2xl font-bold">{analyticsMetrics.validCompositions}</div>
              <div className="text-xs text-muted-foreground">Válidas</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <div>
              <div className="text-2xl font-bold">
                {(analyticsMetrics.averageEfficiency * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">Eficiência</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-green-600" />
            <div>
              <div className="text-2xl font-bold">
                R$ {analyticsMetrics.totalSavings.toLocaleString('pt-BR', { 
                  minimumFractionDigits: 2 
                })}
              </div>
              <div className="text-xs text-muted-foreground">Economias</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Analytics view
  const AnalyticsView = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Resumo de Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {analyticsMetrics.totalCompositions}
              </div>
              <div className="text-sm text-muted-foreground">Composições Criadas</div>
              <div className="text-xs text-green-600 mt-1">
                +{Math.round(analyticsMetrics.totalCompositions * 0.15)} este mês
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {((analyticsMetrics.validCompositions / analyticsMetrics.totalCompositions) * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Taxa de Sucesso</div>
              <div className="text-xs text-green-600 mt-1">
                +2.3% vs mês anterior
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {(analyticsMetrics.averageEfficiency * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Eficiência Média</div>
              <div className="text-xs text-green-600 mt-1">
                +5.2% vs mês anterior
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Composições</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsMetrics.topPerformingCompositions.map((composition) => (
                <div key={composition.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium text-sm">{composition.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {composition.products.length} produtos • ID: {composition.id}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs">
                      {(composition.result.efficiency * 100).toFixed(1)}%
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(composition.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Utilização de Recursos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Peso</span>
                  <span>{(analyticsMetrics.utilizationMetrics.weight * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${analyticsMetrics.utilizationMetrics.weight * 100}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Volume</span>
                  <span>{(analyticsMetrics.utilizationMetrics.volume * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${analyticsMetrics.utilizationMetrics.volume * 100}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Altura</span>
                  <span>{(analyticsMetrics.utilizationMetrics.height * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full" 
                    style={{ width: `${analyticsMetrics.utilizationMetrics.height * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Insights e Recomendações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Alert>
              <TrendingUp className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <strong>Melhoria na eficiência:</strong> A eficiência média aumentou 5.2% no último mês, 
                principalmente devido ao uso de embalagens otimizadas.
              </AlertDescription>
            </Alert>
            
            <Alert>
              <Target className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                <strong>Oportunidade de economia:</strong> Implementar validação automática pode 
                reduzir em 15% o tempo de criação de composições.
              </AlertDescription>
            </Alert>
            
            <Alert>
              <Activity className="h-4 w-4 text-purple-600" />
              <AlertDescription>
                <strong>Padrão identificado:</strong> Composições criadas às terças-feiras 
                têm 12% mais eficiência que a média semanal.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Main render
  return (
    <div className={`space-y-6 ${className}`}>
      <Navigation />
      <QuickStats />

      {isMobile ? (
        <MobileResponsiveComposition
          onCompositionCreate={handleCompositionCreate}
          onCompositionUpdate={(request, validation) => {
            setValidationData(validation || null);
          }}
          onOptimizationApply={handleOptimizationApply}
          initialComposition={currentComposition || undefined}
        />
      ) : (
        <Tabs value={activeView} onValueChange={(value) => setActiveView(value as any)}>
          <TabsContent value="builder" className="space-y-6">
            {showAdvancedMode ? (
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-7">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-blue-600" />
                        Construtor Inteligente
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <IntelligentCompositionBuilder
                        onCompositionUpdate={(request, validation) => {
                          setValidationData(validation || null);
                        }}
                        onOptimizationApply={handleOptimizationApply}
                      />
                    </CardContent>
                  </Card>
                </div>
                
                <div className="col-span-5">
                  <RealtimeValidationFeedback
                    compositionRequest={null}
                    onValidationChange={setValidationData}
                    onQuickFix={(fixAction) => {
                      toast({
                        title: "Correção aplicada",
                        description: fixAction.title,
                      });
                    }}
                    showAdvanced={true}
                    autoRefresh={true}
                  />
                </div>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-blue-600" />
                    Construtor de Composições
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <IntelligentCompositionBuilder
                    onCompositionUpdate={(request, validation) => {
                      setValidationData(validation || null);
                    }}
                    onOptimizationApply={handleOptimizationApply}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="manager" className="space-y-6">
            <CompositionManager />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsView />
          </TabsContent>
        </Tabs>
      )}

      {/* Create composition button */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2">
        {validationData && (
          <Button
            onClick={() => {
              if (validationData.isValid) {
                // Create composition logic here
                const request: CompositionRequest = {
                  products: [],
                  palletId: 1,
                  constraints: {}
                };
                
                handleCompositionCreate(request, {
                  name: `Composição ${new Date().toLocaleString()}`,
                  description: 'Composição criada via botão rápido'
                });
              }
            }}
            disabled={!validationData?.isValid}
            className="rounded-full shadow-lg"
            size="lg"
          >
            <Package className="h-5 w-5 mr-2" />
            Criar Composição
          </Button>
        )}
      </div>
    </div>
  );
}