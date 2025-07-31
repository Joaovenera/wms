#!/usr/bin/env tsx
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

async function migrateVehiclesSchema() {
  console.log('🚛 Iniciando migração do schema de veículos...');
  
  try {
    // 1. Adicionar novos campos com valores padrão temporários
    console.log('📝 Adicionando novos campos...');
    await db.execute(sql`
      ALTER TABLE vehicles 
      ADD COLUMN IF NOT EXISTS brand VARCHAR DEFAULT 'A definir' NOT NULL,
      ADD COLUMN IF NOT EXISTS model VARCHAR DEFAULT 'A definir' NOT NULL,
      ADD COLUMN IF NOT EXISTS license_plate VARCHAR DEFAULT 'AAA-0000' NOT NULL,
      ADD COLUMN IF NOT EXISTS cargo_area_length DECIMAL(10,3) DEFAULT 0.000 NOT NULL,
      ADD COLUMN IF NOT EXISTS cargo_area_width DECIMAL(10,3) DEFAULT 0.000 NOT NULL,
      ADD COLUMN IF NOT EXISTS cargo_area_height DECIMAL(10,3) DEFAULT 0.000 NOT NULL
    `);

    // 2. Alterar weight_capacity para VARCHAR
    console.log('🔧 Alterando tipo do campo weight_capacity...');
    await db.execute(sql`
      ALTER TABLE vehicles 
      ALTER COLUMN weight_capacity TYPE VARCHAR USING weight_capacity::VARCHAR
    `);

    // 3. Tornar cubic_capacity opcional
    console.log('🔄 Tornando cubic_capacity opcional...');
    await db.execute(sql`
      ALTER TABLE vehicles 
      ALTER COLUMN cubic_capacity DROP NOT NULL
    `);

    // 4. Adicionar constraint unique para license_plate (se não existir)
    console.log('🔐 Adicionando constraint unique para placa...');
    try {
      await db.execute(sql`
        ALTER TABLE vehicles 
        ADD CONSTRAINT vehicles_license_plate_unique UNIQUE (license_plate)
      `);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log('⚠️  Constraint unique para placa já existe');
      } else {
        throw error;
      }
    }

    // 5. Atualizar registros existentes com dados temporários
    console.log('📊 Atualizando registros existentes...');
    await db.execute(sql`
      UPDATE vehicles 
      SET 
        brand = 'Marca não informada',
        model = 'Modelo não informado',
        license_plate = CONCAT('VHC', LPAD(id::TEXT, 4, '0'))
      WHERE brand = 'A definir'
    `);

    // 6. Remover valores padrão temporários
    console.log('🧹 Removendo valores padrão temporários...');
    await db.execute(sql`
      ALTER TABLE vehicles 
      ALTER COLUMN brand DROP DEFAULT,
      ALTER COLUMN model DROP DEFAULT,
      ALTER COLUMN license_plate DROP DEFAULT,
      ALTER COLUMN cargo_area_length DROP DEFAULT,
      ALTER COLUMN cargo_area_width DROP DEFAULT,
      ALTER COLUMN cargo_area_height DROP DEFAULT
    `);

    // 7. Criar função para calcular cubic_capacity automaticamente
    console.log('⚙️  Criando função para cálculo automático...');
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION calculate_vehicle_cubic_capacity()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Calcular cubic_capacity baseado nas dimensões
        NEW.cubic_capacity = NEW.cargo_area_length * NEW.cargo_area_width * NEW.cargo_area_height;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // 8. Criar trigger para calcular automaticamente
    console.log('🎯 Criando trigger para cálculo automático...');
    await db.execute(sql`
      DROP TRIGGER IF EXISTS trigger_calculate_cubic_capacity ON vehicles
    `);
    await db.execute(sql`
      CREATE TRIGGER trigger_calculate_cubic_capacity
        BEFORE INSERT OR UPDATE ON vehicles
        FOR EACH ROW
        EXECUTE FUNCTION calculate_vehicle_cubic_capacity()
    `);

    // 9. Atualizar dimensões padrão para registros existentes
    console.log('📐 Definindo dimensões padrão para registros existentes...');
    await db.execute(sql`
      UPDATE vehicles 
      SET 
        cargo_area_length = CASE 
          WHEN cargo_area_length = 0.000 THEN 6.000 
          ELSE cargo_area_length 
        END,
        cargo_area_width = CASE 
          WHEN cargo_area_width = 0.000 THEN 2.400 
          ELSE cargo_area_width 
        END,
        cargo_area_height = CASE 
          WHEN cargo_area_height = 0.000 THEN 2.700 
          ELSE cargo_area_height 
        END
      WHERE cargo_area_length = 0.000 OR cargo_area_width = 0.000 OR cargo_area_height = 0.000
    `);

    // 10. Forçar recálculo do cubic_capacity via trigger
    console.log('🔄 Recalculando capacidades cúbicas...');
    await db.execute(sql`UPDATE vehicles SET updated_at = NOW()`);

    // 11. Verificar resultados
    console.log('✅ Verificando resultados da migração...');
    const result = await db.execute(sql`
      SELECT 
        'Migração concluída' as status,
        COUNT(*) as total_vehicles,
        COUNT(CASE WHEN cubic_capacity > 0 THEN 1 END) as vehicles_with_capacity,
        COUNT(CASE WHEN brand != 'Marca não informada' THEN 1 END) as vehicles_with_brand
      FROM vehicles
    `);

    console.log('📊 Resultados da migração:');
    console.log(result.rows[0]);

    console.log('🎉 Migração do schema de veículos concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    throw error;
  }
}

// Executar migração se este arquivo for executado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateVehiclesSchema()
    .then(() => {
      console.log('✨ Migração finalizada!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na migração:', error);
      process.exit(1);
    });
}

export { migrateVehiclesSchema };