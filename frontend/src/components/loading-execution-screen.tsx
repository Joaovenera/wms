import { useState, useEffect } from "react";
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
  Scan, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  User,
  Truck,
  FileText,
  CheckSquare,
  XCircle,
  Camera,
  Edit
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface LoadingExecution {
  id: number;
  status: string;
  startedAt: string;
  finishedAt?: string;
  observations?: string;
  transferRequestId: number;
  transferRequestCode: string;
  operatorName: string;
  items: LoadingItem[];
}

interface LoadingItem {
  id: number;
  transferRequestItemId: number;
  productId: number;
  productName: string;
  productSku: string;
  requestedQuantity: string;
  loadedQuantity: string;
  notLoadedQuantity: string;
  divergenceReason?: string;
  divergenceComments?: string;
  scannedAt?: string;
  confirmedAt?: string;
}

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

export function LoadingExecutionScreen({ executionId, onExecutionComplete }: LoadingExecutionScreenProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [showDivergenceDialog, setShowDivergenceDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LoadingItem | null>(null);
  const [scanQuantity, setScanQuantity] = useState("");
  const [divergenceReason, setDivergenceReason] = useState("");
  const [divergenceComments, setDivergenceComments] = useState("");
  const [finishObservations, setFinishObservations] = useState("");
  const [showFinishDialog, setShowFinishDialog] = useState(false);

  const queryClient = useQueryClient();

  // Fetch loading execution details
  const { data: execution, isLoading, refetch } = useQuery({
    queryKey: ['/api/loading-executions', executionId],
    queryFn: async () => {
      if (!executionId) return null;
      const res = await apiRequest('GET', `/api/loading-executions/${executionId}`);
      return await res.json();
    },
    enabled: !!executionId,
    refetchInterval: 5000, // Atualizar a cada 5 segundos
  });

  // Scan and confirm item
  const scanItemMutation = useMutation({
    mutationFn: async (data: { productId: number; quantity: string; scannedCode?: string }) => {
      const res = await apiRequest('POST', `/api/loading-executions/${executionId}/scan-item`, data);
      return await res.json();
    },
    onSuccess: () => {
      refetch();
      setScanQuantity("");
      setShowScanner(false);
    },
  });

  // Register divergence
  const registerDivergenceMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: number; data: any }) => {
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
      const res = await apiRequest('PUT', `/api/loading-executions/${executionId}/finish`, { observations });
      return await res.json();
    },
    onSuccess: () => {
      refetch();
      setShowFinishDialog(false);
      setFinishObservations("");
      onExecutionComplete?.();
    },
  });

  const handleScan = (scannedCode: string) => {
    // Tentar identificar o produto pelo código escaneado
    const item = execution?.items.find((item: LoadingItem) => 
      item.productSku === scannedCode || 
      item.productName.toLowerCase().includes(scannedCode.toLowerCase())
    );

    if (item) {
      setSelectedItem(item);
      setShowScanner(false);
      // Abrir dialog para confirmar quantidade
    } else {
      alert(`Produto não encontrado na lista: ${scannedCode}`);
    }
  };

  const handleConfirmScan = () => {
    if (!selectedItem || !scanQuantity) return;

    scanItemMutation.mutate({
      productId: selectedItem.productId,
      quantity: scanQuantity,
      scannedCode: selectedItem.productSku
    });
  };

  const handleOpenDivergence = (item: LoadingItem) => {
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

  const handleFinishExecution = () => {
    finishExecutionMutation.mutate(finishObservations);
  };

  const handleOpenFinishDialog = () => {
    setShowFinishDialog(true);
  };

  const handleCloseFinishDialog = () => {
    setShowFinishDialog(false);
    setFinishObservations("");
  };

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
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Carregando execução...</p>
        </div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Execução de carregamento não encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-6 w-6" />
                Execução de Carregamento
              </CardTitle>
              <CardDescription>
                Transferência: {execution.transferRequestCode}
              </CardDescription>
            </div>
            <Badge variant={execution.status === 'em_andamento' ? 'default' : 'secondary'}>
              {execution.status === 'em_andamento' ? 'Em Andamento' : 'Finalizado'}
            </Badge>
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
                {stats.completed}/{stats.total} itens ({stats.percentage.toFixed(0)}%)
              </p>
            </div>
            <div>
              <span className="text-gray-600">Status:</span>
              <p className="font-medium capitalize">{execution.status.replace('_', ' ')}</p>
            </div>
          </div>
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
              <span className="font-semibold">{stats.percentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.percentage}%` }}
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
                onClick={() => refetch()}
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

      {/* Items List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Itens para Carregamento
          </CardTitle>
          <CardDescription>
            {execution.items.length} itens na lista de carregamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {execution.items.map((item: LoadingItem) => {
              const status = getItemStatus(item);
              const StatusIcon = status.icon;
              const loadedQuantity = parseFloat(item.loadedQuantity);
              const requestedQuantity = parseFloat(item.requestedQuantity);
              const notLoadedQuantity = parseFloat(item.notLoadedQuantity);

              return (
                <div 
                  key={item.id} 
                  className={`border rounded-lg p-4 transition-colors ${
                    execution.status === 'em_andamento' 
                      ? 'bg-blue-50 hover:bg-blue-100 cursor-pointer border-blue-200' 
                      : 'bg-gray-50'
                  }`}
                  onClick={() => {
                    if (execution.status === 'em_andamento') {
                      setSelectedItem(item);
                      // Se já foi confirmado, mostrar a quantidade carregada atual, senão a solicitada
                      setScanQuantity(item.confirmedAt ? item.loadedQuantity : item.requestedQuantity);
                    }
                  }}
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
                      {item.confirmedAt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation(); // Evitar trigger do click do card
                            setSelectedItem(item);
                            setScanQuantity(item.loadedQuantity);
                          }}
                          className="flex items-center gap-1"
                        >
                          <Edit className="h-3 w-3" />
                          Editar Quantidade
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation(); // Evitar trigger do click do card
                            handleOpenDivergence(item);
                          }}
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
            })}
          </div>
        </CardContent>
      </Card>

      {/* Scanner Dialog */}
      {showScanner && (
        <QrScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Confirm Scan Dialog */}
      <Dialog open={!!selectedItem && !showDivergenceDialog && !showScanner && !showFinishDialog} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedItem?.confirmedAt ? 'Editar Quantidade Carregada' : 'Informar Quantidade Carregada'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded">
                <h4 className="font-medium">{selectedItem.productName}</h4>
                <p className="text-sm text-gray-600">SKU: {selectedItem.productSku}</p>
                <p className="text-sm">Quantidade solicitada: <strong>{selectedItem.requestedQuantity}</strong></p>
              </div>

              <div className="space-y-2">
                <Label>Quantidade carregada</Label>
                <Input
                  type="number"
                  value={scanQuantity}
                  onChange={(e) => setScanQuantity(e.target.value)}
                  placeholder="Digite a quantidade carregada"
                  min="0"
                  max={selectedItem.requestedQuantity}
                  step="0.001"
                  autoFocus
                />
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Mínimo: 0</span>
                  <span className="text-gray-500">Máximo: {selectedItem.requestedQuantity}</span>
                </div>
                <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  {selectedItem.confirmedAt ? (
                    <>💡 Você pode editar esta quantidade quantas vezes precisar enquanto a execução estiver em andamento.</>
                  ) : (
                    <>💡 Dica: Se não conseguiu carregar a quantidade total, informe o que foi carregado e registre uma divergência depois.</>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmScan}
              disabled={!scanQuantity || scanItemMutation.isPending}
            >
              {selectedItem?.confirmedAt ? 'Atualizar Quantidade' : 'Confirmar Carregamento'}
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
}