import { DatabaseAdapter, TransactionConnection } from '../types';

/**
 * Default implementation requires the user to provide their own DB adapter
 */
export class DefaultDatabaseAdapter implements DatabaseAdapter {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async prepare(sql: string, params: any[]): Promise<any[]> {
    if (!this.db || typeof this.db.prepare !== 'function') {
      throw new Error('Database adapter must implement prepare method');
    }
    return this.db.prepare(sql, params);
  }

  async transaction<T>(callback: (conn: TransactionConnection) => Promise<T>): Promise<T> {
    if (!this.db || typeof this.db.transaction !== 'function') {
      throw new Error('Database adapter must implement transaction method');
    }
    return this.db.transaction(callback);
  }
} 