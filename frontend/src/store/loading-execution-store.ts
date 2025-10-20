
import { create } from 'zustand';
import { LoadingItem, TransferRequest, LoadingExecution } from '@/types/api';

interface LoadingExecutionState {
  selectedExecutionId: number | null;
  showStartDialog: boolean;
  selectedTransferRequest: TransferRequest | null;
  apiError: string | null;
  optimisticUpdates: Set<number>;
  
  // New state for the execution screen
  showScanner: boolean;
  showDivergenceDialog: boolean;
  showQuantityDialog: boolean;
  selectedItem: LoadingItem | null;
  scanQuantity: number;
  divergenceReason: string;
  divergenceComments: string;
  finishObservations: string;
  showFinishDialog: boolean;

  // Actions
  setSelectedExecutionId: (id: number | null) => void;
  openStartDialog: (request: TransferRequest) => void;
  closeStartDialog: () => void;
  setApiError: (error: string | null) => void;
  addOptimisticUpdate: (id: number) => void;
  removeOptimisticUpdate: (id: number) => void;

  // Execution screen actions
  openScanner: () => void;
  closeScanner: () => void;
  openDivergenceDialog: (item: LoadingItem) => void;
  closeDivergenceDialog: () => void;
  openQuantityDialog: (item: LoadingItem, quantity: number) => void;
  closeQuantityDialog: () => void;
  setScanQuantity: (quantity: number) => void;
  setDivergenceReason: (reason: string) => void;
  setDivergenceComments: (comments: string) => void;
  openFinishDialog: () => void;
  closeFinishDialog: () => void;
  setFinishObservations: (observations: string) => void;
  resetExecutionScreenState: () => void;
}

export const useLoadingExecutionStore = create<LoadingExecutionState>((set) => ({
  // Initial state from the page
  selectedExecutionId: null,
  showStartDialog: false,
  selectedTransferRequest: null,
  apiError: null,
  optimisticUpdates: new Set(),

  // Initial state for the execution screen
  showScanner: false,
  showDivergenceDialog: false,
  showQuantityDialog: false,
  selectedItem: null,
  scanQuantity: 0,
  divergenceReason: '',
  divergenceComments: '',
  finishObservations: '',
  showFinishDialog: false,

  // Actions from the page
  setSelectedExecutionId: (id) => set({ selectedExecutionId: id }),
  openStartDialog: (request) => set({ showStartDialog: true, selectedTransferRequest: request }),
  closeStartDialog: () => set({ showStartDialog: false, selectedTransferRequest: null }),
  setApiError: (error) => set({ apiError: error }),
  addOptimisticUpdate: (id) => set((state) => ({ optimisticUpdates: new Set(state.optimisticUpdates).add(id) })),
  removeOptimisticUpdate: (id) => set((state) => {
    const newSet = new Set(state.optimisticUpdates);
    newSet.delete(id);
    return { optimisticUpdates: newSet };
  }),

  // Actions for the execution screen
  openScanner: () => set({ showScanner: true }),
  closeScanner: () => set({ showScanner: false }),
  openDivergenceDialog: (item) => set({ showDivergenceDialog: true, selectedItem: item }),
  closeDivergenceDialog: () => set({ showDivergenceDialog: false, selectedItem: null, divergenceReason: '', divergenceComments: '' }),
  openQuantityDialog: (item, quantity) => set({ showQuantityDialog: true, selectedItem: item, scanQuantity: quantity }),
  closeQuantityDialog: () => set({ showQuantityDialog: false, selectedItem: null, scanQuantity: 0 }),
  setScanQuantity: (quantity) => set({ scanQuantity: quantity }),
  setDivergenceReason: (reason) => set({ divergenceReason: reason }),
  setDivergenceComments: (comments) => set({ divergenceComments: comments }),
  openFinishDialog: () => set({ showFinishDialog: true }),
  closeFinishDialog: () => set({ showFinishDialog: false, finishObservations: '' }),
  setFinishObservations: (observations) => set({ finishObservations: observations }),
  resetExecutionScreenState: () => set({
    showScanner: false,
    showDivergenceDialog: false,
    showQuantityDialog: false,
    selectedItem: null,
    scanQuantity: 0,
    divergenceReason: '',
    divergenceComments: '',
    finishObservations: '',
    showFinishDialog: false,
  }),
}));
