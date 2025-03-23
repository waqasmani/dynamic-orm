import { DynamicModel } from './DynamicModel';
import { DefaultDatabaseAdapter } from './adapters/database';
import { RedisCacheAdapter, NullCacheAdapter } from './adapters/cache';
import * as Types from './types';

/**
 * Create a new DynamicORM instance
 */
export function createORM(options: {
  db: any; 
  redis?: any;
  useCache?: boolean;
}) {
  const { db, redis, useCache = false } = options;
  
  if (!db) {
    throw new Error('Database adapter is required');
  }
  
  // Create the database adapter
  const dbAdapter = new DefaultDatabaseAdapter(db);
  
  // Create the cache adapter
  const cacheAdapter = useCache && redis
    ? new RedisCacheAdapter(redis)
    : new NullCacheAdapter();
  
  // Return a factory function to create models
  return {
    /**
     * Create a new model for a specific table
     */
    createModel: (table: string, options: Types.DynamicModelOptions = {}) => {
      return new DynamicModel(
        table, 
        { ...options, useCache },
        dbAdapter,
        cacheAdapter
      );
    }
  };
}

// Re-export types
export { Types };

// Export model and adapters classes for advanced use cases
export { 
  DynamicModel,
  DefaultDatabaseAdapter,
  RedisCacheAdapter,
  NullCacheAdapter
}; 