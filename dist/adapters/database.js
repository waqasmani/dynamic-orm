"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultDatabaseAdapter = void 0;
/**
 * Default implementation requires the user to provide their own DB adapter
 */
class DefaultDatabaseAdapter {
    constructor(db) {
        this.db = db;
    }
    async prepare(sql, params) {
        if (!this.db || typeof this.db.prepare !== 'function') {
            throw new Error('Database adapter must implement prepare method');
        }
        return this.db.prepare(sql, params);
    }
    async transaction(callback) {
        if (!this.db || typeof this.db.transaction !== 'function') {
            throw new Error('Database adapter must implement transaction method');
        }
        return this.db.transaction(callback);
    }
}
exports.DefaultDatabaseAdapter = DefaultDatabaseAdapter;
