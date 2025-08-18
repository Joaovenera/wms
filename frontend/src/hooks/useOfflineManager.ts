import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface PendingAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  endpoint: string;
  data?: any;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  timestamp: number;
  retries: number;
  maxRetries: number;
}

interface OfflineData {
  loadingExecutions: any[];
  transferRequests: any[];
  pendingActions: PendingAction[];
  lastSync: number;
}

const STORAGE_KEY = 'wms-offline-data';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

export function useOfflineManager() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  // Load offline data from localStorage
  const loadOfflineData = useCallback((): OfflineData => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading offline data:', error);
    }
    
    return {
      loadingExecutions: [],
      transferRequests: [],
      pendingActions: [],
      lastSync: Date.now()
    };
  }, []);

  // Save offline data to localStorage
  const saveOfflineData = useCallback((data: OfflineData) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving offline data:', error);
    }
  }, []);

  // Initialize offline data
  useEffect(() => {
    const data = loadOfflineData();
    setPendingActions(data.pendingActions);
  }, [loadOfflineData]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('🟢 Connection restored - starting sync');
      syncPendingActions();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('🔴 Connection lost - entering offline mode');
      showOfflineNotification();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Show offline notification
  const showOfflineNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('WMS - Modo Offline', {
        body: 'Você está offline. As ações serão sincronizadas quando a conexão for restaurada.',
        icon: '/icons/icon-192x192.png',
        tag: 'offline-notification'
      });
    }
  };

  // Add action to pending queue
  const addPendingAction = useCallback((action: Omit<PendingAction, 'id' | 'timestamp' | 'retries' | 'maxRetries'>) => {
    const newAction: PendingAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: MAX_RETRIES
    };

    setPendingActions(prev => {
      const updated = [...prev, newAction];
      const data = loadOfflineData();
      saveOfflineData({ ...data, pendingActions: updated });
      return updated;
    });

    console.log('📤 Action queued for offline sync:', newAction);
    return newAction.id;
  }, [loadOfflineData, saveOfflineData]);

  // Remove action from pending queue
  const removePendingAction = useCallback((actionId: string) => {
    setPendingActions(prev => {
      const updated = prev.filter(action => action.id !== actionId);
      const data = loadOfflineData();
      saveOfflineData({ ...data, pendingActions: updated });
      return updated;
    });
  }, [loadOfflineData, saveOfflineData]);

  // Sync pending actions when online
  const syncPendingActions = useCallback(async () => {
    if (!isOnline || isSyncing || pendingActions.length === 0) {
      return;
    }

    setIsSyncing(true);
    console.log(`🔄 Syncing ${pendingActions.length} pending actions...`);

    for (const action of pendingActions) {
      try {
        const response = await fetch(`/api${action.endpoint}`, {
          method: action.method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: action.data ? JSON.stringify(action.data) : undefined,
        });

        if (response.ok) {
          console.log('✅ Action synced successfully:', action.id);
          removePendingAction(action.id);
          
          // Invalidate related queries
          queryClient.invalidateQueries({ 
            queryKey: [action.endpoint.split('?')[0]] 
          });
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('❌ Failed to sync action:', action.id, error);
        
        // Increment retry count
        setPendingActions(prev => prev.map(a => 
          a.id === action.id 
            ? { ...a, retries: a.retries + 1 }
            : a
        ));

        // Remove action if max retries reached
        if (action.retries >= action.maxRetries) {
          console.log('🗑️ Max retries reached, removing action:', action.id);
          removePendingAction(action.id);
        }
      }

      // Small delay between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsSyncing(false);
    console.log('✅ Sync completed');

    // Show success notification if actions were synced
    if (pendingActions.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('WMS - Sincronização Completa', {
        body: 'Todas as ações offline foram sincronizadas com sucesso.',
        icon: '/icons/icon-192x192.png',
        tag: 'sync-notification'
      });
    }
  }, [isOnline, isSyncing, pendingActions, removePendingAction, queryClient]);

  // Cache data for offline use
  const cacheData = useCallback((key: string, data: any) => {
    const offlineData = loadOfflineData();
    
    switch (key) {
      case 'loading-executions':
        offlineData.loadingExecutions = data;
        break;
      case 'transfer-requests':
        offlineData.transferRequests = data;
        break;
    }
    
    offlineData.lastSync = Date.now();
    saveOfflineData(offlineData);
  }, [loadOfflineData, saveOfflineData]);

  // Get cached data
  const getCachedData = useCallback((key: string) => {
    const data = loadOfflineData();
    
    switch (key) {
      case 'loading-executions':
        return data.loadingExecutions;
      case 'transfer-requests':
        return data.transferRequests;
      default:
        return null;
    }
  }, [loadOfflineData]);

  // Clear offline data
  const clearOfflineData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPendingActions([]);
  }, []);

  // Get offline storage info
  const getStorageInfo = useCallback(() => {
    const data = loadOfflineData();
    const storageSize = new Blob([JSON.stringify(data)]).size;
    
    return {
      size: storageSize,
      lastSync: data.lastSync,
      itemCount: data.loadingExecutions.length + data.transferRequests.length,
      pendingActions: data.pendingActions.length
    };
  }, [loadOfflineData]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingActions.length > 0) {
      const timer = setTimeout(() => {
        syncPendingActions();
      }, 1000); // Wait 1 second after coming online
      
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingActions.length, syncPendingActions]);

  // Periodic sync retry
  useEffect(() => {
    if (!isOnline || pendingActions.length === 0) return;

    const interval = setInterval(() => {
      if (!isSyncing) {
        syncPendingActions();
      }
    }, RETRY_DELAY);

    return () => clearInterval(interval);
  }, [isOnline, pendingActions.length, isSyncing, syncPendingActions]);

  return {
    isOnline,
    pendingActions: pendingActions.length,
    isSyncing,
    addPendingAction,
    syncPendingActions,
    cacheData,
    getCachedData,
    clearOfflineData,
    getStorageInfo
  };
}

export default useOfflineManager;