import { DatabaseAdapter, TransactionConnection } from '../types';
/**
 * Default implementation requires the user to provide their own DB adapter
 */
export declare class DefaultDatabaseAdapter implements DatabaseAdapter {
    private db;
    constructor(db: any);
    prepare(sql: string, params: any[]): Promise<any[]>;
    transaction<T>(callback: (conn: TransactionConnection) => Promise<T>): Promise<T>;
}
