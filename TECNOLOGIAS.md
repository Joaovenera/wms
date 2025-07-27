# Tecnologias e Versões - Warehouse Management System (WMS)

Este documento lista todas as tecnologias utilizadas no projeto WMS, organizadas por frontend e backend com suas respectivas versões.

## 📋 Resumo do Projeto

- **Nome**: Warehouse Management System (WMS)
- **Versão**: 1.0.0
- **Arquitetura**: Frontend/Backend separados
- **Containerização**: Docker + Docker Compose

---

## 🎨 **FRONTEND**

### **Framework Principal**
- **React**: `^18.3.1`
- **TypeScript**: `5.6.3`
- **Vite**: `^5.4.19`

### **Build & Development Tools**
- **@vitejs/plugin-react**: `^4.3.2`
- **Vite**: `^5.4.19`
- **TypeScript**: `5.6.3`
- **ESBuild**: Integrado via Vite

### **UI & Styling**
- **Tailwind CSS**: `^3.4.17`
- **@tailwindcss/typography**: `^0.5.15`
- **@tailwindcss/vite**: `^4.1.3`
- **tailwindcss-animate**: `^1.0.7`
- **tailwind-merge**: `^2.6.0`
- **PostCSS**: `^8.4.47`
- **Autoprefixer**: `^10.4.20`

### **Componentes UI (Radix UI)**
- **@radix-ui/react-accordion**: `^1.2.4`
- **@radix-ui/react-alert-dialog**: `^1.1.7`
- **@radix-ui/react-aspect-ratio**: `^1.1.3`
- **@radix-ui/react-avatar**: `^1.1.4`
- **@radix-ui/react-checkbox**: `^1.1.5`
- **@radix-ui/react-collapsible**: `^1.1.4`
- **@radix-ui/react-context-menu**: `^2.2.7`
- **@radix-ui/react-dialog**: `^1.1.7`
- **@radix-ui/react-dropdown-menu**: `^2.1.7`
- **@radix-ui/react-hover-card**: `^1.1.7`
- **@radix-ui/react-label**: `^2.1.3`
- **@radix-ui/react-menubar**: `^1.1.7`
- **@radix-ui/react-navigation-menu**: `^1.2.6`
- **@radix-ui/react-popover**: `^1.1.7`
- **@radix-ui/react-progress**: `^1.1.3`
- **@radix-ui/react-radio-group**: `^1.2.4`
- **@radix-ui/react-scroll-area**: `^1.2.4`
- **@radix-ui/react-select**: `^2.1.7`
- **@radix-ui/react-separator**: `^1.1.3`
- **@radix-ui/react-slider**: `^1.2.4`
- **@radix-ui/react-slot**: `^1.2.0`
- **@radix-ui/react-switch**: `^1.1.4`
- **@radix-ui/react-tabs**: `^1.1.4`
- **@radix-ui/react-toast**: `^1.2.7`
- **@radix-ui/react-toggle**: `^1.1.3`
- **@radix-ui/react-toggle-group**: `^1.1.3`
- **@radix-ui/react-tooltip**: `^1.2.0`

### **State Management & Data Fetching**
- **@tanstack/react-query**: `^5.60.5`
- **react-hook-form**: `^7.55.0`
- **@hookform/resolvers**: `^3.10.0`

### **Routing**
- **wouter**: `^3.3.5`

### **Utilidades & Helpers**
- **class-variance-authority**: `^0.7.1`
- **clsx**: `^2.1.1`
- **cmdk**: `^1.1.1`
- **date-fns**: `^3.6.0`
- **zod**: `^3.24.2`
- **input-otp**: `^1.4.2`
- **qrcode**: `^1.5.4`

### **Animações & Interações**
- **framer-motion**: `^11.13.1`
- **embla-carousel-react**: `^8.6.0`
- **react-resizable-panels**: `^2.1.7`
- **vaul**: `^1.1.2`
- **tw-animate-css**: `^1.2.5`

### **Ícones & Gráficos**
- **lucide-react**: `^0.453.0`
- **react-icons**: `^5.4.0`
- **recharts**: `^2.15.2`

### **Temas**
- **next-themes**: `^0.4.6`
- **react-day-picker**: `^8.10.1`

### **Testes**
- **Vitest**: `^3.2.4`
- **@vitest/ui**: `^3.2.4`
- **@testing-library/react**: `^16.3.0`
- **@testing-library/jest-dom**: `^6.6.3`
- **@testing-library/user-event**: `^14.6.1`
- **happy-dom**: `^18.0.1`
- **jsdom**: `^26.1.0`
- **msw**: `^2.10.4` (Mock Service Worker)

### **Desenvolvimento**
- **@replit/vite-plugin-runtime-error-modal**: `^0.0.3`
- **@types/qrcode**: `^1.5.5`
- **@types/react**: `^18.3.11`
- **@types/react-dom**: `^18.3.1`

---

## ⚙️ **BACKEND**

### **Runtime & Framework**
- **Node.js**: `20-alpine` (Docker)
- **TypeScript**: `5.6.3`
- **Express.js**: `^4.21.2`

### **Build & Development Tools**
- **tsx**: `^4.19.1` (TypeScript execution)
- **esbuild**: `^0.25.0`
- **drizzle-kit**: `^0.30.4`

### **Database & ORM**
- **PostgreSQL**: `15-alpine` (Docker)
- **Drizzle ORM**: `^0.39.1`
- **drizzle-zod**: `^0.7.0`
- **@neondatabase/serverless**: `^0.10.4`

### **Cache & Session**
- **Redis**: `7-alpine` (Docker)
- **ioredis**: `^5.6.1`
- **redis**: `^4.7.1`
- **express-session**: `^1.18.1`
- **connect-pg-simple**: `^10.0.0`
- **memorystore**: `^1.6.7`
- **node-cache**: `^5.1.2`

### **Autenticação & Autorização**
- **passport**: `^0.7.0`
- **passport-local**: `^1.0.0`
- **openid-client**: `^6.6.1`

### **Segurança & Rate Limiting**
- **helmet**: `^8.1.0`
- **cors**: `^2.8.5`
- **express-rate-limit**: `^7.5.1`
- **rate-limit-redis**: `^4.2.1`
- **dompurify**: `^3.2.6`

### **Logging & Monitoring**
- **winston**: `^3.17.0`

### **Documentação API**
- **swagger-jsdoc**: `^6.2.8`
- **swagger-ui-express**: `^5.0.1`

### **Validação & Utilitários**
- **zod**: `^3.24.2`
- **zod-validation-error**: `^3.4.0`
- **dotenv**: `^17.2.0`
- **compression**: `^1.8.0`
- **memoizee**: `^0.4.17`

### **Processamento de Imagens**
- **sharp**: `^0.34.3`

### **WebSockets**
- **ws**: `^8.18.3`
- **bufferutil**: `^4.0.8` (opcional)

### **Web Scraping & DOM**
- **jsdom**: `^26.1.0`

### **TypeScript Types**
- **@types/compression**: `^1.8.1`
- **@types/connect-pg-simple**: `^7.0.3`
- **@types/cors**: `^2.8.19`
- **@types/dompurify**: `^3.0.5`
- **@types/express**: `4.17.21`
- **@types/express-rate-limit**: `^5.1.3`
- **@types/express-session**: `^1.18.0`
- **@types/ioredis**: `^4.28.10`
- **@types/jsdom**: `^21.1.7`
- **@types/memoizee**: `^0.4.12`
- **@types/node**: `20.16.11`
- **@types/passport**: `^1.0.16`
- **@types/passport-local**: `^1.0.38`
- **@types/sharp**: `^0.31.1`
- **@types/swagger-jsdoc**: `^6.0.4`
- **@types/swagger-ui-express**: `^4.1.8`
- **@types/ws**: `^8.18.1`

---

## 🐳 **INFRAESTRUTURA & DEVOPS**

### **Containerização**
- **Docker Compose**: Versão atual do sistema
- **PostgreSQL**: `15-alpine`
- **Redis**: `7-alpine`
- **Node.js**: `20-alpine`

### **Configuração de Desenvolvimento**
- **Vite Dev Server**: Hot Module Replacement (HMR)
- **TypeScript Watch Mode**: tsx watch para backend
- **Docker Volume Sync**: Para desenvolvimento em tempo real

---

## 🔧 **CONFIGURAÇÕES ESPECÍFICAS**

### **TypeScript Targets**
- **Frontend**: `ES2020`
- **Backend**: `ES2022`

### **Drizzle ORM**
- **Dialect**: PostgreSQL
- **Migration Strategy**: Timestamp prefix
- **Schema Location**: `./src/infrastructure/database/schemas/index.ts`

### **Vite Configuration**
- **Port**: 5174 (desenvolvimento)
- **HMR**: WebSocket na porta 5174
- **HTTPS**: Suporte opcional com certificados auto-assinados
- **Proxy**: `/api` → Backend

### **Tailwind CSS**
- **Style**: New York (shadcn/ui)
- **CSS Variables**: Habilitado
- **Base Color**: Neutral
- **Dark Mode**: Class-based

---

## 📊 **Estatísticas do Projeto**

- **Total de Dependências Frontend**: ~50 dependencies + ~20 devDependencies
- **Total de Dependências Backend**: ~30 dependencies + ~20 devDependencies
- **Componentes UI (Radix)**: 20+ componentes
- **TypeScript**: 100% do código
- **Containerized Services**: 4 (frontend, backend, postgres, redis)

---

**Última atualização**: $(date)
**Gerado automaticamente** a partir da análise da codebase 