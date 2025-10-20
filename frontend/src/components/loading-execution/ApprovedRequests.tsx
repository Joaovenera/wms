
import { CheckCircle, Play, AlertTriangle, Ship, Truck, Package, UserCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingExecutionSkeleton } from "@/components/LoadingExecutionSkeleton";
import RetryComponent, { useRetry, retryPresets } from "@/components/RetryMechanism";
import { useLoadingExecutionStore } from '@/store/loading-execution-store';
import { TransferRequest } from '@/types/api';
import { useMutation } from '@tanstack/react-query';

interface ApprovedRequestsProps {
  approvedRequests: TransferRequest[];
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
  apiError: string | null;
  startExecutionMutation: ReturnType<typeof useMutation>;
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const getOperationInfo = (request: TransferRequest) => {
  switch (request.type) {
    case 'container-arrival-plan':
      return { icon: Ship, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', title: 'Chegada de Container', description: `Fornecedor: ${request.supplierName || 'N/I'}` };
    case 'truck-arrival-plan':
      return { icon: Truck, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', title: 'Chegada de Caminhão', description: `Fornecedor: ${request.supplierName || 'N/I'}` };
    case 'delivery-arrival-plan':
      return { icon: Package, color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', title: 'Entrega via Transportadora', description: `Transportadora: ${request.transporterName || 'N/I'}` };
    case 'transfer-plan':
      return { icon: Truck, color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200', title: 'Transferência entre Locais', description: `Origem: ${request.fromLocation} → Destino: ${request.toLocation}` };
    case 'withdrawal-plan':
      return { icon: UserCheck, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', title: 'Retirada do Cliente', description: `Cliente: ${request.clientInfo?.clientName || 'N/I'}` };
    default:
      return { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', title: 'Operação Desconhecida', description: `Tipo: ${request.type}` };
  }
};

export const ApprovedRequests = ({ approvedRequests, isLoading, error, retry, apiError, startExecutionMutation }: ApprovedRequestsProps) => {
  const openStartDialog = useLoadingExecutionStore((state) => state.openStartDialog);
  const retryApprovedRequests = useRetry(retry, retryPresets.network);

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold text-gray-700">
          <CheckCircle className="h-6 w-6 text-green-500" />
          Planos Aprovados para Execução
        </CardTitle>
        <CardDescription>
          Planos de todas as operações aguardando execução.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingExecutionSkeleton type="list" count={3} />
        ) : error ? (
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
        ) : !approvedRequests || approvedRequests.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-lg">
            <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Nenhum plano aprovado para execução</p>
            <p className="text-sm text-gray-500 mt-1">Aprove um plano na página de Planejamento para vê-lo aqui.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvedRequests.map((request) => {
              const operationInfo = getOperationInfo(request);
              const OperationIcon = operationInfo.icon;

              return (
                <div key={request.id} className={`border rounded-lg p-4 ${operationInfo.bgColor} ${operationInfo.borderColor} hover:shadow-md transition-shadow duration-200`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full bg-white ${operationInfo.borderColor} border-2`}>
                        <OperationIcon className={`h-6 w-6 ${operationInfo.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-gray-800">{request.code}</h3>
                        <p className="text-sm text-gray-600 font-medium">{operationInfo.title}</p>
                        <p className="text-sm text-gray-500">{operationInfo.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className="bg-green-500 text-white flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Aprovado
                      </Badge>
                      <Button
                        onClick={() => openStartDialog(request)}
                        disabled={startExecutionMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 transition-transform transform hover:scale-105"
                      >
                        <Play className="h-4 w-4" />
                        Iniciar Execução
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-3 border-t border-gray-200 mt-3">
                    {request.vehicleName && <div><span className="text-gray-500">Veículo:</span><p className="font-medium">{request.vehicleName}</p></div>}
                    {request.clientInfo?.clientName && <div><span className="text-gray-500">Cliente:</span><p className="font-medium">{request.clientInfo.clientName}</p></div>}
                    {request.supplierName && <div><span className="text-gray-500">Fornecedor:</span><p className="font-medium">{request.supplierName}</p></div>}
                    {request.transporterName && <div><span className="text-gray-500">Transportadora:</span><p className="font-medium">{request.transporterName}</p></div>}
                    {request.estimatedArrival && <div><span className="text-gray-500">Estimativa:</span><p className="font-medium">{formatDate(request.estimatedArrival)}</p></div>}
                    <div><span className="text-gray-500">Criado por:</span><p className="font-medium">{request.createdByName}</p></div>
                    <div><span className="text-gray-500">Criado em:</span><p className="font-medium">{formatDate(request.createdAt)}</p></div>
                  </div>
                  {request.notes && (
                    <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                      <p className="text-sm"><strong className="font-medium">Observações:</strong> {request.notes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
