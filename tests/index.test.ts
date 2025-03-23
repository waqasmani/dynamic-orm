import { createORM, DynamicModel, DefaultDatabaseAdapter, RedisCacheAdapter, NullCacheAdapter } from '../src/index';
import * as Types from '../src/types';

describe('createORM', () => {
  test('should throw error if db is not provided', () => {
    expect(() => createORM({ db: null })).toThrow('Database adapter is required');
  });

  test('should create ORM with database adapter', () => {
    const mockDb = {};
    const orm = createORM({ db: mockDb });
    
    expect(orm).toHaveProperty('createModel');
    expect(typeof orm.createModel).toBe('function');
  });

  test('should create ORM with database and Redis adapter', () => {
    const mockDb = {};
    const mockRedis = {};
    const orm = createORM({ db: mockDb, redis: mockRedis, useCache: true });
    
    expect(orm).toHaveProperty('createModel');
    expect(typeof orm.createModel).toBe('function');
  });

  test('should create model with options', () => {
    const mockDb = {};
    const orm = createORM({ db: mockDb });
    
    const model = orm.createModel('users', {
      primaryKey: 'id',
      defaultLimit: 20
    });
    
    expect(model).toBeInstanceOf(DynamicModel);
  });
});

describe('Module exports', () => {
  test('should export main classes and types', () => {
    expect(DynamicModel).toBeDefined();
    expect(DefaultDatabaseAdapter).toBeDefined();
    expect(RedisCacheAdapter).toBeDefined();
    expect(NullCacheAdapter).toBeDefined();
    expect(Types).toBeDefined();
  });
}); 