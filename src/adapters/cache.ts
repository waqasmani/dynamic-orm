import { CacheAdapter } from '../types';

/**
 * Default implementation of cache adapter using Redis
 */
export class RedisCacheAdapter implements CacheAdapter {
  private redis: any;

  constructor(redis: any) {
    this.redis = redis;
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, expireFlag = 'EX', expireTime = 3600): Promise<void> {
    await this.redis.set(key, value, expireFlag, expireTime);
  }

  async del(key: string | string[]): Promise<void> {
    await this.redis.del(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }
}

/**
 * No-op cache adapter for when caching is disabled
 */
export class NullCacheAdapter implements CacheAdapter {
  async get(): Promise<null> {
    return null;
  }

  async set(): Promise<void> {
    // No-op
  }

  async del(): Promise<void> {
    // No-op
  }

  async keys(): Promise<string[]> {
    return [];
  }
} 