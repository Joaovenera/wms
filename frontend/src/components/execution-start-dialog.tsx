import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Ship, 
  Truck, 
  Package, 
  UserCheck, 
  AlertTriangle,
  ArrowLeft,
  Play
} from 'lucide-react';
import { ContainerExecutionForm } from './container-execution-form';
import { TruckExecutionForm } from './truck-execution-form';
import { DeliveryExecutionForm } from './delivery-execution-form';

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
}

interface ExecutionStartDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transferRequest: TransferRequest | null;
  onStartExecution: (data: any) => void;
  isSubmitting?: boolean;
  fullPage?: boolean;
}

export function ExecutionStartDialog({
  isOpen,
  onClose,
  transferRequest,
  onStartExecution,
  isSubmitting = false,
  fullPage = false
}: ExecutionStartDialogProps) {
  const [currentStep, setCurrentStep] = useState<'overview' | 'form'>('overview');

  if (!transferRequest) return null;

  const getOperationInfo = (type: string) => {
    switch (type) {
      case 'container-arrival-plan':
        return {
          icon: Ship,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          title: 'Execução de Chegada de Container',
          description: 'Configurar dados específicos para descarregamento do container'
        };
      
      case 'truck-arrival-plan':
        return {
          icon: Truck,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          title: 'Execução de Chegada de Caminhão',
          description: 'Configurar dados do veículo e motorista para descarregamento'
        };
      
      case 'delivery-arrival-plan':
        return {
          icon: Package,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          title: 'Execução de Entrega via Transportadora',
          description: 'Configurar dados de entrega e documentação de recebimento'
        };
      
      case 'transfer-plan':
        return {
          icon: Truck,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          title: 'Execução de Transferência',
          description: 'Configurar dados do veículo para transferência entre locais'
        };
      
      case 'withdrawal-plan':
        return {
          icon: UserCheck,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          title: 'Execução de Retirada do Cliente',
          description: 'Configurar dados para entrega direta ao cliente'
        };
      
      default:
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          title: 'Execução de Operação Desconhecida',
          description: 'Tipo de operação não reconhecido'
        };
    }
  };

  const operationInfo = getOperationInfo(transferRequest.type);
  const OperationIcon = operationInfo.icon;

  const handleFormSubmit = (executionData: any) => {
    const fullData = {
      transferRequestId: transferRequest.id,
      observations: `Execução iniciada para ${operationInfo.title}`,
      ...executionData
    };
    onStartExecution(fullData);
  };

  const renderExecutionForm = () => {
    switch (transferRequest.type) {
      case 'container-arrival-plan':
        return (
          <ContainerExecutionForm
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
          />
        );
      
      case 'truck-arrival-plan':
      case 'transfer-plan':
        return (
          <TruckExecutionForm
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
          />
        );
      
      case 'delivery-arrival-plan':
      case 'withdrawal-plan':
        return (
          <DeliveryExecutionForm
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
          />
        );
      
      default:
        return (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-600">Tipo de operação não suportado para execução específica</p>
            <Button
              onClick={() => handleFormSubmit({})}
              disabled={isSubmitting}
              className="mt-4"
            >
              <Play className="h-4 w-4 mr-2" />
              Iniciar Execução Genérica
            </Button>
          </div>
        );
    }
  };

  const Content = (
    <div className={fullPage ? "container mx-auto p-6" : undefined}>
      <div className={fullPage ? "" : "hidden"}>
        {/* spacer for symmetry when in fullPage mode */}
      </div>
      <div className={fullPage ? "" : "max-w-4xl"}>
        <div className="mb-4">
          <div className="flex items-center gap-3">
            {currentStep === 'form' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep('overview')}
                className="p-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className={`p-2 rounded-lg bg-white ${operationInfo.borderColor} border`}>
              <OperationIcon className={`h-5 w-5 ${operationInfo.color}`} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{operationInfo.title}</h2>
              <p className="text-sm text-gray-600 mt-1">{operationInfo.description}</p>
            </div>
          </div>
        </div>

        {currentStep === 'overview' && (
          <div className="space-y-6">
            {/* Plan Overview */}
            <div className={`p-4 rounded-lg ${operationInfo.bgColor} ${operationInfo.borderColor} border`}>
              <div className="flex items-center gap-3 mb-3">
                <div>
                  <h4 className="font-medium">{transferRequest.code}</h4>
                  <p className="text-sm text-gray-600">{operationInfo.title}</p>
                </div>
                <Badge variant="default" className="ml-auto">
                  Aprovado
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                {transferRequest.type === 'transfer-plan' && (
                  <>
                    <div>
                      <span className="text-gray-600">Origem:</span>
                      <p className="font-medium">{transferRequest.fromLocation}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Destino:</span>
                      <p className="font-medium">{transferRequest.toLocation}</p>
                    </div>
                    {transferRequest.vehicleName && (
                      <>
                        <div>
                          <span className="text-gray-600">Veículo:</span>
                          <p className="font-medium">{transferRequest.vehicleName}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Código:</span>
                          <p className="font-medium">{transferRequest.vehicleCode}</p>
                        </div>
                      </>
                    )}
                  </>
                )}
                
                {transferRequest.type === 'withdrawal-plan' && transferRequest.clientInfo && (
                  <>
                    <div>
                      <span className="text-gray-600">Cliente:</span>
                      <p className="font-medium">{transferRequest.clientInfo.clientName}</p>
                    </div>
                    {transferRequest.clientInfo.clientDocument && (
                      <div>
                        <span className="text-gray-600">Documento:</span>
                        <p className="font-medium">{transferRequest.clientInfo.clientDocument}</p>
                      </div>
                    )}
                  </>
                )}
                
                {(transferRequest.type === 'container-arrival-plan' || 
                  transferRequest.type === 'truck-arrival-plan' || 
                  transferRequest.type === 'delivery-arrival-plan') && (
                  <>
                    {transferRequest.supplierName && (
                      <div>
                        <span className="text-gray-600">Fornecedor:</span>
                        <p className="font-medium">{transferRequest.supplierName}</p>
                      </div>
                    )}
                    {transferRequest.transporterName && (
                      <div>
                        <span className="text-gray-600">Transportadora:</span>
                        <p className="font-medium">{transferRequest.transporterName}</p>
                      </div>
                    )}
                  </>
                )}
                
                {transferRequest.estimatedArrival && (
                  <div>
                    <span className="text-gray-600">
                      {transferRequest.type.includes('arrival') ? 'Chegada Estimada:' : 'Data Estimada:'}
                    </span>
                    <p className="font-medium">
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
              </div>
              
              {transferRequest.notes && (
                <div className="mt-3 p-3 bg-white rounded border">
                  <p className="text-sm">
                    <strong>Observações:</strong> {transferRequest.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Execution Setup Info */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta operação requer configuração específica de dados de execução. 
                Clique em "Configurar Execução" para fornecer as informações necessárias 
                (veículo, motorista, documentação, etc.) antes de iniciar.
              </AlertDescription>
            </Alert>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={() => setCurrentStep('form')}>
                Configurar Execução
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'form' && (
          <div className="space-y-6">
            {renderExecutionForm()}
          </div>
        )}
      </div>
    </div>
  );

  if (fullPage) {
    if (!isOpen) return null;
    return Content;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader />
        {Content}
      </DialogContent>
    </Dialog>
  );
}