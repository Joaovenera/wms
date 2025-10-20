import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  Info,
  User,
  Calendar,
  Package,
  Truck,
  Ship,
  UserCheck
} from 'lucide-react';

interface TransferRequest {
  id: number;
  code: string;
  status: string;
  type: string;
  fromLocation: string;
  toLocation: string;
  vehicleName?: string;
  vehicleCode?: string;
  supplierName?: string;
  clientInfo?: {
    clientName: string;
    clientDocument?: string;
    contactInfo?: string;
  };
  transporterName?: string;
  estimatedArrival?: string;
  createdAt: string;
  createdByName: string;
  notes?: string;
  totalCubicVolume?: string;
  effectiveCapacity?: string;
  capacityUsagePercent?: string;
}

interface PlanApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transferRequest: TransferRequest | null;
  onApprove: (notes?: string) => void;
  onReject: (notes: string) => void;
  isSubmitting?: boolean;
}

export function PlanApprovalDialog({
  isOpen,
  onClose,
  transferRequest,
  onApprove,
  onReject,
  isSubmitting = false
}: PlanApprovalDialogProps) {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');

  if (!transferRequest) return null;

  const getOperationInfo = (type: string) => {
    switch (type) {
      case 'container-arrival-plan':
        return {
          icon: Ship,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          title: 'Plano de Chegada de Container',
          description: 'Container programado para chegada e descarregamento'
        };
      
      case 'truck-arrival-plan':
        return {
          icon: Truck,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          title: 'Plano de Chegada de Caminhão',
          description: 'Caminhão programado para chegada e descarregamento'
        };
      
      case 'delivery-arrival-plan':
        return {
          icon: Package,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          title: 'Plano de Entrega via Transportadora',
          description: 'Entrega programada via transportadora'
        };
      
      case 'transfer-plan':
        return {
          icon: Truck,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          title: 'Plano de Transferência',
          description: 'Transferência programada entre locais'
        };
      
      case 'withdrawal-plan':
        return {
          icon: UserCheck,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          title: 'Plano de Retirada do Cliente',
          description: 'Retirada programada pelo cliente'
        };
      
      default:
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          title: 'Operação Desconhecida',
          description: 'Tipo de operação não reconhecido'
        };
    }
  };

  const operationInfo = getOperationInfo(transferRequest.type);
  const OperationIcon = operationInfo.icon;

  const handleSubmit = () => {
    if (action === 'approve') {
      onApprove(notes || undefined);
    } else if (action === 'reject') {
      if (!notes.trim()) {
        return; // Require notes for rejection
      }
      onReject(notes);
    }
    
    // Reset state
    setAction(null);
    setNotes('');
  };

  const resetForm = () => {
    setAction(null);
    setNotes('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'planejamento':
        return <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Em Planejamento
        </Badge>;
      case 'aprovado':
        return <Badge variant="default" className="flex items-center gap-1 bg-green-600">
          <CheckCircle className="h-3 w-3" />
          Aprovado
        </Badge>;
      case 'carregamento':
        return <Badge variant="default" className="flex items-center gap-1 bg-blue-600">
          <Package className="h-3 w-3" />
          Em Carregamento
        </Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { 
      if (!open) {
        resetForm();
        onClose();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-white ${operationInfo.borderColor} border`}>
              <OperationIcon className={`h-5 w-5 ${operationInfo.color}`} />
            </div>
            <div>
              <DialogTitle>Aprovar Plano de Operação</DialogTitle>
              <p className="text-sm text-gray-600 mt-1">{operationInfo.description}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Plan Overview */}
          <div className={`p-4 rounded-lg ${operationInfo.bgColor} ${operationInfo.borderColor} border`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-lg">{transferRequest.code}</h4>
                <p className="text-sm text-gray-600">{operationInfo.title}</p>
              </div>
              {getStatusBadge(transferRequest.status)}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {/* Operation-specific information */}
              {transferRequest.type === 'transfer-plan' && (
                <>
                  <div>
                    <span className="text-gray-600 font-medium">Origem:</span>
                    <p className="font-semibold">{transferRequest.fromLocation}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 font-medium">Destino:</span>
                    <p className="font-semibold">{transferRequest.toLocation}</p>
                  </div>
                  {transferRequest.vehicleName && (
                    <>
                      <div>
                        <span className="text-gray-600 font-medium">Veículo:</span>
                        <p className="font-semibold">{transferRequest.vehicleName}</p>
                        <p className="text-xs text-gray-500">{transferRequest.vehicleCode}</p>
                      </div>
                    </>
                  )}
                </>
              )}
              
              {transferRequest.type === 'withdrawal-plan' && transferRequest.clientInfo && (
                <>
                  <div>
                    <span className="text-gray-600 font-medium">Cliente:</span>
                    <p className="font-semibold">{transferRequest.clientInfo.clientName}</p>
                    {transferRequest.clientInfo.clientDocument && (
                      <p className="text-xs text-gray-500">{transferRequest.clientInfo.clientDocument}</p>
                    )}
                  </div>
                </>
              )}
              
              {(transferRequest.type === 'container-arrival-plan' || 
                transferRequest.type === 'truck-arrival-plan' || 
                transferRequest.type === 'delivery-arrival-plan') && (
                <>
                  {transferRequest.supplierName && (
                    <div>
                      <span className="text-gray-600 font-medium">Fornecedor:</span>
                      <p className="font-semibold">{transferRequest.supplierName}</p>
                    </div>
                  )}
                  {transferRequest.transporterName && (
                    <div>
                      <span className="text-gray-600 font-medium">Transportadora:</span>
                      <p className="font-semibold">{transferRequest.transporterName}</p>
                    </div>
                  )}
                </>
              )}
              
              {transferRequest.estimatedArrival && (
                <div>
                  <span className="text-gray-600 font-medium">
                    {transferRequest.type.includes('arrival') ? 'Chegada Estimada:' : 'Data Estimada:'}
                  </span>
                  <p className="font-semibold">
                    {new Date(transferRequest.estimatedArrival).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <div>
                  <span className="text-gray-600 font-medium">Criado por:</span>
                  <p className="font-semibold">{transferRequest.createdByName}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <span className="text-gray-600 font-medium">Criado em:</span>
                  <p className="font-semibold">
                    {new Date(transferRequest.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Capacity Information */}
            {transferRequest.totalCubicVolume && transferRequest.effectiveCapacity && (
              <div className="mt-4 p-3 bg-white rounded border">
                <h5 className="font-medium text-sm mb-2">Informações de Capacidade</h5>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-gray-600">Volume Total:</span>
                    <p className="font-semibold">{parseFloat(transferRequest.totalCubicVolume).toFixed(3)} m³</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Capacidade Efetiva:</span>
                    <p className="font-semibold">{parseFloat(transferRequest.effectiveCapacity).toFixed(3)} m³</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Utilização:</span>
                    <p className="font-semibold">{parseFloat(transferRequest.capacityUsagePercent || '0').toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )}
            
            {transferRequest.notes && (
              <div className="mt-3 p-3 bg-white rounded border">
                <p className="text-sm">
                  <strong>Observações do Plano:</strong> {transferRequest.notes}
                </p>
              </div>
            )}
          </div>

          {/* Action Selection */}
          {!action && (
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Selecione uma ação para este plano. Planos aprovados poderão ser executados 
                  na página de Execução de Operações.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button
                  onClick={() => setAction('approve')}
                  className="flex-1 flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4" />
                  Aprovar Plano
                </Button>
                <Button
                  onClick={() => setAction('reject')}
                  variant="destructive"
                  className="flex-1 flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Rejeitar Plano
                </Button>
              </div>
            </div>
          )}

          {/* Approval Form */}
          {action === 'approve' && (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Aprovando plano:</strong> Este plano ficará disponível para execução 
                  após a aprovação.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Observações da Aprovação (opcional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicione observações sobre a aprovação do plano..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Rejection Form */}
          {action === 'reject' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Rejeitando plano:</strong> Este plano será cancelado e não poderá ser executado. 
                  O motivo da rejeição deve ser informado.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Motivo da Rejeição *</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informe o motivo da rejeição do plano..."
                  rows={3}
                  className={!notes.trim() ? 'border-red-500' : ''}
                />
                {!notes.trim() && action === 'reject' && (
                  <p className="text-sm text-red-600">Motivo da rejeição é obrigatório</p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          
          {action && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || (action === 'reject' && !notes.trim())}
              variant={action === 'approve' ? 'default' : 'destructive'}
              className={`flex items-center gap-2 ${
                action === 'approve' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {action === 'approve' ? 'Aprovando...' : 'Rejeitando...'}
                </>
              ) : action === 'approve' ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Confirmar Aprovação
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  Confirmar Rejeição
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}