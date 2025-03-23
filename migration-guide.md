# Migration Guide

This guide helps you transition from using the embedded `model.utils.js` to the standalone `dynamic-orm` package.

## Step 1: Install the package

```bash
npm install dynamic-orm
```

## Step 2: Update your database configuration

Before:
```javascript
// Original code in your application
const { prepare, transaction } = require("../config/db.config");
const { redis } = require("../config/redis");
const DynamicModel = require("../utils/model.utils");

// Using the model
const userModel = new DynamicModel('users', {
  useCache: true,
  primaryKey: 'id',
  searchableFields: ['firstName', 'lastName', 'email']
});
```

After:
```javascript
// Import from the package
const { createORM } = require('dynamic-orm');
const { prepare, transaction } = require("../config/db.config");
const { redis } = require("../config/redis");

// Create ORM with your database and Redis clients
const orm = createORM({
  db: { prepare, transaction },
  redis,
  useCache: true
});

// Create model using the ORM
const userModel = orm.createModel('users', {
  primaryKey: 'id',
  searchableFields: ['firstName', 'lastName', 'email']
});
```

## Step 3: Update your model usage

The API remains largely the same, so most of your code won't need to change. Just ensure you're creating models through the ORM factory.

Example:
```javascript
// Before
const vehicleModel = new DynamicModel('vehicles', { primaryKey: 'stock_id' });

// After
const vehicleModel = orm.createModel('vehicles', { primaryKey: 'stock_id' });
```

## Step 4: Typescript Support (Optional)

If using TypeScript, you can enhance your code with types:

```typescript
import { createORM, Types } from 'dynamic-orm';

// Define your entity interface
interface Vehicle {
  stock_id: string;
  make: string;
  model: string;
  body_type: string;
  // other fields...
}

// Create strongly-typed model
const vehicleModel = orm.createModel<Vehicle>('vehicles', { 
  primaryKey: 'stock_id' 
});

// Now all queries will have proper type information
const result = await vehicleModel.findAll({
  filters: { body_type: 'SUV' }
});

// result.data is now Vehicle[]
const vehicles: Vehicle[] = result.data;
```

## Step 5: Advanced Configuration

You can configure the adapters more extensively if needed:

```javascript
const { 
  createORM, 
  DefaultDatabaseAdapter, 
  RedisCacheAdapter 
} = require('dynamic-orm');

// Custom database adapter configuration
const dbAdapter = new DefaultDatabaseAdapter({
  // Your custom database connector
  prepare: async (sql, params) => { /* ... */ },
  transaction: async (callback) => { /* ... */ }
});

// Custom cache adapter configuration
const cacheAdapter = new RedisCacheAdapter({
  // Your custom Redis client
  get: async (key) => { /* ... */ },
  set: async (key, value, expireFlag, expireTime) => { /* ... */ },
  del: async (keys) => { /* ... */ },
  keys: async (pattern) => { /* ... */ }
});

// Create ORM with custom adapters
const orm = createORM({
  dbAdapter,
  cacheAdapter,
  useCache: true
});
```

## Common Questions

### Is the API compatible?

Yes, all the methods from the original `DynamicModel` class are preserved:
- `findAll()` / `getAll()`
- `findById()`
- `findByField()`
- `create()`
- `update()`
- `delete()`
- `count()`
- `withTransaction()`
- `executeQuery()`

### What's improved?

- Full TypeScript support with types for all parameters and return values
- Cleaner separation of concerns with adapter patterns
- More maintainable and testable codebase
- Better documentation

### Do I need to change my database code?

No, the package is designed to work with your existing database adapter. You just need to pass it to the ORM factory. 