"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NullCacheAdapter = exports.RedisCacheAdapter = void 0;
/**
 * Default implementation of cache adapter using Redis
 */
class RedisCacheAdapter {
    constructor(redis) {
        this.redis = redis;
    }
    async get(key) {
        return this.redis.get(key);
    }
    async set(key, value, expireFlag = 'EX', expireTime = 3600) {
        await this.redis.set(key, value, expireFlag, expireTime);
    }
    async del(key) {
        await this.redis.del(key);
    }
    async keys(pattern) {
        return this.redis.keys(pattern);
    }
}
exports.RedisCacheAdapter = RedisCacheAdapter;
/**
 * No-op cache adapter for when caching is disabled
 */
class NullCacheAdapter {
    async get() {
        return null;
    }
    async set() {
        // No-op
    }
    async del() {
        // No-op
    }
    async keys() {
        return [];
    }
}
exports.NullCacheAdapter = NullCacheAdapter;
