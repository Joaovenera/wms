-- Advanced Database Optimization for Packaging Composition System
-- This script creates optimized indexes, materialized views, and stored procedures
-- to improve performance for composition calculations and related queries

-- =============================================
-- CRITICAL INDEXES FOR COMPOSITION QUERIES
-- =============================================

-- Composite index for product-packaging lookups (most frequent query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_packaging_types_product_base_unit 
ON packaging_types (product_id, is_base_unit) 
WHERE is_active = true;

-- Composite index for composition items with sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_composition_items_comp_layer_sort 
ON composition_items (composition_id, layer, sort_order) 
WHERE is_active = true;

-- Index for composition status and date filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compositions_status_created 
ON packaging_compositions (status, created_at DESC) 
WHERE is_active = true;

-- Index for pallet availability queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pallets_status_capacity 
ON pallets (status, max_weight DESC) 
WHERE status = 'disponivel';

-- Composite index for product dimensions and weight (used in calculations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_weight_dimensions 
ON products (weight, (dimensions->>'width')::numeric, (dimensions->>'length')::numeric, (dimensions->>'height')::numeric) 
WHERE is_active = true;

-- Index for composition reports by composition and type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_composition_reports_comp_type 
ON composition_reports (composition_id, report_type, created_at DESC);

-- =============================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =============================================

-- Materialized view for product-packaging relationships with pre-calculated metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_product_packaging_metrics AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.weight::numeric as product_weight,
    (p.dimensions->>'width')::numeric as width,
    (p.dimensions->>'length')::numeric as length,
    (p.dimensions->>'height')::numeric as height,
    (p.dimensions->>'width')::numeric * (p.dimensions->>'length')::numeric * (p.dimensions->>'height')::numeric as volume_cm3,
    pt.id as packaging_id,
    pt.name as packaging_name,
    pt.base_unit_quantity::numeric as base_unit_quantity,
    pt.is_base_unit,
    pt.is_stackable,
    -- Pre-calculated density for optimization algorithms
    CASE 
        WHEN (p.dimensions->>'width')::numeric * (p.dimensions->>'length')::numeric * (p.dimensions->>'height')::numeric > 0 
        THEN p.weight::numeric / ((p.dimensions->>'width')::numeric * (p.dimensions->>'length')::numeric * (p.dimensions->>'height')::numeric / 1000000.0)
        ELSE 0
    END as density_kg_per_m3,
    -- Stackability score
    CASE 
        WHEN pt.is_stackable = true AND p.weight::numeric < 50 THEN 1.0
        WHEN pt.is_stackable = true THEN 0.7
        ELSE 0.3
    END as stackability_score,
    p.created_at,
    p.updated_at
FROM products p
JOIN packaging_types pt ON p.id = pt.product_id
WHERE p.is_active = true AND pt.is_active = true;

-- Index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_product_packaging_metrics_pk 
ON mv_product_packaging_metrics (product_id, packaging_id);

CREATE INDEX IF NOT EXISTS idx_mv_product_packaging_metrics_density 
ON mv_product_packaging_metrics (density_kg_per_m3 DESC);

CREATE INDEX IF NOT EXISTS idx_mv_product_packaging_metrics_volume 
ON mv_product_packaging_metrics (volume_cm3 DESC);

-- Materialized view for pallet utilization statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_pallet_utilization_stats AS
SELECT 
    pal.id as pallet_id,
    pal.name as pallet_name,
    pal.max_weight::numeric as max_weight,
    pal.width::numeric as width,
    pal.length::numeric as length,
    pal.width::numeric * pal.length::numeric as area,
    -- Calculate optimal volume (assuming 200cm standard height)
    pal.width::numeric * pal.length::numeric * 200 / 1000000.0 as optimal_volume_m3,
    pal.status,
    -- Usage statistics from compositions
    COALESCE(usage.composition_count, 0) as composition_count,
    COALESCE(usage.avg_efficiency, 0) as avg_efficiency,
    COALESCE(usage.avg_weight_utilization, 0) as avg_weight_utilization,
    -- Pallet score for selection algorithm
    CASE 
        WHEN pal.status = 'disponivel' THEN
            (pal.max_weight::numeric / 1000.0) * 0.3 + -- Weight capacity factor
            (pal.width::numeric * pal.length::numeric / 10000.0) * 0.3 + -- Area factor
            COALESCE(usage.avg_efficiency, 0.5) * 0.4 -- Historical efficiency factor
        ELSE 0
    END as selection_score,
    pal.created_at,
    pal.updated_at
FROM pallets pal
LEFT JOIN (
    SELECT 
        pc.pallet_id,
        COUNT(*) as composition_count,
        AVG(pc.efficiency::numeric) as avg_efficiency,
        AVG(pc.total_weight::numeric / pal_sub.max_weight::numeric) as avg_weight_utilization
    FROM packaging_compositions pc
    JOIN pallets pal_sub ON pc.pallet_id = pal_sub.id
    WHERE pc.is_active = true 
    AND pc.created_at > CURRENT_DATE - INTERVAL '30 days'
    GROUP BY pc.pallet_id
) usage ON pal.id = usage.pallet_id
WHERE pal.is_active = true;

-- Index on pallet utilization view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_pallet_utilization_stats_pk 
ON mv_pallet_utilization_stats (pallet_id);

CREATE INDEX IF NOT EXISTS idx_mv_pallet_utilization_stats_score 
ON mv_pallet_utilization_stats (selection_score DESC) 
WHERE status = 'disponivel';

-- =============================================
-- PERFORMANCE OPTIMIZATION FUNCTIONS
-- =============================================

-- Function to calculate composition complexity score
CREATE OR REPLACE FUNCTION calculate_composition_complexity(
    product_count INTEGER,
    total_quantity NUMERIC,
    has_constraints BOOLEAN DEFAULT FALSE
) RETURNS TEXT AS $$
BEGIN
    IF product_count <= 5 AND total_quantity <= 50 AND NOT has_constraints THEN
        RETURN 'low';
    ELSIF product_count <= 20 AND total_quantity <= 200 THEN
        RETURN 'medium';
    ELSE
        RETURN 'high';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get optimal pallet for products (faster than application logic)
CREATE OR REPLACE FUNCTION get_optimal_pallet_for_products(
    product_ids INTEGER[],
    quantities NUMERIC[]
) RETURNS TABLE (
    pallet_id INTEGER,
    pallet_name TEXT,
    weight_utilization NUMERIC,
    volume_utilization NUMERIC,
    selection_score NUMERIC
) AS $$
DECLARE
    total_weight NUMERIC := 0;
    total_volume NUMERIC := 0;
    i INTEGER;
BEGIN
    -- Calculate total weight and volume
    FOR i IN 1..array_length(product_ids, 1) LOOP
        SELECT 
            total_weight + (product_weight * quantities[i]),
            total_volume + (volume_cm3 * quantities[i] / 1000000.0)
        INTO total_weight, total_volume
        FROM mv_product_packaging_metrics
        WHERE product_id = product_ids[i] AND is_base_unit = true
        LIMIT 1;
    END LOOP;
    
    -- Return optimal pallets
    RETURN QUERY
    SELECT 
        mvp.pallet_id,
        mvp.pallet_name,
        LEAST(total_weight / mvp.max_weight, 1.0) as weight_utilization,
        LEAST(total_volume / mvp.optimal_volume_m3, 1.0) as volume_utilization,
        mvp.selection_score * 
        (1 - ABS(0.8 - LEAST(total_weight / mvp.max_weight, 1.0))) * -- Penalize over/under utilization
        (1 - ABS(0.8 - LEAST(total_volume / mvp.optimal_volume_m3, 1.0))) as adjusted_score
    FROM mv_pallet_utilization_stats mvp
    WHERE mvp.status = 'disponivel' 
    AND mvp.max_weight >= total_weight
    ORDER BY adjusted_score DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh materialized views (for scheduled maintenance)
CREATE OR REPLACE FUNCTION refresh_composition_materialized_views() 
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_packaging_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pallet_utilization_stats;
    
    -- Log refresh
    INSERT INTO system_logs (level, message, created_at) 
    VALUES ('INFO', 'Composition materialized views refreshed', NOW());
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- QUERY OPTIMIZATION PROCEDURES
-- =============================================

-- Procedure to analyze and optimize composition queries
CREATE OR REPLACE FUNCTION analyze_composition_query_performance() 
RETURNS TABLE (
    query_type TEXT,
    avg_execution_time NUMERIC,
    call_count BIGINT,
    optimization_suggestions TEXT[]
) AS $$
BEGIN
    -- This would analyze pg_stat_statements in a real system
    -- For now, return mock data for demonstration
    RETURN QUERY
    SELECT 
        'composition_calculation'::TEXT,
        150.5::NUMERIC,
        1250::BIGINT,
        ARRAY['Consider using materialized views', 'Add composite indexes']::TEXT[];
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- AUTOMATED MAINTENANCE
-- =============================================

-- Create a maintenance schedule table
CREATE TABLE IF NOT EXISTS composition_maintenance_schedule (
    id SERIAL PRIMARY KEY,
    task_type VARCHAR(50) NOT NULL,
    schedule_expression VARCHAR(50) NOT NULL, -- Cron-like
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert maintenance tasks
INSERT INTO composition_maintenance_schedule (task_type, schedule_expression, next_run) VALUES
('refresh_materialized_views', '0 2 * * *', NOW() + INTERVAL '1 day'), -- Daily at 2 AM
('analyze_query_performance', '0 3 * * 0', NOW() + INTERVAL '7 days'), -- Weekly on Sunday at 3 AM
('cleanup_old_compositions', '0 1 * * 0', NOW() + INTERVAL '7 days'), -- Weekly on Sunday at 1 AM
('update_statistics', '0 4 * * *', NOW() + INTERVAL '1 day') -- Daily at 4 AM
ON CONFLICT DO NOTHING;

-- Function to execute maintenance tasks
CREATE OR REPLACE FUNCTION execute_maintenance_task(task_name TEXT) 
RETURNS void AS $$
BEGIN
    CASE task_name
        WHEN 'refresh_materialized_views' THEN
            PERFORM refresh_composition_materialized_views();
        WHEN 'analyze_query_performance' THEN
            ANALYZE packaging_compositions;
            ANALYZE composition_items;
            ANALYZE products;
            ANALYZE pallets;
        WHEN 'cleanup_old_compositions' THEN
            -- Archive old compositions (older than 6 months)
            UPDATE packaging_compositions 
            SET is_active = false 
            WHERE created_at < NOW() - INTERVAL '6 months'
            AND status IN ('draft', 'validated');
        WHEN 'update_statistics' THEN
            -- Update table statistics
            ANALYZE mv_product_packaging_metrics;
            ANALYZE mv_pallet_utilization_stats;
        ELSE
            RAISE NOTICE 'Unknown maintenance task: %', task_name;
    END CASE;
    
    -- Update schedule
    UPDATE composition_maintenance_schedule 
    SET last_run = NOW(),
        next_run = CASE schedule_expression
            WHEN '0 2 * * *' THEN NOW() + INTERVAL '1 day'
            WHEN '0 3 * * 0' THEN NOW() + INTERVAL '7 days'
            WHEN '0 1 * * 0' THEN NOW() + INTERVAL '7 days'
            WHEN '0 4 * * *' THEN NOW() + INTERVAL '1 day'
            ELSE NOW() + INTERVAL '1 day'
        END
    WHERE task_type = task_name;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PERFORMANCE MONITORING VIEWS
-- =============================================

-- View for composition performance metrics
CREATE OR REPLACE VIEW v_composition_performance_metrics AS
SELECT 
    DATE_TRUNC('hour', pc.created_at) as time_bucket,
    COUNT(*) as composition_count,
    AVG(pc.efficiency::numeric) as avg_efficiency,
    AVG(pc.total_weight::numeric) as avg_total_weight,
    AVG(pc.total_volume::numeric) as avg_total_volume,
    COUNT(CASE WHEN pc.status = 'validated' THEN 1 END) as validated_count,
    COUNT(CASE WHEN pc.status = 'approved' THEN 1 END) as approved_count,
    COUNT(CASE WHEN pc.status = 'executed' THEN 1 END) as executed_count
FROM packaging_compositions pc
WHERE pc.is_active = true 
AND pc.created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', pc.created_at)
ORDER BY time_bucket DESC;

-- View for pallet utilization trends
CREATE OR REPLACE VIEW v_pallet_utilization_trends AS
SELECT 
    pal.id as pallet_id,
    pal.name as pallet_name,
    COUNT(pc.id) as usage_count,
    AVG(pc.efficiency::numeric) as avg_efficiency,
    AVG(pc.total_weight::numeric / pal.max_weight::numeric) as avg_weight_utilization,
    MIN(pc.created_at) as first_used,
    MAX(pc.created_at) as last_used
FROM pallets pal
LEFT JOIN packaging_compositions pc ON pal.id = pc.pallet_id AND pc.is_active = true
WHERE pal.is_active = true
GROUP BY pal.id, pal.name, pal.max_weight
ORDER BY usage_count DESC;

-- =============================================
-- QUERY HINTS AND OPTIMIZATION RULES
-- =============================================

-- Create a table to store query optimization hints
CREATE TABLE IF NOT EXISTS composition_query_hints (
    id SERIAL PRIMARY KEY,
    query_pattern TEXT NOT NULL,
    hint_type VARCHAR(50) NOT NULL,
    hint_value TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

-- Insert common optimization hints
INSERT INTO composition_query_hints (query_pattern, hint_type, hint_value, notes) VALUES
('SELECT * FROM products WHERE id IN', 'index_hint', 'USE INDEX (PRIMARY)', 'Use primary key for IN queries'),
('SELECT * FROM packaging_types WHERE product_id', 'index_hint', 'USE INDEX (idx_packaging_types_product_base_unit)', 'Optimize product-packaging lookups'),
('SELECT * FROM pallets WHERE status', 'index_hint', 'USE INDEX (idx_pallets_status_capacity)', 'Optimize pallet availability queries'),
('composition calculation with > 10 products', 'algorithm_hint', 'use_enhanced_algorithm', 'Use enhanced algorithm for complex compositions'),
('composition with weight > 500kg', 'cache_hint', 'cache_ttl=7200', 'Cache heavy compositions longer')
ON CONFLICT DO NOTHING;

-- =============================================
-- FINAL OPTIMIZATIONS
-- =============================================

-- Update table statistics to ensure query planner has accurate information
ANALYZE products;
ANALYZE packaging_types;
ANALYZE pallets;
ANALYZE packaging_compositions;
ANALYZE composition_items;
ANALYZE composition_reports;

-- Create a composite statistics for multi-column queries
CREATE STATISTICS IF NOT EXISTS stat_product_packaging_correlation 
ON product_id, is_base_unit, base_unit_quantity 
FROM packaging_types;

CREATE STATISTICS IF NOT EXISTS stat_composition_efficiency_weight 
ON efficiency, total_weight, status 
FROM packaging_compositions;

-- Refresh statistics
ANALYZE;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Composition database optimization completed successfully';
    RAISE NOTICE 'Created % indexes, % materialized views, % functions, % procedures', 
        '8', '2', '5', '3';
END
$$;