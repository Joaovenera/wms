import Redis from 'ioredis';

export class RedisTestHelper {
  private client: Redis | null = null;
  private testRedisUrl: string;

  constructor() {
    this.testRedisUrl = process.env.REDIS_URL || 'redis://localhost:6379/1';
  }

  async initialize(): Promise<void> {
    try {
      this.client = new Redis(this.testRedisUrl, {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });

      // Test the connection
      await this.client.ping();
      console.log('✅ Test Redis initialized');
    } catch (error) {
      console.error('❌ Failed to initialize test Redis:', error);
      // Don't throw error - Redis might not be available in CI
      console.warn('⚠️ Redis not available, tests will run without cache');
    }
  }

  async flushAll(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.flushdb();
    } catch (error) {
      console.error('❌ Failed to flush test Redis:', error);
    }
  }

  async cleanup(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
        console.log('✅ Test Redis connection closed');
      } catch (error) {
        console.error('❌ Failed to cleanup test Redis:', error);
      }
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      console.error('❌ Failed to set Redis key:', error);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) {
      return null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      console.error('❌ Failed to get Redis key:', error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      console.error('❌ Failed to delete Redis key:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('❌ Failed to check Redis key existence:', error);
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client) {
      return [];
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('❌ Failed to get Redis keys:', error);
      return [];
    }
  }
}