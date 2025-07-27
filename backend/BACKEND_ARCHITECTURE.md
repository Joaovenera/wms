# 🏗️ Backend Architecture - WMS System

## 📋 Visão Geral

Este documento descreve a arquitetura completa do backend do sistema WMS (Warehouse Management System), otimizado para **PostgreSQL 17 em NVMe** com alta performance e arquitetura limpa.

## 🎯 Principais Características

- **Arquitetura Limpa** com separação clara de responsabilidades
- **PostgreSQL 17** otimizado para storage NVMe
- **Cache Inteligente** com Redis e estratégias por domínio
- **Monitoramento Completo** com health checks e métricas
- **Validação Centralizada** com Zod schemas
- **Repository Pattern** com interfaces bem definidas

---

## 📁 Estrutura de Diretórios

```
backend/src/
├── 📁 config/                    # Configurações centralizadas
│   ├── app.config.ts            # Configuração geral da aplicação
│   ├── database.config.ts       # PostgreSQL 17 + NVMe otimizado
│   ├── redis.config.ts          # Configuração do cache
│   ├── security.config.ts       # Configuração de segurança
│   ├── logger.config.ts         # Configuração de logging
│   └── index.ts                 # Barrel exports
│
├── 📁 core/                     # Camada de domínio
│   ├── 📁 domain/               # Entidades e interfaces
│   │   ├── entities/            # Entidades de negócio
│   │   │   ├── user.entity.ts
│   │   │   ├── product.entity.ts
│   │   │   ├── pallet.entity.ts
│   │   │   └── ucp.entity.ts
│   │   └── interfaces/          # Contratos de repositórios
│   │       ├── user.repository.ts
│   │       ├── product.repository.ts
│   │       ├── pallet.repository.ts
│   │       └── ucp.repository.ts
│   └── 📁 shared/               # Código compartilhado
│       ├── constants/           # Constantes da aplicação
│       ├── enums/               # Enumerações
│       └── types/               # Tipos compartilhados
│
├── 📁 infrastructure/           # Camada de infraestrutura
│   ├── 📁 database/             # PostgreSQL 17 otimizado
│   │   ├── schemas/             # Schemas organizados por entidade
│   │   ├── repositories/        # Implementações concretas
│   │   ├── migrations/          # Migrações do banco
│   │   └── database.ts          # Configuração da conexão
│   ├── 📁 cache/                # Sistema de cache avançado
│   │   ├── cache.service.ts     # Serviço principal de cache
│   │   ├── strategies.ts        # Estratégias por entidade
│   │   ├── redis.client.ts      # Cliente Redis
│   │   └── index.ts             # Exports unificados
│   └── 📁 monitoring/           # Monitoramento e métricas
│       ├── health.service.ts    # Health checks
│       ├── metrics.service.ts   # Coleta de métricas
│       └── index.ts             # Exports de monitoramento
│
├── 📁 presentation/             # Camada de apresentação
│   └── 📁 http/                 # Interface HTTP
│       ├── controllers/         # Controllers por domínio
│       ├── middleware/          # Middlewares customizados
│       └── routes/              # Definição de rotas
│
└── 📁 utils/                    # Utilitários
    ├── exceptions/              # Sistema de exceções
    ├── helpers/                 # Funções auxiliares
    └── logger.ts                # Sistema de logging
```

---

## 🗄️ PostgreSQL 17 + NVMe Otimizado

### 🔧 Configurações de Conexão

```typescript
// Configurações otimizadas para alta performance
pool: {
  min: 5,                        // Mínimo de conexões ativas
  max: 50,                       // Máximo para alta concorrência
  idleTimeoutMillis: 10000,      // Timeout reduzido para NVMe
  connectionTimeoutMillis: 5000,  // Conexão rápida
  acquireTimeoutMillis: 10000,   // Aquisição de conexão
  maxUses: 7500,                 // Reuso máximo por conexão
}
```

### ⚡ Parâmetros PostgreSQL 17

```sql
-- Configurações de memória otimizadas
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

-- Otimizações para NVMe SSD
random_page_cost = 1.1          # Reduzido para NVMe
effective_io_concurrency = 200  # Alto para NVMe
seq_page_cost = 1.0

-- WAL otimizado para NVMe
wal_buffers = 16MB
wal_compression = on
max_wal_size = 1GB
min_wal_size = 80MB

-- Paralelização PostgreSQL 17
max_parallel_workers = 8
max_parallel_workers_per_gather = 2
max_parallel_maintenance_workers = 2

-- Checkpointing para NVMe
checkpoint_completion_target = 0.9
checkpoint_timeout = 5min
```

---

## 🔄 Sistema de Cache Avançado

### 📊 Estratégias por Entidade

| Entidade | TTL | Casos de Uso |
|----------|-----|--------------|
| **Users** | 1h | Perfis de usuário |
| **Products** | 30min | Detalhes de produtos |
| **Stock** | 5min | Informações de estoque |
| **Pallets** | 10min | Dados de pallets |
| **UCPs** | 5min | Containers de produtos |
| **Positions** | 30min | Estrutura do armazém |

### 🎯 Funcionalidades do Cache

```typescript
// Cache básico
await cache.set(key, value, { ttl: 3600 });
const data = await cache.get(key);

// Cache estratégico
await strategicCache.set(strategies.user.profile, userId, userData);
const user = await strategicCache.get(strategies.user.profile, userId);

// Cache com fallback
const product = await cache.getOrSet(
  'product:123',
  () => productRepository.findById(123),
  { ttl: 1800 }
);

// Invalidação por tags
await cache.invalidateByTags(['products', 'inventory']);

// Distributed locking
const lockValue = await cache.acquireLock('resource:update', 30000);
// ... operação crítica ...
await cache.releaseLock('resource:update', lockValue);
```

---

## 📊 Sistema de Monitoramento

### 🏥 Health Checks

```typescript
// Health check completo
const health = await healthService.performHealthCheck();
// Retorna status de: database, cache, memory, disk, application

// Health check rápido
const quick = await healthService.getQuickHealth();
// Retorna status básico para load balancers
```

### 📈 Métricas Coletadas

- **Performance**: Tempo de resposta, taxa de erro, requests/min
- **Business**: Pallets criados, transferências, produtos
- **System**: Uso de memória, conexões DB, cache hit rate
- **Errors**: Tracking e agregação de erros

### 🚨 Alertas e Monitoramento

```typescript
// Configuração de métricas de negócio
metricsService.updateBusinessMetrics({
  palletsCreated: 15,
  itemTransfers: 42,
  activeUsers: 8
});

// Tracking de requests automático
metricsService.recordRequest({
  method: 'POST',
  route: '/api/pallets',
  statusCode: 201,
  responseTime: 156,
  userId: 123
});
```

---

## 🛡️ Validação Centralizada

### 📝 Schemas por Domínio

```typescript
// Validação de usuário
const userSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'operator'])
});

// Middleware de validação
app.post('/api/users', 
  validationMiddleware.user.create,
  userController.createUser
);
```

### ✅ Tipos de Validação

- **Body**: Validação do corpo da requisição
- **Query**: Parâmetros de consulta (paginação, filtros)
- **Params**: Parâmetros de rota (IDs)
- **Custom**: Validações específicas de negócio

---

## 🏛️ Repository Pattern

### 🔍 Interfaces Definidas

```typescript
interface UserRepository {
  findById(id: number): Promise<UserEntity | null>;
  findMany(filters: UserQueryFilters): Promise<{users: UserEntity[], total: number}>;
  create(data: CreateUserData): Promise<UserEntity>;
  update(id: number, data: UpdateUserData): Promise<UserEntity | null>;
  delete(id: number): Promise<boolean>;
}
```

### 💾 Implementações Concretas

```typescript
// Uso dos repositórios
const user = await repositories.user.findById(123);
const products = await repositories.product.findMany({ search: 'laptop' });
const pallet = await repositories.pallet.create({ code: 'PLT001' });
```

---

## 🚀 Performance e Escalabilidade

### ⚡ Otimizações Implementadas

1. **Connection Pooling**: Pool otimizado para alta concorrência
2. **Query Optimization**: Prepared statements e indexação
3. **Caching Layers**: Multi-level caching com TTL inteligente
4. **Async Processing**: Operações não-bloqueantes
5. **Resource Management**: Cleanup automático e graceful shutdown

### 📊 Métricas de Performance

- **Database Latency**: < 50ms (target para NVMe)
- **Cache Hit Rate**: > 85% (target)
- **Response Time**: < 200ms para 95% das requests
- **Throughput**: > 1000 requests/min por instância

---

## 🔧 Comandos de Desenvolvimento

### 🏃 Execução

```bash
# Desenvolvimento
npm run dev

# Produção
npm run build && npm run start

# Type checking
npm run check

# Database
npm run db:push      # Aplicar mudanças de schema
npm run db:generate  # Gerar migrações
npm run db:migrate   # Executar migrações
```

### 🧪 Testes

```bash
# Testes unitários
npm test

# Testes de integração
npm run test:integration

# Coverage
npm run test:coverage
```

---

## 🔐 Segurança

### 🛡️ Medidas Implementadas

- **Rate Limiting**: Proteção contra abuse
- **Input Validation**: Validação rigorosa com Zod
- **SQL Injection Protection**: Queries parametrizadas
- **CORS**: Configuração restritiva
- **Helmet**: Headers de segurança
- **Session Management**: Sessões seguras com Redis

### 🔑 Autenticação & Autorização

- **Passport.js**: Estratégias de autenticação
- **Role-based Access**: Admin, Manager, Operator
- **Session Storage**: Redis para escalabilidade
- **Password Security**: Hashing seguro

---

## 🌐 Ambiente de Produção

### 📦 Deployment

```dockerfile
# Docker otimizado para produção
FROM node:18-alpine
# ... configurações otimizadas
```

### 🔧 Variáveis de Ambiente

```env
# Database - PostgreSQL 17
DATABASE_URL=postgresql://user:pass@host:5432/db
DB_POOL_MIN=5
DB_POOL_MAX=50
DB_CONNECTION_TIMEOUT=5000

# Cache - Redis
REDIS_URL=redis://host:6379
REDIS_PASSWORD=secure_password

# Application
NODE_ENV=production
APP_VERSION=1.0.0
LOG_LEVEL=info

# Security
SESSION_SECRET=secure_random_secret
CORS_ORIGIN=https://yourdomain.com
```

---

## 📚 Próximos Passos

### 🎯 Melhorias Futuras

1. **API Versioning**: Sistema de versionamento
2. **GraphQL**: Endpoint GraphQL complementar
3. **Microservices**: Decomposição em serviços
4. **Event Sourcing**: Para auditoria completa
5. **CQRS**: Separação de comandos e queries
6. **Message Queues**: Para processamento assíncrono

### 🔍 Monitoramento Avançado

1. **OpenTelemetry**: Tracing distribuído
2. **Prometheus**: Métricas de sistema
3. **Grafana**: Dashboards de monitoramento
4. **ELK Stack**: Logging centralizado
5. **APM**: Application Performance Monitoring

---

## 📞 Suporte e Documentação

### 🛠️ Troubleshooting

- **Logs**: Verifique `./logs/` para debug
- **Health**: Acesse `/health` para status
- **Metrics**: Use monitoring endpoints
- **Database**: Verifique conexões e pool

### 📖 Recursos Adicionais

- [PostgreSQL 17 Documentation](https://www.postgresql.org/docs/17/)
- [Redis Documentation](https://redis.io/documentation)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Zod Validation](https://zod.dev/)

---

## 🏆 Conclusão

Este backend foi arquitetado para **máxima performance** e **escalabilidade**, aproveitando as capacidades do **PostgreSQL 17 em NVMe** com:

- ✅ **Arquitetura limpa** e maintível
- ✅ **Cache inteligente** com estratégias otimizadas  
- ✅ **Monitoramento completo** para produção
- ✅ **Validação robusta** e centralizada
- ✅ **Performance otimizada** para alta concorrência

O sistema está pronto para **produção** com configurações enterprise-grade e capacidade de escalar horizontalmente conforme necessário.

---

*Documento atualizado em: Dezembro 2024*  
*Versão da Arquitetura: 2.0*