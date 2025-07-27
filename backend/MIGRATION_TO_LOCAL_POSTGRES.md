# 🔄 Migração para PostgreSQL Local

## 📋 Resumo da Migração

O backend foi migrado do **Neon Database** (PostgreSQL serverless) para **PostgreSQL 17 local** executando via Docker Compose, otimizado para máxima performance em desenvolvimento e produção local.

---

## 🚀 **Principais Mudanças Implementadas**

### 🗄️ **1. Docker Compose Atualizado**

```yaml
# PostgreSQL 17 com otimizações de performance
postgres:
  image: postgres:17-alpine
  environment:
    POSTGRES_DB: warehouse
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
  command: >
    postgres
    -c shared_buffers=256MB
    -c effective_cache_size=1GB
    -c max_connections=200
    -c random_page_cost=1.1    # Otimizado para SSD/NVMe
    -c effective_io_concurrency=200
    -c wal_compression=on
    # ... mais otimizações
```

### 🔧 **2. Configuração do Banco Atualizada**

#### **Antes (Neon):**
```typescript
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
```

#### **Depois (PostgreSQL Local):**
```typescript
import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
```

### 📊 **3. Pool de Conexões Otimizado**

```typescript
export const pool = new Pool({
  connectionString: databaseConfig.url,
  
  // Configurações otimizadas para PostgreSQL 17
  min: 5,                        // Mínimo de conexões
  max: 50,                       // Máximo para alta concorrência
  idleTimeoutMillis: 10000,      // Timeout otimizado
  connectionTimeoutMillis: 5000,  // Conexão rápida
  maxUses: 7500,                 // Reuso de conexões
  
  // Configurações locais
  application_name: 'wms-backend',
  search_path: 'public',
});
```

### 🛠️ **4. Extensões PostgreSQL 17**

```sql
-- Extensões instaladas automaticamente
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS unaccent;
```

---

## 🔗 **Configuração de Conexão**

### **URLs de Conexão:**

```bash
# Desenvolvimento Local (Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/warehouse

# Container para Container (Docker Compose)
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/warehouse
```

### **Variáveis de Ambiente:**

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/warehouse
DB_HOST=localhost
DB_PORT=5432
DB_NAME=warehouse
DB_USER=postgres
DB_PASSWORD=postgres

# Pool Settings
DB_POOL_MIN=5
DB_POOL_MAX=50
DB_CONNECTION_TIMEOUT=5000

# SSL (desabilitado para desenvolvimento local)
DB_SSL=false
```

---

## 📈 **Benefícios da Migração**

### ⚡ **Performance:**
- **Latência Reduzida**: Conexão local vs internet
- **Throughput Maior**: Pool de conexões otimizado
- **Cache Eficiente**: Buffer pools configurados
- **I/O Otimizado**: Configurado para SSDs locais

### 💰 **Custo:**
- **Zero Custo**: Sem cobrança por operações
- **Desenvolvimento Gratuito**: Ambiente local
- **Testes Ilimitados**: Sem limites de query

### 🛠️ **Desenvolvimento:**
- **Controle Total**: Configuração completa
- **Debug Facilitado**: Logs locais
- **Backup Simples**: Volumes Docker
- **Versionamento**: PostgreSQL 17 fixo

### 🔒 **Segurança:**
- **Dados Locais**: Não saem do ambiente
- **Controle de Acesso**: Configuração própria
- **Compliance**: Total controle dos dados

---

## 🚀 **Como Usar**

### **1. Iniciar o Ambiente:**

```bash
# Subir os containers
docker-compose up -d postgres redis

# Verificar se estão rodando
docker-compose ps
```

### **2. Aplicar Migrações:**

```bash
# Navegar para o backend
cd backend

# Gerar migrações (se necessário)
npm run db:generate

# Aplicar migrações
npm run db:push
```

### **3. Verificar Conexão:**

```bash
# Testar conexão
npm run check

# Ou conectar diretamente
psql postgresql://postgres:postgres@localhost:5432/warehouse
```

### **4. Executar Aplicação:**

```bash
# Desenvolvimento
npm run dev

# Build e produção
npm run build
npm run start
```

---

## 🔍 **Monitoramento e Debug**

### **Verificar Status do Banco:**

```sql
-- Estatísticas do banco
SELECT * FROM get_db_stats();

-- Conexões ativas
SELECT * FROM pg_stat_activity;

-- Performance queries
SELECT * FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 10;

-- Tamanho do banco
SELECT pg_size_pretty(pg_database_size('warehouse'));
```

### **Logs do PostgreSQL:**

```bash
# Ver logs do container
docker-compose logs postgres

# Seguir logs em tempo real
docker-compose logs -f postgres
```

### **Health Check da Aplicação:**

```bash
# Health check endpoint
curl http://localhost:3000/health

# Métricas do banco
curl http://localhost:3000/api/metrics/database
```

---

## 🔧 **Configurações Avançadas**

### **postgresql.conf Customizado:**

O arquivo `postgresql.conf` inclui otimizações específicas para:

- **Memória**: Buffer pools e work memory
- **I/O**: Configurações para SSD/NVMe
- **WAL**: Write-ahead logging otimizado
- **Parallelismo**: Queries paralelas
- **Logging**: Debug e monitoring

### **Indexação Automática:**

```sql
-- Função para criar indexes de performance
SELECT create_performance_indexes();

-- Indexes são criados automaticamente para:
-- - Chaves primárias e estrangeiras
-- - Campos de busca frequente
-- - Campos de ordenação
```

### **Backup e Restore:**

```bash
# Backup do banco
docker exec wms-postgres pg_dump -U postgres warehouse > backup.sql

# Restore do banco
docker exec -i wms-postgres psql -U postgres warehouse < backup.sql

# Backup com Docker Compose
docker-compose exec postgres pg_dump -U postgres warehouse > backup.sql
```

---

## 🎯 **Performance Benchmarks**

### **Antes (Neon):**
- Latência: 100-300ms (internet)
- Throughput: Limitado por rede
- Pool: Gerenciado remotamente
- Cache: Compartilhado

### **Depois (Local):**
- Latência: 1-5ms (local)
- Throughput: Limitado por hardware
- Pool: 50 conexões configuráveis
- Cache: 256MB dedicado

### **Métricas Esperadas:**
- **Conexão**: < 5ms
- **Queries simples**: < 10ms
- **Queries complexas**: < 100ms
- **Throughput**: > 1000 ops/sec

---

## 🔄 **Rollback (Se Necessário)**

Se precisar voltar para o Neon:

### **1. Restaurar Dependências:**

```bash
npm install @neondatabase/serverless
```

### **2. Restaurar Configuração:**

```typescript
// database.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
```

### **3. Atualizar Variáveis:**

```env
DATABASE_URL=postgresql://username:password@ep-xxx.neon.tech/database
```

---

## 📚 **Recursos Adicionais**

### **Documentação:**
- [PostgreSQL 17 Documentation](https://www.postgresql.org/docs/17/)
- [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)
- [Docker Compose PostgreSQL](https://hub.docker.com/_/postgres)

### **Ferramentas Úteis:**
- **pgAdmin**: Interface web para PostgreSQL
- **DBeaver**: Cliente desktop universal
- **psql**: Cliente command line oficial

### **Monitoramento:**
- **pg_stat_statements**: Estatísticas de queries
- **pg_stat_activity**: Conexões ativas
- **Health checks**: Endpoints da aplicação

---

## ✅ **Checklist de Migração**

- [x] ✅ Docker Compose atualizado para PostgreSQL 17
- [x] ✅ Configuração do banco migrada do Neon
- [x] ✅ Pool de conexões otimizado
- [x] ✅ Drizzle config atualizado
- [x] ✅ Variáveis de ambiente configuradas
- [x] ✅ Script de inicialização do banco
- [x] ✅ Extensões PostgreSQL 17 instaladas
- [x] ✅ Tipos customizados criados
- [x] ✅ Funções de monitoramento
- [x] ✅ Configurações de performance
- [x] ✅ Documentação atualizada

---

## 🎉 **Conclusão**

A migração para PostgreSQL 17 local foi concluída com sucesso, oferecendo:

- **🚀 Performance Superior**: Latência reduzida e throughput aumentado
- **💰 Zero Custo**: Desenvolvimento sem limitações
- **🔧 Controle Total**: Configuração e otimização completa
- **📊 Monitoramento**: Health checks e métricas integradas
- **🛡️ Segurança**: Dados locais e controle de acesso

O sistema está agora otimizado para desenvolvimento local e pronto para deploy em ambientes de produção com PostgreSQL 17.

---

*Migração concluída em: Dezembro 2024*  
*PostgreSQL Version: 17-alpine*  
*Drizzle ORM: node-postgres driver*