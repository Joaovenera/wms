# Migração do Schema de Veículos

## 📋 Visão Geral

Esta migração atualiza o schema da tabela `vehicles` para incluir informações mais detalhadas sobre os veículos, substituindo a capacidade cúbica única pelas dimensões individuais da área de carga.

## 🎯 Objetivo

- **Problema**: O sistema anterior armazenava apenas a capacidade cúbica total, não permitindo verificar se objetos grandes cabem fisicamente no veículo
- **Solução**: Armazenar as dimensões individuais (comprimento × largura × altura) da área de carga para melhor planejamento de carregamento

## 🆕 Campos Adicionados

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `brand` | VARCHAR | Marca do veículo (ex: Mercedes-Benz, Volvo) |
| `model` | VARCHAR | Modelo do veículo (ex: Atego 1719, FH540) |
| `license_plate` | VARCHAR | Placa do veículo (unique constraint) |
| `cargo_area_length` | DECIMAL(10,3) | Comprimento da área de carga em metros |
| `cargo_area_width` | DECIMAL(10,3) | Largura da área de carga em metros |
| `cargo_area_height` | DECIMAL(10,3) | Altura da área de carga em metros |

## 🔄 Campos Modificados

| Campo | Antes | Depois |
|-------|-------|--------|
| `weight_capacity` | DECIMAL(10,2) | VARCHAR (permite unidades como "5000 kg") |
| `cubic_capacity` | NOT NULL | Opcional (calculado automaticamente) |

## ⚙️ Automação

- **Trigger Automático**: O campo `cubic_capacity` é calculado automaticamente sempre que um veículo é criado ou atualizado
- **Função SQL**: `calculate_vehicle_cubic_capacity()` calcula `length × width × height`
- **Compatibilidade**: Mantém total compatibilidade com o código existente que usa `cubicCapacity`

## 🚀 Como Executar a Migração

### Opção 1: Script TypeScript (Recomendado)
```bash
cd backend
npm run tsx src/scripts/migrate-vehicles-schema.ts
```

### Opção 2: SQL Direto
```bash
psql -d seu_banco -f src/scripts/migrate-vehicles-schema.sql
```

## 📊 Dados de Exemplo

### Antes da Migração:
```json
{
  "id": 1,
  "code": "VHC001",
  "name": "Caminhão Principal",
  "type": "caminhao",
  "cubicCapacity": "40.5",
  "weightCapacity": "5000"
}
```

### Após a Migração:
```json
{
  "id": 1,
  "code": "VHC001",
  "name": "Caminhão Principal",
  "brand": "Mercedes-Benz",
  "model": "Atego 1719",
  "licensePlate": "ABC-1234",
  "type": "caminhao",
  "weightCapacity": "5000 kg",
  "cargoAreaLength": 6.0,
  "cargoAreaWidth": 2.4,
  "cargoAreaHeight": 2.7,
  "cubicCapacity": "38.88" // Calculado automaticamente
}
```

## ✅ Verificações Pós-Migração

1. **Trigger Funcionando**: Teste criando um novo veículo - o `cubic_capacity` deve ser calculado automaticamente
2. **Constraints Unique**: Teste criando veículos com códigos ou placas duplicadas - deve gerar erro
3. **Dados Existentes**: Verifique se todos os veículos existentes têm dimensões válidas
4. **Frontend**: Teste o cadastro de veículos na interface web

## 🔙 Rollback (Se Necessário)

```sql
-- Remover novos campos
ALTER TABLE vehicles 
DROP COLUMN brand,
DROP COLUMN model,
DROP COLUMN license_plate,
DROP COLUMN cargo_area_length,
DROP COLUMN cargo_area_width,
DROP COLUMN cargo_area_height;

-- Restaurar weight_capacity como DECIMAL
ALTER TABLE vehicles 
ALTER COLUMN weight_capacity TYPE DECIMAL(10,2) USING weight_capacity::DECIMAL(10,2);

-- Tornar cubic_capacity obrigatório novamente
ALTER TABLE vehicles 
ALTER COLUMN cubic_capacity SET NOT NULL;

-- Remover trigger e função
DROP TRIGGER IF EXISTS trigger_calculate_cubic_capacity ON vehicles;
DROP FUNCTION IF EXISTS calculate_vehicle_cubic_capacity();
```

## 🎨 Benefícios da Migração

1. **Planejamento Melhor**: Verificar se objetos grandes cabem fisicamente
2. **Dados Mais Ricos**: Informações completas sobre cada veículo da frota
3. **Compatibilidade**: Sistema existente continua funcionando normalmente
4. **Automação**: Capacidade cúbica calculada automaticamente
5. **Validação**: Constraints de unicidade para códigos e placas

## 🛠️ Manutenção

- A função `calculate_vehicle_cubic_capacity()` é executada automaticamente
- Não é necessária intervenção manual para manter os dados sincronizados
- O trigger garante que `cubic_capacity` esteja sempre atualizado