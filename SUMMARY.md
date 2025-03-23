# Dynamic ORM Package

This package provides a standalone, flexible ORM for SQL databases with Redis caching support. It is extracted and enhanced from the original `model.utils.js` to make it reusable across multiple projects.

## What's Included

1. **Core ORM Functionality**:
   - Full database CRUD operations
   - Flexible query building with filtering, sorting, pagination
   - Relationship handling with automatic JOIN generation
   - Redis caching integration
   - Transaction support

2. **TypeScript Support**:
   - Complete type definitions for all functions and models
   - Generic typing for model data

3. **Adapter Pattern**:
   - Database adapter interface that can be implemented for any SQL database
   - Cache adapter interface that can be implemented for any caching solution

4. **Documentation**:
   - Comprehensive README with examples
   - Migration guide from the original implementation
   - Integration examples with Express.js
   - Full JSDoc comments for all methods

## How to Use the Package

### Option 1: As a Local Package

1. Copy the `dynamic-orm` directory to your project (or a shared location)
2. Run `npm install` in the `dynamic-orm` directory to install dependencies
3. Build the package with `npm run build`
4. In your project, install it using:
   ```bash
   npm install --save ../path/to/dynamic-orm
   ```

### Option 2: As a Private NPM Package

1. Create a private NPM repository (like GitHub Packages or a private registry)
2. Run `npm publish` in the `dynamic-orm` directory to publish it
3. Install it in your project using:
   ```bash
   npm install --save dynamic-orm
   ```

### Option 3: As a Public NPM Package

1. Choose a unique name (like `@yourorg/dynamic-orm`)
2. Update the `package.json` name field
3. Create an NPM account if you don't have one
4. Run `npm publish --access public` to publish it
5. Install it in your project using:
   ```bash
   npm install --save @yourorg/dynamic-orm
   ```

## Migrating Existing Code

The API is designed to be compatible with the original `model.utils.js` implementation, so migration should be straightforward:

1. Replace the direct import of `DynamicModel` with the ORM factory
2. Create models through the factory instead of directly instantiating
3. Use the same method names and parameters as before

See the `migration-guide.md` file for detailed instructions.

## Benefits of Using This Package

1. **Maintainability**: Separates database logic from your application code
2. **Reusability**: Use across multiple projects
3. **TypeScript Support**: Full type definitions for better IDE support and type checking
4. **Adaptability**: Works with any SQL database and caching solution through adapters
5. **Testing**: Easier to test database operations by mocking adapters 