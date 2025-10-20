
import { useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import ErrorBoundary from "./ErrorBoundary";
import { LoadingExecutionSkeleton } from "./LoadingExecutionSkeleton";
import { useLoadingExecutionStore } from "@/store/loading-execution-store";
import { LoadingExecutionScreenHeader } from "./loading-execution-screen/LoadingExecutionScreenHeader";
import { LoadingExecutionScreenStats } from "./loading-execution-screen/LoadingExecutionScreenStats";
import { LoadingExecutionScreenActions } from "./loading-execution-screen/LoadingExecutionScreenActions";
import { LoadingExecutionScreenItems } from "./loading-execution-screen/LoadingExecutionScreenItems";
import { QuantityDialog } from "./loading-execution-screen/QuantityDialog";
import { DivergenceDialog } from "./loading-execution-screen/DivergenceDialog";
import { FinishDialog } from "./loading-execution-screen/FinishDialog";
import QrScanner from "./qr-scanner";

interface LoadingExecutionScreenProps {
  executionId: number;
  onExecutionComplete: () => void;
}

const LoadingExecutionScreenContent = ({ executionId, onExecutionComplete }: LoadingExecutionScreenProps) => {
  const queryClient = useQueryClient();
  const store = useLoadingExecutionStore();

  const { data: execution, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/loading-executions', executionId],
    queryFn: () => apiRequest('GET', `/api/loading-executions/${executionId}`).then(res => res.json()),
    enabled: !!executionId,
  });

  const scanItemMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', `/api/loading-executions/${executionId}/scan-item`, data),
    onSuccess: () => { store.closeQuantityDialog(); refetch(); },
  });

  const registerDivergenceMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PUT', `/api/loading-executions/${executionId}/items/${store.selectedItem?.id}/divergence`, data),
    onSuccess: () => { store.closeDivergenceDialog(); refetch(); },
  });

  const finishExecutionMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PUT', `/api/loading-executions/${executionId}/finish`, data),
    onSuccess: () => { store.closeFinishDialog(); onExecutionComplete(); },
  });

  const handleScan = useCallback((scannedCode: string) => {
    const item = execution?.items.find((i: any) => i.productSku === scannedCode);
    if (item) store.openQuantityDialog(item, parseFloat(item.requestedQuantity));
    store.closeScanner();
  }, [execution, store]);

  const completionStats = useMemo(() => {
    if (!execution?.items) return { completed: 0, total: 0, percentage: 0 };
    const total = execution.items.length;
    const completed = execution.items.filter((item: any) => item.confirmedAt).length;
    return { completed, total, percentage: total > 0 ? (completed / total) * 100 : 0 };
  }, [execution]);

  if (isLoading) return <LoadingExecutionSkeleton type="detail" count={5} />;
  if (error) return <div>Error loading execution details.</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <LoadingExecutionScreenHeader 
            transferRequestCode={execution.transferRequestCode} 
            operatorName={execution.operatorName} 
            status={execution.status} 
          />
        </CardHeader>
        <CardContent>
          <LoadingExecutionScreenStats {...completionStats} />
        </CardContent>
      </Card>

      {execution.status === 'em_andamento' && (
        <Card>
          <CardContent className="pt-6">
            <LoadingExecutionScreenActions 
              onScan={store.openScanner}
              onFinish={store.openFinishDialog}
              onRefresh={refetch}
              canFinish={completionStats.completed === completionStats.total}
              isFinishing={finishExecutionMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      <LoadingExecutionScreenItems 
        items={execution.items || []} 
        onItemClick={(item) => store.openQuantityDialog(item, parseFloat(item.requestedQuantity))} 
      />

      {store.showScanner && <QrScanner onScan={handleScan} onClose={store.closeScanner} />}
      
      <QuantityDialog 
        isOpen={store.showQuantityDialog}
        onClose={store.closeQuantityDialog}
        item={store.selectedItem}
        quantity={store.scanQuantity}
        setQuantity={store.setScanQuantity}
        onSubmit={() => scanItemMutation.mutate({ productId: store.selectedItem?.productId, quantity: store.scanQuantity.toString() })}
        isSubmitting={scanItemMutation.isPending}
      />

      <DivergenceDialog
        isOpen={store.showDivergenceDialog}
        onClose={store.closeDivergenceDialog}
        item={store.selectedItem}
        reason={store.divergenceReason}
        setReason={store.setDivergenceReason}
        comments={store.divergenceComments}
        setComments={store.setDivergenceComments}
        onSubmit={() => registerDivergenceMutation.mutate({ divergenceReason: store.divergenceReason, divergenceComments: store.divergenceComments })}
        isSubmitting={registerDivergenceMutation.isPending}
      />

      <FinishDialog
        isOpen={store.showFinishDialog}
        onClose={store.closeFinishDialog}
        observations={store.finishObservations}
        setObservations={store.setFinishObservations}
        onSubmit={() => finishExecutionMutation.mutate({ observations: store.finishObservations })}
        isSubmitting={finishExecutionMutation.isPending}
      />
    </div>
  );
};

export function LoadingExecutionScreen({ executionId, onExecutionComplete }: LoadingExecutionScreenProps) {
  return (
    <ErrorBoundary context="Loading Execution Screen">
      <LoadingExecutionScreenContent executionId={executionId} onExecutionComplete={onExecutionComplete} />
    </ErrorBoundary>
  );
}

export default LoadingExecutionScreen;
