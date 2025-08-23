#!/bin/bash

# Script para configurar wms.jarmaq.com.br
# Execute como root: sudo bash setup-domain.sh

set -e

echo "🔧 Configurando domínio wms.jarmaq.com.br..."

# 1. Copiar configuração do virtual host
echo "📁 Copiando configuração do virtual host..."
sudo cp litespeed-wms.conf /usr/local/lsws/conf/vhosts/wms.conf

# 2. Incluir virtual host no httpd_config.conf
echo "🔗 Adicionando virtual host ao httpd_config.conf..."
if ! grep -q "wms.jarmaq.com.br" /usr/local/lsws/conf/httpd_config.conf; then
    sudo sed -i '/virtualhost default {/a\  include /usr/local/lsws/conf/vhosts/wms.conf' /usr/local/lsws/conf/httpd_config.conf
fi

# 3. Criar diretório para logs
echo "📝 Criando diretórios de log..."
sudo mkdir -p /usr/local/lsws/logs
sudo touch /usr/local/lsws/logs/wms.jarmaq.com.br.access.log
sudo touch /usr/local/lsws/logs/wms.jarmaq.com.br.error.log
sudo chown nobody:nobody /usr/local/lsws/logs/wms.jarmaq.com.br.*

# 4. Build do frontend para produção
echo "🏗️  Fazendo build do frontend..."
cd frontend
npm run build
cd ..

# 5. Verificar se o build foi criado
if [ ! -d "frontend/dist" ]; then
    echo "❌ Erro: Build do frontend não encontrado em frontend/dist"
    echo "Execute: cd frontend && npm run build"
    exit 1
fi

# 6. Configurar permissões
echo "🔐 Configurando permissões..."
sudo chown -R nobody:nobody frontend/dist
sudo chmod -R 755 frontend/dist

# 7. Recarregar LiteSpeed
echo "🔄 Recarregando LiteSpeed..."
sudo /usr/local/lsws/bin/lswsctrl restart

echo ""
echo "🎉 Configuração concluída!"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure DNS no Cloudflare:"
echo "   - Tipo: A"
echo "   - Nome: wms"
echo "   - Conteúdo: $(curl -s ifconfig.me)"
echo "   - Proxy: ✅ Ativado"
echo ""
echo "2. Configure SSL (opcional):"
echo "   - Use Let's Encrypt ou Cloudflare SSL"
echo "   - Certificados em: /usr/local/lsws/ssl/"
echo ""
echo "3. Teste o acesso:"
echo "   - HTTP: http://wms.jarmaq.com.br"
echo "   - API: http://wms.jarmaq.com.br/api/health"
echo ""
echo "4. Para atualizações futuras:"
echo "   - cd frontend && npm run build"
echo "   - sudo bash setup-domain.sh"
