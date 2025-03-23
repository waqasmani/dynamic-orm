"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NullCacheAdapter = exports.RedisCacheAdapter = exports.DefaultDatabaseAdapter = exports.DynamicModel = exports.Types = void 0;
exports.createORM = createORM;
const DynamicModel_1 = require("./DynamicModel");
Object.defineProperty(exports, "DynamicModel", { enumerable: true, get: function () { return DynamicModel_1.DynamicModel; } });
const database_1 = require("./adapters/database");
Object.defineProperty(exports, "DefaultDatabaseAdapter", { enumerable: true, get: function () { return database_1.DefaultDatabaseAdapter; } });
const cache_1 = require("./adapters/cache");
Object.defineProperty(exports, "RedisCacheAdapter", { enumerable: true, get: function () { return cache_1.RedisCacheAdapter; } });
Object.defineProperty(exports, "NullCacheAdapter", { enumerable: true, get: function () { return cache_1.NullCacheAdapter; } });
const Types = __importStar(require("./types"));
exports.Types = Types;
/**
 * Create a new DynamicORM instance
 */
function createORM(options) {
    const { db, redis, useCache = false } = options;
    if (!db) {
        throw new Error('Database adapter is required');
    }
    // Create the database adapter
    const dbAdapter = new database_1.DefaultDatabaseAdapter(db);
    // Create the cache adapter
    const cacheAdapter = useCache && redis
        ? new cache_1.RedisCacheAdapter(redis)
        : new cache_1.NullCacheAdapter();
    // Return a factory function to create models
    return {
        /**
         * Create a new model for a specific table
         */
        createModel: (table, options = {}) => {
            return new DynamicModel_1.DynamicModel(table, { ...options, useCache }, dbAdapter, cacheAdapter);
        }
    };
}
