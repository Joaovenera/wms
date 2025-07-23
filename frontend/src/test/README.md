# Sistema de Testes - Página de Pallets

Este sistema de testes fornece cobertura completa para a página de pallets, incluindo testes de UI, API e integração end-to-end.

## 🏗️ Estrutura dos Testes

```
src/test/
├── setup.ts                    # Configuração global dos testes
├── utils.tsx                   # Utilitários para renderização com providers
├── mocks/
│   ├── handlers.ts             # Handlers MSW para mock das APIs
│   └── server.ts               # Servidor de mock MSW
├── pages/
│   ├── pallets.test.tsx        # Testes unitários da página (em desenvolvimento)
│   ├── pallets-fixed.test.tsx  # Versão corrigida dos testes
│   └── working-pallets.test.tsx # Testes funcionais
├── api/
│   └── pallets.test.ts         # Testes das APIs
├── integration/
│   └── pallets-workflow.test.tsx # Testes de integração E2E
├── simple-pallets.test.tsx     # Testes básicos funcionais
└── README.md                   # Esta documentação
```

## 🧪 Status dos Testes

### ✅ Testes Funcionais
- **`simple-pallets.test.tsx`** - ✅ **FUNCIONANDO**
  - Testes básicos de renderização
  - Verificação de elementos da UI
  - Teste do mock server MSW

### 🔧 Testes em Desenvolvimento
- **`working-pallets.test.tsx`** - ⚠️ **PARCIALMENTE FUNCIONAL**
  - Alguns testes passam, outros falham devido a problemas de React Query
  - Problemas com `queryFn` não configurado
  - Warnings de `act()` do React

### 📋 Testes de API
- **`api/pallets.test.ts`** - ✅ **FUNCIONANDO**
  - Testes completos de todas as rotas da API
  - Mock server funcionando corretamente
  - Validações e edge cases

## 🚀 Como Executar os Testes

### Executar testes funcionais
```bash
# Testes básicos que funcionam
npm test simple-pallets.test.tsx --run

# Testes de API
npm test api/pallets.test.ts --run
```

### Executar todos os testes
```bash
npm test --run
```

### Executar testes em modo watch
```bash
npm test
```

### Executar testes com interface gráfica
```bash
npm run test:ui
```

### Executar testes com cobertura
```bash
npm run test:coverage
```

## 📊 Cobertura dos Testes

### ✅ Funcionalidades Testadas e Funcionais

#### **APIs Testadas (100% funcional)**
- ✅ `GET /api/pallets` - Listar pallets
- ✅ `GET /api/pallets/:id` - Buscar por ID
- ✅ `GET /api/pallets/code/:code` - Buscar por código
- ✅ `GET /api/pallets/next-code` - Próximo código
- ✅ `GET /api/pallets/available-for-ucp` - Pallets disponíveis
- ✅ `POST /api/pallets` - Criar pallet
- ✅ `PUT /api/pallets/:id` - Atualizar pallet
- ✅ `DELETE /api/pallets/:id` - Deletar pallet

#### **UI Básica (100% funcional)**
- ✅ Renderização de título e descrição
- ✅ Exibição de botões principais
- ✅ Controles de filtro
- ✅ Mock server funcionando

### ⚠️ Funcionalidades em Desenvolvimento

#### **UI Avançada (parcialmente funcional)**
- ⚠️ Carregamento de dados via React Query
- ⚠️ Interações de usuário (cliques, formulários)
- ⚠️ Filtros dinâmicos
- ⚠️ Modais e diálogos
- ⚠️ Estados de loading

## 🔧 Configuração

### Mock Service Worker (MSW) ✅
- ✅ Simula todas as rotas da API de pallets
- ✅ Mantém estado entre chamadas
- ✅ Permite testes isolados sem depender do backend real

### Testing Library ✅
- ✅ Renderiza componentes em ambiente de teste
- ✅ Simula interações do usuário
- ✅ Fazer assertions baseadas no que o usuário vê

### Vitest ✅
- ✅ Execução rápida dos testes
- ✅ Hot reload em modo watch
- ✅ Coverage reports
- ✅ Interface gráfica

### React Query ⚠️
- ⚠️ Configuração básica funcionando
- ⚠️ Problemas com `queryFn` em alguns testes
- ⚠️ Warnings de `act()` do React

## 📝 Exemplos de Uso

### Executar teste específico
```bash
npm test -- --grep "deve renderizar o título da página"
```

### Executar apenas testes de API
```bash
npm test api/pallets.test.ts
```

### Debug de testes
```bash
npm run test:ui
```

## 🐛 Problemas Conhecidos

### 1. React Query `queryFn` não configurado
**Sintoma**: `No queryFn was passed as an option, and no default queryFn was found`
**Causa**: A página usa `useQuery` sem `queryFn` explícito
**Solução**: Configurar `queryFn` padrão ou mockar a query

### 2. Warnings de `act()`
**Sintoma**: `An update to Component inside a test was not wrapped in act(...)`
**Causa**: Atualizações de estado assíncronas não estão envolvidas em `act()`
**Solução**: Usar `waitFor` ou envolver operações em `act()`

### 3. Componentes complexos não renderizando
**Sintoma**: Elementos não encontrados nos testes
**Causa**: Componentes como `CameraCapture` e `QRCodeDialog` podem ter dependências
**Solução**: Mockar componentes problemáticos

## 🎯 Próximos Passos

### Prioridade Alta
- [ ] Corrigir configuração do React Query nos testes
- [ ] Resolver warnings de `act()`
- [ ] Completar testes de UI funcionais

### Prioridade Média
- [ ] Testes de acessibilidade (a11y)
- [ ] Testes de performance
- [ ] Testes de diferentes tamanhos de tela

### Prioridade Baixa
- [ ] Testes de conectividade offline
- [ ] Testes cross-browser automatizados
- [ ] Testes de integração com backend real

## ✅ Conclusão

O sistema de testes está **parcialmente funcional**:

- ✅ **Infraestrutura completa** configurada
- ✅ **Testes de API** funcionando 100%
- ✅ **Testes básicos de UI** funcionando
- ⚠️ **Testes avançados de UI** precisam de ajustes
- ✅ **Mock server** funcionando perfeitamente
- ✅ **Documentação** completa

**Para uso imediato**: Execute `npm test simple-pallets.test.tsx --run` e `npm test api/pallets.test.ts --run` para ver os testes funcionais. 