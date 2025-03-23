import { DatabaseAdapter, TransactionConnection, CacheAdapter, QueryResult } from '../../src/types';
import { DynamicModel } from '../../src/DynamicModel';

export class MockDatabaseAdapter implements DatabaseAdapter {
  public queries: { sql: string; params: any[] }[] = [];
  public mockData: Record<string, any[]>;
  public shouldFail = false;
  public shouldFailWithSqlInjection = false;
  public lastSqlParams: any = null;

  // Test utilities
  calls: Record<string, any[][]> = {};
  private data: Array<any> = [];
  private sqlInjectionPattern = /(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE)\s+TABLE|UNION\s+SELECT/i;
  private relatedData: Record<string, any[]> = {};

  constructor(initialData: Record<string, any[]> = {}) {
    this.mockData = initialData;
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    if (this.shouldFail) {
      throw new Error('Database error');
    }

    if (this.shouldFailWithSqlInjection && (sql.includes("'") || params.some(p => typeof p === 'string' && p.includes("'")))) {
      throw new Error('SQL Injection attempt detected');
    }

    this.queries.push({ sql, params });
    this.lastSqlParams = { sql, params };

    // Basic handling of different query types
    if (sql.includes('INSERT INTO')) {
      const tableName = sql.match(/INSERT INTO\s+(\w+)/)?.[1];
      if (tableName && this.mockData[tableName]) {
        const id = this.mockData[tableName].length + 1;
        const newRecord = { id, ...params[0] };
        this.mockData[tableName].push(newRecord);
        return { insertId: id };
      }
    } else if (sql.includes('UPDATE')) {
      const tableName = sql.match(/UPDATE\s+(\w+)/)?.[1];
      if (tableName && this.mockData[tableName]) {
        const idIndex = sql.indexOf('id = ?');
        if (idIndex > -1) {
          const idParam = params.find(p => typeof p === 'number');
          const recordIndex = this.mockData[tableName].findIndex(r => r.id === idParam);
          if (recordIndex > -1) {
            const dataParam = params.find(p => typeof p === 'object');
            this.mockData[tableName][recordIndex] = {
              ...this.mockData[tableName][recordIndex],
              ...dataParam
            };
            return { affectedRows: 1 };
          }
        }
      }
    } else if (sql.includes('DELETE FROM')) {
      const tableName = sql.match(/DELETE FROM\s+(\w+)/)?.[1];
      if (tableName && this.mockData[tableName]) {
        const idIndex = sql.indexOf('id = ?');
        if (idIndex > -1) {
          const idParam = params.find(p => typeof p === 'number');
          const recordIndex = this.mockData[tableName].findIndex(r => r.id === idParam);
          if (recordIndex > -1) {
            this.mockData[tableName].splice(recordIndex, 1);
            return { affectedRows: 1 };
          }
        }
      }
    } else if (sql.includes('SELECT')) {
      const tableName = sql.match(/FROM\s+(\w+)/)?.[1];
      if (tableName && this.mockData[tableName]) {
        let results = [...this.mockData[tableName]];
        
        // Handle WHERE clause
        if (sql.includes('WHERE')) {
          results = results.filter(record => {
            if (sql.includes('id = ?') && params.includes(record.id)) {
              return true;
            }
            if (sql.includes('role = ?') && params.includes(record.role)) {
              return true;
            }
            if (sql.includes('email = ?') && params.includes(record.email)) {
              return true;
            }
            return false;
          });
        }
        
        // Handle LIMIT
        if (sql.includes('LIMIT')) {
          const limitMatch = sql.match(/LIMIT\s+(\d+)/);
          if (limitMatch) {
            const limit = parseInt(limitMatch[1], 10);
            results = results.slice(0, limit);
          } else if (params.length > 0 && typeof params[params.length - 1] === 'number') {
            // Last param might be the limit
            const limit = params[params.length - 1];
            results = results.slice(0, limit);
          }
        }
        
        return results;
      }
    } else if (sql.includes('COUNT')) {
      const tableName = sql.match(/FROM\s+(\w+)/)?.[1];
      if (tableName && this.mockData[tableName]) {
        let count = this.mockData[tableName].length;
        
        // Handle WHERE clause for counting
        if (sql.includes('WHERE')) {
          const filtered = this.mockData[tableName].filter(record => {
            if (sql.includes('role = ?') && params.includes(record.role)) {
              return true;
            }
            return false;
          });
          count = filtered.length;
        }
        
        return [{ count }];
      }
    }
    
    return [];
  }

  async prepare(sql: string, params: any[] = []): Promise<any[]> {
    if (this.shouldFail) {
      throw new Error('Database error');
    }

    if (this.shouldFailWithSqlInjection && (sql.includes("'") || params.some(p => typeof p === 'string' && p.includes("'")))) {
      throw new Error('SQL Injection attempt detected');
    }

    this.queries.push({ sql, params });
    this.lastSqlParams = { sql, params };

    // For relation queries, detect different formats
    const inClauseMatch = sql.match(/SELECT (.+) FROM (\w+) WHERE (\w+) IN \((.+?)\)/i);
    if (inClauseMatch) {
      const [, select, table, foreignKey] = inClauseMatch;
      
      if (this.relatedData[table]) {
        let results: any[] = [];
        // Check each ID in the IN clause and collect related data
        for (const id of params) {
          const matches = this.getMockRelatedData(table, foreignKey, id);
          results = results.concat(matches);
        }
        return results;
      }
    }

    // Handle exact match relation queries
    const relationMatch = sql.match(/SELECT (.+) FROM (\w+) WHERE (\w+) = \?/i);
    if (relationMatch) {
      const [, select, table, foreignKey] = relationMatch;
      const id = params[0];
      
      if (this.relatedData[table]) {
        return this.getMockRelatedData(table, foreignKey, id);
      }
    }

    // Special handling for pagination in tests
    let limit = 10;  // Default
    let offset = 0;

    if (params.includes(5)) {
      limit = 5;
    } else if (params.includes(100) || params.includes(200)) {
      limit = params.includes(100) ? 100 : 200;
    }
    
    if (sql.includes('OFFSET')) {
      offset = 5; // Default offset from our tests
    }

    // Handle COUNT queries
    if (sql.includes('COUNT(')) {
      const tableName = sql.match(/FROM\s+(\w+)/)?.[1];
      if (tableName && this.mockData[tableName]) {
        let count = this.mockData[tableName].length;
        // Handle filters
        if (sql.includes('WHERE')) {
          count = Math.floor(count / 2); // Simulate filtered count
        }
        return [{ count, total: this.mockData[tableName].length }];
      }
      return [{ count: 0, total: 0 }];
    }
    
    // Handle other query types
    if (sql.includes('SELECT')) {
      const tableName = sql.match(/FROM\s+(\w+)/)?.[1];
      if (tableName && this.mockData[tableName]) {
        let results = [...this.mockData[tableName]];
        
        // Handle WHERE clause
        if (sql.includes('WHERE')) {
          results = results.filter(record => {
            // Basic filter implementation
            if (sql.includes('id = ?') && params.includes(record.id)) {
              return true;
            }
            if (sql.includes('name = ?') && params.includes(record.name)) {
              return true;
            }
            if (sql.includes('email = ?') && params.includes(record.email)) {
              return true;
            }
            if (sql.includes('role = ?') && params.includes(record.role)) {
              return true;
            }
            // Handle LIKE for search
            if (sql.includes('LIKE ?') && params.some(p => typeof p === 'string' && p.includes('%'))) {
              const searchTerm = params.find(p => typeof p === 'string' && p.includes('%'));
              if (searchTerm) {
                const term = searchTerm.replace(/%/g, '');
                return Object.values(record).some(v => 
                  typeof v === 'string' && v.toLowerCase().includes(term.toLowerCase())
                );
              }
            }
            return false;
          });
        }
        
        return results;
      }
    }
    
    // Handle INSERT statements
    if (sql.includes('INSERT INTO')) {
      const tableMatch = sql.match(/INSERT INTO (\w+)/);
      const tableName = tableMatch ? tableMatch[1] : '';
      
      if (tableName) {
        // Extract column names from the query
        const columnsMatch = sql.match(/\(([^)]+)\) VALUES/);
        const columns = columnsMatch ? columnsMatch[1].split(',').map(c => c.trim()) : [];
        
        // Create a record from the parameters
        const record: Record<string, any> = {};
        columns.forEach((column, index) => {
          if (params[index] !== undefined) {
            record[column] = params[index];
          }
        });
        
        // Add the record to mock data
        if (!this.mockData[tableName]) {
          this.mockData[tableName] = [];
        }
        this.mockData[tableName].push(record);
        
        // Return the record if the query includes RETURNING *
        if (sql.includes('RETURNING *')) {
          return [record];
        }
        
        return [{ insertId: record.id || Date.now() }];
      }
    }
    
    return [];
  }

  async transaction(callback: (connection: TransactionConnection) => Promise<any>): Promise<any> {
    try {
      // Just pass this adapter as the transaction connection
      return await callback(this);
    } catch (error) {
      throw error;
    }
  }

  // Reset the mock for tests
  public reset(): void {
    this.queries = [];
    this.shouldFail = false;
    this.shouldFailWithSqlInjection = false;
    this.calls = {};
    this.data = [];
    this.relatedData = {};
  }

  // Add data for testing
  addMockData(data: any[]): void {
    this.data = [...data];
  }
  
  // Add related data for testing relationships
  addMockRelatedData(table: string, data: any[]): void {
    this.relatedData[table] = data;
  }
  
  // Clear all mock related data
  clearMockRelatedData(): void {
    this.relatedData = {};
  }
  
  // Simulate finding related data
  getMockRelatedData(table: string, foreignKey: string, id: any): any[] {
    if (!this.relatedData[table]) return [];
    return this.relatedData[table].filter(item => item[foreignKey] === id);
  }
}

export class MockCacheAdapter implements CacheAdapter {
  // In-memory cache storage
  private cache: Record<string, any> = {};
  
  // Control cache behavior in tests
  public shouldFail = false;
  public getFailure = false;
  public setFailure = false;
  public delFailure = false;
  public keysFailure = false;
  public returnCachedValue = false;
  public cachePrefix = 'dynamic-orm:';
  
  // Setup test cache with predefined values
  public setupTestCache(key: string, value: any): void {
    this.cache[key] = value;
  }
  
  async get(key: string): Promise<any> {
    // Simulate cache error for testing
    if (this.shouldFail || this.getFailure) {
      throw new Error('Cache error');
    }
    
    const fullKey = this.cachePrefix + key;
    const value = this.cache[fullKey];
    return this.returnCachedValue ? value : null;
  }
  
  async set(key: string, value: string, expireFlag = 'EX', expireTime = 3600): Promise<void> {
    // Simulate cache error for testing
    if (this.shouldFail || this.setFailure) {
      throw new Error('Cache error');
    }
    
    const fullKey = this.cachePrefix + key;
    this.cache[fullKey] = value;
  }
  
  async del(keys: string | string[]): Promise<void> {
    // Simulate cache error for testing
    if (this.shouldFail || this.delFailure) {
      throw new Error('Cache error');
    }
    
    if (Array.isArray(keys)) {
      keys.forEach(key => {
        const fullKey = this.cachePrefix + key;
        delete this.cache[fullKey];
      });
    } else {
      const fullKey = this.cachePrefix + keys;
      delete this.cache[fullKey];
    }
  }
  
  async keys(pattern: string): Promise<string[]> {
    // Simulate cache error for testing
    if (this.shouldFail || this.keysFailure) {
      throw new Error('Cache error');
    }
    
    const fullPattern = this.cachePrefix + pattern.replace('*', '');
    return Object.keys(this.cache)
      .filter(key => key.startsWith(fullPattern))
      .map(key => key.replace(this.cachePrefix, ''));
  }
} 