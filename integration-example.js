// Example of integrating dynamic-orm with an existing Express.js application

// 1. Import dependencies
const express = require('express');
const { createORM } = require('dynamic-orm');
const { prepare, transaction } = require('./config/db.config'); // Your existing DB config
const { redis } = require('./config/redis'); // Your existing Redis config

// 2. Initialize the ORM
const orm = createORM({
  db: { prepare, transaction },
  redis,
  useCache: true
});

// 3. Create models for your tables
const vehicleModel = orm.createModel('vehicles', { 
  primaryKey: 'stock_id',
  searchableFields: ['make', 'model', 'year', 'color']
});

const userModel = orm.createModel('users', {
  primaryKey: 'id',
  searchableFields: ['firstName', 'lastName', 'email']
});

// 4. Create Express app
const app = express();
app.use(express.json());

// 5. Define your routes
app.get('/api/vehicles', async (req, res) => {
  try {
    const { page = 1, limit = 20, make, model, year, sort } = req.query;
    
    // Build filters
    const filters = {};
    if (make) filters.make = make;
    if (model) filters.model = model;
    if (year) filters.year = year;
    
    // Build query options
    const options = {
      filters,
      pagination: { page: parseInt(page), limit: parseInt(limit) },
      relations: [
        {
          table: 'makes',
          foreignKey: 'id',
          localKey: 'make',
          as: 'make',
          select: ['name']
        },
        {
          table: 'models',
          foreignKey: 'id',
          localKey: 'model',
          as: 'model',
          select: ['name']
        }
      ]
    };
    
    // Add sorting if provided
    if (sort) {
      options.sort = sort;
    }
    
    const result = await vehicleModel.findAll(options);
    res.json(result);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vehicles/:id', async (req, res) => {
  try {
    const vehicle = await vehicleModel.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    res.json(vehicle);
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vehicles', async (req, res) => {
  try {
    const newVehicle = await vehicleModel.create(req.body);
    res.status(201).json(newVehicle);
  } catch (error) {
    console.error('Error creating vehicle:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/vehicles/:id', async (req, res) => {
  try {
    const updatedVehicle = await vehicleModel.update(req.params.id, req.body);
    
    if (!updatedVehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    res.json(updatedVehicle);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/vehicles/:id', async (req, res) => {
  try {
    const result = await vehicleModel.delete(req.params.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app; 