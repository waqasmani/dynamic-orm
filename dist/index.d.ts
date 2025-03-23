import { DynamicModel } from './DynamicModel';
import { DefaultDatabaseAdapter } from './adapters/database';
import { RedisCacheAdapter, NullCacheAdapter } from './adapters/cache';
import * as Types from './types';
/**
 * Create a new DynamicORM instance
 */
export declare function createORM(options: {
    db: any;
    redis?: any;
    useCache?: boolean;
}): {
    /**
     * Create a new model for a specific table
     */
    createModel: (table: string, options?: Types.DynamicModelOptions) => DynamicModel;
};
export { Types };
export { DynamicModel, DefaultDatabaseAdapter, RedisCacheAdapter, NullCacheAdapter };
