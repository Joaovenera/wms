-- Script para criar veículos placeholder para planos que não precisam de veículo específico
-- Estes veículos são usados durante a fase de planejamento e podem ser substituídos durante a execução

-- Verificar se já existe um usuário para usar como created_by
-- Assumindo que existe um usuário com ID 1, caso contrário, ajuste conforme necessário

-- Veículo placeholder para planos de containers
INSERT INTO vehicles (
  code, name, brand, model, license_plate, type, weight_capacity, 
  cargo_area_length, cargo_area_width, cargo_area_height, cubic_capacity, 
  status, observations, created_by
) 
VALUES (
  'PLACEHOLDER-CONTAINER', 
  'Container (Planejamento)',
  'Placeholder',
  'Container',
  'PLH-CONT',
  'Container', 
  '30000 kg',
  '12.000',  -- Comprimento em metros (container 40 pés)
  '2.400',   -- Largura em metros
  '2.300',   -- Altura em metros
  '67.200',  -- Capacidade cúbica calculada
  'disponivel', 
  'Veículo placeholder para planos de chegada de container. Será substituído pelo veículo real durante execução.', 
  1
) ON CONFLICT (code) DO NOTHING;

-- Veículo placeholder para planos de entrega via transportadora
INSERT INTO vehicles (
  code, name, brand, model, license_plate, type, weight_capacity, 
  cargo_area_length, cargo_area_width, cargo_area_height, cubic_capacity, 
  status, observations, created_by
) 
VALUES (
  'PLACEHOLDER-DELIVERY', 
  'Entrega Transportadora (Planejamento)',
  'Placeholder',
  'Delivery',
  'PLH-DELV',
  'Entrega', 
  '5000 kg',
  '5.000',   -- Comprimento típico para entregas
  '2.200',   -- Largura típica
  '2.300',   -- Altura típica
  '25.300',  -- Capacidade cúbica calculada
  'disponivel', 
  'Veículo placeholder para planos de entrega via transportadora. Será substituído pelo veículo real durante execução.', 
  1
) ON CONFLICT (code) DO NOTHING;

-- Veículo placeholder para planos de retirada de clientes
INSERT INTO vehicles (
  code, name, brand, model, license_plate, type, weight_capacity, 
  cargo_area_length, cargo_area_width, cargo_area_height, cubic_capacity, 
  status, observations, created_by
) 
VALUES (
  'PLACEHOLDER-WITHDRAWAL', 
  'Retirada Cliente (Planejamento)',
  'Placeholder',
  'Cliente',
  'PLH-WTHD',
  'Cliente', 
  '2000 kg',
  '3.000',   -- Comprimento típico veículo cliente
  '1.800',   -- Largura típica
  '1.800',   -- Altura típica
  '9.720',   -- Capacidade cúbica calculada
  'disponivel', 
  'Veículo placeholder para planos de retirada de cliente. Será substituído pelo veículo real do cliente durante execução.', 
  1
) ON CONFLICT (code) DO NOTHING;

-- Verificar se os veículos foram criados
SELECT code, name, type, cubic_capacity, weight_capacity, status, observations 
FROM vehicles 
WHERE code LIKE 'PLACEHOLDER-%'
ORDER BY code;