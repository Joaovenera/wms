#!/bin/bash

# Script para configurar Claude Flow para usuário não-root
echo "🔧 Configurando Claude Flow para usuário não-root..."

# Verificar se estamos como claude-user
if [ "$(whoami)" != "claude-user" ]; then
    echo "❌ Este script deve ser executado como claude-user"
    echo "Execute: su - claude-user"
    exit 1
fi

# Navegar para o diretório do projeto
cd /home/claude-user/wms

# Verificar se o diretório existe
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Diretório do projeto WMS não encontrado"
    exit 1
fi

echo "✅ Diretório do projeto encontrado"

# Instalar Node.js e npm se necessário
if ! command -v node &> /dev/null; then
    echo "📦 Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Verificar versões
echo "📋 Verificando versões..."
node --version
npm --version

# Instalar Claude Code globalmente
echo "📦 Instalando Claude Code..."
npm install -g @anthropic-ai/claude-code

# Instalar Claude Flow
echo "📦 Instalando Claude Flow..."
npm install -g claude-flow@alpha

# Inicializar Claude Flow no projeto
echo "🔧 Inicializando Claude Flow..."
npx claude-flow@alpha init --force --project-name "wms-system"

# Configurar MCPs
echo "🔧 Configurando MCPs..."
claude mcp add claude-flow npx claude-flow@alpha mcp start
claude mcp add ruv-swarm npx ruv-swarm@latest mcp start

# Testar configuração
echo "🧪 Testando configuração..."
npx claude-flow@alpha --version
npx claude-flow@alpha memory stats

# Armazenar contexto do projeto
echo "🧠 Configurando memória do projeto..."
npx claude-flow@alpha memory store "wms-setup" "Sistema WMS configurado com Claude Flow v2.0.0, usuário não-root, Docker funcionando, PostgreSQL e Redis ativos"

echo ""
echo "🎉 Configuração completa!"
echo ""
echo "📋 Próximos passos:"
echo "1. Teste o ambiente: npx claude-flow@alpha swarm 'docker compose ps'"
echo "2. Inicie desenvolvimento: npx claude-flow@alpha hive-mind spawn 'Implementar sistema de testes' --claude"
echo "3. Consulte o guia: cat ANALISE_PROJETO_WMS.md"
echo ""
echo "🚀 Pronto para desenvolvimento com IA!" 