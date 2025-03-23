import { CacheAdapter } from '../types';
/**
 * Default implementation of cache adapter using Redis
 */
export declare class RedisCacheAdapter implements CacheAdapter {
    private redis;
    constructor(redis: any);
    get(key: string): Promise<string | null>;
    set(key: string, value: string, expireFlag?: string, expireTime?: number): Promise<void>;
    del(key: string | string[]): Promise<void>;
    keys(pattern: string): Promise<string[]>;
}
/**
 * No-op cache adapter for when caching is disabled
 */
export declare class NullCacheAdapter implements CacheAdapter {
    get(): Promise<null>;
    set(): Promise<void>;
    del(): Promise<void>;
    keys(): Promise<string[]>;
}
