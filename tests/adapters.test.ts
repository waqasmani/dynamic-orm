import { DefaultDatabaseAdapter } from '../src/adapters/database';
import { RedisCacheAdapter, NullCacheAdapter } from '../src/adapters/cache';

describe('DefaultDatabaseAdapter', () => {
  test('should call prepare method on db adapter', async () => {
    const mockDb = {
      prepare: jest.fn().mockResolvedValue(['result'])
    };
    const adapter = new DefaultDatabaseAdapter(mockDb);
    const result = await adapter.prepare('SELECT * FROM users', [1]);
    
    expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM users', [1]);
    expect(result).toEqual(['result']);
  });

  test('should throw error if db adapter does not implement prepare', async () => {
    const mockDb = {};
    const adapter = new DefaultDatabaseAdapter(mockDb);
    
    await expect(adapter.prepare('SELECT * FROM users', [1]))
      .rejects
      .toThrow('Database adapter must implement prepare method');
  });

  test('should call transaction method on db adapter', async () => {
    const mockCallback = jest.fn().mockResolvedValue('transaction result');
    const mockDb = {
      transaction: jest.fn().mockImplementation(cb => cb('txConn'))
    };
    const adapter = new DefaultDatabaseAdapter(mockDb);
    
    await adapter.transaction(mockCallback);
    
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockCallback).toHaveBeenCalledWith('txConn');
  });

  test('should throw error if db adapter does not implement transaction', async () => {
    const mockDb = {};
    const adapter = new DefaultDatabaseAdapter(mockDb);
    
    await expect(adapter.transaction(async () => 'result'))
      .rejects
      .toThrow('Database adapter must implement transaction method');
  });
});

describe('RedisCacheAdapter', () => {
  test('should call get method on redis client', async () => {
    const mockRedis = {
      get: jest.fn().mockResolvedValue('cached value')
    };
    const adapter = new RedisCacheAdapter(mockRedis);
    const result = await adapter.get('test-key');
    
    expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    expect(result).toBe('cached value');
  });

  test('should call set method on redis client', async () => {
    const mockRedis = {
      set: jest.fn().mockResolvedValue(undefined)
    };
    const adapter = new RedisCacheAdapter(mockRedis);
    await adapter.set('test-key', 'test-value', 'EX', 600);
    
    expect(mockRedis.set).toHaveBeenCalledWith('test-key', 'test-value', 'EX', 600);
  });

  test('should call del method on redis client', async () => {
    const mockRedis = {
      del: jest.fn().mockResolvedValue(undefined)
    };
    const adapter = new RedisCacheAdapter(mockRedis);
    await adapter.del('test-key');
    
    expect(mockRedis.del).toHaveBeenCalledWith('test-key');
  });

  test('should call keys method on redis client', async () => {
    const mockRedis = {
      keys: jest.fn().mockResolvedValue(['key1', 'key2'])
    };
    const adapter = new RedisCacheAdapter(mockRedis);
    const result = await adapter.keys('test*');
    
    expect(mockRedis.keys).toHaveBeenCalledWith('test*');
    expect(result).toEqual(['key1', 'key2']);
  });
});

describe('NullCacheAdapter', () => {
  test('get should always return null', async () => {
    const adapter = new NullCacheAdapter();
    const result = await adapter.get();
    
    expect(result).toBeNull();
  });

  test('set should be a no-op', async () => {
    const adapter = new NullCacheAdapter();
    // This should not throw
    await expect(adapter.set()).resolves.toBeUndefined();
  });

  test('del should be a no-op', async () => {
    const adapter = new NullCacheAdapter();
    // This should not throw
    await expect(adapter.del()).resolves.toBeUndefined();
  });

  test('keys should always return empty array', async () => {
    const adapter = new NullCacheAdapter();
    const result = await adapter.keys();
    
    expect(result).toEqual([]);
  });
}); 