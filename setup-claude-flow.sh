#!/bin/bash

# 🚀 Script de Configuração Claude Flow para WMS
# Este script configura automaticamente o Claude Flow para o seu projeto WMS

echo "🚀 Iniciando configuração do Claude Flow para WMS..."

# Verificar se estamos no diretório correto
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erro: Execute este script no diretório raiz do projeto WMS"
    exit 1
fi

# Verificar Node.js
echo "📋 Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js 18+ primeiro."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ é necessário. Versão atual: $(node --version)"
    exit 1
fi

echo "✅ Node.js $(node --version) encontrado"

# Verificar npm
echo "📋 Verificando npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado"
    exit 1
fi

echo "✅ npm $(npm --version) encontrado"

# Verificar Docker
echo "📋 Verificando Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não encontrado"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose não encontrado"
    exit 1
fi

echo "✅ Docker $(docker --version) e Docker Compose encontrados"

# Instalar Claude Code (se não estiver instalado)
echo "📦 Verificando Claude Code..."
if ! command -v claude &> /dev/null; then
    echo "📦 Instalando Claude Code..."
    npm install -g @anthropic-ai/claude-code
    echo "✅ Claude Code instalado"
else
    echo "✅ Claude Code já está instalado"
fi

# Instalar Claude Flow
echo "📦 Instalando Claude Flow Alpha..."
npm install -g claude-flow@alpha

# Inicializar Claude Flow no projeto
echo "🔧 Inicializando Claude Flow no projeto WMS..."
npx claude-flow@alpha init --force --project-name "wms-system"

# Configurar memória inicial do projeto
echo "🧠 Configurando memória inicial do projeto..."
npx claude-flow@alpha memory store "wms-architecture" "Sistema WMS com React frontend, Node.js backend, PostgreSQL e Redis"
npx claude-flow@alpha memory store "wms-tech-stack" "Frontend: React+TypeScript+Vite+Tailwind+Radix UI | Backend: Node.js+Express+TypeScript+Drizzle ORM+PostgreSQL | Infra: Docker+Redis+PostgreSQL"
npx claude-flow@alpha memory store "wms-development" "Desenvolvimento com hot reload, HTTPS local, certificados auto-assinados, Docker Compose para ambiente completo"

# Verificar configuração
echo "🔍 Verificando configuração..."
npx claude-flow@alpha --version
npx claude-flow@alpha memory stats

# Testar conectividade básica
echo "🧪 Testando conectividade..."
npx claude-flow@alpha swarm "echo 'Claude Flow configurado com sucesso!'" --strategy test

echo ""
echo "🎉 Claude Flow configurado com sucesso para o projeto WMS!"
echo ""
echo "📋 Próximos passos:"
echo "1. Teste o ambiente: npx claude-flow@alpha swarm 'docker compose ps'"
echo "2. Inicie desenvolvimento: npx claude-flow@alpha hive-mind spawn 'Melhorar sistema de autenticação' --claude"
echo "3. Consulte o guia completo: cat GUIA_CLAUDE_FLOW_COMPLETO.md"
echo ""
echo "🚀 Pronto para desenvolvimento com IA!" 