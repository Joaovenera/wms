# Ambiente Docker para Desenvolvimento

Este projeto inclui uma configuração Docker completa para desenvolvimento local, incluindo backend, frontend, PostgreSQL e Redis.

## 🏗️ Arquitetura

- **Frontend**: React + Vite (porta 5173)
- **Backend**: Node.js + TypeScript + Express (porta 3000)
- **PostgreSQL**: Banco de dados (porta 5432)
- **Redis**: Cache e sessões (porta 6379)

## 🚀 Início Rápido

### Pré-requisitos

- Docker Desktop instalado
- Docker Compose v2+

### 1. Executar o ambiente completo

```bash
# Subir todos os serviços
docker compose up

# Ou em background
docker compose up -d
```

### 2. Acessar as aplicações

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 🔧 Comandos Úteis

### Gerenciamento de containers

```bash
# Parar todos os serviços
docker compose down

# Rebuild e restart
docker compose up --build

# Ver logs
docker compose logs -f

# Ver logs de um serviço específico
docker compose logs -f backend
docker compose logs -f frontend
```

### Desenvolvimento com Hot Reload

O ambiente está configurado com hot reload automático:

- **Backend**: Mudanças em `./backend/src` são sincronizadas automaticamente
- **Frontend**: Mudanças em `./frontend/src` são sincronizadas automaticamente

### Executar comandos nos containers

```bash
# Backend - instalar nova dependência
docker compose exec backend npm install nova-dependencia

# Frontend - instalar nova dependência  
docker compose exec frontend npm install nova-dependencia

# Acessar shell do backend
docker compose exec backend sh

# Acessar shell do PostgreSQL
docker compose exec postgres psql -U postgres -d warehouse
```

### Banco de Dados

```bash
# Executar migrações do Drizzle
docker compose exec backend npm run db:migrate

# Push schema changes
docker compose exec backend npm run db:push

# Gerar migrações
docker compose exec backend npm run db:generate
```

## 📁 Estrutura de Volumes

- `postgres_data`: Dados persistentes do PostgreSQL
- `redis_data`: Dados persistentes do Redis  
- `backend_logs`: Logs do backend
- `./backend` e `./frontend`: Código sincronizado com hot reload

## 🔐 Variáveis de Ambiente

### Backend

As configurações do Docker estão em `backend/.env.docker`:

- `DATABASE_URL`: postgresql://postgres:postgres@postgres:5432/warehouse
- `REDIS_URL`: redis://redis:6379
- `PORT`: 3000

### Frontend

- `VITE_API_URL`: http://localhost:3000

## 🛠️ Troubleshooting

### Containers não sobem

```bash
# Verificar logs de erro
docker compose logs

# Rebuild do zero
docker compose down -v
docker compose build --no-cache
docker compose up
```

### Problemas de permissão

```bash
# Reset de volumes
docker compose down -v
docker compose up
```

### PostgreSQL não conecta

```bash
# Verificar se o container está healthy
docker compose ps

# Verificar logs do PostgreSQL
docker compose logs postgres
```

### Hot reload não funciona

```bash
# Rebuild containers específicos
docker compose up --build backend
docker compose up --build frontend
```

## 📊 Monitoramento

### Health Checks

Os serviços incluem health checks automáticos:

- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`

### Logs

```bash
# Logs estruturados do backend
docker compose logs backend | grep -E "(ERROR|WARN)"

# Logs do Vite (frontend)
docker compose logs frontend
```

## 🔄 Workflow de Desenvolvimento

1. **Iniciar ambiente**: `docker compose up`
2. **Desenvolver**: Editar arquivos normalmente
3. **Ver mudanças**: Aplicadas automaticamente via hot reload
4. **Adicionar dependências**: Usar `docker compose exec`
5. **Commit**: Incluir arquivos Docker no git

## 📋 Scripts Úteis

Adicione estes scripts ao seu `package.json` raiz:

```json
{
  "scripts": {
    "docker:up": "docker compose up",
    "docker:down": "docker compose down", 
    "docker:build": "docker compose build",
    "docker:logs": "docker compose logs -f",
    "docker:clean": "docker compose down -v && docker system prune -f"
  }
}
```

## 🏷️ Produção

Para produção, ajuste:

1. Use `NODE_ENV=production`
2. Configure secrets adequados
3. Use banco de dados externo
4. Configure HTTPS
5. Ajuste recursos e limits dos containers

## 📝 Notas

- O ambiente PostgreSQL inclui o script `init-db.sql` para inicialização
- Redis está configurado para persistência de dados
- Os logs do backend são salvos em volume persistente
- Hot reload está otimizado para development apenas 