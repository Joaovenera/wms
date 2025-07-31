import { useState } from "react";
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
  AlertTriangle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

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

export default function LoadingExecutionPage() {
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [selectedTransferRequest, setSelectedTransferRequest] = useState<TransferRequest | null>(null);
  const [startObservations, setStartObservations] = useState("");

  const queryClient = useQueryClient();

  // Fetch approved transfer requests (ready for loading)
  const { data: approvedRequests, isLoading: approvedLoading } = useQuery({
    queryKey: ['/api/transfer-requests', { status: 'aprovado' }],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/transfer-requests?status=aprovado');
      return await res.json();
    },
  });

  // Fetch pending loading executions
  const { data: pendingExecutions, isLoading: pendingLoading } = useQuery({
    queryKey: ['/api/loading-executions/pending'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/loading-executions/pending');
      return await res.json();
    },
  });

  // Start loading execution
  const startExecutionMutation = useMutation({
    mutationFn: async (data: { transferRequestId: number; observations?: string }) => {
      const res = await apiRequest('POST', '/api/loading-executions', data);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/loading-executions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests'] });
      setSelectedExecutionId(data.id);
      setShowStartDialog(false);
      setSelectedTransferRequest(null);
      setStartObservations("");
    }
  });

  const handleStartExecution = (request: TransferRequest) => {
    setSelectedTransferRequest(request);
    setShowStartDialog(true);
  };

  const handleConfirmStart = () => {
    if (!selectedTransferRequest) return;
    
    startExecutionMutation.mutate({
      transferRequestId: selectedTransferRequest.id,
      observations: startObservations
    });
  };

  const handleExecutionComplete = () => {
    setSelectedExecutionId(null);
    queryClient.invalidateQueries({ queryKey: ['/api/loading-executions'] });
    queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests'] });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Se há uma execução selecionada, mostrar a tela de execução
  if (selectedExecutionId) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => setSelectedExecutionId(null)}
            className="mb-4"
          >
            ← Voltar à Lista
          </Button>
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
            <div className="text-center py-4">
              <div className="text-sm text-gray-500">Carregando execuções...</div>
            </div>
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
            <div className="text-center py-4">
              <div className="text-sm text-gray-500">Carregando pedidos...</div>
            </div>
          ) : !approvedRequests || approvedRequests.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum pedido aprovado para carregamento</p>
              <p className="text-sm text-gray-400 mt-2">
                Pedidos precisam ser aprovados antes do carregamento
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {approvedRequests.map((request: TransferRequest) => (
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
}