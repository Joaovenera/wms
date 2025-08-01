# WMS Composition System Deployment Runbook

## Overview
This runbook provides step-by-step instructions for deploying the WMS composition system to production, including rollback procedures and troubleshooting guides.

## Pre-Deployment Checklist

### 🔍 Security & Compliance Checks
- [ ] Security scan completed (Trivy, npm audit)
- [ ] No critical vulnerabilities detected
- [ ] Environment variables configured and secured
- [ ] SSL certificates valid and up to date
- [ ] Database backups completed
- [ ] Access controls verified

### 🧪 Testing & Quality Assurance
- [ ] All unit tests passing
- [ ] Integration tests completed successfully
- [ ] E2E tests verified across all browsers
- [ ] Performance tests within acceptable limits
- [ ] Load testing completed
- [ ] Composition system functionality verified

### 🏗️ Infrastructure Readiness
- [ ] Production environment accessible
- [ ] Docker registry available
- [ ] Database migration scripts tested
- [ ] Monitoring systems operational
- [ ] Log aggregation configured
- [ ] Backup systems verified

## Deployment Process

### Phase 1: Pre-Deployment Setup

#### 1.1 Environment Preparation
```bash
# Connect to production server
ssh -i ~/.ssh/production_key user@production-server

# Navigate to deployment directory
cd /opt/wms-production

# Verify system resources
df -h
free -h
docker system df
```

#### 1.2 Database Backup
```bash
# Create pre-deployment backup
pg_dump -h localhost -U postgres -d warehouse > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup integrity
pg_restore --list backup_$(date +%Y%m%d_%H%M%S).sql

# Store backup securely
aws s3 cp backup_$(date +%Y%m%d_%H%M%S).sql s3://wms-backups/pre-deployment/
```

#### 1.3 Service Health Check
```bash
# Check current system health
curl -f http://localhost:3000/api/health/comprehensive
curl -f http://localhost:8080/health.html

# Verify monitoring systems
curl -f http://localhost:9090/-/healthy  # Prometheus
curl -f http://localhost:3001/api/health  # Grafana
```

### Phase 2: Deployment Execution

#### 2.1 Pull Latest Images
```bash
# Login to container registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull latest images
docker pull ghcr.io/your-org/wms/backend:latest
docker pull ghcr.io/your-org/wms/frontend:latest

# Verify image integrity
docker image inspect ghcr.io/your-org/wms/backend:latest
docker image inspect ghcr.io/your-org/wms/frontend:latest
```

#### 2.2 Database Migration
```bash
# Run composition system migration
cd /opt/wms-production/backend
docker run --rm --network wms-network \
  -e DATABASE_URL="postgresql://postgres:password@postgres:5432/warehouse" \
  ghcr.io/your-org/wms/backend:latest \
  npm run db:migrate

# Verify migration success
docker run --rm --network wms-network \
  -e DATABASE_URL="postgresql://postgres:password@postgres:5432/warehouse" \
  ghcr.io/your-org/wms/backend:latest \
  psql $DATABASE_URL -c "SELECT version FROM _migrations ORDER BY applied_at DESC LIMIT 1;"
```

#### 2.3 Service Deployment
```bash
# Update environment variables
export BACKEND_IMAGE=ghcr.io/your-org/wms/backend:latest
export FRONTEND_IMAGE=ghcr.io/your-org/wms/frontend:latest

# Deploy with zero-downtime strategy
docker compose -f docker-compose.production.yml up -d --remove-orphans

# Wait for services to be healthy
timeout 180 bash -c 'until curl -f http://localhost:3000/api/health/ready; do sleep 5; done'
timeout 60 bash -c 'until curl -f http://localhost:8080/health.html; do sleep 5; done'
```

### Phase 3: Post-Deployment Verification

#### 3.1 Health Checks
```bash
# Comprehensive health check
curl -s http://localhost:3000/api/health/comprehensive | jq '.'

# Verify composition system
curl -s http://localhost:3000/api/compositions/health | jq '.'

# Check all endpoints
curl -f http://localhost:3000/api/health
curl -f http://localhost:3000/api/health/ready  
curl -f http://localhost:3000/api/health/live
curl -f http://localhost:8080/health.html
```

#### 3.2 Functional Testing
```bash
# Test composition system endpoints
curl -X GET http://localhost:3000/api/compositions/definitions
curl -X POST http://localhost:3000/api/compositions/instances \
  -H "Content-Type: application/json" \
  -d '{"definition_id": 1, "instance_data": {"test": true}}'

# Verify cache functionality
curl -X GET http://localhost:3000/api/compositions/cache/stats
```

#### 3.3 Performance Verification
```bash
# Check response times
curl -w "Time: %{time_total}s\n" -o /dev/null -s http://localhost:3000/api/health

# Monitor resource usage
docker stats --no-stream

# Check logs for errors
docker compose logs backend | grep -i error | tail -20
docker compose logs frontend | grep -i error | tail -20
```

## Monitoring & Alerting Setup

### 4.1 Configure Monitoring
```bash
# Verify Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health != "up")'

# Check alert rules
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.state == "firing")'

# Verify Grafana dashboards
curl -f http://localhost:3001/api/health
```

### 4.2 Set Up Alerts
```bash
# Test critical alerts
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{"labels":{"alertname":"DeploymentTest","severity":"info"}}]'
```

## Rollback Procedures

### 🚨 Emergency Rollback (< 5 minutes)

#### Quick Rollback to Previous Version
```bash
# Stop current services
docker compose -f docker-compose.production.yml down

# Restore from rollback configuration
docker compose -f docker-compose.rollback.yml up -d

# Verify rollback success
timeout 60 bash -c 'until curl -f http://localhost:3000/api/health; do sleep 2; done'
```

### 🔄 Standard Rollback Process

#### 1. Identify Rollback Target
```bash
# List available image versions
docker images | grep wms

# Check previous deployment tags
git log --oneline -10
```

#### 2. Database Rollback (if needed)
```bash
# Restore database from backup
pg_restore -h localhost -U postgres -d warehouse backup_YYYYMMDD_HHMMSS.sql

# Verify database state
psql -h localhost -U postgres -d warehouse -c "SELECT version FROM _migrations ORDER BY applied_at DESC LIMIT 5;"
```

#### 3. Application Rollback
```bash
# Set rollback image versions
export BACKEND_IMAGE=ghcr.io/your-org/wms/backend:v1.2.3
export FRONTEND_IMAGE=ghcr.io/your-org/wms/frontend:v1.2.3

# Deploy rollback version
docker compose -f docker-compose.production.yml up -d

# Verify rollback health
curl -f http://localhost:3000/api/health/comprehensive
```

## Troubleshooting Guide

### Common Issues & Solutions

#### 🔴 Database Connection Issues
```bash
# Check database connectivity
docker exec wms-postgres-prod pg_isready -U postgres

# Verify connection strings
echo $DATABASE_URL

# Check database logs
docker logs wms-postgres-prod | tail -50
```

#### 🔴 Redis Connection Issues
```bash
# Test Redis connectivity
docker exec wms-redis-prod redis-cli ping

# Check Redis memory usage
docker exec wms-redis-prod redis-cli info memory

# Restart Redis if needed
docker restart wms-redis-prod
```

#### 🔴 High Memory Usage
```bash
# Check container memory usage
docker stats --no-stream

# Identify memory leaks
curl -s http://localhost:3000/api/health/comprehensive | jq '.performance.memory'

# Restart high-memory containers
docker restart wms-backend-prod
```

#### 🔴 Composition System Issues
```bash
# Check composition tables
docker exec wms-postgres-prod psql -U postgres -d warehouse \
  -c "SELECT COUNT(*) FROM composition_definitions WHERE is_active = true;"

# Verify composition cache
curl -s http://localhost:3000/api/compositions/cache/stats

# Clear composition cache if needed
curl -X DELETE http://localhost:3000/api/compositions/cache/clear
```

#### 🔴 SSL/TLS Certificate Issues
```bash
# Check certificate validity
openssl x509 -in /etc/ssl/certs/wms.crt -text -noout

# Verify certificate chain
openssl verify -CAfile /etc/ssl/certs/ca.crt /etc/ssl/certs/wms.crt

# Renew certificates if needed
certbot renew --nginx
```

### Performance Optimization

#### Database Performance
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Analyze composition system performance
ANALYZE composition_definitions;
ANALYZE composition_instances;
REFRESH MATERIALIZED VIEW composition_performance_summary;
```

#### Cache Optimization
```bash
# Check Redis performance
docker exec wms-redis-prod redis-cli --latency-history

# Optimize cache settings
docker exec wms-redis-prod redis-cli config set maxmemory-policy allkeys-lru
```

## Post-Deployment Tasks

### Documentation Updates
- [ ] Update deployment version in documentation
- [ ] Record any configuration changes
- [ ] Update monitoring dashboards if needed
- [ ] Notify stakeholders of successful deployment

### Security Verification
- [ ] Verify all security headers are present
- [ ] Test authentication flows
- [ ] Validate authorization controls
- [ ] Check audit logging functionality

### Performance Baseline
- [ ] Record performance metrics
- [ ] Update performance budgets if needed
- [ ] Set up new monitoring alerts
- [ ] Schedule performance review

## Contact Information

### Emergency Contacts
- **DevOps Lead**: [email] / [phone]
- **Database Admin**: [email] / [phone]
- **Security Team**: [email] / [phone]
- **On-Call Engineer**: [phone]

### Escalation Procedures
1. **Level 1**: Development Team (0-15 minutes)
2. **Level 2**: DevOps Team (15-30 minutes)
3. **Level 3**: Architecture Team (30-60 minutes)
4. **Level 4**: Leadership Team (60+ minutes)

## Appendix

### Useful Commands
```bash
# Quick health check
curl -f http://localhost:3000/api/health && echo "✅ Backend OK" || echo "❌ Backend Failed"

# Container status overview
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Log streaming
docker compose logs -f backend frontend

# Resource monitoring
watch -n 5 'docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"'
```

### Configuration Files
- `/opt/wms-production/docker-compose.production.yml`
- `/opt/wms-production/.env.production`
- `/opt/wms-production/nginx/nginx.conf`
- `/opt/wms-production/monitoring/prometheus.yml`

---

**Last Updated**: $(date)  
**Version**: 1.0.0  
**Author**: DevOps Team