-- Inicialização do banco de dados WMS
-- Este arquivo é executado automaticamente quando o container PostgreSQL é criado pela primeira vez

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar schema se não existir
CREATE SCHEMA IF NOT EXISTS public;

-- Definir permissões
GRANT ALL PRIVILEGES ON SCHEMA public TO wms_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO wms_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO wms_user;

-- Configurar timezone
SET timezone = 'UTC';

-- Comentário para documentar
COMMENT ON DATABASE wms_db IS 'Warehouse Management System Database'; 