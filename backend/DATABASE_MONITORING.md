# Database Connection Monitoring

## Visão Geral

O sistema agora implementa verificação de conexão com PostgreSQL similar ao Redis, incluindo:

- **Monitoramento de conexões**: Pool otimizado para desenvolvimento
- **Health checks**: Endpoints para verificar saúde do sistema
- **Logs estruturados**: Informações sobre conexões e performance
- **Estatísticas em tempo real**: Dados do banco e pool de conexões

## Configuração do Pool PostgreSQL

### Configurações Otimizadas para Desenvolvimento

```typescript
const postgresConfig = {
  min: 1,                     // 1 conexão mínima (reduzido de 2)
  max: 5,                     // 5 conexões máximas (reduzido de 20)
  idleTimeoutMillis: 10000,   // 10s timeout para conexões idle
  connectionTimeoutMillis: 5000, // 5s timeout para conectar
  query_timeout: 5000,        // 5s timeout para queries
  statement_timeout: 15000,   // 15s timeout para statements
}
```

### Benefícios da Otimização

- **Menos conexões simultâneas**: Reduz carga no banco
- **Timeouts menores**: Falhas mais rápidas em caso de problemas
- **Logs inteligentes**: Apenas avisos quando necessário

## Endpoints de Health Check

### 1. Health Check Básico
```bash
GET /api/health
```
Retorna status geral do sistema (Redis + PostgreSQL).

### 2. Health Check Detalhado
```bash
GET /api/health/detailed
```
Informações completas sobre sistema, memória e serviços.

### 3. Health Check PostgreSQL
```bash
GET /api/health/postgres
```
Estatísticas específicas do PostgreSQL:
- Conexões ativas/totais/máximas
- Tamanho do banco de dados
- Taxa de cache hit
- Lista de tabelas com contagem
- Status das verificações de saúde

### 4. Health Check Redis
```bash
GET /api/health/redis
```
Estatísticas específicas do Redis.

### 5. Teste de Conectividade
```bash
GET /api/health/database/test
```
Testa a conectividade e integridade do banco.

## Exemplos de Uso

### Verificar Status Geral
```bash
curl -k https://localhost:5000/api/health
```

### Monitorar PostgreSQL
```bash
curl -k https://localhost:5000/api/health/postgres | jq '.stats.connection'
```

### Verificar Performance do Cache
```bash
curl -k https://localhost:5000/api/health/postgres | jq '.stats.performance'
```

## Logs de Monitoramento

### Conexão Inicial
```
PostgreSQL connected successfully
Database time: [timestamp]
PostgreSQL version: PostgreSQL 17.5
```

### Alertas de Pool
```
PostgreSQL pool utilizando 4/5 conexões
```

### Logs de Erro
```
PostgreSQL pool error: [detalhes do erro]
```

## Verificações de Saúde

O sistema verifica automaticamente:

1. **Consulta básica**: `SELECT 1`
2. **Tabelas essenciais**: users, products, pallets, ucps, positions
3. **Extensões**: uuid-ossp, btree_gin, btree_gist

### Status Possíveis

- **healthy**: Todas as verificações passaram
- **degraded**: Algumas verificações falharam
- **unhealthy**: Sistema não funcional

## Integração com Startup

O backend agora verifica automaticamente:

1. **Conexão PostgreSQL** antes do Redis
2. **Graceful shutdown** desconecta PostgreSQL e Redis
3. **Logs estruturados** em todas as operações

## Benefícios Implementados

✅ **Pool otimizado**: Reduzidas conexões desnecessárias  
✅ **Monitoramento ativo**: Health checks em tempo real  
✅ **Logs estruturados**: Informações relevantes sem spam  
✅ **Detecção de problemas**: Alertas quando pool está sobrecarregado  
✅ **Estatísticas úteis**: Dados sobre performance e uso  
✅ **Compatibilidade**: Similar ao sistema Redis existente  

## Próximos Passos Sugeridos

1. **Alertas avançados**: Notificações quando thresholds são atingidos
2. **Métricas históricas**: Armazenar dados de performance ao longo do tempo
3. **Dashboard**: Interface visual para monitoramento
4. **Auto-scaling**: Ajuste automático do pool baseado na carga