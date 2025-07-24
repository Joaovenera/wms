import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Truck, 
  Package, 
  User,
  Calendar,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TransferDetailsModalProps {
  transferId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TransferDetail {
  id: number;
  code: string;
  status: string;
  fromLocation: string;
  toLocation: string;
  totalCubicVolume: string;
  effectiveCapacity: string;
  capacityUsagePercent: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  vehicleName: string;
  vehicleCode: string;
  vehicleCubicCapacity: string;
  createdByName: string;
  items: Array<{
    id: number;
    productId: number;
    productName: string;
    productSku: string;
    quantity: string;
    totalCubicVolume: string;
    notes?: string;
  }>;
}

const STATUS_LABELS = {
  'planejamento': { label: 'Planejamento', color: 'bg-gray-100 text-gray-800' },
  'aprovado': { label: 'Aprovado', color: 'bg-green-100 text-green-800' },
  'carregamento': { label: 'Carregamento', color: 'bg-blue-100 text-blue-800' },
  'transito': { label: 'Em Trânsito', color: 'bg-purple-100 text-purple-800' },
  'finalizado': { label: 'Finalizado', color: 'bg-green-100 text-green-800' },
  'cancelado': { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
};

export function TransferDetailsModal({ transferId, open, onOpenChange }: TransferDetailsModalProps) {
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [actionType, setActionType] = useState<'approve' | 'cancel'>('approve');

  const queryClient = useQueryClient();

  // Fetch transfer details
  const { data: transfer, isLoading } = useQuery({
    queryKey: ['/api/transfer-requests', transferId],
    queryFn: async () => {
      if (!transferId) return null;
      const res = await apiRequest('GET', `/api/transfer-requests/${transferId}`);
      return await res.json();
    },
    enabled: !!transferId && open
  });

  // Update transfer status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      const res = await apiRequest('PUT', `/api/transfer-requests/${transferId}/status`, { status, notes });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests'] });
      setShowApprovalDialog(false);
      setApprovalNotes("");
      onOpenChange(false);
    }
  });

  const handleStatusUpdate = (newStatus: 'approve' | 'cancel') => {
    setActionType(newStatus);
    setShowApprovalDialog(true);
  };

  const handleConfirmStatusUpdate = () => {
    const status = actionType === 'approve' ? 'aprovado' : 'cancelado';
    updateStatusMutation.mutate({ 
      status, 
      notes: approvalNotes 
    });
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

  const getCapacityColor = (percentage: number) => {
    if (percentage <= 70) return 'text-green-600';
    if (percentage <= 90) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!transfer) {
    return null;
  }

  const statusInfo = STATUS_LABELS[transfer.status as keyof typeof STATUS_LABELS] || 
    { label: transfer.status, color: 'bg-gray-100 text-gray-800' };

  const capacityPercent = parseFloat(transfer.capacityUsagePercent);
  const canApprove = transfer.status === 'planejamento';
  const canCancel = ['planejamento', 'aprovado'].includes(transfer.status);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Detalhes da Transferência - {transfer.code}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-sm text-gray-500">Carregando detalhes...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status e Ações */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{transfer.code}</CardTitle>
                      <CardDescription>
                        {transfer.fromLocation} → {transfer.toLocation}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={statusInfo.color}>
                        {statusInfo.label}
                      </Badge>
                      {canApprove && (
                        <Button
                          onClick={() => handleStatusUpdate('approve')}
                          className="flex items-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Aprovar
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          variant="destructive"
                          onClick={() => handleStatusUpdate('cancel')}
                          className="flex items-center gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Informações Gerais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Veículo */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Veículo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm text-gray-600">Nome</Label>
                      <p className="font-medium">{transfer.vehicleName}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Código</Label>
                      <p className="font-medium">{transfer.vehicleCode}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Capacidade Total</Label>
                      <p className="font-medium">{parseFloat(transfer.vehicleCubicCapacity).toFixed(2)} m³</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Capacidade Efetiva (90%)</Label>
                      <p className="font-medium">{parseFloat(transfer.effectiveCapacity).toFixed(2)} m³</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Cubagem */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Análise de Cubagem
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm text-gray-600">Volume Total dos Itens</Label>
                      <p className="font-medium">{parseFloat(transfer.totalCubicVolume).toFixed(3)} m³</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Utilização da Capacidade</Label>
                      <p className={`font-bold text-lg ${getCapacityColor(capacityPercent)}`}>
                        {capacityPercent.toFixed(1)}%
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all ${
                          capacityPercent <= 70 ? 'bg-green-500' :
                          capacityPercent <= 90 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                      />
                    </div>
                    {capacityPercent > 100 && (
                      <Alert className="border-red-200 bg-red-50">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-700">
                          A capacidade foi excedida em {(capacityPercent - 100).toFixed(1)}%
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Informações Adicionais */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Informações Adicionais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600">Criado por</Label>
                      <p className="font-medium flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {transfer.createdByName}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Criado em</Label>
                      <p className="font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatDate(transfer.createdAt)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Última atualização</Label>
                      <p className="font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatDate(transfer.updatedAt)}
                      </p>
                    </div>
                  </div>
                  {transfer.notes && (
                    <div className="mt-4">
                      <Label className="text-sm text-gray-600">Observações</Label>
                      <p className="mt-1 p-3 bg-gray-50 rounded border">{transfer.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Lista de Itens */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Itens da Transferência ({transfer.items?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!transfer.items || transfer.items.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhum item na transferência</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transfer.items.map((item: any, index: number) => (
                        <div key={item.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-medium">{item.productName}</h4>
                              <p className="text-sm text-gray-600">SKU: {item.productSku}</p>
                            </div>
                            <Badge variant="outline">#{index + 1}</Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Quantidade:</span>
                              <p className="font-semibold">{item.quantity}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Cubagem:</span>
                              <p className="font-semibold">{parseFloat(item.totalCubicVolume).toFixed(4)} m³</p>
                            </div>
                            <div>
                              <span className="text-gray-600">% do Total:</span>
                              <p className="font-semibold">
                                {((parseFloat(item.totalCubicVolume) / parseFloat(transfer.totalCubicVolume)) * 100).toFixed(1)}%
                              </p>
                            </div>
                          </div>
                          
                          {item.notes && (
                            <div className="mt-2 pt-2 border-t">
                              <span className="text-sm text-gray-600">Observações: </span>
                              <span className="text-sm">{item.notes}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Aprovar Transferência' : 'Cancelar Transferência'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert className={actionType === 'approve' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              {actionType === 'approve' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={actionType === 'approve' ? 'text-green-700' : 'text-red-700'}>
                {actionType === 'approve' 
                  ? 'Ao aprovar, a transferência ficará disponível para carregamento.'
                  : 'Ao cancelar, a transferência não poderá mais ser processada.'
                }
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Observações {actionType === 'cancel' ? '(obrigatório)' : '(opcional)'}</Label>
              <Textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder={actionType === 'approve' 
                  ? "Adicione observações sobre a aprovação..."
                  : "Motivo do cancelamento..."
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmStatusUpdate}
              disabled={
                updateStatusMutation.isPending || 
                (actionType === 'cancel' && !approvalNotes.trim())
              }
              variant={actionType === 'approve' ? 'default' : 'destructive'}
              className="flex items-center gap-2"
            >
              {actionType === 'approve' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {actionType === 'approve' ? 'Aprovar' : 'Cancelar'} Transferência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}