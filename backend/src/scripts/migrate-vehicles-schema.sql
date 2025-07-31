-- Migração: Atualizar schema de veículos para incluir dimensões da área de carga
-- Data: 2025-01-29
-- Descrição: Adiciona campos de marca, modelo, placa e dimensões da área de carga

-- Adicionar novos campos obrigatórios com valores padrão temporários
ALTER TABLE vehicles 
ADD COLUMN brand VARCHAR DEFAULT 'A definir' NOT NULL,
ADD COLUMN model VARCHAR DEFAULT 'A definir' NOT NULL,
ADD COLUMN license_plate VARCHAR DEFAULT 'AAA-0000' NOT NULL,
ADD COLUMN cargo_area_length DECIMAL(10,3) DEFAULT 0.000 NOT NULL,
ADD COLUMN cargo_area_width DECIMAL(10,3) DEFAULT 0.000 NOT NULL,
ADD COLUMN cargo_area_height DECIMAL(10,3) DEFAULT 0.000 NOT NULL;

-- Alterar weight_capacity para VARCHAR para permitir unidades (ex: "5000 kg")
ALTER TABLE vehicles 
ALTER COLUMN weight_capacity TYPE VARCHAR USING weight_capacity::VARCHAR;

-- Tornar cubic_capacity opcional (será calculado automaticamente)
ALTER TABLE vehicles 
ALTER COLUMN cubic_capacity DROP NOT NULL;

-- Adicionar constraint unique para license_plate
ALTER TABLE vehicles 
ADD CONSTRAINT vehicles_license_plate_unique UNIQUE (license_plate);

-- Atualizar registros existentes com dados temporários se existirem
UPDATE vehicles 
SET 
  brand = 'Marca não informada',
  model = 'Modelo não informado',
  license_plate = CONCAT('VHC', LPAD(id::TEXT, 4, '0'))
WHERE brand = 'A definir';

-- Remover valores padrão temporários
ALTER TABLE vehicles 
ALTER COLUMN brand DROP DEFAULT,
ALTER COLUMN model DROP DEFAULT,
ALTER COLUMN license_plate DROP DEFAULT,
ALTER COLUMN cargo_area_length DROP DEFAULT,
ALTER COLUMN cargo_area_width DROP DEFAULT,
ALTER COLUMN cargo_area_height DROP DEFAULT;

-- Comentários para documentar as mudanças
COMMENT ON COLUMN vehicles.brand IS 'Marca do veículo (Mercedes-Benz, Volvo, etc.)';
COMMENT ON COLUMN vehicles.model IS 'Modelo do veículo (Atego 1719, FH540, etc.)';
COMMENT ON COLUMN vehicles.license_plate IS 'Placa do veículo';
COMMENT ON COLUMN vehicles.cargo_area_length IS 'Comprimento da área de carga em metros';
COMMENT ON COLUMN vehicles.cargo_area_width IS 'Largura da área de carga em metros';
COMMENT ON COLUMN vehicles.cargo_area_height IS 'Altura da área de carga em metros';
COMMENT ON COLUMN vehicles.cubic_capacity IS 'Capacidade cúbica calculada automaticamente (length × width × height)';

-- Função para calcular cubicCapacity automaticamente
CREATE OR REPLACE FUNCTION calculate_vehicle_cubic_capacity()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular cubic_capacity baseado nas dimensões
  NEW.cubic_capacity = NEW.cargo_area_length * NEW.cargo_area_width * NEW.cargo_area_height;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular automaticamente o cubic_capacity
DROP TRIGGER IF EXISTS trigger_calculate_cubic_capacity ON vehicles;
CREATE TRIGGER trigger_calculate_cubic_capacity
  BEFORE INSERT OR UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION calculate_vehicle_cubic_capacity();

-- Atualizar cubic_capacity de todos os registros existentes (assumindo dimensões padrão se não definidas)
UPDATE vehicles 
SET 
  cargo_area_length = CASE 
    WHEN cargo_area_length = 0.000 THEN 6.000 -- Valor padrão: 6m
    ELSE cargo_area_length 
  END,
  cargo_area_width = CASE 
    WHEN cargo_area_width = 0.000 THEN 2.400 -- Valor padrão: 2.4m
    ELSE cargo_area_width 
  END,
  cargo_area_height = CASE 
    WHEN cargo_area_height = 0.000 THEN 2.700 -- Valor padrão: 2.7m
    ELSE cargo_area_height 
  END
WHERE cargo_area_length = 0.000 OR cargo_area_width = 0.000 OR cargo_area_height = 0.000;

-- O trigger irá recalcular cubic_capacity automaticamente no próximo UPDATE
UPDATE vehicles SET updated_at = NOW();

-- Verificar se a migração foi bem-sucedida
SELECT 
  'Migração concluída' as status,
  COUNT(*) as total_vehicles,
  COUNT(CASE WHEN cubic_capacity > 0 THEN 1 END) as vehicles_with_capacity
FROM vehicles;