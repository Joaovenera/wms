import { drizzle } from 'drizzle-orm/node-postgres';
import { schema } from "./infrastructure/database/schemas/index";
import { postgresPool } from './config/postgres';

// Export the PostgreSQL pool for direct use if needed
export const pool = postgresPool;

// Create Drizzle instance with our configured pool
export const db = drizzle(pool, { schema });