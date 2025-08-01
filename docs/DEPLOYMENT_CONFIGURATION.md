# Deployment & Configuration Documentation

## Overview

This document provides comprehensive deployment and configuration guidance for the WMS system across different environments (development, staging, production). The system supports both traditional server deployment and containerized deployment using Docker.

## Environment Configuration

### Environment Variables

#### Core Application Settings

```bash
# Application Configuration
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.wms.company.com

# Security
SESSION_SECRET=your-super-secure-session-secret-here
JWT_SECRET=your-jwt-secret-for-api-tokens
BCRYPT_ROUNDS=12

# CORS Configuration
CORS_ORIGIN=https://wms.company.com,https://app.wms.company.com
CORS_CREDENTIALS=true
```

#### Database Configuration

```bash
# PostgreSQL Database
DATABASE_URL=postgresql://username:password@host:5432/database_name
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wms_production
DB_USER=wms_user
DB_PASSWORD=secure_database_password
DB_SSL=true
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=300000
```

#### Redis Configuration

```bash
# Redis for Caching and Sessions
REDIS_URL=redis://username:password@host:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secure_redis_password
REDIS_DB=0
REDIS_CLUSTER_MODE=false
REDIS_SSL=true
```

#### File Storage Configuration

```bash
# File Storage (Local or Cloud)
STORAGE_TYPE=local # or 'aws-s3', 'google-cloud'
UPLOAD_MAX_SIZE=10485760 # 10MB in bytes
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/webp

# AWS S3 Configuration (if using S3)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=wms-files-production

# Local Storage Configuration
UPLOAD_DIR=/var/wms/uploads
STATIC_FILES_DIR=/var/wms/public
```

#### Monitoring and Logging

```bash
# Logging Configuration
LOG_LEVEL=info # debug, info, warn, error
LOG_FORMAT=json # json, simple
LOG_FILE=/var/log/wms/application.log
LOG_MAX_SIZE=100MB
LOG_MAX_FILES=10

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_TIMEOUT=30000

# APM Configuration (optional)
NEW_RELIC_LICENSE_KEY=your-new-relic-license-key
DATADOG_API_KEY=your-datadog-api-key
```

### Environment-Specific Configurations

#### Development Environment

```bash
# .env.development
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://wms_dev:dev_password@localhost:5432/wms_development
REDIS_URL=redis://localhost:6379/1
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:5173
ENABLE_METRICS=false
```

#### Staging Environment

```bash
# .env.staging
NODE_ENV=staging
PORT=3000
DATABASE_URL=postgresql://wms_staging:staging_password@staging-db:5432/wms_staging
REDIS_URL=redis://staging-redis:6379/0
LOG_LEVEL=info
CORS_ORIGIN=https://staging.wms.company.com
ENABLE_METRICS=true
```

#### Production Environment

```bash
# .env.production
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://wms_prod:prod_password@prod-db:5432/wms_production
REDIS_URL=redis://prod-redis:6379/0
LOG_LEVEL=warn
CORS_ORIGIN=https://wms.company.com
ENABLE_METRICS=true
SSL_CERT_PATH=/etc/ssl/certs/wms.crt
SSL_KEY_PATH=/etc/ssl/private/wms.key
```

## Docker Deployment

### Production Docker Configuration

#### Backend Dockerfile

```dockerfile
# backend/Dockerfile.production
FROM node:18-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S wms -u 1001

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src ./src
COPY drizzle ./drizzle

# Build application
RUN npm run build

# Remove dev dependencies and source files
RUN rm -rf src tsconfig.json
RUN chown -R wms:nodejs /app

USER wms

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

#### Frontend Dockerfile

```dockerfile
# frontend/Dockerfile.production
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY public ./public
COPY index.html ./

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy nginx configuration
COPY nginx.production.conf /etc/nginx/nginx.conf

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Create log directory
RUN mkdir -p /var/log/nginx

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Nginx Configuration

```nginx
# frontend/nginx.production.conf
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    # Performance optimizations
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # Security
        server_tokens off;

        # Static assets caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }

        # API proxy
        location /api/ {
            proxy_pass http://backend:3000/api/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_connect_timeout 5s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # WebSocket proxy
        location /socket.io/ {
            proxy_pass http://backend:3000/socket.io/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "Upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # SPA routing
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        # Security.txt
        location /.well-known/security.txt {
            return 200 "Contact: security@company.com\nExpires: 2025-12-31T23:59:59.000Z\n";
            add_header Content-Type text/plain;
        }
    }
}
```

#### Docker Compose Configuration

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  # PostgreSQL Database
  database:
    image: postgres:14-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: wms_production
      POSTGRES_USER: wms_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --locale=en_US.UTF-8"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backup:/backup
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    ports:
      - "127.0.0.1:5432:5432"
    networks:
      - wms-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wms_user -d wms_production"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  # Redis Cache
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"
    networks:
      - wms-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Backend Application
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.production
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://wms_user:${DB_PASSWORD}@database:5432/wms_production
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      SESSION_SECRET: ${SESSION_SECRET}
      CORS_ORIGIN: ${FRONTEND_URL}
    volumes:
      - uploads:/app/uploads
      - logs:/var/log/wms
    ports:
      - "127.0.0.1:3000:3000"
    networks:
      - wms-network
    depends_on:
      database:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  # Frontend Application
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.production
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./ssl:/etc/ssl/certs:ro
      - logs:/var/log/nginx
    networks:
      - wms-network
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Monitoring (optional)
  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "127.0.0.1:9090:9090"
    networks:
      - wms-network
    depends_on:
      - backend

  grafana:
    image: grafana/grafana:latest
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "127.0.0.1:3001:3000"
    networks:
      - wms-network
    depends_on:
      - prometheus

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  uploads:
    driver: local
  logs:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local

networks:
  wms-network:
    driver: bridge
```

## Traditional Server Deployment

### System Requirements

#### Minimum Requirements

- **OS**: Ubuntu 20.04 LTS or CentOS 8+
- **CPU**: 2 cores (4 recommended)
- **RAM**: 4GB (8GB recommended)
- **Storage**: 50GB SSD (100GB recommended)
- **Network**: 100 Mbps connection

#### Recommended Production Requirements

- **OS**: Ubuntu 22.04 LTS
- **CPU**: 4 cores (8 recommended for high load)
- **RAM**: 16GB (32GB for high load)
- **Storage**: 200GB NVMe SSD
- **Network**: 1 Gbps connection
- **Load Balancer**: Nginx or HAProxy

### Server Setup Script

```bash
#!/bin/bash
# setup-wms-server.sh - WMS Production Server Setup

set -e

# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 14
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-14 postgresql-client-14

# Install Redis
sudo apt install -y redis-server

# Install Nginx
sudo apt install -y nginx

# Install PM2 for process management
sudo npm install -g pm2

# Create WMS user
sudo useradd -m -s /bin/bash wms
sudo usermod -aG www-data wms

# Create application directories
sudo mkdir -p /var/wms/{app,uploads,logs,backup}
sudo chown -R wms:wms /var/wms

# Setup PostgreSQL
sudo -u postgres createuser --interactive wms
sudo -u postgres createdb wms_production -O wms

# Configure Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Setup firewall
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo "Server setup completed. Please configure application-specific settings."
```

### Application Deployment Script

```bash
#!/bin/bash
# deploy-wms.sh - WMS Application Deployment

set -e

APP_DIR="/var/wms/app"
BACKUP_DIR="/var/wms/backup"
REPO_URL="https://github.com/company/wms.git"
BRANCH="main"

# Create backup of current deployment
if [ -d "$APP_DIR" ]; then
    echo "Creating backup..."
    sudo tar -czf "$BACKUP_DIR/wms-backup-$(date +%Y%m%d-%H%M%S).tar.gz" -C "$APP_DIR" .
fi

# Clone or update repository
if [ -d "$APP_DIR/.git" ]; then
    echo "Updating existing repository..."
    cd "$APP_DIR"
    sudo -u wms git fetch origin
    sudo -u wms git reset --hard origin/$BRANCH
else
    echo "Cloning repository..."
    sudo rm -rf "$APP_DIR"
    sudo -u wms git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# Install backend dependencies
echo "Installing backend dependencies..."
cd "$APP_DIR/backend"
sudo -u wms npm ci --production

# Build backend
echo "Building backend..."
sudo -u wms npm run build

# Install frontend dependencies and build
echo "Building frontend..."
cd "$APP_DIR/frontend"
sudo -u wms npm ci
sudo -u wms npm run build

# Copy built frontend files to nginx directory
sudo rm -rf /var/www/html/wms
sudo mkdir -p /var/www/html/wms
sudo cp -r dist/* /var/www/html/wms/
sudo chown -R www-data:www-data /var/www/html/wms

# Run database migrations
echo "Running database migrations..."
cd "$APP_DIR/backend"
sudo -u wms npm run db:migrate

# Restart services
echo "Restarting services..."
sudo pm2 restart wms-backend || sudo -u wms pm2 start ecosystem.config.js
sudo systemctl reload nginx

echo "Deployment completed successfully!"
```

### PM2 Process Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'wms-backend',
      script: './dist/index.js',
      cwd: '/var/wms/app/backend',
      instances: 'max',
      exec_mode: 'cluster',
      user: 'wms',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      log_file: '/var/wms/logs/wms-backend.log',
      out_file: '/var/wms/logs/wms-backend-out.log',
      error_file: '/var/wms/logs/wms-backend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
```

## SSL/TLS Configuration

### Let's Encrypt Setup

```bash
#!/bin/bash
# setup-ssl.sh - Let's Encrypt SSL Certificate Setup

# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d wms.company.com -d api.wms.company.com

# Setup automatic renewal
sudo crontab -l | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | sudo crontab -

# Test renewal
sudo certbot renew --dry-run
```

### Nginx SSL Configuration

```nginx
# /etc/nginx/sites-available/wms
server {
    listen 80;
    server_name wms.company.com api.wms.company.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wms.company.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/wms.company.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wms.company.com/privkey.pem;
    ssl_session_cache shared:SSL:1m;
    ssl_session_timeout 5m;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    root /var/www/html/wms;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Database Management

### Backup Strategy

```bash
#!/bin/bash
# backup-database.sh - Automated Database Backup

BACKUP_DIR="/var/wms/backup"
DB_NAME="wms_production"
DB_USER="wms_user"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup filename with timestamp
BACKUP_FILE="$BACKUP_DIR/wms-db-backup-$(date +%Y%m%d-%H%M%S).sql.gz"

# Create database backup
pg_dump -h localhost -U "$DB_USER" -d "$DB_NAME" --no-password | gzip > "$BACKUP_FILE"

# Verify backup
if [ $? -eq 0 ]; then
    echo "Database backup created successfully: $BACKUP_FILE"
    
    # Remove old backups
    find "$BACKUP_DIR" -name "wms-db-backup-*.sql.gz" -mtime +$RETENTION_DAYS -delete
    
    # Upload to cloud storage (optional)
    # aws s3 cp "$BACKUP_FILE" s3://wms-backups/database/
else
    echo "Database backup failed!"
    exit 1
fi
```

### Restore Procedure

```bash
#!/bin/bash
# restore-database.sh - Database Restore Procedure

BACKUP_FILE="$1"
DB_NAME="wms_production"
DB_USER="wms_user"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

# Stop application
sudo pm2 stop wms-backend

# Create restoration database
sudo -u postgres createdb "${DB_NAME}_restore" -O "$DB_USER"

# Restore backup
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | psql -h localhost -U "$DB_USER" -d "${DB_NAME}_restore"
else
    psql -h localhost -U "$DB_USER" -d "${DB_NAME}_restore" < "$BACKUP_FILE"
fi

# Verify restore
if [ $? -eq 0 ]; then
    echo "Database restored successfully to ${DB_NAME}_restore"
    echo "Please verify the data and then run the following commands to switch:"
    echo "sudo -u postgres dropdb $DB_NAME"
    echo "sudo -u postgres psql -c \"ALTER DATABASE ${DB_NAME}_restore RENAME TO $DB_NAME;\""
    echo "sudo pm2 start wms-backend"
else
    echo "Database restore failed!"
    sudo -u postgres dropdb "${DB_NAME}_restore"
    exit 1
fi
```

## Monitoring and Logging

### Log Rotation Configuration

```bash
# /etc/logrotate.d/wms
/var/wms/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 0644 wms wms
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Health Check Endpoint

```typescript
// Health check implementation
export const healthCheck = async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
    checks: {
      database: 'unknown',
      redis: 'unknown',
      disk: 'unknown',
      memory: 'unknown'
    }
  };

  try {
    // Database check
    await db.execute(sql`SELECT 1`);
    health.checks.database = 'healthy';
  } catch (error) {
    health.checks.database = 'unhealthy';
    health.status = 'unhealthy';
  }

  try {
    // Redis check
    await redis.ping();
    health.checks.redis = 'healthy';
  } catch (error) {
    health.checks.redis = 'unhealthy';
    health.status = 'unhealthy';
  }

  // Memory check
  const memUsage = process.memoryUsage();
  const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  health.checks.memory = memoryUsagePercent < 90 ? 'healthy' : 'warning';

  // Disk space check (simplified)
  health.checks.disk = 'healthy'; // Implement actual disk check

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
};
```

## Security Configuration

### Security Headers Middleware

```typescript
// Security configuration
import helmet from 'helmet';

export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "*.amazonaws.com"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});
```

### Rate Limiting Configuration

```typescript
// Rate limiting setup
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

export const rateLimitConfig = {
  // General API rate limiting
  general: rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...args),
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Authentication rate limiting
  auth: rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...args),
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 auth requests per windowMs
    message: 'Too many authentication attempts, please try again later.',
    skipSuccessfulRequests: true,
  }),

  // File upload rate limiting
  upload: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 upload requests per minute
    message: 'Too many upload requests, please try again later.',
  })
};
```

## Performance Tuning

### PostgreSQL Configuration

```postgresql
-- postgresql.conf optimizations for production
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
```

### Redis Configuration

```redis
# redis.conf optimizations
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
```

This comprehensive deployment and configuration guide ensures the WMS system can be deployed reliably across different environments while maintaining security, performance, and operational excellence.