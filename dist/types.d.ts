/**
 * Options for Dynamic Model configuration
 */
export interface DynamicModelOptions {
    /** Whether to use Redis caching */
    useCache?: boolean;
    /** Cache TTL in seconds */
    cacheTTL?: number;
    /** Primary key field name */
    primaryKey?: string;
    /** Default pagination limit */
    defaultLimit?: number;
    /** Maximum pagination limit */
    maxLimit?: number;
    /** Fields that can be used for text search */
    searchableFields?: string[];
    /** Optional custom logger */
    logger?: Logger;
}
/**
 * Logger interface for handling log messages
 */
export interface Logger {
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
}
/**
 * Filter operator types
 */
export type FilterOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'ne' | 'like' | 'ilike';
/**
 * Filter value types
 */
export type FilterValue = string | number | boolean | null | Array<string | number> | {
    [key in FilterOperator]?: string | number | null;
};
/**
 * Filter object type
 */
export interface Filters {
    [key: string]: FilterValue;
}
/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc' | 'ASC' | 'DESC';
/**
 * Sort specification
 */
export interface SortSpec {
    [key: string]: SortDirection;
}
/**
 * Pagination options
 */
export interface PaginationOptions {
    page?: number;
    limit?: number;
}
/**
 * Relation join type
 */
export type JoinType = 'inner' | 'left' | 'right';
/**
 * Relation definition
 */
export interface Relation {
    /** Related table name */
    table: string;
    /** Foreign key field in related table */
    foreignKey: string;
    /** Local key field in main table */
    localKey?: string;
    /** Alias for the relation */
    as?: string;
    /** Join type */
    type?: JoinType | 'many';
    /** Fields to select from relation */
    select?: string[] | string;
    /** Filters for relation */
    filters?: Filters;
}
/**
 * Query options
 */
export interface QueryOptions {
    /** Filter conditions */
    filters?: Filters;
    /** Sort specification */
    sort?: SortSpec | string[] | string;
    /** Fields to select */
    fields?: string[] | string;
    /** Pagination options */
    pagination?: PaginationOptions;
    /** Text search term */
    search?: string;
    /** Relations to join */
    relations?: Relation[];
}
/**
 * Pagination metadata
 */
export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasNext: boolean;
}
/**
 * Query result with pagination
 */
export interface QueryResult<T = any> {
    data: T[];
    pagination: PaginationMeta;
}
/**
 * Database adapter interface
 */
export interface DatabaseAdapter {
    prepare(sql: string, params: any[]): Promise<any[]>;
    transaction<T>(callback: (conn: TransactionConnection) => Promise<T>): Promise<T>;
}
/**
 * Transaction connection
 */
export interface TransactionConnection {
    prepare(sql: string, params: any[]): Promise<any[]>;
}
/**
 * Cache adapter interface
 */
export interface CacheAdapter {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, expireFlag?: string, expireTime?: number): Promise<void>;
    del(key: string | string[]): Promise<void>;
    keys(pattern: string): Promise<string[]>;
}
