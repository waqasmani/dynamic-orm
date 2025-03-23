# Dynamic ORM

A flexible and powerful ORM for SQL databases with Redis caching support.

## Features

- Fluent query builder with support for complex filtering and pagination
- Support for table relationships with automatic JOIN generation
- Redis caching for improved performance
- Transaction support
- TypeScript support with full type definitions

## Installation

```bash
npm install dynamic-orm
```

## Basic Usage

```javascript
const { createORM } = require('dynamic-orm');
const { prepare, transaction } = require('your-database-module');
const redis = require('your-redis-module');

// Create ORM instance
const orm = createORM({
  db: { prepare, transaction },  // Your database adapter
  redis: redis,                  // Your Redis client
  useCache: true                 // Enable caching
});

// Create a model for a specific table
const userModel = orm.createModel('users', {
  primaryKey: 'id',
  searchableFields: ['firstName', 'lastName', 'email'],
  defaultLimit: 50,
  maxLimit: 500
});

// Now you can use the model to interact with the database
async function example() {
  // Find all users with filtering, pagination, and sorting
  const result = await userModel.findAll({
    filters: { 
      role: 'admin',
      status: 'active',
      createdAt: { gt: '2023-01-01' }
    },
    sort: { lastName: 'asc', firstName: 'asc' },
    pagination: { page: 2, limit: 25 },
    fields: ['id', 'firstName', 'lastName', 'email'],
    search: 'john'
  });
  
  console.log(result.data); // Array of user objects
  console.log(result.pagination); // Pagination metadata
  
  // Find a user by ID
  const user = await userModel.findById('user-123');
  
  // Find a user by email
  const userByEmail = await userModel.findByField('email', 'user@example.com');
  
  // Create a new user
  const newUser = await userModel.create({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com'
  });
  
  // Update a user
  const updatedUser = await userModel.update('user-123', {
    status: 'inactive'
  });
  
  // Delete a user
  await userModel.delete('user-123');
  
  // Count users
  const count = await userModel.count({ status: 'active' });
}
```

## Advanced Usage

### Relationships

You can fetch related data using the `relations` option:

```javascript
const result = await userModel.findAll({
  filters: { status: 'active' },
  relations: [
    { 
      table: 'orders', 
      foreignKey: 'userId',
      localKey: 'id',
      as: 'orders',
      type: 'many', // or 'left', 'inner', 'right' for JOIN types
      select: ['id', 'total', 'createdAt'],
      filters: { status: 'completed' }
    }
  ]
});

// Result will include user records with their orders as nested objects
console.log(result.data);
```

### Transactions

Execute multiple operations in a transaction:

```javascript
const result = await orderModel.withTransaction(async (tr) => {
  // Create the order
  const order = await tr.create({
    customerId: 'cust-123',
    total: 99.99
  });
  
  // Add order items
  await tr.executeQuery(
    'INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, ?, ?)',
    [order.id, 'prod-456', 2]
  );
  
  return order;
});
```

### Custom Queries

Execute raw SQL queries when needed:

```javascript
const results = await userModel.executeQuery(
  'SELECT id, email FROM users WHERE last_login > ? AND role = ?',
  ['2023-01-01', 'admin']
);
```

## TypeScript Support

The package includes full TypeScript definitions:

```typescript
import { createORM, Types } from 'dynamic-orm';

// Define your record type
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

// Create strongly typed model
const orm = createORM({ db, redis, useCache: true });
const userModel = orm.createModel<User>('users', {
  primaryKey: 'id',
  searchableFields: ['firstName', 'lastName', 'email']
});

// Now all queries will be properly typed
const result = await userModel.findAll({
  filters: { status: 'active' }
});

// result.data will be User[]
const users: User[] = result.data;
```

## License

MIT 