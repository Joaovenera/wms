# ⚡ Comandos Rápidos - Claude Flow + WMS

## 🚀 **Início Rápido**

```bash
# 1. Configuração automática (execute uma vez)
./setup-claude-flow.sh

# 2. Verificar se tudo está funcionando
npx claude-flow@alpha swarm "docker compose ps"

# 3. Iniciar desenvolvimento
npx claude-flow@alpha hive-mind spawn "Implementar nova feature" --claude
```

---

## 🎯 **Comandos Diários**

### **Desenvolvimento**
```bash
# Iniciar nova feature
npx claude-flow@alpha hive-mind spawn "Adicionar sistema de relatórios" --claude

# Continuar trabalho anterior
npx claude-flow@alpha hive-mind resume session-xxxxx-xxxxx

# Executar tarefa rápida
npx claude-flow@alpha swarm "Corrigir bug de login" --strategy debugging
```

### **Docker e Infraestrutura**
```bash
# Iniciar ambiente
npx claude-flow@alpha swarm "docker compose up -d"

# Ver logs
npx claude-flow@alpha swarm "docker compose logs -f backend"

# Rebuild
npx claude-flow@alpha swarm "docker compose up --build"
```

### **Banco de Dados**
```bash
# Executar migrações
npx claude-flow@alpha swarm "cd backend && npm run db:push"

# Backup
npx claude-flow@alpha swarm "docker compose exec postgres pg_dump -U postgres warehouse > backup.sql"
```

### **Frontend**
```bash
# Desenvolver componente
npx claude-flow@alpha swarm "Criar componente de tabela" --strategy frontend

# Testar
npx claude-flow@alpha swarm "cd frontend && npm run test"
```

### **Backend**
```bash
# Criar API
npx claude-flow@alpha swarm "Criar endpoint de produtos" --strategy backend

# Otimizar query
npx claude-flow@alpha swarm "Otimizar query de busca" --strategy optimization
```

---

## 🧠 **Comandos Avançados**

### **Memória e Contexto**
```bash
# Salvar contexto
npx claude-flow@alpha memory store "feature-auth" "Implementando autenticação JWT"

# Consultar memória
npx claude-flow@alpha memory query "autenticação" --recent

# Ver estatísticas
npx claude-flow@alpha memory stats
```

### **Debugging Inteligente**
```bash
# Debug automático
npx claude-flow@alpha swarm "Analisar erro 500" --strategy debugging

# Análise de performance
npx claude-flow@alpha swarm "Otimizar performance" --strategy performance

# Correção automática
npx claude-flow@alpha swarm "Corrigir CORS" --auto-fix
```

### **Monitoramento**
```bash
# Dashboard em tempo real
npx claude-flow@alpha swarm monitor --dashboard

# Health check
npx claude-flow@alpha health check --auto-heal

# Análise de bottlenecks
npx claude-flow@alpha bottleneck analyze
```

---

## 🔧 **Troubleshooting**

### **Problemas Comuns**
```bash
# Claude Flow não inicia
npx claude-flow@alpha init --force

# Docker não funciona
npx claude-flow@alpha swarm "docker --version"

# Memória não persiste
npx claude-flow@alpha memory reset --confirm

# Hooks não funcionam
npx claude-flow@alpha fix-hook-variables
```

### **Verificações de Sistema**
```bash
# Status completo
npx claude-flow@alpha status --full

# Testar conectividade
npx claude-flow@alpha connectivity test

# Verificar configuração
npx claude-flow@alpha config validate
```

---

## 📊 **Workflows Específicos**

### **Feature Development**
```bash
# 1. Planejar
npx claude-flow@alpha hive-mind spawn "Planejar sistema de relatórios" --agents architect --claude

# 2. Implementar backend
npx claude-flow@alpha swarm "Criar APIs de relatórios" --continue-session

# 3. Implementar frontend
npx claude-flow@alpha swarm "Criar dashboard de relatórios" --continue-session

# 4. Testar
npx claude-flow@alpha swarm "Testar integração completa" --continue-session
```

### **Bug Fix**
```bash
# 1. Identificar
npx claude-flow@alpha swarm "Analisar erro de login" --strategy debugging

# 2. Corrigir
npx claude-flow@alpha swarm "Corrigir validação de senha" --strategy fix

# 3. Testar
npx claude-flow@alpha swarm "Testar login após correção" --strategy testing
```

### **Performance Optimization**
```bash
# 1. Analisar
npx claude-flow@alpha swarm "Analisar performance de listagem" --strategy analysis

# 2. Otimizar
npx claude-flow@alpha swarm "Otimizar queries com índices" --strategy optimization

# 3. Implementar cache
npx claude-flow@alpha swarm "Implementar cache Redis" --strategy optimization
```

---

## 🎯 **Dicas de Uso**

### **Para Desenvolvimento Rápido**
- Use `swarm` para tarefas simples e rápidas
- Use `hive-mind` para projetos complexos
- Sempre use `--continue-session` para manter contexto

### **Para Debugging Eficiente**
- Use `--strategy debugging` para análise automática
- Use `--auto-fix` para correções automáticas
- Use `--neural-patterns enabled` para aprendizado

### **Para Performance**
- Use `--strategy optimization` para otimizações
- Use `--strategy performance` para análise
- Use `--parallel` para execução paralela

---

## 📋 **Checklist Rápido**

### **Antes de Começar**
- [ ] Claude Flow instalado: `npx claude-flow@alpha --version`
- [ ] Docker funcionando: `docker compose ps`
- [ ] Projeto rodando: `docker compose up -d`

### **Para Nova Feature**
- [ ] Iniciar hive-mind: `npx claude-flow@alpha hive-mind spawn "feature" --claude`
- [ ] Desenvolver backend: `npx claude-flow@alpha swarm "backend" --continue-session`
- [ ] Desenvolver frontend: `npx claude-flow@alpha swarm "frontend" --continue-session`
- [ ] Testar: `npx claude-flow@alpha swarm "test" --continue-session`

### **Para Bug Fix**
- [ ] Identificar: `npx claude-flow@alpha swarm "debug" --strategy debugging`
- [ ] Corrigir: `npx claude-flow@alpha swarm "fix" --strategy fix`
- [ ] Testar: `npx claude-flow@alpha swarm "test" --strategy testing`

---

**🚀 Pronto para desenvolvimento acelerado com IA!** 