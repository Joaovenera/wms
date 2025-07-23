# Configuração da Câmera

## Problema
A câmera não funciona quando o site é acessado via HTTP. Os navegadores modernos requerem HTTPS para acessar a câmera por questões de segurança.

## Soluções

### 1. Acesso via HTTPS (Recomendado)
Para usar a câmera, acesse o sistema via HTTPS:

```
https://69.62.95.146:5174/pallets
```

**Nota:** Como estamos usando certificados auto-assinados, o navegador mostrará um aviso de segurança. Clique em "Avançado" e depois "Prosseguir para 69.62.95.146 (não seguro)".

### 2. Upload de Arquivo (Alternativa)
Se não conseguir usar HTTPS, o sistema oferece uma alternativa de upload de arquivo:

1. Clique em "Capturar Foto" no formulário de pallet
2. Quando aparecer a mensagem sobre HTTPS, clique em "Selecionar Foto"
3. Escolha uma imagem do seu dispositivo

### 3. Desenvolvimento Local
Para desenvolvimento local, a câmera funciona normalmente em `http://localhost:5174`.

## Configuração de Certificados

Os certificados SSL auto-assinados já foram criados em `frontend/certs/`. Se precisar recriar:

```bash
cd frontend/certs
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=BR/ST=SP/L=SaoPaulo/O=WMS/CN=localhost"
```

## Iniciar Servidor com HTTPS

```bash
cd frontend
npm run dev:https
```

## Troubleshooting

### Câmera não inicia
1. Verifique se está acessando via HTTPS
2. Verifique as permissões do navegador para câmera
3. Tente usar a opção de upload de arquivo

### Erro de certificado
1. Clique em "Avançado" no aviso de segurança
2. Clique em "Prosseguir para [IP] (não seguro)"
3. Ou adicione uma exceção de segurança no navegador

### Permissão negada
1. Verifique as configurações de câmera do navegador
2. Clique no ícone de câmera na barra de endereços
3. Permita o acesso à câmera 