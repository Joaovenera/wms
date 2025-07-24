import { createClient } from 'redis';
import logger from '../utils/logger.js';

// Configuração do Redis
const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 10000,
    lazyConnect: true,
  },
  retry_strategy: (options: any) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      logger.error('Redis server refused connection');
      return new Error('Redis server refused connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      logger.error('Redis retry time exhausted');
      return new Error('Redis retry time exhausted');
    }
    if (options.attempt > 10) {
      logger.error('Redis max retry attempts reached');
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
};

// Criar cliente Redis
export const redisClient = createClient(redisConfig);

// Event listeners
redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('error', (err) => {
  logger.error('Redis client error:', err);
});

redisClient.on('end', () => {
  logger.info('Redis client disconnected');
});

redisClient.on('reconnecting', () => {
  logger.info('Redis client reconnecting...');
});

// Função para conectar ao Redis
export async function connectRedis() {
  try {
    await redisClient.connect();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

// Função para desconectar do Redis
export async function disconnectRedis() {
  try {
    await redisClient.quit();
    logger.info('Redis disconnected successfully');
  } catch (error) {
    logger.error('Failed to disconnect from Redis:', error);
  }
}

// Função para verificar se Redis está conectado
export function isRedisConnected() {
  return redisClient.isReady;
}

// Funções utilitárias para cache
export async function setCache(key: string, value: any, ttl?: number): Promise<void> {
  try {
    if (!isRedisConnected()) {
      logger.warn('Redis not connected, skipping cache set');
      return;
    }
    
    const serializedValue = JSON.stringify(value);
    if (ttl) {
      await redisClient.setEx(key, ttl, serializedValue);
    } else {
      await redisClient.set(key, serializedValue);
    }
  } catch (error) {
    logger.error('Error setting cache:', error);
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    if (!isRedisConnected()) {
      logger.warn('Redis not connected, skipping cache get');
      return null;
    }
    
    const value = await redisClient.get(key);
    if (value) {
      return JSON.parse(value) as T;
    }
    return null;
  } catch (error) {
    logger.error('Error getting cache:', error);
    return null;
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    if (!isRedisConnected()) {
      logger.warn('Redis not connected, skipping cache delete');
      return;
    }
    
    await redisClient.del(key);
  } catch (error) {
    logger.error('Error deleting cache:', error);
  }
}

export async function clearCache(): Promise<void> {
  try {
    if (!isRedisConnected()) {
      logger.warn('Redis not connected, skipping cache clear');
      return;
    }
    
    await redisClient.flushDb();
    logger.info('Cache cleared successfully');
  } catch (error) {
    logger.error('Error clearing cache:', error);
  }
}

// Função para obter estatísticas do Redis
export async function getRedisStats() {
  try {
    if (!isRedisConnected()) {
      return null;
    }
    
    const info = await redisClient.info();
    const dbsize = await redisClient.dbSize();

    // Extrai a informação de memória do comando INFO
    const memoryLine = info.split('\r\n').find(line => line.includes('used_memory_human'));
    const memory = memoryLine ? memoryLine.split(':')[1] : 'N/A';
    
    return {
      info: info.split('\r\n').filter(line => line && !line.startsWith('#')),
      memory,
      dbsize,
      connected: isRedisConnected()
    };
  } catch (error) {
    logger.error('Error getting Redis stats:', error);
    return null;
  }
} 