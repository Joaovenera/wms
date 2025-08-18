import { useState, useMemo, useCallback, memo, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QrScanner from "./qr-scanner";
import { 
  Package, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  User,
  Truck,
  CheckSquare,
  XCircle,
  Camera,
  Edit,
  Info,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import ErrorBoundary from "./ErrorBoundary";
import { LoadingExecutionSkeleton } from "./LoadingExecutionSkeleton";
import RetryComponent, { useRetry, retryPresets } from "./RetryMechanism";
import { LoadingItem } from "@/types/api";
import { VirtualScrollList } from "./VirtualScrollList";
import LoadingItemsList from "./loading-items-list";


// LoadingItem interface moved to types/api.ts for consistency

interface LoadingExecutionScreenProps {
  executionId?: number;
  onExecutionComplete?: () => void;
}

const DIVERGENCE_REASONS = [
  { value: 'falta_espaco', label: 'Falta de espaço no caminhão' },
  { value: 'item_avariado', label: 'Item avariado' },
  { value: 'divergencia_estoque', label: 'Divergência de estoque' },
  { value: 'item_nao_localizado', label: 'Item não localizado' },
];

const LoadingExecutionScreenContent = memo(({ executionId, onExecutionComplete }: LoadingExecutionScreenProps) => {
  const [showScanner, setShowScanner] = useState(false);
  const [showDivergenceDialog, setShowDivergenceDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LoadingItem | null>(null);
  const [scanQuantity, setScanQuantity] = useState("");
  const [divergenceReason, setDivergenceReason] = useState("");
  const [divergenceComments, setDivergenceComments] = useState("");
  const [finishObservations, setFinishObservations] = useState("");
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'slow'>('online');
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const performanceRef = useRef<{ renderCount: number; lastRenderTime: number }>({ 
    renderCount: 0, 
    lastRenderTime: Date.now() 
  });
  const queryClient = useQueryClient();
  
  // Performance monitoring - temporarily disabled to fix hook issues
  const performanceMetrics = {
    overallScore: 100,
    renderCount: 0,
    apiCallCount: 0,
    apiErrorCount: 0,
    memoryUsage: 0,
    scanCount: 0
  };


  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');
    
    // Check initial network status
    const updateNetworkStatus = () => {
      if (navigator.onLine) {
        setNetworkStatus('online');
      } else {
        setNetworkStatus('offline');
      }
    };
    
    updateNetworkStatus();
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Performance tracking - simplified
  useEffect(() => {
    performanceRef.current.renderCount++;
    performanceRef.current.lastRenderTime = Date.now();
  }, []);

  // Enhanced loading execution query with performance tracking and adaptive polling
  const { data: execution, isLoading, error } = useQuery({
    queryKey: ['/api/loading-executions', executionId],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', `/api/loading-executions/${executionId}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        setApiError(null);
        return await res.json();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar execução';
        setApiError(errorMessage);
        throw error;
      }
    },
    enabled: !!executionId,
    refetchInterval: 10000, // Simple 10s interval
    staleTime: 3000, // Consider data fresh for 3 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Enhanced scan and confirm item with optimistic updates and performance tracking
  const scanItemMutation = useMutation({
    mutationFn: async (data: { productId: number; quantity: string; scannedCode?: string; isEdit?: boolean }) => {
      try {
        const res = await apiRequest('POST', `/api/loading-executions/${executionId}/scan-item`, data);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const result = await res.json();
        return result;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: (data) => {
      // Enhanced optimistic UI update with robust matching and fallback
      let cacheUpdateSuccessful = false;
      
      queryClient.setQueryData(['/api/loading-executions', executionId], (oldData: any) => {
        if (!oldData) return data;
        
        const updatedItems = oldData.items.map((item: LoadingItem) => {
          // Robust matching using multiple identifiers to prevent duplicates
          if (item.id === data.id && item.productId === data.productId && item.transferRequestItemId === data.transferRequestItemId) {
            cacheUpdateSuccessful = true;
            // Preserve critical identifying fields and update quantities
            return {
              ...item,
              ...data,
              // Ensure these key fields remain consistent
              id: item.id,
              transferRequestItemId: item.transferRequestItemId,
              productId: item.productId
            };
          }
          return item;
        });
        
        return {
          ...oldData,
          items: updatedItems
        };
      });
      
      // Fallback: if optimistic update failed to find matching item, invalidate cache
      if (!cacheUpdateSuccessful) {
        console.warn('Cache update failed - invalidating cache for consistency');
        queryClient.invalidateQueries({ queryKey: ['/api/loading-executions', executionId] });
      }
      
      setScanQuantity("");
      setShowScanner(false);
      setSelectedItem(null);
      setApiError(null);
      setLastSyncTime(Date.now());
      
      // Track successful scan
      // trackScan(); // Removed as per edit hint
      // trackCompletion( // Removed as per edit hint
      //   getCompletionStats.completed + 1,
      //   getCompletionStats.total
      // );
      
      // Show success feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([20, 10, 20]);
      }
    },
    onError: (error) => {
      setApiError(error instanceof Error ? error.message : 'Erro ao escanear item');
    }
  });

  // Enhanced register divergence with performance tracking
  const registerDivergenceMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: number; data: any }) => {
      try {
        const res = await apiRequest('PUT', `/api/loading-executions/${executionId}/items/${itemId}/divergence`, data);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const result = await res.json();
        return result;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: (data) => {
      // Enhanced cache update with robust matching
      let divergenceCacheUpdateSuccessful = false;
      
      queryClient.setQueryData(['/api/loading-executions', executionId], (oldData: any) => {
        if (!oldData) return oldData;
        
        const updatedItems = oldData.items.map((item: LoadingItem) => {
          if (item.id === data.id && item.productId === data.productId && item.transferRequestItemId === data.transferRequestItemId) {
            divergenceCacheUpdateSuccessful = true;
            return {
              ...item,
              ...data,
              // Preserve key identifying fields
              id: item.id,
              transferRequestItemId: item.transferRequestItemId,
              productId: item.productId
            };
          }
          return item;
        });
        
        return {
          ...oldData,
          items: updatedItems
        };
      });
      
      // Fallback for divergence cache update
      if (!divergenceCacheUpdateSuccessful) {
        console.warn('Divergence cache update failed - invalidating cache');
        queryClient.invalidateQueries({ queryKey: ['/api/loading-executions', executionId] });
      }
      
      setShowDivergenceDialog(false);
      setSelectedItem(null);
      setDivergenceReason("");
      setDivergenceComments("");
      setApiError(null);
      setLastSyncTime(Date.now());
      
      // Track divergence
      // trackDivergence(data.divergenceReason); // Removed as per edit hint
    },
    onError: (error) => {
      setApiError(error instanceof Error ? error.message : 'Erro ao registrar divergência');
    }
  });

  // Enhanced finish execution
  const finishExecutionMutation = useMutation({
    mutationFn: async (observations: string) => {
      const res = await apiRequest('PUT', `/api/loading-executions/${executionId}/finish`, { observations });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      setShowFinishDialog(false);
      setFinishObservations("");
      setApiError(null);
      onExecutionComplete?.();
    },
    onError: (error) => {
      setApiError(error instanceof Error ? error.message : 'Erro ao finalizar execução');
    }
  });

  const handleScan = useCallback((scannedCode: string) => {
    // Performance tracking for scan operation
    const scanStartTime = performance.now();
    
    // Tentar identificar o produto pelo código escaneado
    const item = execution?.items.find((item: LoadingItem) => 
      item.productSku === scannedCode || 
      item.productName.toLowerCase().includes(scannedCode.toLowerCase())
    );

    if (item) {
      setSelectedItem(item);
      setShowScanner(false);
      
      // Track successful scan
      const scanTime = performance.now() - scanStartTime;
      console.log(`Scan completed in ${scanTime.toFixed(1)}ms`);
    } else {
      setApiError(`Produto não encontrado na lista: ${scannedCode}`);
      
      // Track failed scan
      console.log('Scan failed: Product not found');
    }
  }, [execution?.items]);

  const handleConfirmScan = useCallback(() => {
    if (!selectedItem || !scanQuantity) return;

    const isEdit = !!selectedItem.confirmedAt;
    
    scanItemMutation.mutate({
      productId: selectedItem.productId,
      quantity: scanQuantity,
      scannedCode: selectedItem.productSku,
      isEdit
    });
  }, [selectedItem, scanQuantity, scanItemMutation]);

  const handleOpenDivergence = useCallback((item: LoadingItem) => {
    setSelectedItem(item);
    setShowDivergenceDialog(true);
  }, []);

  const handleRegisterDivergence = useCallback(() => {
    if (!selectedItem || !divergenceReason) return;

    registerDivergenceMutation.mutate({
      itemId: selectedItem.id,
      data: {
        divergenceReason,
        divergenceComments
      }
    });
  }, [selectedItem, divergenceReason, divergenceComments, registerDivergenceMutation]);

  const handleFinishExecution = useCallback(() => {
    finishExecutionMutation.mutate(finishObservations);
  }, [finishObservations, finishExecutionMutation]);

  const handleOpenFinishDialog = useCallback(() => {
    setShowFinishDialog(true);
  }, []);

  const handleCloseFinishDialog = useCallback(() => {
    setShowFinishDialog(false);
    setFinishObservations("");
  }, []);

  const getItemStatus = (item: LoadingItem) => {
    if (item.confirmedAt) {
      const loaded = parseFloat(item.loadedQuantity);
      const requested = parseFloat(item.requestedQuantity);
      
      if (loaded === requested) {
        return { label: 'Completo', variant: 'default' as const, icon: CheckCircle };
      } else if (loaded > 0) {
        return { label: 'Parcial', variant: 'secondary' as const, icon: AlertTriangle };
      } else {
        return { label: 'Não Carregado', variant: 'destructive' as const, icon: XCircle };
      }
    }
    return { label: 'Pendente', variant: 'outline' as const, icon: Clock };
  };

  // Enhanced completion stats with performance metrics
  const getCompletionStats = useMemo(() => {
    if (!execution?.items) return { 
      completed: 0, 
      total: 0, 
      percentage: 0, 
      partiallyCompleted: 0,
      divergenceCount: 0,
      averageItemTime: 0
    };
    
    const total = execution.items.length;
    const completed = execution.items.filter((item: LoadingItem) => item.confirmedAt).length;
    const partiallyCompleted = execution.items.filter((item: LoadingItem) => 
      item.confirmedAt && parseFloat(item.loadedQuantity) > 0 && 
      parseFloat(item.loadedQuantity) < parseFloat(item.requestedQuantity)
    ).length;
    const divergenceCount = execution.items.filter((item: LoadingItem) => item.divergenceReason).length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    
    // Calculate average time per item (approximate)
    const completedItems = execution.items.filter((item: LoadingItem) => item.confirmedAt);
    const averageItemTime = completedItems.length > 0 
      ? (Date.now() - new Date(execution.startedAt).getTime()) / completedItems.length
      : 0;
    
    return { 
      completed, 
      total, 
      percentage, 
      partiallyCompleted,
      divergenceCount,
      averageItemTime
    };
  }, [execution?.items, execution?.startedAt]);

  // Error handling - moved after all hooks
  if (error || !execution) {
    return (
      <div className="p-6">
        <Alert className="border-red-200 bg-red-50 text-red-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : 'Erro ao carregar execução de carregamento'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const canFinish = getCompletionStats.completed === getCompletionStats.total && getCompletionStats.total > 0;

  if (isLoading) {
    return <LoadingExecutionSkeleton type="detail" count={5} />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Enhanced Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-6 w-6" />
                Execução de Carregamento
                {process.env.NODE_ENV === 'development' && (
                  <Badge variant="outline" className="text-xs">
                    Perf: {performanceMetrics.overallScore.toFixed(0)}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Transferência: {execution.transferRequestCode}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {networkStatus !== 'online' && (
                <Badge variant={networkStatus === 'offline' ? 'destructive' : 'secondary'}>
                  {networkStatus === 'offline' ? '🔴 Offline' : '🟡 Rede lenta'}
                </Badge>
              )}
              <Badge variant={execution.status === 'em_andamento' ? 'default' : 'secondary'}>
                {execution.status === 'em_andamento' ? 'Em Andamento' : 'Finalizado'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Operador:</span>
              <p className="font-medium flex items-center gap-1">
                <User className="h-4 w-4" />
                {execution.operatorName}
              </p>
            </div>
            <div>
              <span className="text-gray-600">Iniciado em:</span>
              <p className="font-medium">
                {new Date(execution.startedAt).toLocaleString('pt-BR')}
              </p>
            </div>
            <div>
              <span className="text-gray-600">Progresso:</span>
              <p className="font-medium">
                {getCompletionStats.completed}/{getCompletionStats.total} itens ({getCompletionStats.percentage.toFixed(0)}%)
              </p>
              {getCompletionStats.averageItemTime > 0 && (
                <p className="text-xs text-gray-500">
                  ~{getCompletionStats.averageItemTime}s/item
                </p>
              )}
            </div>
            <div>
              <span className="text-gray-600">Status:</span>
              <p className="font-medium capitalize">{execution.status.replace('_', ' ')}</p>
              {getCompletionStats.divergenceCount > 0 && (
                <p className="text-xs text-yellow-600">
                  ⚠️ {getCompletionStats.divergenceCount} divergências
                </p>
              )}
            </div>
          </div>
          
          {/* Performance Info in Dev Mode */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 pt-4 border-t text-xs text-gray-500">
              <div className="grid grid-cols-4 gap-4">
                <div>Renders: {performanceMetrics.renderCount}</div>
                <div>API: {performanceMetrics.apiCallCount} ({performanceMetrics.apiErrorCount} errors)</div>
                <div>Scans: {performanceMetrics.scanCount}</div>
                <div>Memory: {(performanceMetrics.memoryUsage / 1024 / 1024).toFixed(1)}MB</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Progresso do Carregamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Itens processados</span>
              <span className="font-semibold">{getCompletionStats.percentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getCompletionStats.percentage}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {execution.status === 'em_andamento' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Button
                onClick={() => setShowScanner(true)}
                className="flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Scanner Item
              </Button>
              
              <Button
                variant="outline"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/loading-executions', executionId] })}
                className="flex items-center gap-2"
              >
                <Package className="h-4 w-4" />
                Atualizar Lista
              </Button>
              
              <Button
                variant="destructive"
                onClick={handleOpenFinishDialog}
                disabled={!canFinish || finishExecutionMutation.isPending}
                className="flex items-center gap-2 ml-auto"
              >
                <CheckSquare className="h-4 w-4" />
                Finalizar Carregamento
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Items List */}
      <LoadingItemsList
        items={execution.items || []}
        execution={execution}
        onItemClick={(item) => {
          setSelectedItem(item);
          setScanQuantity(item.confirmedAt ? item.loadedQuantity : item.requestedQuantity);
        }}
        onDivergenceClick={handleOpenDivergence}
        isLoading={isLoading}
        enableVirtualization={execution.items && execution.items.length > 20}
      />

      {/* Scanner Dialog */}
      {showScanner && (
        <QrScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Confirm Scan Dialog */}
      <Dialog open={!!selectedItem && !showDivergenceDialog && !showScanner && !showFinishDialog} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedItem?.confirmedAt ? (
                <>
                  <Edit className="h-5 w-5" />
                  Editar Quantidade Carregada
                </>
              ) : (
                <>
                  <Package className="h-5 w-5" />
                  Informar Quantidade Carregada
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-semibold text-lg">{selectedItem.productName}</h4>
                <p className="text-sm text-gray-600">SKU: {selectedItem.productSku}</p>
                <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                  <p className="text-sm font-medium text-blue-800">
                    Quantidade solicitada: <span className="font-bold">{selectedItem.requestedQuantity}</span>
                  </p>
                  {selectedItem.confirmedAt && (
                    <p className="text-sm text-blue-700 mt-1">
                      Quantidade atual: <span className="font-bold">{selectedItem.loadedQuantity}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">
                  {selectedItem.confirmedAt ? 'Nova quantidade carregada' : 'Quantidade carregada'}
                </Label>
                <Input
                  type="number"
                  value={scanQuantity}
                  onChange={(e) => setScanQuantity(e.target.value)}
                  placeholder={selectedItem.confirmedAt ? "Digite a nova quantidade" : "Digite a quantidade carregada"}
                  min="0"
                  max={selectedItem.requestedQuantity}
                  step="0.001"
                  className="h-12 text-lg text-center font-semibold"
                  autoFocus
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Mínimo: 0</span>
                  <span>Máximo: {selectedItem.requestedQuantity}</span>
                </div>
                
                {selectedItem.confirmedAt && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium text-yellow-800 text-sm">Editando quantidade</span>
                    </div>
                    <p className="text-sm text-yellow-700">
                      Você está editando a quantidade carregada. A nova quantidade substituirá a quantidade atual.
                    </p>
                  </div>
                )}
                
                {!selectedItem.confirmedAt && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Info className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-800 text-sm">Dica</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      Se não conseguiu carregar a quantidade total, informe o que foi carregado e registre uma divergência depois.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmScan}
              disabled={!scanQuantity || scanItemMutation.isPending}
              className="min-w-[140px]"
            >
              {scanItemMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : selectedItem?.confirmedAt ? (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Atualizar Quantidade
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Carregamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Divergence Dialog */}
      <Dialog open={showDivergenceDialog} onOpenChange={setShowDivergenceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Divergência</DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded">
                <h4 className="font-medium">{selectedItem.productName}</h4>
                <p className="text-sm text-gray-600">SKU: {selectedItem.productSku}</p>
                <p className="text-sm">Quantidade solicitada: <strong>{selectedItem.requestedQuantity}</strong></p>
              </div>

              <div className="space-y-2">
                <Label>Motivo da divergência</Label>
                <Select value={divergenceReason} onValueChange={setDivergenceReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DIVERGENCE_REASONS.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Comentários adicionais (opcional)</Label>
                <Textarea
                  value={divergenceComments}
                  onChange={(e) => setDivergenceComments(e.target.value)}
                  placeholder="Adicione detalhes sobre a divergência..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDivergenceDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegisterDivergence}
              disabled={!divergenceReason || registerDivergenceMutation.isPending}
              variant="destructive"
            >
              Registrar Divergência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finish Execution Dialog */}
      <Dialog open={showFinishDialog} onOpenChange={handleCloseFinishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar Carregamento</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Todos os itens foram processados. O carregamento pode ser finalizado.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Observações finais (opcional)</Label>
              <Textarea
                value={finishObservations}
                onChange={(e) => setFinishObservations(e.target.value)}
                placeholder="Adicione observações sobre o carregamento..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseFinishDialog}
              disabled={finishExecutionMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleFinishExecution}
              disabled={finishExecutionMutation.isPending}
              className="flex items-center gap-2"
            >
              <CheckSquare className="h-4 w-4" />
              Finalizar Carregamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

LoadingExecutionScreenContent.displayName = 'LoadingExecutionScreenContent';

// Memoized item component for better performance
const LoadingItemCard = memo(({ 
  item, 
  execution, 
  onItemClick, 
  onDivergenceClick 
}: {
  item: LoadingItem;
  execution: any;
  onItemClick: (item: LoadingItem) => void;
  onDivergenceClick: (item: LoadingItem) => void;
}) => {
  const getItemStatus = useCallback((item: LoadingItem) => {
    if (item.confirmedAt) {
      const loaded = parseFloat(item.loadedQuantity);
      const requested = parseFloat(item.requestedQuantity);
      
      if (loaded === requested) {
        return { label: 'Completo', variant: 'default' as const, icon: CheckCircle };
      } else if (loaded > 0) {
        return { label: 'Parcial', variant: 'secondary' as const, icon: AlertTriangle };
      } else {
        return { label: 'Não Carregado', variant: 'destructive' as const, icon: XCircle };
      }
    }
    return { label: 'Pendente', variant: 'outline' as const, icon: Clock };
  }, []);

  const status = getItemStatus(item);
  const StatusIcon = status.icon;
  const loadedQuantity = parseFloat(item.loadedQuantity);
  const requestedQuantity = parseFloat(item.requestedQuantity);
  const notLoadedQuantity = parseFloat(item.notLoadedQuantity);

  const handleItemClick = useCallback(() => {
    if (execution.status === 'em_andamento') {
      onItemClick(item);
    }
  }, [item, execution.status, onItemClick]);

  const handleDivergenceClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDivergenceClick(item);
  }, [item, onDivergenceClick]);

  return (
    <div 
      className={`border rounded-lg p-4 transition-colors ${
        execution.status === 'em_andamento' 
          ? 'bg-blue-50 hover:bg-blue-100 cursor-pointer border-blue-200' 
          : 'bg-gray-50'
      }`}
      onClick={handleItemClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-medium text-lg">{item.productName}</h4>
          <p className="text-sm text-gray-600">SKU: {item.productSku}</p>
          {execution.status === 'em_andamento' && (
            <p className="text-xs text-blue-600 mt-1">
              {item.confirmedAt 
                ? '✏️ Clique para editar quantidade carregada' 
                : '👆 Clique para informar quantidade carregada'
              }
            </p>
          )}
        </div>
        <Badge variant={status.variant} className="flex items-center gap-1">
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm mb-3">
        <div>
          <span className="text-gray-600">Solicitado:</span>
          <p className="font-semibold text-lg">{requestedQuantity}</p>
        </div>
        <div>
          <span className="text-gray-600">Carregado:</span>
          <p className="font-semibold text-lg text-green-600">{loadedQuantity}</p>
        </div>
        <div>
          <span className="text-gray-600">Faltante:</span>
          <p className="font-semibold text-lg text-red-600">{notLoadedQuantity}</p>
        </div>
      </div>

      {item.divergenceReason && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="font-medium text-yellow-800">Divergência registrada</span>
          </div>
          <p className="text-sm text-yellow-700">
            <strong>Motivo:</strong> {DIVERGENCE_REASONS.find(r => r.value === item.divergenceReason)?.label}
          </p>
          {item.divergenceComments && (
            <p className="text-sm text-yellow-700 mt-1">
              <strong>Comentários:</strong> {item.divergenceComments}
            </p>
          )}
        </div>
      )}

      {execution.status === 'em_andamento' && (
        <div className="flex gap-2">
          {!item.confirmedAt && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDivergenceClick}
              className="flex items-center gap-1"
            >
              <XCircle className="h-3 w-3" />
              Registrar Divergência
            </Button>
          )}
        </div>
      )}

      {item.scannedAt && (
        <p className="text-xs text-gray-500 mt-2">
          Escaneado em: {new Date(item.scannedAt).toLocaleString('pt-BR')}
        </p>
      )}
    </div>
  );
});

LoadingItemCard.displayName = 'LoadingItemCard';

export function LoadingExecutionScreen({ executionId, onExecutionComplete }: LoadingExecutionScreenProps) {
  return (
    <ErrorBoundary context="Loading Execution Screen">
      <LoadingExecutionScreenContent 
        executionId={executionId} 
        onExecutionComplete={onExecutionComplete} 
      />
    </ErrorBoundary>
  );
}