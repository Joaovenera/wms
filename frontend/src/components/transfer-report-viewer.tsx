import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VehicleSelectorFilter } from "./vehicle-selector-filter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, 
  Download, 
  BarChart3, 
  AlertTriangle, 
  TrendingUp,
  Truck,
  Target,
  CheckCircle,
  Clock,
  RefreshCw,
  Filter
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TransferReport {
  id: number;
  reportType: string;
  generatedAt: string;
  transferRequestId: number;
  transferRequestCode: string;
  generatedByName: string;
}



const DIVERGENCE_REASON_LABELS = {
  'falta_espaco': 'Falta de espaço no caminhão',
  'item_avariado': 'Item avariado',
  'divergencia_estoque': 'Divergência de estoque',
  'item_nao_localizado': 'Item não localizado'
};

export function TransferReportViewer() {
  const [activeTab, setActiveTab] = useState("summary");
  const [analysisFilters, setAnalysisFilters] = useState({
    startDate: "",
    endDate: "",
    vehicleId: ""
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const queryClient = useQueryClient();

  // Fetch transfer reports
  const { data: reports, isLoading: reportsLoading, error: reportsError } = useQuery({
    queryKey: ['/api/transfer-reports', refreshKey],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/transfer-reports');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    },
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch divergence analysis
  const { data: divergenceAnalysis, isLoading: divergenceLoading, error: divergenceError } = useQuery({
    queryKey: ['/api/transfer-reports/divergence-analysis', analysisFilters, refreshKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (analysisFilters.startDate) params.append('startDate', analysisFilters.startDate);
      if (analysisFilters.endDate) params.append('endDate', analysisFilters.endDate);
      if (analysisFilters.vehicleId) params.append('vehicleId', analysisFilters.vehicleId);
      
      const res = await apiRequest('GET', `/api/transfer-reports/divergence-analysis?${params}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    },
    retry: 3,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch efficiency metrics
  const { data: efficiencyMetrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ['/api/transfer-reports/efficiency-metrics', analysisFilters, refreshKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (analysisFilters.startDate) params.append('startDate', analysisFilters.startDate);
      if (analysisFilters.endDate) params.append('endDate', analysisFilters.endDate);
      
      const res = await apiRequest('GET', `/api/transfer-reports/efficiency-metrics?${params}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    },
    retry: 3,
    staleTime: 5 * 60 * 1000,
  });


  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    queryClient.invalidateQueries({ queryKey: ['/api/transfer-reports'] });
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Data inválida';
    }
  };

  const formatTime = (milliseconds: number) => {
    if (isNaN(milliseconds)) return 'N/A';
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}min`;
  };

  const getReportTypeBadge = (type: string) => {
    const typeMap = {
      'summary': { label: 'Resumo', variant: 'default' as const },
      'detailed': { label: 'Detalhado', variant: 'secondary' as const },
      'divergence_analysis': { label: 'Análise de Divergências', variant: 'outline' as const },
    };
    
    const typeInfo = typeMap[type as keyof typeof typeMap] || 
      { label: type, variant: 'outline' as const };
    
    return <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>;
  };

  const downloadReport = async (reportId: number, reportCode: string) => {
    try {
      const res = await apiRequest('GET', `/api/transfer-reports/${reportId}`);
      const reportData = await res.json();
      
      // Create downloadable content
      const dataStr = JSON.stringify(reportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      // Create download link
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_${reportCode}_${new Date().toISOString().split('T')[0]}.json`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading report:', error);
    }
  };

  const ErrorMessage = ({ error, title }: { error: any; title: string }) => (
    <Alert className="border-red-200 bg-red-50">
      <AlertTriangle className="h-4 w-4 text-red-600" />
      <AlertDescription className="text-red-800">
        <strong>{title}:</strong> {error?.message || 'Erro desconhecido'}
      </AlertDescription>
    </Alert>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                Relatórios e Análise de Transferências
              </CardTitle>
              <CardDescription>
                Análise detalhada de desempenho, divergências e métricas de eficiência
              </CardDescription>
            </div>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="divergences" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Divergências
          </TabsTrigger>
          <TabsTrigger value="efficiency" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Eficiência
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Filtros de Data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros de Análise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={analysisFilters.startDate}
                  onChange={(e) => setAnalysisFilters({
                    ...analysisFilters,
                    startDate: e.target.value
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={analysisFilters.endDate}
                  onChange={(e) => setAnalysisFilters({
                    ...analysisFilters,
                    endDate: e.target.value
                  })}
                />
              </div>
              <VehicleSelectorFilter
                value={analysisFilters.vehicleId}
                onValueChange={(value) => setAnalysisFilters({
                  ...analysisFilters,
                  vehicleId: value
                })}
                label="Veículo (opcional)"
              />
            </div>
          </CardContent>
        </Card>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Relatórios Gerados
              </CardTitle>
              <CardDescription>
                Histórico de relatórios detalhados gerados para transferências
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reportsError && (
                <ErrorMessage error={reportsError} title="Erro ao carregar relatórios" />
              )}
              {reportsLoading ? (
                <div className="text-center py-8">
                  <div className="text-sm text-gray-500 flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Carregando relatórios...
                  </div>
                </div>
              ) : !reports || reports.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {reportsError ? 'Erro ao carregar relatórios' : 'Nenhum relatório gerado ainda'}
                  </p>
                  {!reportsError && (
                    <p className="text-sm text-gray-400 mt-2">
                      Os relatórios aparecerão aqui conforme forem gerados
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.map((report: TransferReport) => (
                    <div key={report.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{report.transferRequestCode}</h3>
                          <p className="text-sm text-gray-600">
                            Gerado por: {report.generatedByName || 'N/A'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {getReportTypeBadge(report.reportType)}
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => downloadReport(report.id, report.transferRequestCode)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">
                        Gerado em: {formatDate(report.generatedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="divergences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Análise de Divergências
              </CardTitle>
              <CardDescription>
                Análise detalhada de itens não carregados e seus motivos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {divergenceError && (
                <ErrorMessage error={divergenceError} title="Erro ao carregar análise de divergências" />
              )}
              {divergenceLoading ? (
                <div className="text-center py-8">
                  <div className="text-sm text-gray-500 flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Carregando análise...
                  </div>
                </div>
              ) : !divergenceAnalysis ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {divergenceError ? 'Erro ao carregar dados' : 'Nenhuma divergência encontrada no período selecionado'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Estatísticas Gerais */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-red-600">
                            {divergenceAnalysis.statistics?.totalDivergences || 0}
                          </div>
                          <div className="text-sm text-gray-600">
                            Total de Divergências
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {Object.keys(divergenceAnalysis.statistics?.byReason || {}).length}
                          </div>
                          <div className="text-sm text-gray-600">
                            Tipos de Motivos
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {Object.keys(divergenceAnalysis.statistics?.byVehicle || {}).length}
                          </div>
                          <div className="text-sm text-gray-600">
                            Veículos Afetados
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Divergências por Motivo */}
                  {divergenceAnalysis.statistics?.byReason && Object.keys(divergenceAnalysis.statistics.byReason).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Divergências por Motivo</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Object.entries(divergenceAnalysis.statistics.byReason).map(([reason, count]) => (
                            <div key={reason} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                              <span className="font-medium">
                                {DIVERGENCE_REASON_LABELS[reason as keyof typeof DIVERGENCE_REASON_LABELS] || reason}
                              </span>
                              <Badge variant="destructive">{String(count)}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Lista de Divergências */}
                  {divergenceAnalysis.divergences && divergenceAnalysis.divergences.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Divergências Recentes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {divergenceAnalysis.divergences.slice(0, 10).map((divergence: any, index: number) => (
                            <div key={index} className="border rounded-lg p-4 bg-red-50">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <h4 className="font-medium">{divergence.productName}</h4>
                                  <p className="text-sm text-gray-600">
                                    {divergence.transferRequestCode} • {divergence.vehicleName}
                                  </p>
                                </div>
                                <Badge variant="destructive">
                                  {DIVERGENCE_REASON_LABELS[divergence.divergenceReason as keyof typeof DIVERGENCE_REASON_LABELS] || divergence.divergenceReason}
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                                <div>
                                  <span className="text-gray-600">Solicitado:</span>
                                  <p className="font-semibold">{divergence.requestedQuantity}</p>
                                </div>
                                <div>
                                  <span className="text-gray-600">Carregado:</span>
                                  <p className="font-semibold text-green-600">{divergence.loadedQuantity || '0'}</p>
                                </div>
                                <div>
                                  <span className="text-gray-600">Não Carregado:</span>
                                  <p className="font-semibold text-red-600">{divergence.notLoadedQuantity || '0'}</p>
                                </div>
                              </div>
                              
                              {divergence.divergenceComments && (
                                <p className="text-sm text-gray-700 bg-white p-2 rounded border-l-4 border-red-300">
                                  <strong>Comentários:</strong> {divergence.divergenceComments}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="efficiency" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Métricas de Eficiência
              </CardTitle>
              <CardDescription>
                Análise de desempenho e otimização das transferências
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metricsError && (
                <ErrorMessage error={metricsError} title="Erro ao carregar métricas" />
              )}
              {metricsLoading ? (
                <div className="text-center py-8">
                  <div className="text-sm text-gray-500 flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Carregando métricas...
                  </div>
                </div>
              ) : !efficiencyMetrics ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {metricsError ? 'Erro ao carregar dados' : 'Nenhuma métrica disponível para o período selecionado'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* KPIs Principais */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600">
                            {efficiencyMetrics.metrics?.totalTransfers || 0}
                          </div>
                          <div className="text-sm text-gray-600">
                            Total de Transferências
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {(efficiencyMetrics.metrics?.averageCapacityUsage || 0).toFixed(1)}%
                          </div>
                          <div className="text-sm text-gray-600">
                            Utilização Média
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {formatTime(efficiencyMetrics.metrics?.averageLoadingTime || 0)}
                          </div>
                          <div className="text-sm text-gray-600">
                            Tempo Médio de Carga
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {efficiencyMetrics.metrics?.capacityUtilizationRanges?.high || 0}
                          </div>
                          <div className="text-sm text-gray-600">
                            Alta Utilização (≥90%)
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Distribuição de Utilização */}
                  {efficiencyMetrics.metrics?.capacityUtilizationRanges && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Distribuição de Utilização de Capacidade</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-red-50 rounded">
                            <span className="font-medium">Baixa Utilização (&lt;70%)</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive">
                                {efficiencyMetrics.metrics.capacityUtilizationRanges.low}
                              </Badge>
                              <span className="text-sm text-gray-600">
                                ({((efficiencyMetrics.metrics.capacityUtilizationRanges.low / (efficiencyMetrics.metrics.totalTransfers || 1)) * 100).toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between p-3 bg-yellow-50 rounded">
                            <span className="font-medium">Média Utilização (70-89%)</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {efficiencyMetrics.metrics.capacityUtilizationRanges.medium}
                              </Badge>
                              <span className="text-sm text-gray-600">
                                ({((efficiencyMetrics.metrics.capacityUtilizationRanges.medium / (efficiencyMetrics.metrics.totalTransfers || 1)) * 100).toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                            <span className="font-medium">Alta Utilização (≥90%)</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="default">
                                {efficiencyMetrics.metrics.capacityUtilizationRanges.high}
                              </Badge>
                              <span className="text-sm text-gray-600">
                                ({((efficiencyMetrics.metrics.capacityUtilizationRanges.high / (efficiencyMetrics.metrics.totalTransfers || 1)) * 100).toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Transferências por Veículo */}
                  {efficiencyMetrics.metrics?.transfersByVehicle && Object.keys(efficiencyMetrics.metrics.transfersByVehicle).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Transferências por Veículo</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Object.entries(efficiencyMetrics.metrics.transfersByVehicle).map(([vehicle, count]) => (
                            <div key={vehicle} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                              <span className="font-medium flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                {vehicle}
                              </span>
                              <Badge variant="outline">{String(count)}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics Avançados
              </CardTitle>
              <CardDescription>
                Insights e recomendações baseados nos dados coletados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Recomendações */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Recomendações
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-blue-800">Otimização de Capacidade</span>
                        </div>
                        <p className="text-sm text-blue-700">
                          Identifique padrões de baixa utilização e otimize o planejamento de cargas 
                          para maximizar o aproveitamento da capacidade dos veículos.
                        </p>
                      </div>
                      
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <span className="font-medium text-yellow-800">Redução de Divergências</span>
                        </div>
                        <p className="text-sm text-yellow-700">
                          Analise os motivos mais frequentes de divergência e implemente 
                          melhorias nos processos de planejamento e controle de estoque.
                        </p>
                      </div>
                      
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">Melhores Práticas</span>
                        </div>
                        <p className="text-sm text-green-700">
                          Identifique veículos e rotas com melhor desempenho para replicar 
                          as melhores práticas em toda a operação.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Status do Sistema */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Status do Sistema
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                        <span className="font-medium flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Sistema de Relatórios
                        </span>
                        <Badge variant="default">Operacional</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                        <span className="font-medium flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-blue-600" />
                          Análise de Dados
                        </span>
                        <Badge variant="secondary">Ativo</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span className="font-medium flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-600" />
                          Última Atualização
                        </span>
                        <span className="text-sm text-gray-600">
                          {new Date().toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}