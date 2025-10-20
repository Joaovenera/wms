
import { Clock, Play, Package, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingExecutionSkeleton } from "@/components/LoadingExecutionSkeleton";
import RetryComponent, { useRetry, retryPresets } from "@/components/RetryMechanism";
import { useLoadingExecutionStore } from '@/store/loading-execution-store';
import { LoadingExecution } from '@/types/api';

interface PendingExecutionsProps {
  pendingExecutions: LoadingExecution[];
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
  apiError: string | null;
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export const PendingExecutions = ({ pendingExecutions, isLoading, error, retry, apiError }: PendingExecutionsProps) => {
  const setSelectedExecutionId = useLoadingExecutionStore((state) => state.setSelectedExecutionId);
  const retryPendingExecutions = useRetry(retry, retryPresets.network);

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold text-gray-700">
          <Clock className="h-6 w-6 text-blue-500" />
          Execuções em Andamento
        </CardTitle>
        <CardDescription>
          Operações que estão sendo executadas no momento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingExecutionSkeleton type="list" count={2} />
        ) : error ? (
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
          <div className="text-center py-10 bg-gray-50 rounded-lg">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Nenhuma execução em andamento</p>
            <p className="text-sm text-gray-500 mt-1">Quando uma operação for iniciada, ela aparecerá aqui.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingExecutions.map((execution) => (
              <div key={execution.id} className="border rounded-lg p-4 bg-blue-50 hover:bg-blue-100 transition-colors duration-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg text-blue-800">
                      {execution.transferRequestCode}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Operador: {execution.operatorName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-blue-500 text-white flex items-center gap-1">
                      <Play className="h-3 w-3" />
                      Em Andamento
                    </Badge>
                    <Button
                      onClick={() => setSelectedExecutionId(execution.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-transform transform hover:scale-105"
                    >
                      <Package className="h-4 w-4" />
                      Continuar
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-gray-600 border-t border-blue-200 pt-2 mt-2">
                  <p>Iniciado em: {formatDate(execution.startedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
