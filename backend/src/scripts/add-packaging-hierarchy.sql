-- Migration script para adicionar hierarquia de embalagens
-- Execute com: psql -d wms_db -f add-packaging-hierarchy.sql

BEGIN;

-- Tabela de tipos de embalagem
CREATE TABLE packaging_types (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  barcode VARCHAR(255),
  base_unit_quantity DECIMAL(10,3) NOT NULL CHECK (base_unit_quantity > 0),
  is_base_unit BOOLEAN DEFAULT FALSE,
  parent_packaging_id INTEGER REFERENCES packaging_types(id),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level > 0),
  dimensions JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT prevent_self_reference CHECK (id != parent_packaging_id)
);

-- Constraint para garantir apenas uma unidade base por produto
CREATE UNIQUE INDEX unique_base_unit_per_product 
ON packaging_types(product_id) 
WHERE is_base_unit = true;

-- Constraint para garantir barcode único quando preenchido
CREATE UNIQUE INDEX unique_barcode_when_not_null 
ON packaging_types(barcode) 
WHERE barcode IS NOT NULL;

-- Índices para performance
CREATE INDEX idx_packaging_types_product_id ON packaging_types(product_id);
CREATE INDEX idx_packaging_types_barcode ON packaging_types(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_packaging_types_active ON packaging_types(is_active) WHERE is_active = true;
CREATE INDEX idx_packaging_types_parent ON packaging_types(parent_packaging_id) WHERE parent_packaging_id IS NOT NULL;

-- Tabela de regras de conversão (opcional para performance)
CREATE TABLE packaging_conversion_rules (
  id SERIAL PRIMARY KEY,
  from_packaging_id INTEGER NOT NULL REFERENCES packaging_types(id) ON DELETE CASCADE,
  to_packaging_id INTEGER NOT NULL REFERENCES packaging_types(id) ON DELETE CASCADE,
  conversion_factor DECIMAL(10,3) NOT NULL CHECK (conversion_factor > 0),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_conversion_rule UNIQUE(from_packaging_id, to_packaging_id),
  CONSTRAINT prevent_same_packaging_conversion CHECK (from_packaging_id != to_packaging_id)
);

-- Extensão da tabela ucp_items para suportar embalagens
ALTER TABLE ucp_items 
ADD COLUMN packaging_type_id INTEGER REFERENCES packaging_types(id),
ADD COLUMN packaging_quantity DECIMAL(10,3);

-- Índice para nova coluna
CREATE INDEX idx_ucp_items_packaging_type ON ucp_items(packaging_type_id) WHERE packaging_type_id IS NOT NULL;

-- Migração de dados existentes: criar embalagem base para todos os produtos
INSERT INTO packaging_types (product_id, name, base_unit_quantity, is_base_unit, level, created_by)
SELECT id, unit, 1, true, 1, 1 
FROM products 
WHERE is_active = true;

-- Atualizar ucp_items existentes para referenciar a embalagem base
UPDATE ucp_items 
SET packaging_type_id = pt.id,
    packaging_quantity = quantity
FROM packaging_types pt 
WHERE pt.product_id = ucp_items.product_id 
  AND pt.is_base_unit = true
  AND ucp_items.is_active = true;

-- Função para calcular conversões automaticamente
CREATE OR REPLACE FUNCTION calculate_packaging_conversion(
  from_packaging_id INTEGER,
  to_packaging_id INTEGER
) RETURNS DECIMAL(10,3) AS $$
DECLARE
  from_base_qty DECIMAL(10,3);
  to_base_qty DECIMAL(10,3);
BEGIN
  -- Buscar base_unit_quantity para ambas as embalagens
  SELECT base_unit_quantity INTO from_base_qty 
  FROM packaging_types WHERE id = from_packaging_id;
  
  SELECT base_unit_quantity INTO to_base_qty 
  FROM packaging_types WHERE id = to_packaging_id;
  
  -- Retornar fator de conversão
  RETURN from_base_qty / to_base_qty;
END;
$$ LANGUAGE plpgsql;

-- View para consolidar estoque por produto
CREATE OR REPLACE VIEW product_stock_consolidated AS
SELECT 
  p.id as product_id,
  p.sku,
  p.name,
  COALESCE(SUM(ui.quantity), 0) as total_base_units,
  pt_base.name as base_unit_name,
  COUNT(DISTINCT ui.ucp_id) as locations_count
FROM products p
LEFT JOIN ucp_items ui ON p.id = ui.product_id AND ui.is_active = true
LEFT JOIN packaging_types pt_base ON p.id = pt_base.product_id AND pt_base.is_base_unit = true
WHERE p.is_active = true
GROUP BY p.id, p.sku, p.name, pt_base.name;

-- View para mostrar estoque por embalagem
CREATE OR REPLACE VIEW product_stock_by_packaging AS
SELECT 
  p.id as product_id,
  pt.id as packaging_type_id,
  pt.name as packaging_name,
  pt.barcode,
  pt.base_unit_quantity,
  pt.level,
  FLOOR(COALESCE(SUM(ui.quantity), 0) / pt.base_unit_quantity) as available_packages,
  (COALESCE(SUM(ui.quantity), 0) % pt.base_unit_quantity) as remaining_base_units,
  COALESCE(SUM(ui.quantity), 0) as total_base_units
FROM products p
JOIN packaging_types pt ON p.id = pt.product_id AND pt.is_active = true
LEFT JOIN ucp_items ui ON p.id = ui.product_id AND ui.is_active = true
WHERE p.is_active = true
GROUP BY p.id, p.sku, p.name, pt.id, pt.name, pt.barcode, pt.base_unit_quantity, pt.level
ORDER BY p.id, pt.level;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_packaging_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_packaging_types_updated_at
  BEFORE UPDATE ON packaging_types
  FOR EACH ROW
  EXECUTE FUNCTION update_packaging_updated_at();

COMMIT;

-- Exemplo de dados de teste (descomente para inserir)
/*
-- Produto exemplo: Produto X
INSERT INTO products (sku, name, description, unit, created_by) 
VALUES ('PROD-X', 'Produto X', 'Produto exemplo para hierarquia', 'un', 1);

-- Embalagens do Produto X
INSERT INTO packaging_types (product_id, name, barcode, base_unit_quantity, is_base_unit, level, created_by) VALUES
((SELECT id FROM products WHERE sku = 'PROD-X'), 'Unidade', '7891234567890', 1, true, 1, 1),
((SELECT id FROM products WHERE sku = 'PROD-X'), 'Caixa 10un', '7891234567891', 10, false, 2, 1),
((SELECT id FROM products WHERE sku = 'PROD-X'), 'Caixa Master', '7891234567892', 200, false, 3, 1);

-- Definir hierarquia
UPDATE packaging_types 
SET parent_packaging_id = (
  SELECT id FROM packaging_types 
  WHERE product_id = (SELECT id FROM products WHERE sku = 'PROD-X') 
    AND is_base_unit = true
)
WHERE product_id = (SELECT id FROM products WHERE sku = 'PROD-X') 
  AND name = 'Caixa 10un';

UPDATE packaging_types 
SET parent_packaging_id = (
  SELECT id FROM packaging_types 
  WHERE product_id = (SELECT id FROM products WHERE sku = 'PROD-X') 
    AND name = 'Caixa 10un'
)
WHERE product_id = (SELECT id FROM products WHERE sku = 'PROD-X') 
  AND name = 'Caixa Master';
*/