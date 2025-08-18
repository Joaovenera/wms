import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingExecutionScreen } from "../components/loading-execution-screen";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Package, 
  Play, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Activity
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import ErrorBoundary from "../components/ErrorBoundary";
import { LoadingExecutionSkeleton } from "../components/LoadingExecutionSkeleton";
import { PerformanceMonitor } from "../components/PerformanceMonitor";
import RetryComponent, { useRetry, retryPresets } from "../components/RetryMechanism";
import { VirtualScrollList } from "../components/VirtualScrollList";
import { useVirtualization } from "../hooks/useVirtualization";

interface TransferRequest {
  id: number;
  code: string;
  status: string;
  fromLocation: string;
  toLocation: string;
  vehicleName: string;
  vehicleCode: string;
  createdAt: string;
  createdByName: string;
}

interface LoadingExecution {
  id: number;
  status: string;
  startedAt: string;
  finishedAt?: string;
  transferRequestId: number;
  transferRequestCode: string;
  operatorName: string;
}

const LoadingExecutionPageContent = () => {
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [selectedTransferRequest, setSelectedTransferRequest] = useState<TransferRequest | null>(null);
  const [startObservations, setStartObservations] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [optimisticUpdates, setOptimisticUpdates] = useState<Set<number>>(new Set());
  const [retryCount, setRetryCount] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState(null);

  const queryClient = useQueryClient();

  // Enhanced error recovery with exponential backoff
  const getBackoffDelay = useCallback((attempt: number) => {
    return Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30 seconds
  }, []);

  // Optimized fetch approved transfer requests with smart polling and error recovery
  const { data: approvedRequests, isLoading: approvedLoading, error: approvedError } = useQuery({
    queryKey: ['/api/transfer-requests', { status: 'aprovado' }],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/transfer-requests?status=aprovado');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        setApiError(null);
        return await res.json();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar pedidos aprovados';
        setApiError(errorMessage);
        setRetryCount(prev => prev + 1);
        // Store error metrics for performance monitoring
        setPerformanceMetrics(prev => ({
          ...prev,
          errors: (prev?.errors || 0) + 1,
          lastError: { message: errorMessage, timestamp: Date.now() }
        }));
        throw error;
      }
    },
    refetchInterval: (data, query) => {
      // Smart polling with adaptive frequency
      if (query?.state?.error) return getBackoffDelay(retryCount); // Exponential backoff on error
      if (!data || data.length === 0) return 10000; // 10s if no data
      const isActive = document.visibilityState === 'visible';
      return isActive ? 15000 : 60000; // Reduce frequency when tab is not visible
    },
    staleTime: 5000, // Consider data fresh for 5 seconds
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  // Optimized fetch pending loading executions
  const { data: pendingExecutions, isLoading: pendingLoading, error: pendingError } = useQuery({
    queryKey: ['/api/loading-executions/pending'],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/loading-executions/pending');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return await res.json();
      } catch (error) {
        setApiError(error instanceof Error ? error.message : 'Erro ao carregar execuções pendentes');
        throw error;
      }
    },
    refetchInterval: (data, query) => {
      if (query?.state?.error) return 30000;
      if (!data || data.length === 0) return 20000; // Less frequent if no pending executions
      return 10000; // More frequent if there are pending executions
    },
    staleTime: 3000,
    gcTime: 5 * 60 * 1000,
  });

  // Enhanced start loading execution with optimistic updates
  const startExecutionMutation = useMutation({
    mutationFn: async (data: { transferRequestId: number; observations?: string }) => {
      const res = await apiRequest('POST', '/api/loading-executions', data);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    },
    onMutate: async (variables) => {
      // Optimistic update: add to optimistic updates set
      setOptimisticUpdates(prev => new Set(prev).add(variables.transferRequestId));
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/loading-executions'] });
      await queryClient.cancelQueries({ queryKey: ['/api/transfer-requests'] });
      
      return { transferRequestId: variables.transferRequestId };
    },
    onSuccess: (data, variables, context) => {
      // Reset retry count on success
      setRetryCount(0);
      
      // Remove from optimistic updates
      setOptimisticUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.transferRequestId);
        return newSet;
      });
      
      // Update cache efficiently
      queryClient.setQueryData(['/api/loading-executions/pending'], (old: any) => {
        return old ? [...old, data] : [data];
      });
      
      // Remove from approved requests
      queryClient.setQueryData(['/api/transfer-requests', { status: 'aprovado' }], (old: any) => {
        return old ? old.filter((req: any) => req.id !== variables.transferRequestId) : [];
      });
      
      setSelectedExecutionId(data.id);
      setShowStartDialog(false);
      setSelectedTransferRequest(null);
      setStartObservations("");
      setApiError(null);
    },
    onError: (error, variables, context) => {
      // Remove from optimistic updates on error
      setOptimisticUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.transferRequestId);
        return newSet;
      });
      
      setApiError(error instanceof Error ? error.message : 'Erro ao iniciar execução');
    }
  });

  const handleStartExecution = useCallback((request: TransferRequest) => {
    setSelectedTransferRequest(request);
    setShowStartDialog(true);
  }, []);

  const handleConfirmStart = useCallback(() => {
    if (!selectedTransferRequest) return;
    
    startExecutionMutation.mutate({
      transferRequestId: selectedTransferRequest.id,
      observations: startObservations
    });
  }, [selectedTransferRequest, startObservations, startExecutionMutation]);

  const handleExecutionComplete = useCallback(() => {
    setSelectedExecutionId(null);
    // Efficient cache updates instead of full invalidation
    queryClient.refetchQueries({ queryKey: ['/api/loading-executions/pending'] });
    queryClient.refetchQueries({ queryKey: ['/api/transfer-requests', { status: 'aprovado' }] });
  }, [queryClient]);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Memoized filtered requests (exclude optimistically updated ones)
  const filteredApprovedRequests = useMemo(() => {
    if (!approvedRequests) return [];
    return approvedRequests.filter((req: TransferRequest) => !optimisticUpdates.has(req.id));
  }, [approvedRequests, optimisticUpdates]);

  // Error retry configuration
  const retryApprovedRequests = useRetry(
    () => queryClient.refetchQueries({ queryKey: ['/api/transfer-requests', { status: 'aprovado' }] }),
    retryPresets.network
  );

  const retryPendingExecutions = useRetry(
    () => queryClient.refetchQueries({ queryKey: ['/api/loading-executions/pending'] }),
    retryPresets.network
  );

  // Se há uma execução selecionada, mostrar a tela de execução
  if (selectedExecutionId) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => setSelectedExecutionId(null)}
            >
              ← Voltar à Lista
            </Button>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Activity className="h-4 w-4" />
              <span>Dashboard Avançado Ativo</span>
            </div>
          </div>
        </div>
        <LoadingExecutionScreen 
          executionId={selectedExecutionId}
          onExecutionComplete={handleExecutionComplete}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Execução de Carregamento</h1>
        <p className="text-muted-foreground">
          Gerencie execuções de carregamento com scanner de código de barras
        </p>
      </div>

      {/* Execuções em Andamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Execuções em Andamento
          </CardTitle>
          <CardDescription>
            Execuções de carregamento que estão sendo processadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <LoadingExecutionSkeleton type="list" count={2} />
          ) : pendingError ? (
            <RetryComponent
              operation={retryPendingExecutions.execute}
              options={retryPresets.network}
              trigger={
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <p className="text-red-500 mb-2">Erro ao carregar execuções</p>
                  <p className="text-sm text-gray-500 mb-4">{apiError}</p>
                </div>
              }
              showProgress={true}
            />
          ) : !pendingExecutions || pendingExecutions.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhuma execução em andamento</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingExecutions.map((execution: LoadingExecution) => (
                <div key={execution.id} className="border rounded-lg p-4 bg-blue-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {execution.transferRequestCode}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Operador: {execution.operatorName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="default" className="flex items-center gap-1">
                        <Play className="h-3 w-3" />
                        Em Andamento
                      </Badge>
                      <Button
                        onClick={() => setSelectedExecutionId(execution.id)}
                        className="flex items-center gap-2"
                      >
                        <Package className="h-4 w-4" />
                        Continuar
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <p>Iniciado em: {formatDate(execution.startedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pedidos Aprovados para Carregamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Pedidos Aprovados para Carregamento
          </CardTitle>
          <CardDescription>
            Pedidos de transferência aprovados aguardando início do carregamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {approvedLoading ? (
            <LoadingExecutionSkeleton type="list" count={3} />
          ) : approvedError ? (
            <RetryComponent
              operation={retryApprovedRequests.execute}
              options={retryPresets.network}
              trigger={
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <p className="text-red-500 mb-2">Erro ao carregar pedidos aprovados</p>
                  <p className="text-sm text-gray-500 mb-4">{apiError}</p>
                </div>
              }
              showProgress={true}
            />
          ) : !filteredApprovedRequests || filteredApprovedRequests.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum pedido aprovado para carregamento</p>
              <p className="text-sm text-gray-400 mt-2">
                Pedidos precisam ser aprovados antes do carregamento
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredApprovedRequests.map((request: TransferRequest) => (
                <div key={request.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{request.code}</h3>
                      <p className="text-sm text-gray-600">
                        {request.fromLocation} → {request.toLocation}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="default" className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Aprovado
                      </Badge>
                      <Button
                        onClick={() => handleStartExecution(request)}
                        disabled={startExecutionMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        <Play className="h-4 w-4" />
                        Iniciar Carregamento
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Veículo:</span>
                      <p className="font-medium">{request.vehicleName}</p>
                      <p className="text-xs text-gray-500">{request.vehicleCode}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Criado por:</span>
                      <p className="font-medium">{request.createdByName}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Data de criação:</span>
                      <p className="font-medium">{formatDate(request.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para iniciar execução */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar Execução de Carregamento</DialogTitle>
          </DialogHeader>
          
          {selectedTransferRequest && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">{selectedTransferRequest.code}</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Origem:</span>
                    <p className="font-medium">{selectedTransferRequest.fromLocation}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Destino:</span>
                    <p className="font-medium">{selectedTransferRequest.toLocation}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Veículo:</span>
                    <p className="font-medium">{selectedTransferRequest.vehicleName}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Código:</span>
                    <p className="font-medium">{selectedTransferRequest.vehicleCode}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações iniciais (opcional)</Label>
                <Textarea
                  value={startObservations}
                  onChange={(e) => setStartObservations(e.target.value)}
                  placeholder="Adicione observações sobre o início do carregamento..."
                  rows={3}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Importante</span>
                </div>
                <p className="text-sm text-blue-700">
                  Ao iniciar a execução, você poderá usar o scanner para confirmar 
                  os itens carregados e registrar divergências quando necessário.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmStart}
              disabled={!selectedTransferRequest || startExecutionMutation.isPending}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Iniciar Execução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function LoadingExecutionPage() {
  return (
    <ErrorBoundary context="Loading Execution Page">
      <LoadingExecutionPageContent />
      <PerformanceMonitor enabled={process.env.NODE_ENV === 'development'} />
    </ErrorBoundary>
  );
}