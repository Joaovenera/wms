import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import { postgresPool } from '../config/postgres.js';

// Create Drizzle instance with our complete schema
export const db = drizzle(postgresPool, { schema });

// Export the PostgreSQL pool for direct use if needed
export const pool = postgresPool;

// Export all schema elements
export * from './schema.js';