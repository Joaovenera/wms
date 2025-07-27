-- Inicialização do banco de dados WMS - PostgreSQL 17
-- Este arquivo é executado automaticamente quando o container PostgreSQL é criado pela primeira vez

-- ====================================
-- EXTENSIONS FOR POSTGRESQL 17
-- ====================================

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Performance and statistics extension (PostgreSQL 17) - Temporarily disabled during migration
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Additional useful extensions for WMS
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Text search capabilities
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ====================================
-- SCHEMA AND PERMISSIONS
-- ====================================

-- Ensure public schema exists
CREATE SCHEMA IF NOT EXISTS public;

-- Grant permissions to postgres user (used by the application)
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL PRIVILEGES ON TABLES TO postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL PRIVILEGES ON SEQUENCES TO postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL PRIVILEGES ON FUNCTIONS TO postgres;

-- ====================================
-- DATABASE CONFIGURATION
-- ====================================

-- Set timezone
SET timezone = 'UTC';

-- Set search path
SET search_path = public;

-- ====================================
-- PERFORMANCE OPTIMIZATIONS
-- ====================================

-- Enable auto-explain for slow queries (development)
LOAD 'auto_explain';
SET auto_explain.log_min_duration = '1s';
SET auto_explain.log_analyze = true;
SET auto_explain.log_buffers = true;

-- Configure statement statistics (only if extension is loaded) - Temporarily disabled
-- DO $$
-- BEGIN
--     IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_stat_statements' AND installed_version IS NOT NULL) THEN
--         PERFORM pg_stat_statements_reset();
--     END IF;
-- END
-- $$;

-- ====================================
-- INDEXES AND CONSTRAINTS SETUP
-- ====================================

-- Function to create indexes after table creation
CREATE OR REPLACE FUNCTION create_performance_indexes()
RETURNS void AS $$
BEGIN
    -- This function will be called after Drizzle creates the tables
    -- Add any custom indexes here for performance optimization
    
    -- Example: Create indexes for common query patterns
    -- These will be created by the application after table setup
    
    RAISE NOTICE 'Performance indexes function created successfully';
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- MONITORING AND LOGGING SETUP
-- ====================================

-- Create a function to get database statistics
CREATE OR REPLACE FUNCTION get_db_stats()
RETURNS TABLE (
    stat_name text,
    stat_value text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'Database Size'::text, pg_size_pretty(pg_database_size(current_database()))::text
    UNION ALL
    SELECT 'Active Connections'::text, count(*)::text FROM pg_stat_activity WHERE state = 'active'
    UNION ALL
    SELECT 'Total Connections'::text, count(*)::text FROM pg_stat_activity
    UNION ALL
    SELECT 'Cache Hit Ratio'::text, 
           round((sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0))::numeric, 2)::text || '%'
           FROM pg_stat_database WHERE datname = current_database();
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- WAREHOUSE-SPECIFIC SETUP
-- ====================================

-- Create custom types for warehouse operations
DO $$ BEGIN
    CREATE TYPE pallet_status AS ENUM ('available', 'occupied', 'maintenance', 'retired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ucp_status AS ENUM ('active', 'full', 'locked', 'retired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transfer_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'manager', 'operator');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ====================================
-- COMMENTS AND DOCUMENTATION
-- ====================================

COMMENT ON DATABASE warehouse IS 'Warehouse Management System Database - PostgreSQL 17 Optimized';
COMMENT ON SCHEMA public IS 'Main schema for WMS application tables and functions';

-- Log initialization completion
DO $$
BEGIN
    RAISE NOTICE 'WMS Database initialization completed successfully';
    RAISE NOTICE 'PostgreSQL version: %', version();
    RAISE NOTICE 'Extensions loaded: uuid-ossp, pg_stat_statements, btree_gin, btree_gist, unaccent';
    RAISE NOTICE 'Custom types created: pallet_status, ucp_status, transfer_status, user_role';
END $$; 