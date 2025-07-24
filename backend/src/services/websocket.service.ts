import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import logger from '../utils/logger.js';

let wss: WebSocketServer;

interface WebSocketMessage {
  type: string;
  payload: any;
}

export const initWebSocket = (server: Server) => {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    logger.info('Client connected to WebSocket');

    ws.on('message', (message: string) => {
      try {
        const parsedMessage: WebSocketMessage = JSON.parse(message);
        logger.info('Received message from client:', parsedMessage);
        // Handle incoming messages if needed
      } catch (error) {
        logger.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      logger.info('Client disconnected from WebSocket');
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });
  });

  logger.info('WebSocket server initialized');
};

export const broadcast = (message: object) => {
  if (!wss) {
    logger.warn('WebSocket server not initialized. Cannot broadcast message.');
    return;
  }

  const serializedMessage = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serializedMessage);
    }
  });
};