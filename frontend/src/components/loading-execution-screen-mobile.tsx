
import { useMemo, useCallback, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useLoadingExecutionStore } from "@/store/loading-execution-store";
import { MobileLoadingExecutionHeader } from "./loading-execution-screen-mobile/MobileLoadingExecutionHeader";
import { MobileLoadingExecutionStats } from "./loading-execution-screen-mobile/MobileLoadingExecutionStats";
import { MobileLoadingExecutionActions } from "./loading-execution-screen-mobile/MobileLoadingExecutionActions";
import { MobileLoadingExecutionItems } from "./loading-execution-screen-mobile/MobileLoadingExecutionItems";
import { QuantityDialog } from "./loading-execution-screen/QuantityDialog";
import { DivergenceDialog } from "./loading-execution-screen/DivergenceDialog";
import { FinishDialog } from "./loading-execution-screen/FinishDialog";
import QrScanner from "./qr-scanner";

interface LoadingExecutionScreenMobileProps {
  executionId: number;
  onExecutionComplete: () => void;
}

export function LoadingExecutionScreenMobile({ executionId, onExecutionComplete }: LoadingExecutionScreenMobileProps) {
  const store = useLoadingExecutionStore();
  const [query, setQuery] = useState("");

  const { data: execution, isLoading, refetch } = useQuery({
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

  const filteredItems = useMemo(() => {
    if (!execution?.items) return [];
    if (!query.trim()) return execution.items;
    const q = query.trim().toLowerCase();
    return execution.items.filter((i: any) =>
      (i.productName?.toLowerCase().includes(q)) ||
      (i.productSku?.toLowerCase().includes(q))
    );
  }, [execution, query]);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <MobileLoadingExecutionHeader 
            transferRequestCode={execution.transferRequestCode} 
            operatorName={execution.operatorName} 
            status={execution.status} 
          />
          <MobileLoadingExecutionStats {...completionStats} />
        </CardContent>
      </Card>

      {execution.status === 'em_andamento' && (
        <MobileLoadingExecutionActions 
          onScan={store.openScanner}
          onFinish={store.openFinishDialog}
          canFinish={completionStats.completed === completionStats.total}
          isFinishing={finishExecutionMutation.isPending}
        />
      )}

      {/* Search Bar */}
      <Card>
        <CardContent className="p-3">
          <input
            type="text"
            placeholder="Buscar por nome ou SKU..."
            className="w-full px-3 py-2 border rounded-md"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </CardContent>
      </Card>

      <MobileLoadingExecutionItems 
        items={filteredItems} 
        onTap={(item) => store.openQuantityDialog(item, parseFloat(item.requestedQuantity))} 
        onLongPress={(item) => store.openDivergenceDialog(item)}
        executionStatus={execution.status}
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
}

export default LoadingExecutionScreenMobile;
