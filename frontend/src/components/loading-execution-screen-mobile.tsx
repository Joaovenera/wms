import { useState } from "react";
import { LoadingItem } from "@/types/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  MoreHorizontal,
  Target
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { TouchOptimizedButton, SwipeableCard, QuantityController, ActionButtons } from "./mobile/TouchOptimizedControls";
import { GestureHandler } from "./mobile/GestureHandler";
import { useOfflineManager } from "@/hooks/useOfflineManager";
import { useLoadingPerformance } from "@/hooks/useLoadingPerformance";
import { VirtualScrollList } from "./VirtualScrollList";

// LoadingItem interface now imported from types/api.ts

interface LoadingExecutionScreenMobileProps {
  executionId?: number;
  onExecutionComplete?: () => void;
}

const DIVERGENCE_REASONS = [
  { value: 'falta_espaco', label: 'Falta de espaço no caminhão' },
  { value: 'item_avariado', label: 'Item avariado' },
  { value: 'divergencia_estoque', label: 'Divergência de estoque' },
  { value: 'item_nao_localizado', label: 'Item não localizado' },
];

export function LoadingExecutionScreenMobile({ executionId, onExecutionComplete }: LoadingExecutionScreenMobileProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [showDivergenceDialog, setShowDivergenceDialog] = useState(false);
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LoadingItem | null>(null);
  const [scanQuantity, setScanQuantity] = useState(0);
  const [divergenceReason, setDivergenceReason] = useState("");
  const [divergenceComments, setDivergenceComments] = useState("");
  const [finishObservations, setFinishObservations] = useState("");
  const [showFinishDialog, setShowFinishDialog] = useState(false);

  const { isOnline, addPendingAction } = useOfflineManager();
  
  // Performance monitoring for mobile
  const {
    metrics: performanceMetrics,
    trackRender,
    trackApiCall,
    trackScan,
    markRenderStart
  } = useLoadingPerformance({
    enabled: true, // Always enabled on mobile for better UX monitoring
    onPerformanceAlert: (alert) => {
      if (alert.type === 'error' && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]); // Haptic feedback for performance issues
      }
    }
  });

  // Fetch loading execution details
  const { data: execution, isLoading, refetch } = useQuery({
    queryKey: ['/api/loading-executions', executionId],
    queryFn: async () => {
      if (!executionId) return null;
      const res = await apiRequest('GET', `/api/loading-executions/${executionId}`);
      return await res.json();
    },
    enabled: !!executionId,
    refetchInterval: isOnline ? 5000 : false, // Only auto-refresh when online
  });

  // Scan and confirm item
  const scanItemMutation = useMutation({
    mutationFn: async (data: { productId: number; quantity: string; scannedCode?: string }) => {
      if (!isOnline) {
        addPendingAction({
          type: 'UPDATE',
          endpoint: `/loading-executions/${executionId}/scan-item`,
          method: 'POST',
          data
        });
        return { offline: true, ...data };
      }
      
      const res = await apiRequest('POST', `/api/loading-executions/${executionId}/scan-item`, data);
      return await res.json();
    },
    onSuccess: () => {
      refetch();
      setScanQuantity(0);
      setShowScanner(false);
      setShowQuantityDialog(false);
      setSelectedItem(null);
      
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([20, 10, 20]);
      }
    },
  });

  // Register divergence
  const registerDivergenceMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: number; data: any }) => {
      if (!isOnline) {
        addPendingAction({
          type: 'UPDATE',
          endpoint: `/loading-executions/${executionId}/items/${itemId}/divergence`,
          method: 'PUT',
          data
        });
        return { offline: true, ...data };
      }
      
      const res = await apiRequest('PUT', `/api/loading-executions/${executionId}/items/${itemId}/divergence`, data);
      return await res.json();
    },
    onSuccess: () => {
      refetch();
      setShowDivergenceDialog(false);
      setSelectedItem(null);
      setDivergenceReason("");
      setDivergenceComments("");
    },
  });

  // Finish execution
  const finishExecutionMutation = useMutation({
    mutationFn: async (observations: string) => {
      if (!isOnline) {
        addPendingAction({
          type: 'UPDATE',
          endpoint: `/loading-executions/${executionId}/finish`,
          method: 'PUT',
          data: { observations }
        });
        return { offline: true, observations };
      }
      
      const res = await apiRequest('PUT', `/api/loading-executions/${executionId}/finish`, { observations });
      return await res.json();
    },
    onSuccess: () => {
      refetch();
      setShowFinishDialog(false);
      setFinishObservations("");
      onExecutionComplete?.();
      
      // Show success notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Carregamento Finalizado', {
          body: 'Execução concluída com sucesso!',
          icon: '/icons/icon-192x192.png'
        });
      }
    },
  });

  const handleScan = (scannedCode: string) => {
    const item = execution?.items.find((item: LoadingItem) => 
      item.productSku === scannedCode || 
      item.productName.toLowerCase().includes(scannedCode.toLowerCase())
    );

    if (item) {
      setSelectedItem(item);
      setScanQuantity(parseFloat(item.requestedQuantity));
      setShowScanner(false);
      setShowQuantityDialog(true);
    } else {
      // Show error with haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      alert(`Produto não encontrado: ${scannedCode}`);
    }
  };

  const handleConfirmScan = () => {
    if (!selectedItem || scanQuantity <= 0) return;

    scanItemMutation.mutate({
      productId: selectedItem.productId,
      quantity: scanQuantity.toString(),
      scannedCode: selectedItem.productSku
    });
  };

  const handleItemTap = (item: LoadingItem) => {
    if (execution?.status !== 'em_andamento') return;
    
    setSelectedItem(item);
    setScanQuantity(
      item.confirmedAt 
        ? parseFloat(item.loadedQuantity) 
        : parseFloat(item.requestedQuantity)
    );
    setShowQuantityDialog(true);
  };

  const handleItemLongPress = (item: LoadingItem) => {
    if (execution?.status !== 'em_andamento') return;
    
    setSelectedItem(item);
    setShowDivergenceDialog(true);
  };

  const handleRegisterDivergence = () => {
    if (!selectedItem || !divergenceReason) return;

    registerDivergenceMutation.mutate({
      itemId: selectedItem.id,
      data: {
        divergenceReason,
        divergenceComments
      }
    });
  };

  const getItemStatus = (item: LoadingItem) => {
    if (item.confirmedAt) {
      const loaded = parseFloat(item.loadedQuantity);
      const requested = parseFloat(item.requestedQuantity);
      
      if (loaded === requested) {
        return { label: 'Completo', variant: 'default' as const, icon: CheckCircle, color: 'green' };
      } else if (loaded > 0) {
        return { label: 'Parcial', variant: 'secondary' as const, icon: AlertTriangle, color: 'orange' };
      } else {
        return { label: 'Não Carregado', variant: 'destructive' as const, icon: XCircle, color: 'red' };
      }
    }
    return { label: 'Pendente', variant: 'outline' as const, icon: Clock, color: 'blue' };
  };

  const getCompletionStats = () => {
    if (!execution?.items) return { completed: 0, total: 0, percentage: 0 };
    
    const total = execution.items.length;
    const completed = execution.items.filter((item: LoadingItem) => item.confirmedAt).length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    
    return { completed, total, percentage };
  };

  const stats = getCompletionStats();
  const canFinish = stats.completed === stats.total && stats.total > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Carregando execução...</p>
        </div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Execução não encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">{execution.transferRequestCode}</h2>
              <p className="text-sm text-gray-600">
                Operador: {execution.operatorName}
              </p>
            </div>
            <Badge variant={execution.status === 'em_andamento' ? 'default' : 'secondary'}>
              {execution.status === 'em_andamento' ? 'Em Andamento' : 'Finalizado'}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso</span>
              <span className="font-semibold">{stats.percentage.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-primary h-3 rounded-full transition-all duration-500"
                style={{ width: `${stats.percentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center">
              {stats.completed} de {stats.total} itens processados
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {execution.status === 'em_andamento' && (
        <div className="grid grid-cols-2 gap-3">
          <TouchOptimizedButton
            onClick={() => setShowScanner(true)}
            className="bg-primary hover:bg-primary/90 text-white"
            size="lg"
          >
            <Camera className="h-5 w-5 mr-2" />
            Scanner
          </TouchOptimizedButton>
          
          <TouchOptimizedButton
            variant="destructive"
            onClick={() => setShowFinishDialog(true)}
            disabled={!canFinish || finishExecutionMutation.isPending}
            size="lg"
          >
            <CheckSquare className="h-5 w-5 mr-2" />
            Finalizar
          </TouchOptimizedButton>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-3">
        {execution.items.map((item: LoadingItem) => {
          const status = getItemStatus(item);
          const StatusIcon = status.icon;
          const loadedQuantity = parseFloat(item.loadedQuantity);
          const requestedQuantity = parseFloat(item.requestedQuantity);
          const notLoadedQuantity = parseFloat(item.notLoadedQuantity);

          return (
            <GestureHandler
              key={item.id}
              onTap={() => handleItemTap(item)}
              onLongPress={() => handleItemLongPress(item)}
              enabled={execution.status === 'em_andamento'}
            >
              <Card className={`shadow-sm transition-all duration-200 ${
                execution.status === 'em_andamento' 
                  ? 'active:scale-98 cursor-pointer' 
                  : ''
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-base truncate">
                        {item.productName}
                      </h4>
                      <p className="text-sm text-gray-600">SKU: {item.productSku}</p>
                    </div>
                    <Badge variant={status.variant} className="ml-2 flex-shrink-0">
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Solicitado</p>
                      <p className="text-lg font-semibold">{requestedQuantity}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Carregado</p>
                      <p className="text-lg font-semibold text-green-600">{loadedQuantity}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Faltante</p>
                      <p className="text-lg font-semibold text-red-600">{notLoadedQuantity}</p>
                    </div>
                  </div>

                  {item.divergenceReason && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span className="font-medium text-amber-800 text-sm">Divergência</span>
                      </div>
                      <p className="text-xs text-amber-700">
                        {DIVERGENCE_REASONS.find(r => r.value === item.divergenceReason)?.label}
                      </p>
                      {item.divergenceComments && (
                        <p className="text-xs text-amber-700 mt-1">{item.divergenceComments}</p>
                      )}
                    </div>
                  )}

                  {execution.status === 'em_andamento' && (
                    <div className="text-xs text-blue-600 text-center py-2 bg-blue-50 rounded">
                      {item.confirmedAt 
                        ? '✏️ Toque para editar • Pressione e segure para divergência' 
                        : '👆 Toque para informar quantidade • Pressione e segure para divergência'
                      }
                    </div>
                  )}
                </CardContent>
              </Card>
            </GestureHandler>
          );
        })}
      </div>

      {/* Scanner Dialog */}
      {showScanner && (
        <QrScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Quantity Dialog */}
      <Dialog open={showQuantityDialog} onOpenChange={setShowQuantityDialog}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {selectedItem?.confirmedAt ? 'Editar Quantidade' : 'Informar Quantidade'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-medium">{selectedItem.productName}</h4>
                <p className="text-sm text-gray-600">SKU: {selectedItem.productSku}</p>
                <p className="text-sm">Solicitado: <strong>{selectedItem.requestedQuantity}</strong></p>
              </div>

              <QuantityController
                label="Quantidade carregada"
                value={scanQuantity}
                onChange={setScanQuantity}
                min={0}
                max={parseFloat(selectedItem.requestedQuantity)}
                step={0.001}
              />
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-700">
                  💡 {selectedItem.confirmedAt 
                    ? 'Você pode editar esta quantidade a qualquer momento.'
                    : 'Se não conseguiu carregar tudo, informe o que foi carregado e registre uma divergência.'
                  }
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <TouchOptimizedButton 
              variant="outline" 
              onClick={() => setShowQuantityDialog(false)}
              className="flex-1"
            >
              Cancelar
            </TouchOptimizedButton>
            <TouchOptimizedButton
              onClick={handleConfirmScan}
              disabled={scanQuantity <= 0 || scanItemMutation.isPending}
              className="flex-1"
            >
              {selectedItem?.confirmedAt ? 'Atualizar' : 'Confirmar'}
            </TouchOptimizedButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Divergence Dialog */}
      <Dialog open={showDivergenceDialog} onOpenChange={setShowDivergenceDialog}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Divergência</DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-medium">{selectedItem.productName}</h4>
                <p className="text-sm text-gray-600">SKU: {selectedItem.productSku}</p>
              </div>

              <div className="space-y-2">
                <Label>Motivo da divergência</Label>
                <Select value={divergenceReason} onValueChange={setDivergenceReason}>
                  <SelectTrigger className="h-12">
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
                <Label>Comentários (opcional)</Label>
                <Textarea
                  value={divergenceComments}
                  onChange={(e) => setDivergenceComments(e.target.value)}
                  placeholder="Detalhes sobre a divergência..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <TouchOptimizedButton 
              variant="outline" 
              onClick={() => setShowDivergenceDialog(false)}
              className="flex-1"
            >
              Cancelar
            </TouchOptimizedButton>
            <TouchOptimizedButton
              onClick={handleRegisterDivergence}
              disabled={!divergenceReason || registerDivergenceMutation.isPending}
              variant="destructive"
              className="flex-1"
            >
              Registrar
            </TouchOptimizedButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finish Dialog */}
      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent className="w-[95vw] max-w-md">
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
                placeholder="Observações sobre o carregamento..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <TouchOptimizedButton
              variant="outline"
              onClick={() => setShowFinishDialog(false)}
              disabled={finishExecutionMutation.isPending}
              className="flex-1"
            >
              Cancelar
            </TouchOptimizedButton>
            <TouchOptimizedButton
              onClick={() => finishExecutionMutation.mutate(finishObservations)}
              disabled={finishExecutionMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Finalizar
            </TouchOptimizedButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LoadingExecutionScreenMobile;