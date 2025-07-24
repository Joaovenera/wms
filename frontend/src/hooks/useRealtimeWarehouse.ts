import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface RealtimeMessage {
  type: string;
  data?: any;
  message?: string;
  timestamp: string;
}

interface RealtimeUpdate {
  type: 'movement_created' | 'ucp_status_changed' | 'position_status_changed' | 'connection';
  data: any;
  timestamp: string;
}

interface UseRealtimeWarehouseOptions {
  enabled?: boolean;
}

export function useRealtimeWarehouse(options: UseRealtimeWarehouseOptions = {}) {
  const { enabled = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<RealtimeUpdate | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const isUnmountedRef = useRef(false);
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = () => {
    // Don't connect if disabled or component is unmounted
    if (!enabled || isUnmountedRef.current) {
      return;
    }

    // Clear any existing connection timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }

    // If there's already an active connection, don't create a new one
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      // Connect to the backend WebSocket server, not the Vite dev server
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const backendPort = window.location.protocol === "https:" ? "5000" : "5000";
      const wsUrl = `${protocol}//${window.location.hostname}:${backendPort}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: RealtimeMessage = JSON.parse(event.data);
          
          setLastUpdate({
            type: message.type as any,
            data: message.data || { message: message.message },
            timestamp: message.timestamp
          });

          // Invalidate relevant queries based on message type
          switch (message.type) {
            case 'movement_created':
              queryClient.invalidateQueries({ queryKey: ['/api/movements'] });
              queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
              queryClient.invalidateQueries({ queryKey: ['/api/ucps'] });
              break;
              
            case 'ucp_status_changed':
              queryClient.invalidateQueries({ queryKey: ['/api/ucps'] });
              queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
              break;
              
            case 'position_status_changed':
              queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
              queryClient.invalidateQueries({ queryKey: ['/api/ucps'] });
              break;
              
            case 'connection':
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        wsRef.current = null;
        
        // Only attempt to reconnect if enabled and component is still mounted
        // Also check if this was an intentional close (code 1000) or an error
        const wasIntentionalClose = event.code === 1000;
        const shouldReconnect = enabled && !isUnmountedRef.current && reconnectAttempts.current < 5 && !wasIntentionalClose;
        
        if (shouldReconnect) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // 1s, 2s, 4s, 8s, 16s
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current && enabled) {
              reconnectAttempts.current++;
              connect();
            }
          }, delay);
        } else if (!enabled || isUnmountedRef.current) {
          // Connection cancelled - component disabled or unmounted
        } else if (wasIntentionalClose) {
          // Connection closed intentionally - no reconnection needed
        } else {
          setConnectionError('Falha ao reconectar. Verifique a conexão.');
        }
      };

      ws.onerror = (error) => {
        // Only log error if the connection wasn't intentionally cancelled
        if (!isUnmountedRef.current && enabled) {
          console.error('WebSocket error:', error);
          setConnectionError('Erro de conexão com o sistema de rastreamento');
        } else {
          // Error suppressed - connection was cancelled
        }
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setConnectionError('Erro ao inicializar conexão');
    }
  };

  const disconnect = () => {
    
    // Clear all timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = undefined;
    }
    
    if (wsRef.current) {
      // Don't try to close if already closed
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close(1000, 'Component unmounted'); // Normal closure
      }
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionError(null);
    reconnectAttempts.current = 0;
  };

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  };

  useEffect(() => {
    isUnmountedRef.current = false;
    
    // Clear any existing connection timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    
    if (enabled) {
      // Debounce connection attempts to prevent rapid connect/disconnect
      connectionTimeoutRef.current = setTimeout(() => {
        if (!isUnmountedRef.current && enabled) {
          connect();
        }
      }, 100); // 100ms delay to allow component to stabilize
    } else {
      disconnect();
    }

    return () => {
      isUnmountedRef.current = true;
      disconnect();
    };
  }, [enabled]);

  return {
    isConnected,
    lastUpdate,
    connectionError,
    connect,
    disconnect,
    sendMessage
  };
}