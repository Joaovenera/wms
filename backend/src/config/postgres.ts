import pkg from 'pg';
const { Pool } = pkg;
import logger from '../utils/logger.js';

// Configuração do PostgreSQL otimizada para desenvolvimento
const postgresConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/warehouse',
  
  // Connection pool settings otimizadas para desenvolvimento
  min: 1, // Reduzido para 1 conexão mínima
  max: 5,  // Reduzido para 5 conexões máximas (era 20)
  idleTimeoutMillis: 10000, // Reduzido para 10s (era 30s)
  connectionTimeoutMillis: 5000, // Reduzido para 5s
  
  // SSL configuration (disabled for local development)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  
  // Application identification
  application_name: 'wms-backend-postgres',
  
  // Connection retry settings
  query_timeout: 30000,  // Aumentado para 30s para queries pesadas
  statement_timeout: 45000, // Aumentado para 45s
};

// Criar pool de conexões PostgreSQL
export const postgresPool = new Pool(postgresConfig);

// Event listeners para monitoramento (otimizado)
postgresPool.on('connect', () => {
  logger.info('PostgreSQL client connected to pool');
});

// Removido logs de debug excessivos para acquire/release
// Mantemos apenas logs de erro que são importantes
postgresPool.on('error', (err) => {
  logger.error('PostgreSQL pool error:', err);
});

// Log apenas quando o pool atinge limites críticos
let connectionWarningLogged = false;
postgresPool.on('acquire', () => {
  if (postgresPool.totalCount >= 4 && !connectionWarningLogged) {
    logger.warn(`PostgreSQL pool utilizando ${postgresPool.totalCount}/${postgresConfig.max} conexões`);
    connectionWarningLogged = true;
  }
});

postgresPool.on('release', () => {
  if (postgresPool.totalCount < 4 && connectionWarningLogged) {
    connectionWarningLogged = false; // Reset warning flag
  }
});

// Função para conectar ao PostgreSQL
export async function connectPostgres() {
  try {
    // Teste a conexão pegando um cliente
    const client = await postgresPool.connect();
    
    // Teste uma query simples
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    logger.info('PostgreSQL connected successfully');
    logger.info(`Database time: ${result.rows[0].current_time}`);
    logger.info(`PostgreSQL version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
    
    // Libera o cliente de volta para o pool
    client.release();
    
    return true;
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL:', error);
    throw error;
  }
}

// Função para desconectar do PostgreSQL
export async function disconnectPostgres() {
  try {
    await postgresPool.end();
    logger.info('PostgreSQL disconnected successfully');
  } catch (error) {
    logger.error('Failed to disconnect from PostgreSQL:', error);
  }
}

// Função para verificar se PostgreSQL está conectado
export async function isPostgresConnected(): Promise<boolean> {
  try {
    const client = await postgresPool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    logger.error('PostgreSQL connection check failed:', error);
    return false;
  }
}

// Função para obter estatísticas do PostgreSQL
export async function getPostgresStats() {
  try {
    const client = await postgresPool.connect();
    
    // Query para obter estatísticas básicas
    const statsQuery = `
      SELECT 
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity) as total_connections,
        (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_connections,
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        current_database() as database_name,
        version() as version,
        NOW() as current_time,
        pg_postmaster_start_time() as server_start_time,
        ROUND((sum(blks_hit) * 100.0 / nullif(sum(blks_hit) + sum(blks_read), 0))::numeric, 2) as cache_hit_ratio
      FROM pg_stat_database 
      WHERE datname = current_database()
      GROUP BY datname;
    `;
    
    const result = await client.query(statsQuery);
    const stats = result.rows[0];
    
    // Query para obter informações das tabelas
    const tablesQuery = `
      SELECT 
        table_name,
        (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::int as row_count
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const tablesResult = await client.query(tablesQuery);
    
    // Pool statistics
    const poolStats = {
      totalCount: postgresPool.totalCount,
      idleCount: postgresPool.idleCount,
      waitingCount: postgresPool.waitingCount,
    };
    
    client.release();
    
    return {
      connection: {
        active: parseInt(stats.active_connections),
        total: parseInt(stats.total_connections),
        max: parseInt(stats.max_connections),
        pool: poolStats,
      },
      database: {
        name: stats.database_name,
        size: stats.database_size,
        version: stats.version.split(' ')[0] + ' ' + stats.version.split(' ')[1],
        uptime: stats.server_start_time,
        current_time: stats.current_time,
      },
      performance: {
        cache_hit_ratio: parseFloat(stats.cache_hit_ratio) || 0,
      },
      tables: tablesResult.rows,
      connected: true,
    };
  } catch (error) {
    logger.error('Error getting PostgreSQL stats:', error);
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Função para verificar saúde do banco de dados
export async function checkDatabaseHealth() {
  try {
    const client = await postgresPool.connect();
    
    // Verificações básicas de saúde
    const healthChecks = await Promise.all([
      // 1. Verificar se consegue fazer queries básicas
      client.query('SELECT 1 as basic_query'),
      
      // 2. Verificar se as tabelas principais existem
      client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'products', 'pallets', 'ucps', 'positions')
      `),
      
      // 3. Verificar extensões essenciais
      client.query(`
        SELECT extname 
        FROM pg_extension 
        WHERE extname IN ('uuid-ossp', 'btree_gin', 'btree_gist')
      `),
    ]);
    
    client.release();
    
    const coreTablesCount = healthChecks[1].rows.length;
    const extensionsCount = healthChecks[2].rows.length;
    
    const allChecksPass = 
      healthChecks[0].rows.length > 0 &&
      coreTablesCount >= 5 &&
      extensionsCount >= 3;
      
    const health = {
      status: allChecksPass ? 'healthy' as const : 'degraded' as const,
      checks: {
        basic_query: healthChecks[0].rows.length > 0,
        core_tables: coreTablesCount >= 5,
        extensions: extensionsCount >= 3,
      },
      details: {
        core_tables_found: coreTablesCount,
        extensions_found: extensionsCount,
      },
    };
    
    return health;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'unhealthy' as const,
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        basic_query: false,
        core_tables: false,
        extensions: false,
      },
    };
  }
}

// Função utilitária para executar queries com retry
export async function executeQuery(query: string, params: any[] = [], retries = 3) {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await postgresPool.connect();
      const result = await client.query(query, params);
      client.release();
      return result;
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Query attempt ${attempt}/${retries} failed:`, error);
      
      if (attempt < retries) {
        // Aguarda antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  
  throw lastError;
}