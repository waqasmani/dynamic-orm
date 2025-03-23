import { DynamicModelOptions, Filters, QueryOptions, QueryResult, CacheAdapter, DatabaseAdapter } from './types';
/**
 * Enhanced Dynamic Model for database operations
 * Provides a flexible and powerful abstraction over database tables
 */
export declare class DynamicModel {
    private table;
    private useCache;
    private cacheTTL;
    private primaryKey;
    private defaultLimit;
    private maxLimit;
    private searchableFields;
    private db;
    private cache;
    /**
     * Create a new Dynamic Model instance
     * @param table - Database table name
     * @param options - Configuration options
     * @param db - Database adapter
     * @param cache - Cache adapter
     */
    constructor(table: string, options: DynamicModelOptions | undefined, db: DatabaseAdapter, cache: CacheAdapter);
    /**
     * Find records with filtering, pagination, sorting and field selection
     */
    findAll(options?: QueryOptions): Promise<QueryResult>;
    getAll(options?: QueryOptions): Promise<QueryResult>;
    /**
     * Process query results to organize related data
     * @private
     */
    private _processRelatedData;
    /**
     * Find a record by its primary key
     */
    findById(id: string | number, fields?: string[] | string): Promise<any | null>;
    /**
     * Find a record by a specific field value
     */
    findByField(field: string, value: any, fields?: string[] | string): Promise<any | null>;
    /**
     * Create a new record
     */
    create(data: Record<string, any>, returnRecord?: boolean): Promise<any>;
    /**
     * Update a record by ID
     */
    update(id: string | number, data: Record<string, any>, returnRecord?: boolean): Promise<any>;
    /**
     * Delete a record by ID
     */
    delete(id: string | number, returnRecord?: boolean): Promise<any>;
    /**
     * Count records matching filters
     */
    count(filters?: Filters): Promise<number>;
    /**
     * Execute multiple operations in a transaction
     */
    withTransaction<T>(callback: (txModel: any) => Promise<T>): Promise<T>;
    /**
     * Execute a custom query
     */
    executeQuery(sql: string, params?: any[]): Promise<any[]>;
    /**
     * Invalidate all cache for this table
     */
    invalidateTableCache(): Promise<void>;
    /**
     * Build a cache key for an operation
     * @private
     */
    private _buildCacheKey;
    /**
     * Build field selection clause
     * @private
     */
    private _buildSelectClause;
}
