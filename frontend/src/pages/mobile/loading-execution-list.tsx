import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Play, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLoadingExecutionStore } from "@/store/loading-execution-store";

interface TransferRequest {
  id: number;
  code: string;
  status: string;
  supplierName?: string;
  transporterName?: string;
  createdAt: string;
}

interface PendingExecution {
  id: number;
  status: string;
  startedAt: string;
  transferRequestId: number;
  transferRequestCode: string;
  operatorName?: string;
}

export default function MobileLoadingExecutionListPage() {
  const queryClient = useQueryClient();
  const store = useLoadingExecutionStore();

  const { data: approvedRequests, isLoading: approvedLoading } = useQuery<TransferRequest[]>({
    queryKey: ['/api/transfer-requests', { status: 'aprovado' }],
    queryFn: async () => (await apiRequest('GET', '/api/transfer-requests?status=aprovado')).json(),
    staleTime: 5000,
  });

  const { data: pendingExecutions, isLoading: pendingLoading } = useQuery<PendingExecution[]>({
    queryKey: ['/api/loading-executions/pending'],
    queryFn: async () => (await apiRequest('GET', '/api/loading-executions/pending')).json(),
    staleTime: 3000,
  });

  const startExecutionMutation = useMutation({
    mutationFn: (transferRequestId: number) => apiRequest('POST', '/api/loading-executions', { transferRequestId }).then(res => res.json()),
    onSuccess: (data, transferRequestId) => {
      queryClient.setQueryData(['/api/loading-executions/pending'], (old: any) => [...(old || []), data]);
      queryClient.setQueryData(['/api/transfer-requests', { status: 'aprovado' }], (old: any) =>
        (old || []).filter((req: TransferRequest) => req.id !== transferRequestId)
      );
      window.location.href = `/loading-execution/${data.id}`;
    }
  });

  return (
    <div className="p-4 space-y-6">
      {/* Pending Executions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Em andamento</h2>
          <Badge variant="secondary">{pendingExecutions?.length ?? 0}</Badge>
        </div>
        <div className="space-y-3">
          {(pendingExecutions || []).map((exe) => (
            <Card key={exe.id} onClick={() => (window.location.href = `/loading-execution/${exe.id}`)} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800">{exe.transferRequestCode}</h3>
                    <p className="text-sm text-gray-600">Operador: {exe.operatorName || '—'}</p>
                    <div className="flex items-center text-xs text-gray-500 mt-1">
                      <Clock className="h-3 w-3 mr-1" /> {new Date(exe.startedAt).toLocaleString()}
                    </div>
                  </div>
                  <Badge>Em andamento</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {!pendingLoading && !pendingExecutions?.length && (
            <Card><CardContent className="p-4 text-sm text-gray-600">Sem execuções pendentes</CardContent></Card>
          )}
        </div>
      </section>

      {/* Approved Requests */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Aprovados para Carregamento</h2>
          <Badge variant="secondary">{approvedRequests?.length ?? 0}</Badge>
        </div>
        <div className="space-y-3">
          {(approvedRequests || []).map((req) => (
            <Card key={req.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800">{req.code}</h3>
                    <p className="text-sm text-gray-600 truncate">{req.supplierName || req.transporterName || 'Pedido de transferência'}</p>
                  </div>
                  <Button 
                    size="sm" 
                    className="ml-3" 
                    disabled={startExecutionMutation.isPending}
                    onClick={() => startExecutionMutation.mutate(req.id)}
                  >
                    {startExecutionMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                    Iniciar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!approvedLoading && !approvedRequests?.length && (
            <Card><CardContent className="p-4 text-sm text-gray-600">Sem pedidos aprovados</CardContent></Card>
          )}
        </div>
      </section>
    </div>
  );
}









