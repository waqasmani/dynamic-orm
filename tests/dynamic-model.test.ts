import { DynamicModel } from '../src/DynamicModel';
import { MockDatabaseAdapter, MockCacheAdapter } from './mocks/adapters';
import { mockCacheKey, resetMocks, addPaginationToMockDB, mockRelations, setupSecurityTestMocks, mockTransaction, mockCacheError } from './mocks/jest-mocks';

// Store the original console.error
const originalConsoleError = console.error;

// Replace console.error with a no-op function for tests
console.error = jest.fn();

// Restore console.error after all tests
afterAll(() => {
  console.error = originalConsoleError;
});

describe('DynamicModel', () => {
  let mockDb: MockDatabaseAdapter;
  let mockCache: MockCacheAdapter;
  let model: DynamicModel;
  const TABLE_NAME = 'users';
  
  beforeEach(() => {
    // Reset all Jest mocks
    resetMocks();
    
    // Reset and recreate mocks for each test
    mockDb = new MockDatabaseAdapter();
    mockCache = new MockCacheAdapter();
    
    // Set cache behavior for tests
    mockCache.returnCachedValue = false; // Default to not using cache
    
    // Create model with mocks
    model = new DynamicModel(
      TABLE_NAME,
      {
        useCache: true,
        cacheTTL: 3600,
        primaryKey: 'id',
        defaultLimit: 10,
        maxLimit: 100,
        searchableFields: ['name', 'email']
      },
      mockDb,
      mockCache
    );
    
    // Clear any previous test state
    jest.clearAllMocks();
    mockDb.reset();
  });

  afterEach(() => {
    // Clean up mocks
    resetMocks();
  });

  // Helper to set up cached responses for tests
  function setupCachedResponse(key: string, data: any) {
    mockCache.returnCachedValue = true;
    mockCache.setupTestCache(`${mockCache.cachePrefix}${key}`, JSON.stringify(data));
  }

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      const defaultModel = new DynamicModel(
        TABLE_NAME,
        {},
        mockDb,
        mockCache
      );

      // Test a method to verify it works with default options
      return defaultModel.count();
    });
  });

  describe('findAll', () => {
    test('should retrieve all records without options', async () => {
      await model.findAll();
      
      expect(mockDb.queries.length).toBeGreaterThanOrEqual(1);
      expect(mockDb.queries[0].sql).toContain('SELECT');
      expect(mockDb.queries[0].sql).toContain('FROM users');
    });

    test('should use cache when available', async () => {
      // Setup cached response with exact match to what we're testing
      const cachedResult = {
        data: [
          { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
          { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'user' }
        ],
        pagination: { total: 3, page: 1, limit: 10, pages: 1, hasNext: false }
      };
      
      // Use our mock helper to make this test work correctly
      mockCacheKey(model, 'findAll', 'users:findAll:', cachedResult);
      
      const result = await model.findAll();
      
      expect(result).toEqual(cachedResult);
      expect(mockDb.queries.length).toBe(0); // Should not hit database
    });

    test('should apply filters', async () => {
      await model.findAll({ filters: { role: 'admin' } });
      
      const sql = mockDb.queries[0].sql;
      const params = mockDb.queries[0].params || [];
      
      expect(sql).toContain('WHERE');
      expect(params).toContain('admin');
    });

    test('should handle null filter values', async () => {
      await model.findAll({ filters: { role: null } });
      
      const sql = mockDb.queries[0].sql;
      
      expect(sql).toContain('WHERE');
      expect(sql).toContain('IS NULL');
    });

    test('should handle array filter values', async () => {
      await model.findAll({ filters: { role: ['admin', 'user'] } });
      
      const sql = mockDb.queries[0].sql;
      const params = mockDb.queries[0].params || [];
      
      expect(sql).toContain('WHERE');
      expect(sql).toContain('IN');
      expect(params).toContain('admin');
      expect(params).toContain('user');
    });

    test('should handle empty array filter values', async () => {
      await model.findAll({ filters: { role: [] } });
      
      const sql = mockDb.queries[0].sql;
      
      expect(sql).toContain('WHERE');
      expect(sql).toContain('FALSE');
    });

    test('should handle object filter values with operators', async () => {
      await model.findAll({ 
        filters: { 
          id: { gt: 1 },
          name: { like: 'John' },
          role: { ne: null }
        } 
      });
      
      const sql = mockDb.queries[0].sql;
      const params = mockDb.queries[0].params || [];
      
      expect(sql).toContain('WHERE');
      expect(sql).toContain('>');
      expect(sql).toContain('LIKE');
      expect(sql).toContain('IS NOT NULL');
      expect(params).toContain(1);
      expect(params).toContain('John');
    });

    test('should apply sorting with string', async () => {
      await model.findAll({ sort: 'name' });
      
      const sql = mockDb.queries[0].sql;
      
      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('name');
      expect(sql).toContain('ASC');
    });

    test('should apply descending sorting with string', async () => {
      await model.findAll({ sort: '-name' });
      
      const sql = mockDb.queries[0].sql;
      
      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('name');
      expect(sql).toContain('DESC');
    });

    test('should apply sorting with array', async () => {
      await model.findAll({ sort: ['name', '-role'] });
      
      const sql = mockDb.queries[0].sql;
      
      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('name ASC');
      expect(sql).toContain('role DESC');
    });

    test('should apply sorting with object', async () => {
      await model.findAll({ sort: { name: 'asc', role: 'desc' } });
      
      const sql = mockDb.queries[0].sql;
      
      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('name ASC');
      expect(sql).toContain('role DESC');
    });

    test('should apply pagination', async () => {
      // Use our helper to ensure pagination parameters are included
      addPaginationToMockDB(model, 2, 5);
      
      await model.findAll({ pagination: { page: 2, limit: 5 } });
      
      // We're mocking the database adapter's prepare method
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    test('should respect max limit', async () => {
      // Use our helper to ensure pagination parameters are included
      addPaginationToMockDB(model, 1, 100);
      
      await model.findAll({ pagination: { limit: 200 } }); // Max is 100
      
      // We're mocking the database adapter's prepare method
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    test('should apply search term', async () => {
      await model.findAll({ search: 'john' });
      
      const sql = mockDb.queries[0].sql;
      const params = mockDb.queries[0].params || [];
      
      // Check for LIKE or params containing the search term
      expect(sql.includes('LIKE') || params.some(p => p && p.includes && p.includes('%john%'))).toBeTruthy();
    });

    test('should work with field selection array', async () => {
      await model.findAll({ fields: ['name', 'email'] });
      
      const sql = mockDb.queries[0].sql;
      
      expect(sql).toContain('SELECT');
      expect(sql).toContain('name');
      expect(sql).toContain('email');
      expect(sql).not.toContain('role');
    });

    test('should work with field selection string', async () => {
      await model.findAll({ fields: 'name, email' });
      
      const sql = mockDb.queries[0].sql;
      
      expect(sql).toContain('SELECT');
      expect(sql).toContain('name');
      expect(sql).toContain('email');
    });

    test('should handle relations', async () => {
      // Setup mock for relations
      mockRelations(model);
      
      const result = await model.findAll({
        relations: [
          { table: 'posts', foreignKey: 'user_id', localKey: 'id' }
        ]
      });
      
      // We're testing that relations are handled correctly
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('posts');
    });

    test('should handle relations with type many', async () => {
      // Setup mock for relations
      mockRelations(model);
      
      const result = await model.findAll({
        relations: [
          { table: 'posts', foreignKey: 'user_id', localKey: 'id', type: 'many' }
        ]
      });
      
      // We're testing that relations are handled correctly
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('posts');
      expect(Array.isArray(result.data[0].posts)).toBeTruthy();
    });

    test('should handle relations with specific fields', async () => {
      // Setup mock for relations
      mockRelations(model);
      
      const result = await model.findAll({
        relations: [
          { 
            table: 'posts', 
            foreignKey: 'user_id', 
            localKey: 'id',
            select: ['title', 'content']
          }
        ]
      });
      
      // We're testing that relations are handled correctly
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('posts');
    });

    test('should handle legacy call format', async () => {
      // Legacy format: filters directly as parameter
      await model.findAll({ role: 'admin' } as any);
      
      const sql = mockDb.queries[0].sql;
      const params = mockDb.queries[0].params || [];
      
      expect(sql).toContain('WHERE');
      expect(params).toContain('admin');
    });

    test('should handle database errors', async () => {
      mockDb.shouldFail = true;
      
      await expect(model.findAll()).rejects.toThrow('Database error');
    });

    test('should process related data correctly', async () => {
      // Setup mock for relations
      mockRelations(model);
      
      const result = await model.findAll({
        relations: [
          { table: 'posts', foreignKey: 'user_id', localKey: 'id', type: 'many' }
        ]
      });
      
      // The _processRelatedData method should have set up the nested posts property
      expect(result.data[0]).toHaveProperty('posts');
    });

    test('should handle cache errors in findAll', async () => {
      // Create a model with a failing cache adapter
      const errorCache = new MockCacheAdapter();
      errorCache.shouldFail = true;
      
      const errorModel = new DynamicModel(
        TABLE_NAME,
        {
          useCache: true,
          cacheTTL: 3600,
          primaryKey: 'id',
        },
        mockDb,
        errorCache
      );
      
      // This should proceed to the database query without error
      const result = await errorModel.findAll();
      
      // Verify it returned results despite cache error
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });
  });

  describe('getAll', () => {
    test('should alias to findAll', async () => {
      const spy = jest.spyOn(model as any, 'findAll');
      
      await (model as any).getAll({ role: 'admin' });
      
      expect(spy).toHaveBeenCalledWith({ role: 'admin' });
    });
  });

  describe('findById', () => {
    test('should find record by id', async () => {
      await model.findById(1);
      
      expect(mockDb.queries.length).toBeGreaterThanOrEqual(1);
      expect(mockDb.queries[0].sql).toContain('WHERE');
      expect(mockDb.queries[0].sql).toContain('id = ?');
      expect(mockDb.queries[0].params).toContain(1);
    });

    test('should use cache when available', async () => {
      // Mock data that exactly matches what we'd expect from the database
      const cachedData = { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' };
      
      // Use our mock helper
      mockCacheKey(model, 'findById', 'users:findById:1', cachedData);
      
      const result = await model.findById(1);
      
      expect(result).toEqual(cachedData);
      expect(mockDb.queries.length).toBe(0);
    });

    test('should return null when record not found', async () => {
      const result = await model.findById(999);
      
      expect(result).toBeNull();
    });

    test('should work with field selection', async () => {
      await model.findById(1, ['name']);
      
      expect(mockDb.queries.length).toBeGreaterThanOrEqual(1);
      expect(mockDb.queries[0].sql).toContain('SELECT');
      expect(mockDb.queries[0].sql).toContain('name');
    });

    test('should work with string field selection', async () => {
      await model.findById(1, 'name,email');
      
      expect(mockDb.queries.length).toBeGreaterThanOrEqual(1);
      expect(mockDb.queries[0].sql).toContain('SELECT');
      expect(mockDb.queries[0].sql).toContain('name');
      expect(mockDb.queries[0].sql).toContain('email');
    });

    test('should return null with null id', async () => {
      const result = await model.findById(null as any);
      
      expect(result).toBeNull();
    });

    test('should handle database errors', async () => {
      mockDb.shouldFail = true;
      
      await expect(model.findById(1)).rejects.toThrow('Database error');
    });

    test('should handle cache errors in findById', async () => {
      // Create a model with a failing cache adapter
      const errorCache = new MockCacheAdapter();
      errorCache.shouldFail = true;
      
      const errorModel = new DynamicModel(
        TABLE_NAME,
        {
          useCache: true,
          cacheTTL: 3600,
          primaryKey: 'id',
        },
        mockDb,
        errorCache
      );
      
      // This should proceed to the database query without error
      const result = await errorModel.findById(1);
      
      // Verify it returned results despite cache error
      expect(result).toBeDefined();
    });
  });

  describe('findByField', () => {
    test('should find record by field', async () => {
      await model.findByField('email', 'john@example.com');
      
      expect(mockDb.queries.length).toBeGreaterThanOrEqual(1);
      expect(mockDb.queries[0].sql).toContain('WHERE');
      expect(mockDb.queries[0].sql).toContain('email = ?');
      expect(mockDb.queries[0].params).toContain('john@example.com');
    });

    test('should use cache when available', async () => {
      // Mock data that exactly matches what we'd expect from the database
      const cachedData = { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' };
      
      // Use our mock helper
      mockCacheKey(model, 'findByField', 'users:findByField:email:john@example.com', cachedData);
      
      const result = await model.findByField('email', 'john@example.com');
      
      expect(result).toEqual(cachedData);
      expect(mockDb.queries.length).toBe(0);
    });

    test('should return null when record not found', async () => {
      const result = await model.findByField('email', 'nonexistent@example.com');
      
      expect(result).toBeNull();
    });

    test('should work with field selection', async () => {
      await model.findByField('email', 'john@example.com', ['name']);
      
      expect(mockDb.queries.length).toBeGreaterThanOrEqual(1);
      expect(mockDb.queries[0].sql).toContain('SELECT');
      expect(mockDb.queries[0].sql).toContain('name');
    });

    test('should return null with null field', async () => {
      const result = await model.findByField(null as any, 'value');
      
      expect(result).toBeNull();
    });

    test('should handle database errors', async () => {
      mockDb.shouldFail = true;
      
      await expect(model.findByField('email', 'john@example.com')).rejects.toThrow('Database error');
    });

    test('should handle cache error during set in findByField', async () => {
      // Create a model with cache that fails on set
      const setErrorCache = new MockCacheAdapter();
      setErrorCache.setFailure = true;
      
      // Add a mock record for the model to find
      mockDb.mockData = {
        users: [{ id: 123, name: 'Alice', email: 'alice@example.com' }]
      };
      
      const setErrorModel = new DynamicModel(
        'users',
        {
          useCache: true,
          cacheTTL: 3600,
          primaryKey: 'id',
        },
        mockDb,
        setErrorCache
      );
      
      // Mock the console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      try {
        // Execute method - should not throw despite cache set error
        const result = await setErrorModel.findByField('name', 'Alice');
        
        // Verify the record was found
        expect(result).not.toBeNull();
        expect(result.name).toBe('Alice');
        
        // Verify error was logged
        expect(console.error).toHaveBeenCalled();
      } finally {
        // Restore console.error
        console.error = originalConsoleError;
        // Reset mockDb
        mockDb.mockData = {};
      }
    });
  });

  describe('create', () => {
    test('should insert a new record', async () => {
      const data = { name: 'New User', email: 'new@example.com' };
      const result = await model.create(data);
      
      expect(mockDb.queries.length).toBeGreaterThanOrEqual(1);
      expect(mockDb.queries[0].sql).toContain('INSERT INTO');
      expect(mockDb.queries[0].sql).toContain('users');
      expect(mockDb.queries[0].params).toContain('New User');
      expect(mockDb.queries[0].params).toContain('new@example.com');
      expect(result).toHaveProperty('id');
    });

    test('should insert without returning record', async () => {
      const data = { name: 'New User', email: 'new@example.com' };
      await model.create(data, false);
      
      expect(mockDb.queries.length).toBeGreaterThanOrEqual(1);
      expect(mockDb.queries[0].sql).toContain('INSERT INTO');
      expect(mockDb.queries[0].sql).not.toContain('RETURNING *');
    });

    test('should generate UUID if id not provided and primaryKey is id', async () => {
      const data = { name: 'UUID User', email: 'uuid@example.com' };
      const result = await model.create(data);
      
      expect(mockDb.queries.length).toBeGreaterThanOrEqual(1);
      expect(mockDb.queries[0].sql).toContain('INSERT INTO');
      
      // Check that a parameter exists that looks like a UUID
      const hasUuid = mockDb.queries[0].params.some(p => 
        typeof p === 'string' && 
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p)
      );
      
      expect(hasUuid).toBeTruthy();
    });

    test('should throw error with empty data', async () => {
      await expect(model.create({})).rejects.toThrow('Data must be a non-empty object');
    });

    test('should throw error with null data', async () => {
      await expect(model.create(null as any)).rejects.toThrow('Data must be a non-empty object');
    });

    test('should invalidate cache', async () => {
      // Mock the cache methods
      const keysSpy = jest.spyOn(mockCache, 'keys').mockResolvedValue(['users:findAll:', 'users:findById:1']);
      const delSpy = jest.spyOn(mockCache, 'del').mockResolvedValue();
      
      const data = { name: 'New User', email: 'new@example.com' };
      await model.create(data);
      
      expect(keysSpy).toHaveBeenCalledWith('users:*');
      expect(delSpy).toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      mockDb.shouldFail = true;
      
      await expect(model.create({ name: 'Error User' })).rejects.toThrow('Database error');
    });

    test('should handle cache errors in create', async () => {
      // Setup cache error during invalidation
      mockCache.shouldFail = true;
      
      // Should still succeed even if cache invalidation fails
      const result = await model.create({ name: 'Cache Error Test' });
      
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    test('should handle cache errors in set operations for findById', async () => {
      // Create a model with cache that fails on set
      const setErrorCache = new MockCacheAdapter();
      setErrorCache.getFailure = false;
      setErrorCache.setFailure = true;
      
      const setErrorModel = new DynamicModel(
        'users',
        {
          useCache: true,
          cacheTTL: 3600,
          primaryKey: 'id',
        },
        mockDb,
        setErrorCache
      );
      
      // This should succeed despite the cache set error
      const result = await setErrorModel.findById(1);
      
      // Verify it returned results despite cache error
      expect(result).toBeDefined();
    });
    
    test('should handle cache errors in set operations for findByField', async () => {
      // Create a model with cache that fails on set
      const setErrorCache = new MockCacheAdapter();
      setErrorCache.getFailure = false;
      setErrorCache.setFailure = true;
      
      const setErrorModel = new DynamicModel(
        'users',
        {
          useCache: true,
          cacheTTL: 3600,
          primaryKey: 'id',
        },
        mockDb,
        setErrorCache
      );
      
      // This should succeed despite the cache set error
      const result = await setErrorModel.findByField('name', 'Alice');
      
      // Verify it returned results despite cache error
      expect(result).toBeDefined();
    });

    test('should handle cache errors in set operations for count', async () => {
      // Create a model with cache that fails on set
      const setErrorCache = new MockCacheAdapter();
      setErrorCache.getFailure = false;
      setErrorCache.setFailure = true;
      
      const setErrorModel = new DynamicModel(
        'users',
        {
          useCache: true,
          cacheTTL: 3600,
          primaryKey: 'id',
        },
        mockDb,
        setErrorCache
      );
      
      // This should succeed despite the cache set error
      const result = await setErrorModel.count({ id: 1 });
      
      // Verify it returned results despite cache error
      expect(result).toBeGreaterThanOrEqual(0);
    });

    test('should handle cache errors in update', async () => {
      // Create a model with cache that fails on del and keys
      const updateErrorCache = new MockCacheAdapter();
      updateErrorCache.delFailure = true;
      
      const updateErrorModel = new DynamicModel(
        'users',
        {
          useCache: true,
          cacheTTL: 3600,
          primaryKey: 'id',
        },
        mockDb,
        updateErrorCache
      );
      
      // This should succeed despite the cache invalidation error
      const result = await updateErrorModel.update(1, { name: 'Updated User' });
      
      // Verify it returned results despite cache error
      expect(result).toBeDefined();
    });

    test('should handle cache errors in delete', async () => {
      // Create a model with cache that fails on del
      const deleteErrorCache = new MockCacheAdapter();
      deleteErrorCache.delFailure = true;
      
      const deleteErrorModel = new DynamicModel(
        'users',
        {
          useCache: true,
          cacheTTL: 3600,
          primaryKey: 'id',
        },
        mockDb,
        deleteErrorCache
      );
      
      // This should succeed despite the cache invalidation error
      const result = await deleteErrorModel.delete(1, true);
      
      // Verify it returned results despite cache error
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    test('should update a record', async () => {
      const data = { name: 'Updated User' };
      await model.update(1, data);
      
      expect(mockDb.queries.length).toBeGreaterThanOrEqual(1);
      expect(mockDb.queries[0].sql).toContain('UPDATE');
      expect(mockDb.queries[0].sql).toContain('users');
      expect(mockDb.queries[0].sql).toContain('SET');
      expect(mockDb.queries[0].params).toContain('Updated User');
      expect(mockDb.queries[0].params).toContain(1); // ID in WHERE clause
    });

    test('should update without returning record', async () => {
      const data = { name: 'Updated User' };
      await model.update(1, data, false);
      
      expect(mockDb.queries.length).toBeGreaterThanOrEqual(1);
      expect(mockDb.queries[0].sql).toContain('UPDATE');
      expect(mockDb.queries[0].sql).not.toContain('RETURNING *');
    });

    test('should throw error with no id', async () => {
      await expect(model.update(null as any, { name: 'Invalid' })).rejects.toThrow('ID is required');
    });

    test('should throw error with empty data', async () => {
      await expect(model.update(1, {})).rejects.toThrow('Update data must be a non-empty object');
    });

    test('should invalidate cache', async () => {
      // Mock the cache methods
      const keysSpy = jest.spyOn(mockCache, 'keys').mockResolvedValue(['users:findAll:', 'users:findById:1']);
      const delSpy = jest.spyOn(mockCache, 'del').mockResolvedValue();
      
      const data = { name: 'Updated User' };
      await model.update(1, data);
      
      expect(keysSpy).toHaveBeenCalledWith('users:*');
      expect(delSpy).toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      mockDb.shouldFail = true;
      
      await expect(model.update(1, { name: 'Error User' })).rejects.toThrow('Database error');
    });
  });

  describe('delete', () => {
    test('should delete a record', async () => {
      await model.delete(1);
      
      expect(mockDb.queries.length).toBeGreaterThanOrEqual(1);
      expect(mockDb.queries[0].sql).toContain('DELETE FROM');
      expect(mockDb.queries[0].sql).toContain('users');
      expect(mockDb.queries[0].sql).toContain('WHERE');
      expect(mockDb.queries[0].params).toContain(1);
    });

    test('should delete and return record', async () => {
      // Mock findById to return data before deletion
      jest.spyOn(model, 'findById').mockResolvedValueOnce({ id: 1, name: 'User to delete' });
      
      const result = await model.delete(1, true);
      
      expect(result).toEqual({ id: 1, name: 'User to delete' });
      expect(mockDb.queries.length).toBeGreaterThanOrEqual(1);
      expect(mockDb.queries[0].sql).toContain('DELETE FROM');
    });

    test('should return null when record to delete not found', async () => {
      // Mock findById to return null
      jest.spyOn(model, 'findById').mockResolvedValueOnce(null);
      
      const result = await model.delete(999, true);
      
      expect(result).toBeNull();
    });

    test('should throw error with no id', async () => {
      await expect(model.delete(null as any)).rejects.toThrow('ID is required');
    });

    test('should invalidate cache', async () => {
      // Mock the cache methods
      const keysSpy = jest.spyOn(mockCache, 'keys').mockResolvedValue(['users:findAll:', 'users:findById:1']);
      const delSpy = jest.spyOn(mockCache, 'del').mockResolvedValue();
      
      await model.delete(1);
      
      expect(keysSpy).toHaveBeenCalledWith('users:*');
      expect(delSpy).toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      mockDb.shouldFail = true;
      
      await expect(model.delete(1)).rejects.toThrow('Database error');
    });
  });

  describe('count', () => {
    test('should count records', async () => {
      const result = await model.count();
      
      expect(mockDb.queries.length).toBeGreaterThanOrEqual(1);
      expect(mockDb.queries[0].sql).toContain('COUNT');
      expect(mockDb.queries[0].sql).toContain('users');
      expect(typeof result).toBe('number');
    });

    test('should count with filters', async () => {
      await model.count({ role: 'admin' });
      
      expect(mockDb.queries.length).toBeGreaterThanOrEqual(1);
      expect(mockDb.queries[0].sql).toContain('WHERE');
      expect(mockDb.queries[0].params).toContain('admin');
    });

    test('should handle complex filters in count', async () => {
      await model.count({ 
        role: 'admin', 
        id: { gt: 5 },
        status: ['active', 'pending']
      });
      
      const sql = mockDb.queries[0].sql;
      const params = mockDb.queries[0].params || [];
      
      expect(sql).toContain('WHERE');
      expect(sql).toContain('role =');
      expect(sql).toContain('id >');
      expect(sql).toContain('status IN');
      expect(params).toContain('admin');
      expect(params).toContain(5);
      expect(params).toContain('active');
      expect(params).toContain('pending');
    });

    test('should handle null filter values in count', async () => {
      await model.count({ status: null });
      
      expect(mockDb.queries[0].sql).toContain('WHERE');
      expect(mockDb.queries[0].sql).toContain('IS NULL');
    });

    test('should use cache when available', async () => {
      // Use our mock helper
      mockCacheKey(model, 'count', 'users:count:', 10);
      
      const result = await model.count();
      
      expect(result).toBe(10);
      expect(mockDb.queries.length).toBe(0); // Should not hit database
    });

    test('should handle database errors', async () => {
      mockDb.shouldFail = true;
      
      await expect(model.count()).rejects.toThrow('Database error');
    });

    test('should handle cache errors in create', async () => {
      // Setup cache error during invalidation
      mockCache.shouldFail = true;
      
      // Should still succeed even if cache invalidation fails
      const result = await model.create({ name: 'Cache Error Test' });
      
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    test('should handle cache errors in set operations for findById', async () => {
      // Create a model with cache that fails on set
      const setErrorCache = new MockCacheAdapter();
      setErrorCache.getFailure = false;
      setErrorCache.setFailure = true;
      
      const setErrorModel = new DynamicModel(
        'users',
        {
          useCache: true,
          cacheTTL: 3600,
          primaryKey: 'id',
        },
        mockDb,
        setErrorCache
      );
      
      // This should succeed despite the cache set error
      const result = await setErrorModel.findById(1);
      
      // Verify it returned results despite cache error
      expect(result).toBeDefined();
    });
    
    test('should handle cache errors in set operations for findByField', async () => {
      // Create a model with cache that fails on set
      const setErrorCache = new MockCacheAdapter();
      setErrorCache.getFailure = false;
      setErrorCache.setFailure = true;
      
      const setErrorModel = new DynamicModel(
        'users',
        {
          useCache: true,
          cacheTTL: 3600,
          primaryKey: 'id',
        },
        mockDb,
        setErrorCache
      );
      
      // This should succeed despite the cache set error
      const result = await setErrorModel.findByField('name', 'Alice');
      
      // Verify it returned results despite cache error
      expect(result).toBeDefined();
    });

    test('should handle cache errors in set operations for count', async () => {
      // Create a model with cache that fails on set
      const setErrorCache = new MockCacheAdapter();
      setErrorCache.getFailure = false;
      setErrorCache.setFailure = true;
      
      const setErrorModel = new DynamicModel(
        'users',
        {
          useCache: true,
          cacheTTL: 3600,
          primaryKey: 'id',
        },
        mockDb,
        setErrorCache
      );
      
      // This should succeed despite the cache set error
      const result = await setErrorModel.count({ id: 1 });
      
      // Verify it returned results despite cache error
      expect(result).toBeGreaterThanOrEqual(0);
    });

    test('should handle cache errors in update', async () => {
      // Create a model with cache that fails on del and keys
      const updateErrorCache = new MockCacheAdapter();
      updateErrorCache.delFailure = true;
      
      const updateErrorModel = new DynamicModel(
        'users',
        {
          useCache: true,
          cacheTTL: 3600,
          primaryKey: 'id',
        },
        mockDb,
        updateErrorCache
      );
      
      // This should succeed despite the cache invalidation error
      const result = await updateErrorModel.update(1, { name: 'Updated User' });
      
      // Verify it returned results despite cache error
      expect(result).toBeDefined();
    });

    test('should handle cache errors in delete', async () => {
      // Create a model with cache that fails on del
      const deleteErrorCache = new MockCacheAdapter();
      deleteErrorCache.delFailure = true;
      
      const deleteErrorModel = new DynamicModel(
        'users',
        {
          useCache: true,
          cacheTTL: 3600,
          primaryKey: 'id',
        },
        mockDb,
        deleteErrorCache
      );
      
      // This should succeed despite the cache invalidation error
      const result = await deleteErrorModel.delete(1, true);
      
      // Verify it returned results despite cache error
      expect(result).toBeDefined();
    });
  });

  describe('withTransaction', () => {
    test('should execute callback with transaction model', async () => {
      // Setup successful transaction mock
      const txHelper = mockTransaction(model);
      txHelper.setupSuccess();
      
      const callbackSpy = jest.fn().mockResolvedValue('result');
      
      const result = await model.withTransaction(callbackSpy);
      
      expect(callbackSpy).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    test('should handle transaction errors', async () => {
      // Setup failed transaction mock
      const txHelper = mockTransaction(model);
      txHelper.setupFailure();
      
      await expect(model.withTransaction(async () => {})).rejects.toThrow('Transaction error');
    });

    test('should invalidate cache after successful transaction', async () => {
      // Setup successful transaction mock
      const txHelper = mockTransaction(model);
      txHelper.setupSuccess();
      
      // Spy on invalidateTableCache
      const invalidateSpy = jest.spyOn(model as any, 'invalidateTableCache');
      
      await model.withTransaction(async (txModel) => {
        return 'success';
      });
      
      expect(invalidateSpy).toHaveBeenCalled();
    });

    test('should execute create in transaction', async () => {
      // Setup successful transaction mock
      const txHelper = mockTransaction(model);
      txHelper.setupSuccess();
      
      await model.withTransaction(async (txModel) => {
        const result = await txModel.create({ name: 'Transaction User' });
        expect(result).toHaveProperty('id');
        return result;
      });
    });

    test('should execute update in transaction', async () => {
      // Setup successful transaction mock
      const txHelper = mockTransaction(model);
      txHelper.setupSuccess();
      
      await model.withTransaction(async (txModel) => {
        const result = await txModel.update(1, { name: 'Updated in Transaction' });
        expect(result).toHaveProperty('id');
        return result;
      });
    });

    test('should execute delete in transaction', async () => {
      // Setup successful transaction mock
      const txHelper = mockTransaction(model);
      txHelper.setupSuccess();
      
      // Use special formatting for transaction testing
      // The mock transaction result is normally an array with one object
      const result = await model.withTransaction(async (txModel) => {
        const deleteResult = await txModel.delete(1);
        // For transaction tests, we need to adjust our expectations
        // The result may be returned as an array with one object
        const normalizedResult = Array.isArray(deleteResult) ? deleteResult[0] : deleteResult;
        expect(normalizedResult).toHaveProperty('affectedRows');
        expect(normalizedResult.affectedRows).toBe(1);
        return deleteResult;
      });
      
      // Verify transaction was executed successfully
      expect(result).toBeDefined();
    });

    test('should execute delete with returnRecord in transaction', async () => {
      // Setup successful transaction mock
      const txHelper = mockTransaction(model);
      txHelper.setupSuccess();
      
      await model.withTransaction(async (txModel) => {
        const result = await txModel.delete(1, true);
        expect(result).toHaveProperty('id');
        return result;
      });
    });

    test('should execute findById in transaction', async () => {
      // Setup successful transaction mock
      const txHelper = mockTransaction(model);
      txHelper.setupSuccess();
      
      await model.withTransaction(async (txModel) => {
        const result = await txModel.findById(1);
        expect(result).toHaveProperty('id');
        return result;
      });
    });

    test('should execute raw query in transaction', async () => {
      // Setup successful transaction mock
      const txHelper = mockTransaction(model);
      txHelper.setupSuccess();
      
      await model.withTransaction(async (txModel) => {
        const result = await txModel.executeQuery('SELECT * FROM users WHERE id = ?', [1]);
        expect(Array.isArray(result)).toBeTruthy();
        return result;
      });
    });
  });

  describe('executeQuery', () => {
    test('should execute raw query', async () => {
      await model.executeQuery('SELECT * FROM users WHERE id = ?', [1]);
      
      expect(mockDb.queries.length).toBe(1);
      expect(mockDb.queries[0].sql).toBe('SELECT * FROM users WHERE id = ?');
      expect(mockDb.queries[0].params).toContain(1);
    });

    test('should return query results', async () => {
      // Mock the prepare method to return specific data
      jest.spyOn(mockDb, 'prepare').mockResolvedValueOnce([
        { id: 1, name: 'Query Result' }
      ]);
      
      const result = await model.executeQuery('SELECT * FROM users LIMIT 1');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name', 'Query Result');
    });

    test('should handle database errors', async () => {
      mockDb.shouldFail = true;
      
      await expect(model.executeQuery('SELECT * FROM users')).rejects.toThrow('Database error');
    });
  });

  describe('invalidateTableCache', () => {
    test('should clear all cache for the table', async () => {
      // Mock the cache methods
      const keysSpy = jest.spyOn(mockCache, 'keys').mockResolvedValue([
        'users:findAll:',
        'users:findById:1'
      ]);
      const delSpy = jest.spyOn(mockCache, 'del').mockResolvedValue();
      
      await model.invalidateTableCache();
      
      // Should call keys with the right pattern
      expect(keysSpy).toHaveBeenCalledWith('users:*');
      expect(delSpy).toHaveBeenCalled();
    });

    test('should handle empty cache keys', async () => {
      // Mock the cache methods to return empty array
      const keysSpy = jest.spyOn(mockCache, 'keys').mockResolvedValue([]);
      const delSpy = jest.spyOn(mockCache, 'del').mockResolvedValue();
      
      await model.invalidateTableCache();
      
      expect(keysSpy).toHaveBeenCalledWith('users:*');
      expect(delSpy).not.toHaveBeenCalled(); // Should not call del with empty array
    });

    test('should handle cache errors without throwing', async () => {
      // Mock the cache methods to throw error
      const keysSpy = jest.spyOn(mockCache, 'keys').mockRejectedValue(new Error('Cache error'));
      
      // This should not throw
      await model.invalidateTableCache();
      
      expect(keysSpy).toHaveBeenCalledWith('users:*');
    });

    test('should do nothing if useCache is false', async () => {
      // Create a model with useCache: false
      const noCacheModel = new DynamicModel(
        TABLE_NAME,
        {
          useCache: false
        },
        mockDb,
        mockCache
      );
      
      const keysSpy = jest.spyOn(mockCache, 'keys');
      
      await noCacheModel.invalidateTableCache();
      
      expect(keysSpy).not.toHaveBeenCalled();
    });
  });

  describe('Private Methods', () => {
    describe('_buildCacheKey', () => {
      test('should build correct cache key', async () => {
        // @ts-ignore - accessing private method
        const key = (model as any)._buildCacheKey('findById', { id: 1 });
        
        expect(key).toBe('users:findById:{"id":1}');
      });
    });

    describe('_buildSelectClause', () => {
      test('should return * with null fields', async () => {
        // @ts-ignore - accessing private method
        const clause = (model as any)._buildSelectClause(null);
        
        expect(clause).toBe('*');
      });

      test('should return * with empty array fields', async () => {
        // @ts-ignore - accessing private method
        const clause = (model as any)._buildSelectClause([]);
        
        expect(clause).toBe('*');
      });

      test('should return joined fields with array input', async () => {
        // @ts-ignore - accessing private method
        const clause = (model as any)._buildSelectClause(['name', 'email']);
        
        expect(clause).toBe('name, email');
      });

      test('should return fields string with string input', async () => {
        // @ts-ignore - accessing private method
        const clause = (model as any)._buildSelectClause('name, email');
        
        expect(clause).toBe('name, email');
      });
    });

    describe('_processRelatedData', () => {
      test('should process related data for single relation', async () => {
        // Create mock records
        const records = [
          { id: 1, name: 'John' }
        ];
        
        // Define a relation 
        const relations = [
          { table: 'posts', foreignKey: 'userId', as: 'posts' }
        ];
        
        // Setup mock related data
        mockDb.addMockRelatedData('posts', [
          { id: 101, userId: 1, title: 'Post Title' }
        ]);
        
        // Call the method (via reflection)
        const processRelatedData = (model as any)._processRelatedData.bind(model);
        const result = await processRelatedData(records, relations);
        
        expect(result[0]).toHaveProperty('posts');
        expect(result[0].posts).toEqual({
          id: 101, 
          userId: 1, 
          title: 'Post Title'
        });
      });

      test('should process related data for many relation', async () => {
        // Create mock records
        const records = [
          { id: 1, name: 'John' }
        ];
        
        // Define a relation with many type
        const relations = [
          { table: 'comments', foreignKey: 'userId', as: 'comments', type: 'many' }
        ];
        
        // Setup mock related data
        mockDb.addMockRelatedData('comments', [
          { id: 201, userId: 1, text: 'Comment 1' },
          { id: 202, userId: 1, text: 'Comment 2' }
        ]);
        
        // Call the method (via reflection)
        const processRelatedData = (model as any)._processRelatedData.bind(model);
        const result = await processRelatedData(records, relations);
        
        expect(result[0]).toHaveProperty('comments');
        expect(Array.isArray(result[0].comments)).toBeTruthy();
        expect(result[0].comments.length).toBe(2);
        expect(result[0].comments[0].text).toBe('Comment 1');
        expect(result[0].comments[1].text).toBe('Comment 2');
      });

      test('should handle null records gracefully', async () => {
        const records = [
          { id: 1, name: 'John' },
          null,
          { id: 2, name: 'Jane' }
        ];
        
        const relations = [
          { table: 'posts', foreignKey: 'userId' }
        ];
        
        // Setup mock related data
        mockDb.addMockRelatedData('posts', [
          { id: 101, userId: 1, title: 'Post for John' },
          { id: 102, userId: 2, title: 'Post for Jane' }
        ]);
        
        // Call the method (via reflection)
        const processRelatedData = (model as any)._processRelatedData.bind(model);
        const result = await processRelatedData(records, relations);
        
        expect(result).toHaveLength(3);
        expect(result[0].posts).toBeDefined();
        expect(result[1]).toBeNull();
        expect(result[2].posts).toBeDefined();
      });

      test('should handle relation with single field selection', async () => {
        // Create mock records
        const records = [
          { id: 1, name: 'User 1' }
        ];
        
        // Define a relation with a single select field
        const relations = [
          {
            table: 'roles',
            foreignKey: 'userId',
            as: 'userRole',
            select: ['role']
          }
        ];
        
        // Set up mock related data
        mockDb.addMockRelatedData('roles', [
          { id: 101, userId: 1, role: 'admin' }
        ]);
        
        // Call the method (via reflection)
        const processRelatedData = (model as any)._processRelatedData.bind(model);
        const result = await processRelatedData(records, relations);
        
        // Verify the result contains the extracted value directly
        expect(result[0].userRole).toBe('admin');
      });
      
      test('should handle relation with no data found', async () => {
        // Create mock records
        const records = [
          { id: 1, name: 'User 1' }
        ];
        
        // Define relations - one 'one' type and one 'many' type
        const relations = [
          {
            table: 'roles',
            foreignKey: 'userId',
            as: 'userRole',
            select: ['role']
          },
          {
            table: 'posts',
            foreignKey: 'userId',
            as: 'posts',
            type: 'many'
          }
        ];
        
        // Clear any existing mock related data
        mockDb.clearMockRelatedData();
        
        // Call the method (via reflection)
        const processRelatedData = (model as any)._processRelatedData.bind(model);
        const result = await processRelatedData(records, relations);
        
        // Verify empty results for both relation types
        expect(result[0].userRole).toEqual({});
        expect(result[0].posts).toEqual([]);
      });
    });
  });

  describe('Security Tests', () => {
    test('should prevent SQL injection in findAll', async () => {
      // Setup security testing mocks
      mockDb.shouldFailWithSqlInjection = true;
      
      await expect(model.findAll({ 
        filters: { name: "Robert'); DROP TABLE users; --" } 
      })).rejects.toThrow('SQL Injection');
    });

    test('should prevent SQL injection in findById', async () => {
      // Setup security testing mocks
      mockDb.shouldFailWithSqlInjection = true;
      
      await expect(model.findById("1'; DROP TABLE users; --" as any)).rejects.toThrow('SQL Injection');
    });

    test('should prevent SQL injection in findByField', async () => {
      // Setup security testing mocks
      mockDb.shouldFailWithSqlInjection = true;
      
      await expect(model.findByField('email', "user@example.com'; DROP TABLE users; --")).rejects.toThrow('SQL Injection');
    });

    test('should prevent SQL injection in create', async () => {
      // Setup security testing mocks
      mockDb.shouldFailWithSqlInjection = true;
      
      await expect(model.create({ 
        name: "Robert'); DROP TABLE users; --",
        email: "user@example.com"
      })).rejects.toThrow('SQL Injection');
    });

    test('should prevent SQL injection in update', async () => {
      // Setup security testing mocks
      mockDb.shouldFailWithSqlInjection = true;
      
      await expect(model.update(1, { 
        name: "Robert'); DROP TABLE users; --"
      })).rejects.toThrow('SQL Injection');
    });

    test('should prevent SQL injection in count', async () => {
      // Setup security testing mocks
      mockDb.shouldFailWithSqlInjection = true;
      
      await expect(model.count({
        name: "Robert'); DROP TABLE users; --"
      })).rejects.toThrow('SQL Injection');
    });

    test('should prevent SQL injection in executeQuery', async () => {
      // Setup security testing mocks
      mockDb.shouldFailWithSqlInjection = true;
      
      await expect(model.executeQuery(
        "SELECT * FROM users WHERE name = '" + "Robert'; DROP TABLE users; --" + "'"
      )).rejects.toThrow('SQL Injection');
    });
  });

  describe('Error Handling', () => {
    test('should handle cache errors in findAll', async () => {
      // Create a model with a failing cache adapter
      const errorCache = new MockCacheAdapter();
      errorCache.shouldFail = true;
      
      const errorModel = new DynamicModel(
        TABLE_NAME,
        {
          useCache: true,
          cacheTTL: 3600,
          primaryKey: 'id',
        },
        mockDb,
        errorCache
      );
      
      // This should proceed to the database query without error
      const result = await errorModel.findAll();
      
      // Verify it returned results despite cache error
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });

    test('should handle cache errors in findById', async () => {
      // Create a model with a failing cache adapter
      const errorCache = new MockCacheAdapter();
      errorCache.shouldFail = true;
      
      const errorModel = new DynamicModel(
        TABLE_NAME,
        {
          useCache: true,
          cacheTTL: 3600,
          primaryKey: 'id',
        },
        mockDb,
        errorCache
      );
      
      // This should proceed to the database query without error
      const result = await errorModel.findById(1);
      
      // Verify it returned results despite cache error
      expect(result).toBeDefined();
    });

    test('should handle cache errors in create', async () => {
      // Setup cache error during invalidation
      mockCache.shouldFail = true;
      
      // Should still succeed even if cache invalidation fails
      const result = await model.create({ name: 'Cache Error Test' });
      
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });
  });

  describe('Count method operators', () => {
    test('should handle greater than operator in count', async () => {
      const result = await model.count({ age: { gt: 25 } });
      expect(result).toBeGreaterThanOrEqual(0);
    });

    test('should handle less than operator in count', async () => {
      const result = await model.count({ age: { lt: 30 } });
      expect(result).toBeGreaterThanOrEqual(0);
    });

    test('should handle greater than or equal operator in count', async () => {
      const result = await model.count({ age: { gte: 25 } });
      expect(result).toBeGreaterThanOrEqual(0);
    });

    test('should handle less than or equal operator in count', async () => {
      const result = await model.count({ age: { lte: 30 } });
      expect(result).toBeGreaterThanOrEqual(0);
    });

    test('should handle not equal operator in count', async () => {
      const result = await model.count({ age: { ne: 25 } });
      expect(result).toBeGreaterThanOrEqual(0);
    });

    test('should handle like operator in count', async () => {
      const result = await model.count({ name: { like: '%Alice%' } });
      expect(result).toBeGreaterThanOrEqual(0);
    });

    test('should handle default comparison operator in count', async () => {
      // Use any as a workaround for TypeScript constraints
      const filters = { name: { '=': 'Alice' } } as any;
      const result = await model.count(filters);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Private Methods edge cases', () => {
    test('_buildSelectClause should handle null input', () => {
      // Use reflection to access private method
      const buildSelectClause = (model as any)._buildSelectClause.bind(model);
      expect(buildSelectClause(null)).toBe('*');
    });

    test('_buildSelectClause should handle empty array input', () => {
      const buildSelectClause = (model as any)._buildSelectClause.bind(model);
      expect(buildSelectClause([])).toBe('*');
    });

    test('_buildSelectClause should handle string input', () => {
      const buildSelectClause = (model as any)._buildSelectClause.bind(model);
      expect(buildSelectClause('id, name')).toBe('id, name');
    });

    test('_buildSelectClause should handle array input', () => {
      const buildSelectClause = (model as any)._buildSelectClause.bind(model);
      expect(buildSelectClause(['id', 'name'])).toBe('id, name');
    });

    test('_buildSelectClause should handle unexpected input type', () => {
      const buildSelectClause = (model as any)._buildSelectClause.bind(model);
      // @ts-ignore - intentionally passing invalid type to test fallback
      expect(buildSelectClause(123)).toBe('*');
    });

    test('_buildCacheKey should create consistent keys', () => {
      const buildCacheKey = (model as any)._buildCacheKey.bind(model);
      const key1 = buildCacheKey('findById', { id: 1 });
      const key2 = buildCacheKey('findById', { id: 1 });
      expect(key1).toBe(key2);
      expect(key1).toContain('users:findById:');
    });
  });
}); 