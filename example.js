// Example of how to use Dynamic ORM in a Node.js project

// 1. Import the package
const { createORM } = require('dynamic-orm');

// 2. Import your database adapter and Redis client
// These are just examples - replace with your actual database and Redis modules
const { prepare, transaction } = require('./your-db-module');
const redis = require('./your-redis-module');

// 3. Create ORM instance
const orm = createORM({
  db: { prepare, transaction },
  redis,
  useCache: true
});

// 4. Create models for your tables
const userModel = orm.createModel('users', {
  primaryKey: 'id',
  searchableFields: ['firstName', 'lastName', 'email'],
  useCache: true,
  cacheTTL: 3600
});

const orderModel = orm.createModel('orders', {
  primaryKey: 'id',
  useCache: true
});

// 5. Use the models in your application
async function findActiveUsersWithOrders() {
  try {
    const result = await userModel.findAll({
      filters: { 
        status: 'active',
        createdAt: { gt: '2023-01-01' }
      },
      sort: { lastName: 'asc' },
      pagination: { page: 1, limit: 25 },
      relations: [
        {
          table: 'orders',
          foreignKey: 'userId',
          localKey: 'id',
          as: 'orders',
          type: 'many',
          select: ['id', 'total', 'createdAt'],
          filters: { status: 'completed' }
        }
      ]
    });
    
    console.log(`Found ${result.pagination.total} active users`);
    
    // Users with their orders
    result.data.forEach(user => {
      console.log(`${user.firstName} ${user.lastName} - ${user.orders.length} orders`);
    });
    
    return result;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

// 6. Create a new record
async function createUser(userData) {
  try {
    const newUser = await userModel.create(userData);
    console.log(`Created new user with ID: ${newUser.id}`);
    return newUser;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

// 7. Use transactions for complex operations
async function createOrderWithItems(order, items) {
  try {
    const result = await orderModel.withTransaction(async (tr) => {
      // Create the order first
      const newOrder = await tr.create(order);
      
      // Add order items
      for (const item of items) {
        await tr.executeQuery(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [newOrder.id, item.productId, item.quantity, item.price]
        );
      }
      
      return newOrder;
    });
    
    console.log(`Created new order with ID: ${result.id}`);
    return result;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
}

module.exports = {
  findActiveUsersWithOrders,
  createUser,
  createOrderWithItems
}; 