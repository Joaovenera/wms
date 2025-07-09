# Warehouse Management System

Sistema de gerenciamento de armazém com frontend e backend separados.

## 🏗️ Estrutura do Projeto

```
/
├── frontend/          # Aplicação React (Vite)
│   ├── src/
│   ├── package.json
│   └── ...
├── backend/           # API Express.js
│   ├── src/
│   ├── package.json
│   └── ...
└── README.md
```

## 🚀 Executando o Projeto

### Pré-requisitos

- Node.js 20.x ou superior
- PostgreSQL (Neon)

### Backend (API)

1. Navegue para a pasta do backend:
   ```bash
   cd backend
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente:
   - Crie um arquivo `.env` baseado no `.env.example`
   - Configure a URL do banco de dados PostgreSQL

4. Execute as migrações do banco:
   ```bash
   npm run db:push
   ```

5. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

O backend estará rodando em `http://localhost:5000`

### Frontend (React)

1. Em um novo terminal, navegue para a pasta do frontend:
   ```bash
   cd frontend
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente:
   - O arquivo `.env.local` já está configurado para desenvolvimento

4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

O frontend estará rodando em `http://localhost:5174`

## 📝 Scripts Disponíveis

### Backend

- `npm run dev` - Inicia o servidor em modo desenvolvimento
- `npm run build` - Compila o projeto para produção
- `npm run start` - Inicia o servidor em produção
- `npm run db:push` - Aplica as migrações no banco
- `npm run db:generate` - Gera novas migrações
- `npm run check` - Verifica tipos TypeScript

### Frontend

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Compila o projeto para produção
- `npm run preview` - Visualiza a build de produção
- `npm run check` - Verifica tipos TypeScript

## 🔧 Configuração de Produção

### Backend

1. Compile o projeto:
   ```bash
   npm run build
   ```

2. Inicie com:
   ```bash
   npm run start
   ```

### Frontend

1. Compile o projeto:
   ```bash
   npm run build
   ```

2. Sirva os arquivos estáticos da pasta `dist/` com nginx ou similar

## 🛠️ Tecnologias

- **Frontend**: React, Vite, TypeScript, TailwindCSS, React Query
- **Backend**: Express.js, TypeScript, Drizzle ORM, PostgreSQL
- **Autenticação**: Passport.js com sessões
- **UI Components**: Radix UI, shadcn/ui

## 📚 Documentação da API

A API está disponível em `http://localhost:5000/api`

Principais endpoints:
- `/api/auth/*` - Autenticação
- `/api/pallets` - Gerenciamento de pallets
- `/api/positions` - Gerenciamento de posições
- `/api/products` - Gerenciamento de produtos
- `/api/ucps` - Gerenciamento de UCPs
- `/api/users` - Gerenciamento de usuários 