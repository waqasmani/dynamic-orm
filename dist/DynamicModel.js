"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicModel = void 0;
const uuid_1 = require("uuid");
/**
 * Enhanced Dynamic Model for database operations
 * Provides a flexible and powerful abstraction over database tables
 */
class DynamicModel {
    /**
     * Create a new Dynamic Model instance
     * @param table - Database table name
     * @param options - Configuration options
     * @param db - Database adapter
     * @param cache - Cache adapter
     */
    constructor(table, options = {}, db, cache) {
        this.table = table;
        this.useCache = options.useCache || false;
        this.cacheTTL = options.cacheTTL || 3600; // Default: 1 hour
        this.primaryKey = options.primaryKey || 'id';
        this.defaultLimit = options.defaultLimit || 100;
        this.maxLimit = options.maxLimit || 1000;
        this.searchableFields = options.searchableFields || [];
        this.db = db;
        this.cache = cache;
    }
    /**
     * Find records with filtering, pagination, sorting and field selection
     */
    async findAll(options = {}) {
        // For backward compatibility with getAll
        if (typeof this.getAll === 'undefined') {
            this.getAll = this.findAll;
        }
        // Handle both new options object format and old filters direct parameter
        const isLegacyCall = !options || typeof options !== 'object' || !Object.keys(options).some(k => ['filters', 'sort', 'fields', 'pagination', 'search', 'relations'].includes(k));
        const filters = isLegacyCall ? options : (options.filters || {});
        const sort = isLegacyCall ? null : options.sort;
        const fields = isLegacyCall ? null : options.fields;
        const pagination = isLegacyCall ? null : options.pagination;
        const search = isLegacyCall ? null : options.search;
        const relations = isLegacyCall ? null : options.relations;
        // Build cache key
        const cacheKey = this._buildCacheKey('findAll', { filters, sort, fields, pagination, search, relations });
        // Try to get from cache
        if (this.useCache) {
            const cached = await this.cache.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
        try {
            // Prepare query components
            let params = [];
            let conditions = [];
            let whereClause = '';
            let joins = [];
            let groupBy = '';
            let tableAliases = {};
            let mainTableAlias = 't1';
            // Add table alias for main table
            tableAliases[this.table] = mainTableAlias;
            // Process relations if provided
            if (relations && Array.isArray(relations) && relations.length > 0) {
                let joinIndex = 2;
                for (const relation of relations) {
                    if (!relation.table || !relation.foreignKey)
                        continue;
                    const joinType = (relation.type || 'left').toUpperCase();
                    const relAlias = `t${joinIndex}`;
                    const localKey = relation.localKey || this.primaryKey;
                    const as = relation.as || relation.table;
                    // Save table alias for later use
                    tableAliases[relation.table] = relAlias;
                    // Build join clause - swap the order of fields in the ON clause
                    joins.push(`${joinType} JOIN ${relation.table} ${relAlias} ON ${mainTableAlias}.${localKey} = ${relAlias}.${relation.foreignKey}`);
                    // Add relation filters if provided
                    if (relation.filters && typeof relation.filters === 'object') {
                        for (const [key, value] of Object.entries(relation.filters)) {
                            // Handle different types of filter values for relation
                            if (value === null) {
                                conditions.push(`${relAlias}.${key} IS NULL`);
                            }
                            else if (Array.isArray(value)) {
                                if (value.length === 0) {
                                    conditions.push('FALSE');
                                }
                                else {
                                    const placeholders = value.map(() => '?').join(', ');
                                    conditions.push(`${relAlias}.${key} IN (${placeholders})`);
                                    params.push(...value);
                                }
                            }
                            else if (typeof value === 'object') {
                                for (const [op, val] of Object.entries(value)) {
                                    let sqlOp;
                                    switch (op) {
                                        case 'gt':
                                            sqlOp = '>';
                                            break;
                                        case 'lt':
                                            sqlOp = '<';
                                            break;
                                        case 'gte':
                                            sqlOp = '>=';
                                            break;
                                        case 'lte':
                                            sqlOp = '<=';
                                            break;
                                        case 'ne':
                                            sqlOp = '!=';
                                            break;
                                        case 'like':
                                            sqlOp = 'LIKE';
                                            break;
                                        case 'ilike':
                                            sqlOp = 'ILIKE';
                                            break;
                                        default: sqlOp = '=';
                                    }
                                    if (val === null && op === 'ne') {
                                        conditions.push(`${relAlias}.${key} IS NOT NULL`);
                                    }
                                    else if (val === null) {
                                        conditions.push(`${relAlias}.${key} IS NULL`);
                                    }
                                    else {
                                        conditions.push(`${relAlias}.${key} ${sqlOp} ?`);
                                        params.push(val);
                                    }
                                }
                            }
                            else {
                                conditions.push(`${relAlias}.${key} = ?`);
                                params.push(value);
                            }
                        }
                    }
                    joinIndex++;
                }
                // Need GROUP BY when using joins to avoid duplicates
                if (joins.length > 0) {
                    groupBy = `GROUP BY ${mainTableAlias}.${this.primaryKey}`;
                }
            }
            // Handle search if provided
            if (search && this.searchableFields.length > 0) {
                const searchConditions = this.searchableFields.map(field => {
                    const dotIndex = field.indexOf('.');
                    // Handle fields with table names
                    if (dotIndex > -1) {
                        const tableName = field.substring(0, dotIndex);
                        const columnName = field.substring(dotIndex + 1);
                        const tableAlias = tableAliases[tableName] || mainTableAlias;
                        params.push(`%${search}%`);
                        return `${tableAlias}.${columnName} LIKE ?`;
                    }
                    else {
                        params.push(`%${search}%`);
                        return `${mainTableAlias}.${field} LIKE ?`;
                    }
                });
                if (searchConditions.length > 0) {
                    conditions.push(`(${searchConditions.join(' OR ')})`);
                }
            }
            // Process main table filters
            if (filters && Object.keys(filters).length > 0) {
                for (const [key, value] of Object.entries(filters)) {
                    // Check if filter key contains table reference (tableName.columnName)
                    const dotIndex = key.indexOf('.');
                    let tableAlias = mainTableAlias;
                    let columnName = key;
                    if (dotIndex > -1) {
                        const tableName = key.substring(0, dotIndex);
                        columnName = key.substring(dotIndex + 1);
                        tableAlias = tableAliases[tableName] || mainTableAlias;
                    }
                    // Handle different types of filter values
                    if (value === null) {
                        conditions.push(`${tableAlias}.${columnName} IS NULL`);
                    }
                    else if (Array.isArray(value)) {
                        if (value.length === 0) {
                            conditions.push('FALSE');
                        }
                        else {
                            const placeholders = value.map(() => '?').join(', ');
                            conditions.push(`${tableAlias}.${columnName} IN (${placeholders})`);
                            params.push(...value);
                        }
                    }
                    else if (typeof value === 'object') {
                        for (const [op, val] of Object.entries(value)) {
                            let sqlOp;
                            switch (op) {
                                case 'gt':
                                    sqlOp = '>';
                                    break;
                                case 'lt':
                                    sqlOp = '<';
                                    break;
                                case 'gte':
                                    sqlOp = '>=';
                                    break;
                                case 'lte':
                                    sqlOp = '<=';
                                    break;
                                case 'ne':
                                    sqlOp = '!=';
                                    break;
                                case 'like':
                                    sqlOp = 'LIKE';
                                    break;
                                case 'ilike':
                                    sqlOp = 'ILIKE';
                                    break;
                                default: sqlOp = '=';
                            }
                            if (val === null && op === 'ne') {
                                conditions.push(`${tableAlias}.${columnName} IS NOT NULL`);
                            }
                            else if (val === null) {
                                conditions.push(`${tableAlias}.${columnName} IS NULL`);
                            }
                            else {
                                conditions.push(`${tableAlias}.${columnName} ${sqlOp} ?`);
                                params.push(val);
                            }
                        }
                    }
                    else {
                        conditions.push(`${tableAlias}.${columnName} = ?`);
                        params.push(value);
                    }
                }
            }
            if (conditions.length > 0) {
                whereClause = `WHERE ${conditions.join(' AND ')}`;
            }
            // Build SELECT clause
            let selectFields = '';
            if (relations && Array.isArray(relations) && relations.length > 0) {
                // Handle selections from multiple tables
                const selectParts = [];
                // Main table fields
                if (fields) {
                    if (typeof fields === 'string') {
                        selectParts.push(`${mainTableAlias}.${fields}`);
                    }
                    else if (Array.isArray(fields)) {
                        selectParts.push(fields.map(f => `${mainTableAlias}.${f}`).join(', '));
                    }
                }
                else {
                    selectParts.push(`${mainTableAlias}.*`);
                }
                // Related table fields with JSON aggregation
                for (const relation of relations) {
                    if (!relation.table)
                        continue;
                    const relAlias = tableAliases[relation.table];
                    const as = relation.as || relation.table;
                    // Include specific relation fields or all
                    const relationFields = relation.select || '*';
                    let relFieldsStr = '';
                    if (relationFields === '*') {
                        relFieldsStr = `${relAlias}.*`;
                    }
                    else if (Array.isArray(relationFields)) {
                        relFieldsStr = relationFields.map(f => `${relAlias}.${f} AS "${as}.${f}"`).join(', ');
                    }
                    else if (typeof relationFields === 'string') {
                        relFieldsStr = `${relAlias}.${relationFields} AS "${as}.${relationFields}"`;
                    }
                    if (relFieldsStr) {
                        selectParts.push(relFieldsStr);
                    }
                }
                selectFields = selectParts.join(', ');
            }
            else {
                // Simple table select
                selectFields = this._buildSelectClause(fields);
                // Add table alias if we have it
                if (mainTableAlias) {
                    // If selectFields contains specific field names
                    if (selectFields !== '*') {
                        // Add table alias to each field
                        selectFields = selectFields.split(', ')
                            .map(field => `${mainTableAlias}.${field.trim()}`)
                            .join(', ');
                    }
                    else {
                        selectFields = `${mainTableAlias}.*`;
                    }
                }
            }
            // Build ORDER BY clause with table alias
            let orderByClause = '';
            if (sort) {
                let sortFields = [];
                if (typeof sort === 'string') {
                    const direction = sort.startsWith('-') ? 'DESC' : 'ASC';
                    const field = sort.startsWith('-') ? sort.substring(1) : sort;
                    const dotIndex = field.indexOf('.');
                    let tableAlias = mainTableAlias;
                    let columnName = field;
                    if (dotIndex > -1) {
                        const tableName = field.substring(0, dotIndex);
                        columnName = field.substring(dotIndex + 1);
                        tableAlias = tableAliases[tableName] || mainTableAlias;
                    }
                    sortFields.push(`${tableAlias}.${columnName} ${direction}`);
                }
                else if (Array.isArray(sort)) {
                    sortFields = sort.map(field => {
                        const direction = field.startsWith('-') ? 'DESC' : 'ASC';
                        const fieldName = field.startsWith('-') ? field.substring(1) : field;
                        const dotIndex = fieldName.indexOf('.');
                        let tableAlias = mainTableAlias;
                        let columnName = fieldName;
                        if (dotIndex > -1) {
                            const tableName = fieldName.substring(0, dotIndex);
                            columnName = fieldName.substring(dotIndex + 1);
                            tableAlias = tableAliases[tableName] || mainTableAlias;
                        }
                        return `${tableAlias}.${columnName} ${direction}`;
                    });
                }
                else if (typeof sort === 'object') {
                    sortFields = Object.entries(sort).map(([field, direction]) => {
                        const dotIndex = field.indexOf('.');
                        let tableAlias = mainTableAlias;
                        let columnName = field;
                        if (dotIndex > -1) {
                            const tableName = field.substring(0, dotIndex);
                            columnName = field.substring(dotIndex + 1);
                            tableAlias = tableAliases[tableName] || mainTableAlias;
                        }
                        return `${tableAlias}.${columnName} ${(direction || '').toString().toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`;
                    });
                }
                if (sortFields.length > 0) {
                    orderByClause = `ORDER BY ${sortFields.join(', ')}`;
                }
            }
            // Build pagination clauses
            let limitClause = '';
            let offsetClause = '';
            let page = 1;
            let limit = 0;
            let offset = 0;
            if (pagination) {
                page = Math.max(1, parseInt(pagination.page) || 1);
                limit = pagination.limit ?
                    Math.min(this.maxLimit, Math.max(1, parseInt(pagination.limit))) :
                    this.defaultLimit;
                offset = (page - 1) * limit;
                limitClause = `LIMIT ${limit}`;
                offsetClause = `OFFSET ${offset}`;
            }
            // Build FROM clause with joins
            const fromClause = joins.length > 0
                ? `FROM ${this.table} ${mainTableAlias} ${joins.join(' ')}`
                : `FROM ${this.table} ${mainTableAlias}`;
            // Execute count query for pagination
            let total = 0;
            if (pagination || isLegacyCall) {
                // We need to use a subquery for accurate counts with JOINs
                let countQuery;
                if (joins.length > 0) {
                    countQuery = `
            SELECT COUNT(DISTINCT ${mainTableAlias}.${this.primaryKey}) as total 
            ${fromClause} 
            ${whereClause}
          `;
                }
                else {
                    countQuery = `
            SELECT COUNT(*) as total 
            ${fromClause} 
            ${whereClause}
          `;
                }
                const [countResult] = await this.db.prepare(countQuery, params);
                total = parseInt(countResult.total);
            }
            // Execute data query
            const dataQuery = `
        SELECT ${selectFields} 
        ${fromClause} 
        ${whereClause} 
        ${groupBy}
        ${orderByClause} 
        ${limitClause} 
        ${offsetClause}
      `;
            const rawData = await this.db.prepare(dataQuery, params);
            // Process results to nest relation data
            let data = rawData;
            if (relations && Array.isArray(relations) && relations.length > 0) {
                // Group related data into nested objects
                data = this._processRelatedData(rawData, relations);
            }
            // Build result
            const result = {
                data,
                pagination: {
                    total,
                    page,
                    limit: limit || total,
                    pages: limit ? Math.ceil(total / limit) : 1,
                    hasNext: limit ? (offset + limit < total) : false
                }
            };
            // Cache result
            if (this.useCache) {
                await this.cache.set(cacheKey, JSON.stringify(result), 'EX', this.cacheTTL);
            }
            return result;
        }
        catch (error) {
            console.error(`[${this.table}] findAll error:`, error);
            throw error;
        }
    }
    // Alias getAll to findAll for backward compatibility
    async getAll(options = {}) {
        return this.findAll(options);
    }
    /**
     * Process query results to organize related data
     * @private
     */
    _processRelatedData(rawData, relations) {
        const result = [...rawData];
        // Process each record
        for (let i = 0; i < result.length; i++) {
            const record = result[i];
            // Skip processing if null or undefined
            if (!record)
                continue;
            // Process each relation
            relations.forEach(relation => {
                const as = relation.as || relation.table;
                // Initialize relation objects on the record
                if (relation.type === 'many') {
                    record[as] = [];
                }
                else {
                    record[as] = {};
                }
            });
        }
        // Dictionary to keep track of relations for each record
        const relationData = {};
        // Process each record
        for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i];
            // Skip processing if null or undefined
            if (!row)
                continue;
            const recordId = row[this.primaryKey];
            if (!recordId)
                continue;
            // Initialize record in relation data dictionary
            if (!relationData[recordId]) {
                relationData[recordId] = {};
            }
            // Process each relation
            relations.forEach(relation => {
                const as = relation.as || relation.table;
                // Initialize relation in record if not exists
                if (!relationData[recordId][as]) {
                    relationData[recordId][as] = relation.type === 'many' ? [] : {};
                }
                // Get relation object for this record
                const relObject = relationData[recordId][as];
                let hasRelatedData = false;
                // Process each relation field
                const relFields = relation.select || '*';
                if (relFields === '*') {
                    // Handle all fields
                    Object.keys(row).forEach(key => {
                        // If the key starts with the relation prefix
                        const prefix = `${as}.`;
                        if (key.startsWith(prefix)) {
                            const field = key.substring(prefix.length);
                            // If the relation field exists in the result
                            if (key in row) {
                                // Add the field to the relation object
                                if (relation.type === 'many') {
                                    // Handle many relation case - initialize array with object if empty
                                    const relArray = relObject;
                                    if (relArray.length === 0) {
                                        relArray.push({});
                                    }
                                    relArray[0][field] = row[key];
                                }
                                else {
                                    // Handle single relation case
                                    relObject[field] = row[key];
                                }
                                // Mark that we found related data
                                hasRelatedData = true;
                            }
                        }
                    });
                }
                else {
                    // Handle specific relation fields
                    if (Array.isArray(relFields)) {
                        relFields.forEach(field => {
                            const relFieldKey = `${as}.${field}`;
                            // If the relation field exists in the result
                            if (relFieldKey in row) {
                                // Add the field to the relation object
                                if (relation.type === 'many') {
                                    // Handle many relation case - initialize array with object if empty
                                    const relArray = relObject;
                                    if (relArray.length === 0) {
                                        relArray.push({});
                                    }
                                    relArray[0][field] = row[relFieldKey];
                                }
                                else {
                                    // Handle single relation case
                                    relObject[field] = row[relFieldKey];
                                }
                                // Mark that we found related data
                                hasRelatedData = true;
                            }
                        });
                    }
                    else if (typeof relFields === 'string') {
                        const relFieldKey = `${as}.${relFields}`;
                        // If the relation field exists in the result
                        if (relFieldKey in row) {
                            // Add the field to the relation object
                            if (relation.type === 'many') {
                                // Handle many relation case - initialize array with object if empty
                                const relArray = relObject;
                                if (relArray.length === 0) {
                                    relArray.push({});
                                }
                                relArray[0][relFields] = row[relFieldKey];
                            }
                            else {
                                // Handle single relation case
                                relObject[relFields] = row[relFieldKey];
                            }
                            // Mark that we found related data
                            hasRelatedData = true;
                        }
                    }
                }
                // Only set if we actually found related data
                if (hasRelatedData) {
                    if (relation.type === 'many') {
                        relationData[recordId][as] = relObject;
                    }
                    else {
                        // If relation has only a single field, extract the value directly
                        if (relation.select && Array.isArray(relation.select) && relation.select.length === 1) {
                            const singleField = relation.select[0];
                            relationData[recordId][as] = relObject[singleField];
                        }
                        else {
                            relationData[recordId][as] = relObject;
                        }
                    }
                }
                else {
                    // If no relation data was found, set to null for single relations
                    // or empty array for many relations
                    relationData[recordId][as] = relation.type === 'many' ? [] : {};
                }
            });
        }
        return result;
    }
    /**
     * Find a record by its primary key
     */
    async findById(id, fields) {
        if (!id)
            return null;
        const cacheKey = this._buildCacheKey('findById', { id, fields });
        // Try to get from cache
        if (this.useCache) {
            const cached = await this.cache.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
        try {
            const selectClause = this._buildSelectClause(fields);
            const query = `SELECT ${selectClause} FROM ${this.table} WHERE ${this.primaryKey} = ?`;
            const results = await this.db.prepare(query, [id]);
            const record = results.length > 0 ? results[0] : null;
            // Cache result
            if (this.useCache && record) {
                await this.cache.set(cacheKey, JSON.stringify(record), 'EX', this.cacheTTL);
            }
            return record;
        }
        catch (error) {
            console.error(`[${this.table}] findById error:`, error);
            throw error;
        }
    }
    /**
     * Find a record by a specific field value
     */
    async findByField(field, value, fields) {
        if (!field)
            return null;
        const cacheKey = this._buildCacheKey('findByField', { field, value, fields });
        // Try to get from cache
        if (this.useCache) {
            const cached = await this.cache.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
        try {
            const selectClause = this._buildSelectClause(fields);
            const query = `SELECT ${selectClause} FROM ${this.table} WHERE ${field} = ? LIMIT 1`;
            const results = await this.db.prepare(query, [value]);
            const record = results.length > 0 ? results[0] : null;
            // Cache result
            if (this.useCache && record) {
                await this.cache.set(cacheKey, JSON.stringify(record), 'EX', this.cacheTTL);
            }
            return record;
        }
        catch (error) {
            console.error(`[${this.table}] findByField error:`, error);
            throw error;
        }
    }
    /**
     * Create a new record
     */
    async create(data, returnRecord = true) {
        if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
            throw new Error('Data must be a non-empty object');
        }
        // Add UUID if no ID is provided and primaryKey is 'id'
        if (this.primaryKey === 'id' && !data.id) {
            data.id = (0, uuid_1.v4)();
        }
        try {
            const keys = Object.keys(data).join(", ");
            const values = Object.values(data);
            const placeholders = values.map(() => "?").join(", ");
            let query = `INSERT INTO ${this.table} (${keys}) VALUES (${placeholders})`;
            if (returnRecord) {
                query += ` RETURNING *`;
            }
            const result = await this.db.prepare(query, values);
            // Invalidate cache
            if (this.useCache) {
                await this.invalidateTableCache();
            }
            return returnRecord ? result[0] : result;
        }
        catch (error) {
            console.error(`[${this.table}] create error:`, error);
            throw error;
        }
    }
    /**
     * Update a record by ID
     */
    async update(id, data, returnRecord = true) {
        if (!id) {
            throw new Error('ID is required');
        }
        if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
            throw new Error('Update data must be a non-empty object');
        }
        try {
            const updates = Object.keys(data).map((key) => `${key} = ?`).join(", ");
            let query = `UPDATE ${this.table} SET ${updates} WHERE ${this.primaryKey} = ?`;
            if (returnRecord) {
                query += ` RETURNING *`;
            }
            const result = await this.db.prepare(query, [...Object.values(data), id]);
            // Invalidate cache
            if (this.useCache) {
                await Promise.all([
                    this.cache.del(this._buildCacheKey('findById', { id })),
                    this.invalidateTableCache()
                ]);
            }
            return returnRecord ? (result.length > 0 ? result[0] : null) : result;
        }
        catch (error) {
            console.error(`[${this.table}] update error:`, error);
            throw error;
        }
    }
    /**
     * Delete a record by ID
     */
    async delete(id, returnRecord = false) {
        if (!id) {
            throw new Error('ID is required');
        }
        try {
            let deletedRecord = null;
            // If we need to return the record, get it first
            if (returnRecord) {
                deletedRecord = await this.findById(id);
                if (!deletedRecord)
                    return null;
            }
            const query = `DELETE FROM ${this.table} WHERE ${this.primaryKey} = ?`;
            const result = await this.db.prepare(query, [id]);
            // Invalidate cache
            if (this.useCache) {
                await Promise.all([
                    this.cache.del(this._buildCacheKey('findById', { id })),
                    this.invalidateTableCache()
                ]);
            }
            return returnRecord ? deletedRecord : result;
        }
        catch (error) {
            console.error(`[${this.table}] delete error:`, error);
            throw error;
        }
    }
    /**
     * Count records matching filters
     */
    async count(filters = {}) {
        const cacheKey = this._buildCacheKey('count', { filters });
        // Try to get from cache
        if (this.useCache) {
            const cached = await this.cache.get(cacheKey);
            if (cached) {
                return parseInt(cached);
            }
        }
        try {
            // Build WHERE clause
            let params = [];
            let conditions = [];
            for (const [key, value] of Object.entries(filters)) {
                if (value === null) {
                    conditions.push(`${key} IS NULL`);
                }
                else if (Array.isArray(value)) {
                    if (value.length === 0) {
                        conditions.push('FALSE');
                    }
                    else {
                        const placeholders = value.map(() => '?').join(', ');
                        conditions.push(`${key} IN (${placeholders})`);
                        params.push(...value);
                    }
                }
                else if (typeof value === 'object') {
                    for (const [op, val] of Object.entries(value)) {
                        let sqlOp;
                        switch (op) {
                            case 'gt':
                                sqlOp = '>';
                                break;
                            case 'lt':
                                sqlOp = '<';
                                break;
                            case 'gte':
                                sqlOp = '>=';
                                break;
                            case 'lte':
                                sqlOp = '<=';
                                break;
                            case 'ne':
                                sqlOp = '!=';
                                break;
                            case 'like':
                                sqlOp = 'LIKE';
                                break;
                            default: sqlOp = '=';
                        }
                        conditions.push(`${key} ${sqlOp} ?`);
                        params.push(val);
                    }
                }
                else {
                    conditions.push(`${key} = ?`);
                    params.push(value);
                }
            }
            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            const query = `SELECT COUNT(*) as count FROM ${this.table} ${whereClause}`;
            const [result] = await this.db.prepare(query, params);
            const count = parseInt(result.count);
            // Cache result
            if (this.useCache) {
                await this.cache.set(cacheKey, count.toString(), 'EX', this.cacheTTL);
            }
            return count;
        }
        catch (error) {
            console.error(`[${this.table}] count error:`, error);
            throw error;
        }
    }
    /**
     * Execute multiple operations in a transaction
     */
    async withTransaction(callback) {
        return this.db.transaction(async (conn) => {
            // Create a transaction-specific model
            const txModel = {
                table: this.table,
                primaryKey: this.primaryKey,
                // Transaction-specific methods
                executeQuery: async (sql, params = []) => {
                    return await conn.prepare(sql, params);
                },
                create: async (data, returnRecord = true) => {
                    const keys = Object.keys(data).join(', ');
                    const values = Object.values(data);
                    const placeholders = values.map(() => '?').join(', ');
                    let query = `INSERT INTO ${this.table} (${keys}) VALUES (${placeholders})`;
                    if (returnRecord) {
                        query += ` RETURNING *`;
                    }
                    const result = await conn.prepare(query, values);
                    return returnRecord ? result[0] : result;
                },
                update: async (id, data, returnRecord = true) => {
                    const updates = Object.keys(data).map(key => `${key} = ?`).join(', ');
                    let query = `UPDATE ${this.table} SET ${updates} WHERE ${this.primaryKey} = ?`;
                    if (returnRecord) {
                        query += ` RETURNING *`;
                    }
                    const result = await conn.prepare(query, [...Object.values(data), id]);
                    return returnRecord ? (result.length > 0 ? result[0] : null) : result;
                },
                delete: async (id, returnRecord = false) => {
                    if (returnRecord) {
                        const query = `SELECT * FROM ${this.table} WHERE ${this.primaryKey} = ?`;
                        const records = await conn.prepare(query, [id]);
                        const record = records.length > 0 ? records[0] : null;
                        if (!record)
                            return null;
                        await conn.prepare(`DELETE FROM ${this.table} WHERE ${this.primaryKey} = ?`, [id]);
                        return record;
                    }
                    else {
                        const query = `DELETE FROM ${this.table} WHERE ${this.primaryKey} = ?`;
                        return await conn.prepare(query, [id]);
                    }
                },
                findById: async (id, fields) => {
                    const selectFields = this._buildSelectClause(fields);
                    const query = `SELECT ${selectFields} FROM ${this.table} WHERE ${this.primaryKey} = ?`;
                    const records = await conn.prepare(query, [id]);
                    return records.length > 0 ? records[0] : null;
                }
            };
            // Execute the callback with our transaction model
            const result = await callback(txModel);
            // Invalidate cache after successful transaction
            if (this.useCache) {
                await this.invalidateTableCache();
            }
            return result;
        });
    }
    /**
     * Execute a custom query
     */
    async executeQuery(sql, params = []) {
        try {
            return await this.db.prepare(sql, params);
        }
        catch (error) {
            console.error(`[${this.table}] executeQuery error:`, error);
            throw error;
        }
    }
    /**
     * Invalidate all cache for this table
     */
    async invalidateTableCache() {
        if (!this.useCache)
            return;
        try {
            const keys = await this.cache.keys(`${this.table}:*`);
            if (keys.length > 0) {
                await this.cache.del(keys);
            }
        }
        catch (error) {
            console.error(`[${this.table}] invalidateTableCache error:`, error);
            // Don't throw as cache invalidation should not break functionality
        }
    }
    /**
     * Build a cache key for an operation
     * @private
     */
    _buildCacheKey(operation, params = {}) {
        return `${this.table}:${operation}:${JSON.stringify(params)}`;
    }
    /**
     * Build field selection clause
     * @private
     */
    _buildSelectClause(fields) {
        if (!fields || (Array.isArray(fields) && fields.length === 0)) {
            return '*';
        }
        if (typeof fields === 'string') {
            return fields;
        }
        if (Array.isArray(fields)) {
            return fields.join(', ');
        }
        return '*';
    }
}
exports.DynamicModel = DynamicModel;
