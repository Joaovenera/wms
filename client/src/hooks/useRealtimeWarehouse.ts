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

export function useRealtimeWarehouse() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<RealtimeUpdate | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);

  const connect = () => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: RealtimeMessage = JSON.parse(event.data);
          console.log('Received WebSocket message:', message);
          
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
              console.log('Connection confirmed:', message.message);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < 5) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // 1s, 2s, 4s, 8s, 16s
          console.log(`Attempting to reconnect in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          setConnectionError('Falha ao reconectar. Verifique a conexão.');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Erro de conexão com o sistema de rastreamento');
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setConnectionError('Erro ao inicializar conexão');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
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
    connect();

    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    lastUpdate,
    connectionError,
    connect,
    disconnect,
    sendMessage
  };
}