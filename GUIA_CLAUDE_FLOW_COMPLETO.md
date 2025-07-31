# 🚀 Guia Completo: Claude Flow + WMS (Warehouse Management System)

## 📋 **Visão Geral do Projeto**

Seu projeto é um **Sistema de Gerenciamento de Estoque (WMS)** com arquitetura moderna:

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Radix UI
- **Backend**: Node.js + Express + TypeScript + Drizzle ORM + PostgreSQL 17
- **Infraestrutura**: Docker Compose + Redis + PostgreSQL
- **Desenvolvimento**: Hot reload, HTTPS local, certificados auto-assinados

---

## 🎯 **1. Instalação e Configuração Inicial**

### **1.1 Pré-requisitos**
```bash
# Verificar versões
node --version  # Deve ser 18+
npm --version   # Deve ser 9+

# Instalar Claude Code (obrigatório primeiro)
npm install -g @anthropic-ai/claude-code
```

### **1.2 Instalação do Claude Flow**
```bash
# Instalação global (recomendado)
npm install -g claude-flow@alpha

# OU usar NPX para testes instantâneos
npx claude-flow@alpha init --force
```

### **1.3 Configuração Inicial no Projeto WMS**
```bash
# No diretório raiz do seu projeto WMS
cd /root/wms

# Inicializar Claude Flow com configuração específica para WMS
npx claude-flow@alpha init --force --project-name "wms-system"

# Verificar instalação
npx claude-flow@alpha --version
```

---

## 🔧 **2. Configuração Específica para WMS**

### **2.1 Configuração de Permissões Claude**
```json
// .claude/settings.local.json (atualizar)
{
  "permissions": {
    "allow": [
      "Bash(npm run check:*)",
      "Bash(docker compose *)",
      "Bash(npx claude-flow@alpha *)",
      "FileSystem(backend/src/**/*)",
      "FileSystem(frontend/src/**/*)",
      "FileSystem(docker-compose.yml)",
      "FileSystem(backend/.env)",
      "FileSystem(frontend/.env.local)"
    ],
    "deny": []
  }
}
```

### **2.2 Configuração de Hooks para WMS**
```json
// .claude/settings.json (criar se não existir)
{
  "hooks": {
    "preEditHook": {
      "command": "npx",
      "args": ["claude-flow@alpha", "hooks", "pre-edit", "--file", "$CLAUDE_EDITED_FILE", "--auto-assign-agents", "true"],
      "alwaysRun": false
    },
    "postEditHook": {
      "command": "npx",
      "args": ["claude-flow@alpha", "hooks", "post-edit", "--file", "$CLAUDE_EDITED_FILE", "--format", "true"],
      "alwaysRun": true
    },
    "sessionEndHook": {
      "command": "npx",
      "args": ["claude-flow@alpha", "hooks", "session-end", "--generate-summary", "true"],
      "alwaysRun": true
    }
  }
}
```

---

## 🐝 **3. Fluxos de Trabalho Recomendados**

### **3.1 Desenvolvimento de Features (Padrão Recomendado)**

#### **🚀 Início de Nova Feature**
```bash
# 1. Inicializar sessão para nova feature
npx claude-flow@alpha hive-mind spawn "Implementar sistema de autenticação" --claude

# 2. Continuar desenvolvimento na mesma sessão
npx claude-flow@alpha swarm "Adicionar validação de senha" --continue-session

# 3. Verificar progresso
npx claude-flow@alpha memory query "autenticação" --recent
```

#### **🔄 Desenvolvimento Contínuo**
```bash
# Verificar sessões ativas
npx claude-flow@alpha hive-mind status

# Continuar trabalho anterior
npx claude-flow@alpha hive-mind resume session-xxxxx-xxxxx

# Executar testes após mudanças
npx claude-flow@alpha swarm "Executar testes e verificar build" --continue-session
```

### **3.2 Debugging e Correção de Bugs**

#### **🐛 Debugging Específico**
```bash
# Debug de problema específico
npx claude-flow@alpha swarm "Analisar erro de conexão com PostgreSQL" --strategy debugging

# Debug com contexto completo
npx claude-flow@alpha hive-mind spawn "Debug completo do sistema de upload de fotos" --agents debugger,analyst --claude
```

#### **🔧 Correção Automática**
```bash
# Correção com análise neural
npx claude-flow@alpha swarm "Corrigir problema de CORS no frontend" --neural-patterns enabled

# Correção com rollback automático
npx claude-flow@alpha swarm "Corrigir erro de migração do banco" --auto-rollback
```

### **3.3 Refatoração e Otimização**

#### **🏗️ Refatoração de Código**
```bash
# Refatoração com análise de impacto
npx claude-flow@alpha hive-mind spawn "Refatorar sistema de rotas do backend" --agents architect,coder --claude

# Otimização de performance
npx claude-flow@alpha swarm "Otimizar queries do PostgreSQL" --strategy optimization
```

#### **⚡ Otimização de Performance**
```bash
# Análise de performance
npx claude-flow@alpha swarm "Analisar performance do Redis cache" --strategy performance

# Otimização de build
npx claude-flow@alpha swarm "Otimizar configuração do Vite" --strategy optimization
```

---

## 🛠️ **4. Comandos Específicos para WMS**

### **4.1 Gerenciamento de Docker**
```bash
# Iniciar ambiente completo
npx claude-flow@alpha swarm "docker compose up -d" --strategy infrastructure

# Verificar logs em tempo real
npx claude-flow@alpha swarm "docker compose logs -f backend" --strategy monitoring

# Rebuild containers
npx claude-flow@alpha swarm "docker compose up --build" --strategy infrastructure
```

### **4.2 Gerenciamento de Banco de Dados**
```bash
# Executar migrações
npx claude-flow@alpha swarm "cd backend && npm run db:push" --strategy database

# Gerar novas migrações
npx claude-flow@alpha swarm "cd backend && npm run db:generate" --strategy database

# Backup do banco
npx claude-flow@alpha swarm "docker compose exec postgres pg_dump -U postgres warehouse > backup.sql" --strategy backup
```

### **4.3 Desenvolvimento Frontend**
```bash
# Desenvolvimento de componentes
npx claude-flow@alpha swarm "Criar componente de tabela de produtos" --strategy frontend

# Otimização de bundle
npx claude-flow@alpha swarm "Analisar tamanho do bundle do frontend" --strategy optimization

# Testes de componentes
npx claude-flow@alpha swarm "cd frontend && npm run test" --strategy testing
```

### **4.4 Desenvolvimento Backend**
```bash
# Desenvolvimento de APIs
npx claude-flow@alpha swarm "Criar endpoint para listagem de produtos" --strategy backend

# Otimização de queries
npx claude-flow@alpha swarm "Otimizar query de busca de produtos" --strategy optimization

# Testes de API
npx claude-flow@alpha swarm "cd backend && npm run check" --strategy testing
```

---

## 🧠 **5. Uso Avançado com Memória e Neural**

### **5.1 Sistema de Memória para WMS**
```bash
# Armazenar contexto do projeto
npx claude-flow@alpha memory store "wms-architecture" "Sistema WMS com React frontend, Node.js backend, PostgreSQL e Redis"

# Consultar memória específica
npx claude-flow@alpha memory query "autenticação" --namespace wms

# Exportar memória do projeto
npx claude-flow@alpha memory export wms-memory.json --namespace wms
```

### **5.2 Treinamento Neural Específico**
```bash
# Treinar padrões de desenvolvimento WMS
npx claude-flow@alpha neural train --pattern "wms-development" --data "workflow-patterns.json"

# Predição de problemas comuns
npx claude-flow@alpha neural predict --model "wms-issues" --input "current-state.json"
```

### **5.3 Análise Cognitiva**
```bash
# Análise de padrões de desenvolvimento
npx claude-flow@alpha cognitive analyze --behavior "wms-development-patterns"

# Otimização de workflow
npx claude-flow@alpha cognitive optimize --target "development-efficiency"
```

---

## 🔍 **6. Monitoramento e Debugging**

### **6.1 Monitoramento em Tempo Real**
```bash
# Dashboard de monitoramento
npx claude-flow@alpha swarm monitor --dashboard --real-time

# Análise de performance
npx claude-flow@alpha performance report --components all

# Verificação de saúde do sistema
npx claude-flow@alpha health check --components all --auto-heal
```

### **6.2 Debugging Avançado**
```bash
# Análise de bottlenecks
npx claude-flow@alpha bottleneck analyze --auto-optimize

# Diagnóstico completo
npx claude-flow@alpha diagnostic run --full-system

# Análise de logs
npx claude-flow@alpha log analysis --pattern "error" --timeframe "last-24h"
```

---

## 🚀 **7. Workflows Específicos para WMS**

### **7.1 Workflow de Deploy**
```bash
# Pipeline de deploy completo
npx claude-flow@alpha workflow create --name "WMS-Deploy-Pipeline" --parallel

# Execução do pipeline
npx claude-flow@alpha workflow execute --name "WMS-Deploy-Pipeline" --stages "build,test,deploy"
```

### **7.2 Workflow de Desenvolvimento**
```bash
# Workflow de feature development
npx claude-flow@alpha workflow create --name "Feature-Development" --stages "plan,code,test,review"

# Execução com agentes especializados
npx claude-flow@alpha workflow execute --name "Feature-Development" --agents "architect,coder,tester"
```

### **7.3 Workflow de Testing**
```bash
# Pipeline de testes
npx claude-flow@alpha workflow create --name "Testing-Pipeline" --stages "unit,integration,e2e"

# Execução com cobertura
npx claude-flow@alpha workflow execute --name "Testing-Pipeline" --coverage --parallel
```

---

## 🛡️ **8. Segurança e Boas Práticas**

### **8.1 Configuração de Segurança**
```bash
# Scan de segurança
npx claude-flow@alpha security scan --deep --report

# Auditoria de código
npx claude-flow@alpha security audit --full-trace

# Compliance check
npx claude-flow@alpha security compliance --standard "basic"
```

### **8.2 Backup e Recovery**
```bash
# Backup automático
npx claude-flow@alpha backup create --type "full-system" --schedule "daily"

# Restore de backup
npx claude-flow@alpha restore system --backup "latest" --validate
```

---

## 📊 **9. Comandos de Diagnóstico**

### **9.1 Verificação de Sistema**
```bash
# Status geral
npx claude-flow@alpha status --full

# Verificar conectividade
npx claude-flow@alpha connectivity test --all-services

# Análise de recursos
npx claude-flow@alpha resources analyze --memory --cpu --disk
```

### **9.2 Troubleshooting**
```bash
# Diagnóstico de problemas
npx claude-flow@alpha troubleshoot --auto-fix

# Análise de erros
npx claude-flow@alpha error analysis --pattern "common" --suggestions

# Verificação de configuração
npx claude-flow@alpha config validate --all-files
```

---

## 🎯 **10. Exemplos Práticos para WMS**

### **10.1 Adicionar Nova Feature**
```bash
# 1. Iniciar desenvolvimento
npx claude-flow@alpha hive-mind spawn "Implementar sistema de relatórios" --claude

# 2. Desenvolver backend
npx claude-flow@alpha swarm "Criar API para relatórios de estoque" --continue-session

# 3. Desenvolver frontend
npx claude-flow@alpha swarm "Criar dashboard de relatórios" --continue-session

# 4. Testar integração
npx claude-flow@alpha swarm "Testar integração frontend-backend" --continue-session
```

### **10.2 Corrigir Bug Crítico**
```bash
# 1. Identificar problema
npx claude-flow@alpha swarm "Analisar erro 500 na API de produtos" --strategy debugging

# 2. Corrigir backend
npx claude-flow@alpha swarm "Corrigir query de produtos com JOIN" --strategy fix

# 3. Testar correção
npx claude-flow@alpha swarm "Testar API de produtos após correção" --strategy testing

# 4. Deploy da correção
npx claude-flow@alpha swarm "Deploy da correção em produção" --strategy deployment
```

### **10.3 Otimização de Performance**
```bash
# 1. Análise inicial
npx claude-flow@alpha swarm "Analisar performance da listagem de produtos" --strategy analysis

# 2. Otimizar queries
npx claude-flow@alpha swarm "Otimizar queries com índices PostgreSQL" --strategy optimization

# 3. Implementar cache
npx claude-flow@alpha swarm "Implementar cache Redis para produtos" --strategy optimization

# 4. Testar melhorias
npx claude-flow@alpha swarm "Testar performance após otimizações" --strategy testing
```

---

## 📋 **11. Checklist de Configuração**

### **✅ Pré-requisitos**
- [ ] Node.js 18+ instalado
- [ ] Claude Code instalado globalmente
- [ ] Docker e Docker Compose funcionando
- [ ] Projeto WMS rodando localmente

### **✅ Configuração Claude Flow**
- [ ] Claude Flow instalado
- [ ] Inicialização executada no projeto
- [ ] Permissões configuradas
- [ ] Hooks configurados

### **✅ Testes de Funcionamento**
- [ ] Comando `npx claude-flow@alpha --help` funciona
- [ ] Hive-mind pode ser iniciado
- [ ] Swarm pode executar comandos
- [ ] Memória está funcionando

### **✅ Integração com WMS**
- [ ] Docker Compose funciona com Claude Flow
- [ ] Backend pode ser desenvolvido com assistência
- [ ] Frontend pode ser desenvolvido com assistência
- [ ] Banco de dados pode ser gerenciado

---

## 🚨 **12. Troubleshooting Comum**

### **Problema: Claude Flow não inicia**
```bash
# Solução 1: Reinstalar
npm uninstall -g claude-flow@alpha
npm install -g claude-flow@alpha

# Solução 2: Verificar permissões
npx claude-flow@alpha init --force --skip-permissions-check
```

### **Problema: Docker não funciona com Claude Flow**
```bash
# Verificar Docker
docker --version
docker compose --version

# Testar com Claude Flow
npx claude-flow@alpha swarm "docker compose ps" --strategy infrastructure
```

### **Problema: Memória não persiste**
```bash
# Verificar SQLite
npx claude-flow@alpha memory stats

# Recriar memória
npx claude-flow@alpha memory reset --confirm
```

### **Problema: Hooks não funcionam**
```bash
# Corrigir variáveis de hook
npx claude-flow@alpha fix-hook-variables

# Testar hooks
npx claude-flow@alpha hooks test --all
```

---

## 🎉 **13. Próximos Passos**

### **13.1 Começar Agora**
```bash
# 1. Inicializar Claude Flow no seu projeto
cd /root/wms
npx claude-flow@alpha init --force

# 2. Testar com uma tarefa simples
npx claude-flow@alpha swarm "Verificar status do Docker Compose"

# 3. Iniciar desenvolvimento com assistência
npx claude-flow@alpha hive-mind spawn "Melhorar sistema de autenticação" --claude
```

### **13.2 Recursos Adicionais**
- **Documentação**: [GitHub Claude Flow](https://github.com/ruvnet/claude-flow)
- **Comunidade**: [Discord Agentics](https://discord.agentics.org)
- **Issues**: [GitHub Issues](https://github.com/ruvnet/claude-flow/issues)

---

## 📞 **Suporte**

Se encontrar problemas:
1. Verificar logs: `npx claude-flow@alpha logs --level debug`
2. Reportar issue no GitHub
3. Consultar documentação oficial
4. Pedir ajuda na comunidade Discord

---

**🎯 Resultado Esperado**: Com este guia, você terá um sistema WMS completamente integrado com Claude Flow, permitindo desenvolvimento mais rápido, debugging inteligente e otimizações automáticas baseadas em IA.

**🚀 Próximo Passo**: Execute `npx claude-flow@alpha init --force` no seu projeto e comece a usar! 