
import { useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLoadingExecutionStore } from "@/store/loading-execution-store";
import { LoadingExecutionScreen } from "../components/loading-execution-screen";
import { ExecutionStartDialog } from "../components/execution-start-dialog";
import { LoadingExecutionHeader } from "../components/loading-execution/LoadingExecutionHeader";
import { PendingExecutions } from "../components/loading-execution/PendingExecutions";
import { ApprovedRequests } from "../components/loading-execution/ApprovedRequests";
import { apiRequest } from "@/lib/queryClient";
import ErrorBoundary from "../components/ErrorBoundary";
import { PerformanceMonitor } from "../components/PerformanceMonitor";
import { TransferRequest } from "@/types/api";

const LoadingExecutionPageContent = () => {
  const queryClient = useQueryClient();
  const {
    selectedExecutionId,
    showStartDialog,
    selectedTransferRequest,
    apiError,
    optimisticUpdates,
    setSelectedExecutionId,
    openStartDialog,
    closeStartDialog,
    setApiError,
    addOptimisticUpdate,
    removeOptimisticUpdate,
  } = useLoadingExecutionStore();

  const { data: approvedRequests, isLoading: approvedLoading, error: approvedError, refetch: refetchApproved } = useQuery({
    queryKey: ['/api/transfer-requests', { status: 'aprovado' }],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/transfer-requests?status=aprovado');
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    },
    staleTime: 5000,
  });

  const { data: pendingExecutions, isLoading: pendingLoading, error: pendingError, refetch: refetchPending } = useQuery({
    queryKey: ['/api/loading-executions/pending'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/loading-executions/pending');
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    },
    staleTime: 3000,
  });

  const startExecutionMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/loading-executions', data).then(res => res.json()),
    onMutate: async (variables) => {
      addOptimisticUpdate(variables.transferRequestId);
      await queryClient.cancelQueries({ queryKey: ['/api/transfer-requests'] });
      return { transferRequestId: variables.transferRequestId };
    },
    onSuccess: (data, variables) => {
      removeOptimisticUpdate(variables.transferRequestId);
      queryClient.setQueryData(['/api/loading-executions/pending'], (old: any) => [...(old || []), data]);
      queryClient.setQueryData(['/api/transfer-requests', { status: 'aprovado' }], (old: any) => 
        old ? old.filter((req: any) => req.id !== variables.transferRequestId) : []
      );
      setSelectedExecutionId(data.id);
      closeStartDialog();
    },
    onError: (error, variables) => {
      removeOptimisticUpdate(variables.transferRequestId);
      setApiError(error.message);
    },
  });

  const handleConfirmStart = useCallback((executionData: any) => {
    if (!selectedTransferRequest) return;
    startExecutionMutation.mutate({ ...executionData, transferRequestId: selectedTransferRequest.id });
  }, [selectedTransferRequest, startExecutionMutation]);

  const handleExecutionComplete = useCallback(() => {
    setSelectedExecutionId(null);
    refetchPending();
    refetchApproved();
  }, [queryClient]);

  const filteredApprovedRequests = useMemo(() => {
    if (!approvedRequests) return [];
    return approvedRequests.filter((req: TransferRequest) => !optimisticUpdates.has(req.id));
  }, [approvedRequests, optimisticUpdates]);

  if (selectedExecutionId) {
    return <LoadingExecutionScreen executionId={selectedExecutionId} onExecutionComplete={handleExecutionComplete} />;
  }

  if (showStartDialog && selectedTransferRequest) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-4">
          <Button variant="outline" onClick={closeStartDialog}>
            ← Voltar
          </Button>
        </div>
        <ExecutionStartDialog
          isOpen={true}
          onClose={closeStartDialog}
          transferRequest={selectedTransferRequest}
          onStartExecution={handleConfirmStart}
          isSubmitting={startExecutionMutation.isPending}
          fullPage={true}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <LoadingExecutionHeader />
      
      <PendingExecutions 
        pendingExecutions={pendingExecutions || []} 
        isLoading={pendingLoading}
        error={pendingError as Error | null}
        retry={refetchPending}
        apiError={apiError}
      />

      <ApprovedRequests 
        approvedRequests={filteredApprovedRequests}
        isLoading={approvedLoading}
        error={approvedError as Error | null}
        retry={refetchApproved}
        apiError={apiError}
        startExecutionMutation={startExecutionMutation as any}
      />
    </div>
  );
};

export default function LoadingExecutionPage() {
  return (
    <ErrorBoundary context="Loading Execution Page">
      <LoadingExecutionPageContent />
      <PerformanceMonitor enabled={process.env.NODE_ENV === 'development'} />
    </ErrorBoundary>
  );
}
