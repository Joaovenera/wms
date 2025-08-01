-- =================================================================
-- COMPOSITION SYSTEM MIGRATION SCRIPT
-- Safe deployment migration for composition system features
-- =================================================================

BEGIN;

-- Create migration tracking table if not exists
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    applied_at TIMESTAMP DEFAULT NOW(),
    rollback_sql TEXT
);

-- Check if this migration has already been applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM _migrations WHERE version = 'composition-system-v1.0.0') THEN
        
        -- =============================================================
        -- COMPOSITION SYSTEM TABLES
        -- =============================================================
        
        -- Create composition_definitions table
        CREATE TABLE IF NOT EXISTS composition_definitions (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            description TEXT,
            composition_data JSONB NOT NULL,
            version INTEGER DEFAULT 1,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            created_by INTEGER REFERENCES users(id),
            
            -- Indexes for performance
            CONSTRAINT valid_composition_data CHECK (jsonb_typeof(composition_data) = 'object')
        );

        CREATE INDEX IF NOT EXISTS idx_composition_definitions_name ON composition_definitions(name);
        CREATE INDEX IF NOT EXISTS idx_composition_definitions_active ON composition_definitions(is_active);
        CREATE INDEX IF NOT EXISTS idx_composition_definitions_created_at ON composition_definitions(created_at);
        CREATE INDEX IF NOT EXISTS idx_composition_definitions_data_gin ON composition_definitions USING GIN(composition_data);

        -- Create composition_instances table
        CREATE TABLE IF NOT EXISTS composition_instances (
            id SERIAL PRIMARY KEY,
            definition_id INTEGER NOT NULL REFERENCES composition_definitions(id) ON DELETE CASCADE,
            instance_data JSONB NOT NULL,
            status VARCHAR(20) DEFAULT 'active',
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            created_by INTEGER REFERENCES users(id),
            
            CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'archived', 'error'))
        );

        CREATE INDEX IF NOT EXISTS idx_composition_instances_definition ON composition_instances(definition_id);
        CREATE INDEX IF NOT EXISTS idx_composition_instances_status ON composition_instances(status);
        CREATE INDEX IF NOT EXISTS idx_composition_instances_created_at ON composition_instances(created_at);
        CREATE INDEX IF NOT EXISTS idx_composition_instances_data_gin ON composition_instances USING GIN(instance_data);

        -- Create composition_relationships table for hierarchical compositions
        CREATE TABLE IF NOT EXISTS composition_relationships (
            id SERIAL PRIMARY KEY,
            parent_id INTEGER NOT NULL REFERENCES composition_instances(id) ON DELETE CASCADE,
            child_id INTEGER NOT NULL REFERENCES composition_instances(id) ON DELETE CASCADE,
            relationship_type VARCHAR(50) NOT NULL,
            weight DECIMAL(5,2) DEFAULT 1.0,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            
            UNIQUE(parent_id, child_id),
            CONSTRAINT no_self_reference CHECK (parent_id != child_id)
        );

        CREATE INDEX IF NOT EXISTS idx_composition_relationships_parent ON composition_relationships(parent_id);
        CREATE INDEX IF NOT EXISTS idx_composition_relationships_child ON composition_relationships(child_id);
        CREATE INDEX IF NOT EXISTS idx_composition_relationships_type ON composition_relationships(relationship_type);

        -- =============================================================
        -- PERFORMANCE OPTIMIZATION TABLES
        -- =============================================================
        
        -- Create materialized view for composition performance
        CREATE MATERIALIZED VIEW IF NOT EXISTS composition_performance_summary AS
        SELECT 
            cd.id as definition_id,
            cd.name,
            COUNT(ci.id) as instance_count,
            COUNT(CASE WHEN ci.status = 'active' THEN 1 END) as active_instances,
            COUNT(CASE WHEN ci.status = 'error' THEN 1 END) as error_instances,
            AVG(jsonb_array_length(ci.instance_data->'components')) as avg_components,
            MAX(ci.updated_at) as last_updated
        FROM composition_definitions cd
        LEFT JOIN composition_instances ci ON cd.id = ci.definition_id
        WHERE cd.is_active = true
        GROUP BY cd.id, cd.name;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_composition_performance_summary_id 
            ON composition_performance_summary(definition_id);

        -- Create composition cache table
        CREATE TABLE IF NOT EXISTS composition_cache (
            cache_key VARCHAR(255) PRIMARY KEY,
            cache_data JSONB NOT NULL,
            ttl INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            accessed_at TIMESTAMP DEFAULT NOW(),
            access_count INTEGER DEFAULT 1
        );

        CREATE INDEX IF NOT EXISTS idx_composition_cache_ttl ON composition_cache(created_at, ttl);
        CREATE INDEX IF NOT EXISTS idx_composition_cache_accessed ON composition_cache(accessed_at);

        -- =============================================================
        -- AUDIT AND LOGGING TABLES
        -- =============================================================
        
        -- Create composition audit log
        CREATE TABLE IF NOT EXISTS composition_audit_log (
            id SERIAL PRIMARY KEY,
            entity_type VARCHAR(50) NOT NULL,
            entity_id INTEGER NOT NULL,
            action VARCHAR(20) NOT NULL,
            old_data JSONB,
            new_data JSONB,
            user_id INTEGER REFERENCES users(id),
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            
            CONSTRAINT valid_action CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'VIEW'))
        );

        CREATE INDEX IF NOT EXISTS idx_composition_audit_entity ON composition_audit_log(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_composition_audit_user ON composition_audit_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_composition_audit_created ON composition_audit_log(created_at);

        -- =============================================================
        -- TRIGGERS FOR AUTOMATIC UPDATES
        -- =============================================================
        
        -- Function to update updated_at timestamp
        CREATE OR REPLACE FUNCTION update_composition_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Triggers for updated_at
        DROP TRIGGER IF EXISTS trigger_composition_definitions_updated_at ON composition_definitions;
        CREATE TRIGGER trigger_composition_definitions_updated_at
            BEFORE UPDATE ON composition_definitions
            FOR EACH ROW EXECUTE FUNCTION update_composition_updated_at();

        DROP TRIGGER IF EXISTS trigger_composition_instances_updated_at ON composition_instances;
        CREATE TRIGGER trigger_composition_instances_updated_at
            BEFORE UPDATE ON composition_instances
            FOR EACH ROW EXECUTE FUNCTION update_composition_updated_at();

        -- Audit trigger function
        CREATE OR REPLACE FUNCTION composition_audit_trigger()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                INSERT INTO composition_audit_log (entity_type, entity_id, action, old_data)
                VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD));
                RETURN OLD;
            ELSIF TG_OP = 'UPDATE' THEN
                INSERT INTO composition_audit_log (entity_type, entity_id, action, old_data, new_data)
                VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
                RETURN NEW;
            ELSIF TG_OP = 'INSERT' THEN
                INSERT INTO composition_audit_log (entity_type, entity_id, action, new_data)
                VALUES (TG_TABLE_NAME, NEW.id, 'CREATE', row_to_json(NEW));
                RETURN NEW;
            END IF;
        END;
        $$ LANGUAGE plpgsql;

        -- Create audit triggers
        DROP TRIGGER IF EXISTS composition_definitions_audit ON composition_definitions;
        CREATE TRIGGER composition_definitions_audit
            AFTER INSERT OR UPDATE OR DELETE ON composition_definitions
            FOR EACH ROW EXECUTE FUNCTION composition_audit_trigger();

        DROP TRIGGER IF EXISTS composition_instances_audit ON composition_instances;
        CREATE TRIGGER composition_instances_audit
            AFTER INSERT OR UPDATE OR DELETE ON composition_instances
            FOR EACH ROW EXECUTE FUNCTION composition_audit_trigger();

        -- =============================================================
        -- PERFORMANCE INDEXES AND CONSTRAINTS
        -- =============================================================
        
        -- Add indexes for existing tables that will work with compositions
        CREATE INDEX IF NOT EXISTS idx_products_composition_data 
            ON products USING GIN((metadata->'composition')) 
            WHERE metadata ? 'composition';

        CREATE INDEX IF NOT EXISTS idx_pallets_composition_data 
            ON pallets USING GIN((metadata->'composition')) 
            WHERE metadata ? 'composition';

        -- =============================================================
        -- INITIAL DATA AND CONFIGURATION
        -- =============================================================
        
        -- Insert default composition definitions
        INSERT INTO composition_definitions (name, description, composition_data, created_by) VALUES
        ('basic_product_composition', 'Basic product composition with quantity and location', 
         '{"type": "product", "components": ["quantity", "location", "expiry"], "rules": {"min_quantity": 1}}', 1),
        ('pallet_composition', 'Standard pallet composition with products and positioning',
         '{"type": "pallet", "components": ["products", "weight", "dimensions"], "rules": {"max_weight": 1000}}', 1),
        ('warehouse_zone_composition', 'Warehouse zone composition with capacity and restrictions',
         '{"type": "zone", "components": ["capacity", "restrictions", "temperature"], "rules": {"max_capacity": 10000}}', 1)
        ON CONFLICT (name) DO NOTHING;

        -- Record this migration
        INSERT INTO _migrations (version, description, rollback_sql) VALUES (
            'composition-system-v1.0.0',
            'Initial composition system tables, indexes, triggers, and base data',
            '
            DROP MATERIALIZED VIEW IF EXISTS composition_performance_summary;
            DROP TABLE IF EXISTS composition_cache;
            DROP TABLE IF EXISTS composition_audit_log;
            DROP TABLE IF EXISTS composition_relationships;
            DROP TABLE IF EXISTS composition_instances;
            DROP TABLE IF EXISTS composition_definitions;
            DROP FUNCTION IF EXISTS update_composition_updated_at();
            DROP FUNCTION IF EXISTS composition_audit_trigger();
            '
        );

        RAISE NOTICE 'Composition system migration v1.0.0 applied successfully';
    ELSE
        RAISE NOTICE 'Composition system migration v1.0.0 already applied, skipping';
    END IF;
END $$;

COMMIT;