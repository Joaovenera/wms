import type { Config } from "drizzle-kit";

// Default to local PostgreSQL for development
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/warehouse';

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export default {
  schema: "./src/infrastructure/database/schemas/index.ts", // Use the new organized schema
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
    // Additional connection options for local PostgreSQL
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  },
  migrations: {
    prefix: 'timestamp',
    table: 'drizzle_migrations',
    schema: 'public',
  },
  // Enhanced configuration for PostgreSQL 17
  introspect: {
    casing: 'snake_case',
  },
  verbose: process.env.NODE_ENV === 'development',
  strict: true,
} satisfies Config;
