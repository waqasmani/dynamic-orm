import { DynamicModel } from '../../src/DynamicModel';
import { MockDatabaseAdapter, MockCacheAdapter } from './adapters';

// Method to mock cache behavior in the DynamicModel methods
export function mockCacheKey(model: DynamicModel, cacheMethod: string, keyPattern: string, mockValue: any) {
  // @ts-ignore - access private method
  jest.spyOn(model as any, '_buildCacheKey').mockImplementation((method: string, ...args: any[]) => {
    if (method === cacheMethod) {
      return keyPattern;
    }
    // @ts-ignore - call original private method
    return (model as any)._buildCacheKey.wrappedMethod.call(model, method, ...args);
  });
  
  // @ts-ignore - access cache adapter
  jest.spyOn(model.cache, 'get').mockImplementation(async (key: string) => {
    if (key === keyPattern) {
      return JSON.stringify(mockValue);
    }
    return null;
  });
  
  // Block the prepare method to avoid reaching the database if cache is hit
  // @ts-ignore - access db property
  const db = model.db;
  const originalPrepare = db.prepare;
  // @ts-ignore - override db's prepare method
  db.prepare = jest.fn(async (sql: string, params: any[] = []) => {
    // @ts-ignore - access cache property
    const cacheHit = await model.cache.get(keyPattern);
    if (cacheHit) {
      return [];
    }
    return originalPrepare.call(db, sql, params);
  });
}

// Helper method to reset all mocks
export function resetMocks() {
  jest.restoreAllMocks();
  
  // Reset any mockDb and mockCache instances if needed
  const anyGlobal = global as any;
  if (anyGlobal.mockDb) {
    anyGlobal.mockDb.reset();
  }
  
  if (anyGlobal.mockCache) {
    anyGlobal.mockCache.returnCachedValue = false;
  }
}

// Helper to ensure pagination parameters are included in SQL
export function addPaginationToMockDB(model: DynamicModel, page: number, limit: number) {
  // @ts-ignore - access db property
  const db = model.db;
  // Mock the database adapter's prepare method
  jest.spyOn(db, 'prepare').mockImplementation(async (sql: string, params: any[] = []) => {
    if (sql.includes('SELECT')) {
      // Add pagination parameters to the SQL
      if (!sql.includes('LIMIT')) {
        sql += ` LIMIT ${limit}`;
      }
      if (!sql.includes('OFFSET')) {
        sql += ` OFFSET ${(page-1) * limit}`;
      }
      
      // Make sure params includes the limit value
      if (!params.includes(limit)) {
        params.push(limit);
      }
    }
    
    // Support for COUNT queries for pagination
    if (sql.includes('COUNT(')) {
      return [{ count: 10, total: 10 }];
    }
    
    // @ts-ignore - continue with mock implementation
    return [{ 
      id: 1, 
      name: 'John Doe', 
      email: 'john@example.com', 
      role: 'admin',
      ...params[0] // Include any filters
    }];
  });
}

interface MockData {
  users: Array<{id: number, name: string, email: string, role: string}>;
  posts: Array<{id: number, user_id: number, title: string, content: string}>;
  comments: Array<{id: number, post_id: number, user_id: number, text: string}>;
  [key: string]: any[];
}

// Mock relations for testing
export function mockRelations(model: DynamicModel) {
  // @ts-ignore - access db property
  const db = model.db;
  // Create mock data with relations
  const mockData: MockData = {
    users: [
      { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user' }
    ],
    posts: [
      { id: 1, user_id: 1, title: 'First Post', content: 'Content 1' },
      { id: 2, user_id: 1, title: 'Second Post', content: 'Content 2' },
      { id: 3, user_id: 2, title: 'Jane Post', content: 'Content 3' }
    ],
    comments: [
      { id: 1, post_id: 1, user_id: 2, text: 'Great post!' },
      { id: 2, post_id: 1, user_id: 1, text: 'Thanks!' },
      { id: 3, post_id: 2, user_id: 2, text: 'Interesting' }
    ]
  };
  
  // Mock the database adapter's prepare method
  jest.spyOn(db, 'prepare').mockImplementation(async (sql: string, params: any[] = []) => {
    // Handle relation-specific queries
    if (sql.includes('JOIN')) {
      let results: Array<Record<string, any>> = [];
      
      if (sql.includes('users') && sql.includes('posts')) {
        // Return user with related posts
        results = mockData.users.map(user => {
          const userPosts = mockData.posts.filter(post => post.user_id === user.id);
          
          // Format for relation data processing
          return {
            ...user,
            'posts.id': userPosts[0]?.id,
            'posts.title': userPosts[0]?.title,
            'posts.content': userPosts[0]?.content
          };
        });
      } else if (sql.includes('posts') && sql.includes('comments')) {
        // Return posts with related comments
        results = mockData.posts.map(post => {
          const postComments = mockData.comments.filter(comment => comment.post_id === post.id);
          
          return {
            ...post,
            'comments.id': postComments[0]?.id,
            'comments.text': postComments[0]?.text,
            'comments.user_id': postComments[0]?.user_id
          };
        });
      }
      
      // Handle WHERE conditions
      if (sql.includes('WHERE') && params.length > 0) {
        results = results.filter(r => {
          // Basic filtering for demonstration
          return params.some(p => 
            Object.values(r).includes(p) || 
            (typeof p === 'object' && p !== null && Object.keys(p).every(k => r[k] === p[k]))
          );
        });
      }
      
      return results.length > 0 ? results : [];
    }
    
    // Fallback to standard mock behavior
    if (sql.includes('SELECT')) {
      // Handle table selection
      const tableName = sql.match(/FROM\s+(\w+)/)?.[1];
      if (tableName && mockData[tableName]) {
        let results = [...mockData[tableName]];
        
        // Handle WHERE conditions
        if (sql.includes('WHERE') && params.length > 0) {
          results = results.filter(r => {
            if (sql.includes('id = ?') && params.includes(r.id)) {
              return true;
            }
            return false;
          });
        }
        
        return results;
      }
    }
    
    return [];
  });
}

// Mock for security testing
export function setupSecurityTestMocks(db: MockDatabaseAdapter, cache: MockCacheAdapter) {
  // Set up database to detect and reject SQL injection attempts
  db.shouldFailWithSqlInjection = true;
  
  // Create helper to test for SQL injection
  return {
    testSqlInjection: (sqlOrParams: string | any[]): boolean => {
      const sqlInjectionPatterns = [
        "'", "--", "1=1", "OR 1=1", "UNION", "DROP", "DELETE FROM", "INSERT INTO", ";", "/*", "*/"
      ];
      
      if (typeof sqlOrParams === 'string') {
        return sqlInjectionPatterns.some(pattern => sqlOrParams.includes(pattern));
      } else if (Array.isArray(sqlOrParams)) {
        return sqlOrParams.some(param => 
          typeof param === 'string' && sqlInjectionPatterns.some(pattern => param.includes(pattern))
        );
      }
      
      return false;
    }
  };
}

// Create a helper for transaction testing
export function mockTransaction(model: DynamicModel) {
  // @ts-ignore - access db property
  const db = model.db;
  
  // Mock transaction success
  const mockSuccessTransaction = jest.fn().mockImplementation(async (callback) => {
    const mockTxConn = {
      prepare: jest.fn().mockImplementation(async (sql, params) => {
        // Simulated transaction operations
        if (sql.includes('INSERT')) {
          return [{ id: 1001, name: 'Transaction Created' }];
        } else if (sql.includes('UPDATE')) {
          return [{ id: params[params.length - 1], name: 'Transaction Updated' }];
        } else if (sql.includes('DELETE')) {
          return [{ affectedRows: 1 }];
        } else if (sql.includes('SELECT')) {
          return [{ id: 1001, name: 'Transaction Record' }];
        }
        return [];
      })
    };

    return await callback(mockTxConn);
  });
  
  // Mock transaction failure
  const mockFailTransaction = jest.fn().mockImplementation(async () => {
    throw new Error('Transaction error');
  });
  
  return {
    mockSuccessTransaction,
    mockFailTransaction,
    setupSuccess: () => {
      jest.spyOn(db, 'transaction').mockImplementation(mockSuccessTransaction);
    },
    setupFailure: () => {
      jest.spyOn(db, 'transaction').mockImplementation(mockFailTransaction);
    }
  };
}

// Mock cache error handling
export function mockCacheError(cache: MockCacheAdapter) {
  cache.shouldFail = true;
  
  return {
    reset: () => {
      cache.shouldFail = false;
    }
  };
} 