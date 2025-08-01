import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebSocketService } from '../../../services/websocket.service';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

// Mock WebSocket Server
class MockWebSocketServer extends EventEmitter {
  clients = new Set<MockWebSocket>();
  
  constructor() {
    super();
  }

  close(callback?: () => void) {
    this.clients.clear();
    if (callback) callback();
  }
}

class MockWebSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  isAlive: boolean = true;
  userId?: number;
  rooms: Set<string> = new Set();

  constructor() {
    super();
  }

  send(data: string) {
    this.emit('message', data);
  }

  ping() {
    // Mock ping method
  }

  terminate() {
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  }
}

// Mock dependencies
vi.mock('ws', () => ({
  default: {
    Server: MockWebSocketServer,
    OPEN: 1,
    CLOSED: 3,
  },
}));

vi.mock('../../../utils/logger');

describe('WebSocketService Unit Tests', () => {
  let service: WebSocketService;
  let mockServer: MockWebSocketServer;
  let mockClient1: MockWebSocket;
  let mockClient2: MockWebSocket;
  let mockClient3: MockWebSocket;

  beforeEach(() => {
    mockServer = new MockWebSocketServer();
    service = new WebSocketService();
    
    // Replace internal server with mock
    (service as any).wss = mockServer;
    (service as any).clients = new Map();
    (service as any).rooms = new Map();

    // Create mock clients
    mockClient1 = new MockWebSocket();
    mockClient1.userId = 1;

    mockClient2 = new MockWebSocket();
    mockClient2.userId = 2;

    mockClient3 = new MockWebSocket();
    mockClient3.userId = 3;

    vi.clearAllMocks();
  });

  afterEach(() => {
    service.close();
    vi.resetAllMocks();
  });

  describe('Client Connection Management', () => {
    it('should add client on connection', () => {
      service.addClient(mockClient1 as any, 1);

      const clients = service.getConnectedUsers();
      expect(clients).toContain(1);
    });

    it('should remove client on disconnection', () => {
      service.addClient(mockClient1 as any, 1);
      service.removeClient(mockClient1 as any);

      const clients = service.getConnectedUsers();
      expect(clients).not.toContain(1);
    });

    it('should handle multiple clients for same user', () => {
      const client1a = new MockWebSocket();
      const client1b = new MockWebSocket();

      service.addClient(client1a as any, 1);
      service.addClient(client1b as any, 1);

      const clients = service.getConnectedUsers();
      expect(clients).toContain(1);
      expect((service as any).clients.get(1)).toHaveLength(2);
    });

    it('should clean up user when all clients disconnect', () => {
      const client1a = new MockWebSocket();
      const client1b = new MockWebSocket();

      service.addClient(client1a as any, 1);
      service.addClient(client1b as any, 1);

      service.removeClient(client1a as any);
      expect(service.getConnectedUsers()).toContain(1);

      service.removeClient(client1b as any);
      expect(service.getConnectedUsers()).not.toContain(1);
    });
  });

  describe('Room Management', () => {
    beforeEach(() => {
      service.addClient(mockClient1 as any, 1);
      service.addClient(mockClient2 as any, 2);
      service.addClient(mockClient3 as any, 3);
    });

    it('should join user to room', () => {
      service.joinRoom(1, 'warehouse-1');

      const rooms = (service as any).rooms;
      expect(rooms.has('warehouse-1')).toBe(true);
      expect(rooms.get('warehouse-1')).toContain(1);
    });

    it('should leave user from room', () => {
      service.joinRoom(1, 'warehouse-1');
      service.leaveRoom(1, 'warehouse-1');

      const rooms = (service as any).rooms;
      expect(rooms.get('warehouse-1')).not.toContain(1);
    });

    it('should handle user joining multiple rooms', () => {
      service.joinRoom(1, 'warehouse-1');
      service.joinRoom(1, 'warehouse-2');

      const rooms = (service as any).rooms;
      expect(rooms.get('warehouse-1')).toContain(1);
      expect(rooms.get('warehouse-2')).toContain(1);
    });

    it('should handle multiple users in same room', () => {
      service.joinRoom(1, 'warehouse-1');
      service.joinRoom(2, 'warehouse-1');
      service.joinRoom(3, 'warehouse-1');

      const rooms = (service as any).rooms;
      const roomUsers = rooms.get('warehouse-1');
      expect(roomUsers).toContain(1);
      expect(roomUsers).toContain(2);
      expect(roomUsers).toContain(3);
    });

    it('should clean up empty rooms', () => {
      service.joinRoom(1, 'warehouse-1');
      service.leaveRoom(1, 'warehouse-1');

      const rooms = (service as any).rooms;
      expect(rooms.has('warehouse-1')).toBe(false);
    });
  });

  describe('Message Broadcasting', () => {
    beforeEach(() => {
      service.addClient(mockClient1 as any, 1);
      service.addClient(mockClient2 as any, 2);
      service.addClient(mockClient3 as any, 3);
    });

    it('should broadcast message to all connected clients', () => {
      const message = { type: 'notification', data: 'System update' };
      const sendSpy1 = vi.spyOn(mockClient1, 'send');
      const sendSpy2 = vi.spyOn(mockClient2, 'send');
      const sendSpy3 = vi.spyOn(mockClient3, 'send');

      service.broadcast(message);

      expect(sendSpy1).toHaveBeenCalledWith(JSON.stringify(message));
      expect(sendSpy2).toHaveBeenCalledWith(JSON.stringify(message));
      expect(sendSpy3).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should broadcast to specific room only', () => {
      service.joinRoom(1, 'warehouse-1');
      service.joinRoom(2, 'warehouse-1');
      // User 3 not in room

      const message = { type: 'room-update', data: 'Warehouse 1 update' };
      const sendSpy1 = vi.spyOn(mockClient1, 'send');
      const sendSpy2 = vi.spyOn(mockClient2, 'send');
      const sendSpy3 = vi.spyOn(mockClient3, 'send');

      service.broadcastToRoom('warehouse-1', message);

      expect(sendSpy1).toHaveBeenCalledWith(JSON.stringify(message));
      expect(sendSpy2).toHaveBeenCalledWith(JSON.stringify(message));
      expect(sendSpy3).not.toHaveBeenCalled();
    });

    it('should send message to specific user', () => {
      const message = { type: 'private', data: 'Personal message' };
      const sendSpy1 = vi.spyOn(mockClient1, 'send');
      const sendSpy2 = vi.spyOn(mockClient2, 'send');

      service.sendToUser(1, message);

      expect(sendSpy1).toHaveBeenCalledWith(JSON.stringify(message));
      expect(sendSpy2).not.toHaveBeenCalled();
    });

    it('should handle sending to disconnected user gracefully', () => {
      mockClient1.readyState = WebSocket.CLOSED;
      
      const message = { type: 'test', data: 'message' };
      
      expect(() => service.sendToUser(1, message)).not.toThrow();
    });

    it('should exclude sender from broadcast', () => {
      const message = { type: 'notification', data: 'Update' };
      const sendSpy1 = vi.spyOn(mockClient1, 'send');
      const sendSpy2 = vi.spyOn(mockClient2, 'send');
      const sendSpy3 = vi.spyOn(mockClient3, 'send');

      service.broadcast(message, [1]); // Exclude user 1

      expect(sendSpy1).not.toHaveBeenCalled();
      expect(sendSpy2).toHaveBeenCalledWith(JSON.stringify(message));
      expect(sendSpy3).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('Real-time Updates', () => {
    beforeEach(() => {
      service.addClient(mockClient1 as any, 1);
      service.addClient(mockClient2 as any, 2);
    });

    it('should send pallet update', () => {
      const palletUpdate = {
        id: 1,
        code: 'PLT001',
        status: 'em_uso',
        location: 'A-01-01',
      };

      const sendSpy1 = vi.spyOn(mockClient1, 'send');

      service.sendPalletUpdate(palletUpdate);

      expect(sendSpy1).toHaveBeenCalledWith(JSON.stringify({
        type: 'pallet_update',
        data: palletUpdate,
        timestamp: expect.any(String),
      }));
    });

    it('should send transfer status update', () => {
      service.joinRoom(1, 'transfers');
      service.joinRoom(2, 'transfers');

      const transferUpdate = {
        id: 123,
        status: 'completed',
        completedAt: new Date().toISOString(),
      };

      const sendSpy1 = vi.spyOn(mockClient1, 'send');
      const sendSpy2 = vi.spyOn(mockClient2, 'send');

      service.sendTransferUpdate(transferUpdate);

      expect(sendSpy1).toHaveBeenCalledWith(JSON.stringify({
        type: 'transfer_update',
        data: transferUpdate,
        timestamp: expect.any(String),
      }));
      expect(sendSpy2).toHaveBeenCalledWith(JSON.stringify({
        type: 'transfer_update',
        data: transferUpdate,
        timestamp: expect.any(String),
      }));
    });

    it('should send warehouse status update', () => {
      const warehouseStatus = {
        totalPallets: 150,
        availablePallets: 45,
        activeTransfers: 12,
        pendingTransfers: 8,
      };

      const sendSpy1 = vi.spyOn(mockClient1, 'send');

      service.sendWarehouseStatus(warehouseStatus);

      expect(sendSpy1).toHaveBeenCalledWith(JSON.stringify({
        type: 'warehouse_status',
        data: warehouseStatus,
        timestamp: expect.any(String),
      }));
    });
  });

  describe('Connection Health and Monitoring', () => {
    beforeEach(() => {
      service.addClient(mockClient1 as any, 1);
      service.addClient(mockClient2 as any, 2);
    });

    it('should track connection health with heartbeat', () => {
      const pingSpy1 = vi.spyOn(mockClient1, 'ping');
      const pingSpy2 = vi.spyOn(mockClient2, 'ping');

      service.sendHeartbeat();

      expect(pingSpy1).toHaveBeenCalled();
      expect(pingSpy2).toHaveBeenCalled();
    });

    it('should remove dead connections', () => {
      mockClient1.isAlive = false;
      mockClient2.isAlive = true;

      const terminateSpy = vi.spyOn(mockClient1, 'terminate');

      service.cleanupDeadConnections();

      expect(terminateSpy).toHaveBeenCalled();
      expect(service.getConnectedUsers()).not.toContain(1);
      expect(service.getConnectedUsers()).toContain(2);
    });

    it('should provide connection statistics', () => {
      service.joinRoom(1, 'warehouse-1');
      service.joinRoom(2, 'warehouse-1');
      service.joinRoom(2, 'warehouse-2');

      const stats = service.getConnectionStats();

      expect(stats.totalConnections).toBe(2);
      expect(stats.totalUsers).toBe(2);
      expect(stats.totalRooms).toBe(2);
      expect(stats.rooms['warehouse-1']).toBe(2);
      expect(stats.rooms['warehouse-2']).toBe(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed message sending gracefully', () => {
      service.addClient(mockClient1 as any, 1);
      
      const malformedMessage: any = {
        circular: {},
      };
      malformedMessage.circular.ref = malformedMessage;

      expect(() => service.sendToUser(1, malformedMessage)).not.toThrow();
    });

    it('should handle client without userId', () => {
      const anonymousClient = new MockWebSocket();
      
      expect(() => service.addClient(anonymousClient as any)).not.toThrow();
    });

    it('should handle room operations for non-existent user', () => {
      expect(() => service.joinRoom(999, 'test-room')).not.toThrow();
      expect(() => service.leaveRoom(999, 'test-room')).not.toThrow();
    });

    it('should handle sending to non-existent room', () => {
      const message = { type: 'test', data: 'test' };
      
      expect(() => service.broadcastToRoom('non-existent-room', message)).not.toThrow();
    });

    it('should handle concurrent connection/disconnection', async () => {
      const clients = Array.from({ length: 10 }, (_, i) => {
        const client = new MockWebSocket();
        client.userId = i + 1;
        return client;
      });

      // Add all clients
      await Promise.all(
        clients.map(client => 
          Promise.resolve(service.addClient(client as any, client.userId!))
        )
      );

      expect(service.getConnectedUsers()).toHaveLength(10);

      // Remove all clients
      await Promise.all(
        clients.map(client => 
          Promise.resolve(service.removeClient(client as any))
        )
      );

      expect(service.getConnectedUsers()).toHaveLength(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large number of concurrent broadcasts', async () => {
      // Add many clients
      const clients = Array.from({ length: 100 }, (_, i) => {
        const client = new MockWebSocket();
        client.userId = i + 1;
        service.addClient(client as any, client.userId);
        return client;
      });

      const message = { type: 'broadcast_test', data: 'test' };
      const start = performance.now();

      service.broadcast(message);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // Should complete within 100ms

      // Verify all clients received the message
      clients.forEach(client => {
        expect(vi.spyOn(client, 'send')).toHaveBeenCalledWith(
          JSON.stringify(message)
        );
      });
    });

    it('should efficiently manage large number of rooms', () => {
      // Create many rooms with few users each
      for (let i = 1; i <= 100; i++) {
        const client = new MockWebSocket();
        client.userId = i;
        service.addClient(client as any, i);
        service.joinRoom(i, `room-${i}`);
      }

      const stats = service.getConnectionStats();
      expect(stats.totalRooms).toBe(100);
      expect(stats.totalUsers).toBe(100);
    });

    it('should handle memory cleanup efficiently', () => {
      // Add and remove many clients
      for (let i = 1; i <= 1000; i++) {
        const client = new MockWebSocket();
        client.userId = i;
        service.addClient(client as any, i);
        service.joinRoom(i, `temp-room-${i % 10}`);
        service.removeClient(client as any);
      }

      const stats = service.getConnectionStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.totalUsers).toBe(0);
      expect(stats.totalRooms).toBe(0);
    });
  });
});