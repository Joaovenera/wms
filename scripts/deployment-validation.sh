#!/bin/bash

# =================================================================
# WMS Deployment Validation Script
# Comprehensive validation for composition system deployment
# =================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:8080}"
TIMEOUT="${TIMEOUT:-60}"
RETRY_COUNT="${RETRY_COUNT:-5}"
RETRY_DELAY="${RETRY_DELAY:-10}"

# Logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Health check with retry logic
health_check() {
    local url=$1
    local description=$2
    local retry_count=0
    
    log "Checking $description..."
    
    while [ $retry_count -lt $RETRY_COUNT ]; do
        if curl -sf --max-time $TIMEOUT "$url" > /dev/null; then
            success "$description is healthy"
            return 0
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $RETRY_COUNT ]; then
                warning "$description not ready, retrying in ${RETRY_DELAY}s (attempt $retry_count/$RETRY_COUNT)"
                sleep $RETRY_DELAY
            fi
        fi
    done
    
    error "$description failed health check after $RETRY_COUNT attempts"
    return 1
}

# Comprehensive health check
comprehensive_health_check() {
    local url=$1
    local description=$2
    
    log "Running comprehensive health check for $description..."
    
    local response=$(curl -sf --max-time $TIMEOUT "$url" 2>/dev/null || echo "")
    
    if [ -z "$response" ]; then
        error "$description comprehensive health check failed"
        return 1
    fi
    
    # Parse JSON response
    local status=$(echo "$response" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
    local checks_failed=$(echo "$response" | jq '[.checks // {} | to_entries[] | select(.value.status == "unhealthy")] | length' 2>/dev/null || echo "0")
    
    if [ "$status" = "healthy" ] && [ "$checks_failed" = "0" ]; then
        success "$description comprehensive health check passed"
        return 0
    elif [ "$status" = "degraded" ]; then
        warning "$description is in degraded state but operational"
        return 0
    else
        error "$description comprehensive health check failed (status: $status, failed checks: $checks_failed)"
        return 1
    fi
}

# Test specific endpoints
test_endpoints() {
    log "Testing critical endpoints..."
    
    local endpoints=(
        "$BACKEND_URL/api/health:Basic health check"
        "$BACKEND_URL/api/health/ready:Readiness probe"
        "$BACKEND_URL/api/health/live:Liveness probe"
        "$FRONTEND_URL/health.html:Frontend health"
    )
    
    local failed_count=0
    
    for endpoint_desc in "${endpoints[@]}"; do
        local endpoint=$(echo "$endpoint_desc" | cut -d':' -f1)
        local desc=$(echo "$endpoint_desc" | cut -d':' -f2)
        
        if curl -sf --max-time 10 "$endpoint" > /dev/null; then
            success "$desc endpoint is accessible"
        else
            error "$desc endpoint failed"
            failed_count=$((failed_count + 1))
        fi
    done
    
    if [ $failed_count -eq 0 ]; then
        success "All critical endpoints are accessible"
        return 0
    else
        error "$failed_count critical endpoints failed"
        return 1
    fi
}

# Test composition system specific functionality
test_composition_system() {
    log "Testing composition system functionality..."
    
    # Test composition definitions endpoint
    if curl -sf --max-time 10 "$BACKEND_URL/api/compositions/definitions" > /dev/null; then
        success "Composition definitions endpoint is accessible"
    else
        error "Composition definitions endpoint failed"
        return 1
    fi
    
    # Test composition cache stats
    if curl -sf --max-time 10 "$BACKEND_URL/api/compositions/cache/stats" > /dev/null; then
        success "Composition cache stats endpoint is accessible"
    else
        warning "Composition cache stats endpoint not accessible (may be expected)"
    fi
    
    # Test composition system health
    local comp_health=$(curl -sf --max-time 10 "$BACKEND_URL/api/health/comprehensive" 2>/dev/null || echo "")
    if [ -n "$comp_health" ]; then
        local comp_status=$(echo "$comp_health" | jq -r '.checks.composition_system.status // "unknown"' 2>/dev/null || echo "unknown")
        if [ "$comp_status" = "healthy" ] || [ "$comp_status" = "degraded" ]; then
            success "Composition system is operational"
        else
            error "Composition system health check failed"
            return 1
        fi
    else
        error "Unable to retrieve composition system health status"
        return 1
    fi
    
    return 0
}

# Performance validation
performance_validation() {
    log "Running performance validation..."
    
    # Test response times
    local backend_time=$(curl -w "%{time_total}" -o /dev/null -sf --max-time 30 "$BACKEND_URL/api/health" 2>/dev/null || echo "999")
    local frontend_time=$(curl -w "%{time_total}" -o /dev/null -sf --max-time 30 "$FRONTEND_URL/health.html" 2>/dev/null || echo "999")
    
    # Check if response times are acceptable (< 2 seconds)
    if (( $(echo "$backend_time < 2.0" | bc -l) )); then
        success "Backend response time is acceptable (${backend_time}s)"
    else
        warning "Backend response time is slow (${backend_time}s)"
    fi
    
    if (( $(echo "$frontend_time < 2.0" | bc -l) )); then
        success "Frontend response time is acceptable (${frontend_time}s)"
    else
        warning "Frontend response time is slow (${frontend_time}s)"
    fi
    
    # Check memory usage
    local memory_info=$(curl -sf --max-time 10 "$BACKEND_URL/api/health/comprehensive" 2>/dev/null || echo "")
    if [ -n "$memory_info" ]; then
        local heap_used=$(echo "$memory_info" | jq -r '.performance.memory.heapUsed // 0' 2>/dev/null || echo "0")
        local heap_total=$(echo "$memory_info" | jq -r '.performance.memory.heapTotal // 1' 2>/dev/null || echo "1")
        local memory_usage=$(echo "scale=2; $heap_used / $heap_total * 100" | bc -l 2>/dev/null || echo "0")
        
        if (( $(echo "$memory_usage < 80" | bc -l) )); then
            success "Memory usage is acceptable (${memory_usage}%)"
        else
            warning "Memory usage is high (${memory_usage}%)"
        fi
    fi
}

# Database connectivity test
test_database_connectivity() {
    log "Testing database connectivity..."
    
    local db_health=$(curl -sf --max-time 10 "$BACKEND_URL/api/health/comprehensive" 2>/dev/null || echo "")
    if [ -n "$db_health" ]; then
        local db_status=$(echo "$db_health" | jq -r '.checks.database.status // "unknown"' 2>/dev/null || echo "unknown")
        local db_response_time=$(echo "$db_health" | jq -r '.checks.database.responseTime // 0' 2>/dev/null || echo "0")
        
        if [ "$db_status" = "healthy" ]; then
            success "Database connectivity is healthy (${db_response_time}ms)"
        elif [ "$db_status" = "degraded" ]; then
            warning "Database connectivity is degraded (${db_response_time}ms)"
        else
            error "Database connectivity failed"
            return 1
        fi
    else
        error "Unable to retrieve database health status"
        return 1
    fi
}

# Cache connectivity test
test_cache_connectivity() {
    log "Testing cache connectivity..."
    
    local cache_health=$(curl -sf --max-time 10 "$BACKEND_URL/api/health/comprehensive" 2>/dev/null || echo "")
    if [ -n "$cache_health" ]; then
        local cache_status=$(echo "$cache_health" | jq -r '.checks.redis.status // "unknown"' 2>/dev/null || echo "unknown")
        local cache_response_time=$(echo "$cache_health" | jq -r '.checks.redis.responseTime // 0' 2>/dev/null || echo "0")
        
        if [ "$cache_status" = "healthy" ]; then
            success "Cache connectivity is healthy (${cache_response_time}ms)"
        elif [ "$cache_status" = "degraded" ]; then
            warning "Cache connectivity is degraded (${cache_response_time}ms)"
        else
            error "Cache connectivity failed"
            return 1
        fi
    else
        error "Unable to retrieve cache health status"
        return 1
    fi
}

# Security validation
security_validation() {
    log "Running security validation..."
    
    # Check for security headers
    local headers=$(curl -I -sf --max-time 10 "$FRONTEND_URL" 2>/dev/null || echo "")
    
    if echo "$headers" | grep -q "X-Content-Type-Options"; then
        success "X-Content-Type-Options header present"
    else
        warning "X-Content-Type-Options header missing"
    fi
    
    if echo "$headers" | grep -q "X-Frame-Options"; then
        success "X-Frame-Options header present"
    else
        warning "X-Frame-Options header missing"
    fi
    
    if echo "$headers" | grep -q "Content-Security-Policy"; then
        success "Content-Security-Policy header present"
    else
        warning "Content-Security-Policy header missing"
    fi
    
    # Test HTTPS redirect (if applicable)
    if [[ "$FRONTEND_URL" == https://* ]]; then
        local http_url="${FRONTEND_URL/https:/http:}"
        local redirect_status=$(curl -I -sf --max-time 10 "$http_url" 2>/dev/null | grep "HTTP" | awk '{print $2}' || echo "000")
        
        if [ "$redirect_status" = "301" ] || [ "$redirect_status" = "302" ]; then
            success "HTTP to HTTPS redirect is working"
        else
            warning "HTTP to HTTPS redirect may not be configured"
        fi
    fi
}

# Monitoring validation
test_monitoring() {
    log "Testing monitoring endpoints..."
    
    # Test Prometheus (if available)
    if curl -sf --max-time 10 "http://localhost:9090/-/healthy" > /dev/null 2>&1; then
        success "Prometheus monitoring is healthy"
    else
        warning "Prometheus monitoring not accessible (may be expected in some environments)"
    fi
    
    # Test Grafana (if available)
    if curl -sf --max-time 10 "http://localhost:3001/api/health" > /dev/null 2>&1; then
        success "Grafana monitoring is healthy"
    else
        warning "Grafana monitoring not accessible (may be expected in some environments)"
    fi
    
    # Test metrics endpoint
    if curl -sf --max-time 10 "$BACKEND_URL/metrics" > /dev/null 2>&1; then
        success "Application metrics endpoint is accessible"
    else
        warning "Application metrics endpoint not accessible"
    fi
}

# Generate validation report
generate_report() {
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    local report_file="deployment_validation_$(date +'%Y%m%d_%H%M%S').json"
    
    log "Generating validation report..."
    
    # Create comprehensive report
    cat > "$report_file" << EOF
{
  "validation_timestamp": "$timestamp",
  "backend_url": "$BACKEND_URL",
  "frontend_url": "$FRONTEND_URL",
  "validation_results": {
    "basic_health": $(health_check "$BACKEND_URL/api/health" "Backend basic health" >/dev/null 2>&1 && echo "true" || echo "false"),
    "comprehensive_health": $(comprehensive_health_check "$BACKEND_URL/api/health/comprehensive" "Backend comprehensive health" >/dev/null 2>&1 && echo "true" || echo "false"),
    "endpoints_accessible": $(test_endpoints >/dev/null 2>&1 && echo "true" || echo "false"),
    "composition_system": $(test_composition_system >/dev/null 2>&1 && echo "true" || echo "false"),
    "database_connectivity": $(test_database_connectivity >/dev/null 2>&1 && echo "true" || echo "false"),
    "cache_connectivity": $(test_cache_connectivity >/dev/null 2>&1 && echo "true" || echo "false")
  },
  "performance_metrics": {
    "backend_response_time": $(curl -w "%{time_total}" -o /dev/null -sf --max-time 30 "$BACKEND_URL/api/health" 2>/dev/null || echo "null"),
    "frontend_response_time": $(curl -w "%{time_total}" -o /dev/null -sf --max-time 30 "$FRONTEND_URL/health.html" 2>/dev/null || echo "null")
  }
}
EOF
    
    success "Validation report generated: $report_file"
}

# Main validation function
main() {
    echo "========================================"
    echo "🚀 WMS Deployment Validation Started"
    echo "========================================"
    echo ""
    
    local failed_tests=0
    
    # Basic health checks
    health_check "$BACKEND_URL/api/health" "Backend basic health" || failed_tests=$((failed_tests + 1))
    health_check "$FRONTEND_URL/health.html" "Frontend health" || failed_tests=$((failed_tests + 1))
    
    echo ""
    
    # Comprehensive health checks
    comprehensive_health_check "$BACKEND_URL/api/health/comprehensive" "Backend comprehensive health" || failed_tests=$((failed_tests + 1))
    
    echo ""
    
    # Endpoint tests
    test_endpoints || failed_tests=$((failed_tests + 1))
    
    echo ""
    
    # Composition system tests
    test_composition_system || failed_tests=$((failed_tests + 1))
    
    echo ""
    
    # Infrastructure tests
    test_database_connectivity || failed_tests=$((failed_tests + 1))
    test_cache_connectivity || failed_tests=$((failed_tests + 1))
    
    echo ""
    
    # Performance validation
    performance_validation
    
    echo ""
    
    # Security validation
    security_validation
    
    echo ""
    
    # Monitoring validation
    test_monitoring
    
    echo ""
    
    # Generate report
    generate_report
    
    echo ""
    echo "========================================"
    if [ $failed_tests -eq 0 ]; then
        success "🎉 All validation tests passed successfully!"
        echo "✅ Deployment is ready for production traffic"
    else
        error "⚠️  $failed_tests validation tests failed"
        echo "❌ Review failed tests before proceeding"
        exit 1
    fi
    echo "========================================"
}

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    command -v curl >/dev/null 2>&1 || missing_deps+=("curl")
    command -v jq >/dev/null 2>&1 || missing_deps+=("jq")
    command -v bc >/dev/null 2>&1 || missing_deps+=("bc")
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        error "Missing required dependencies: ${missing_deps[*]}"
        echo "Please install the missing dependencies and try again."
        exit 1
    fi
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --backend-url URL    Backend URL (default: http://localhost:3000)"
    echo "  --frontend-url URL   Frontend URL (default: http://localhost:8080)"
    echo "  --timeout SECONDS    Request timeout (default: 60)"
    echo "  --retry-count COUNT  Retry attempts (default: 5)"
    echo "  --retry-delay DELAY  Delay between retries (default: 10)"
    echo "  --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0"
    echo "  $0 --backend-url https://api.wms.yourdomain.com --frontend-url https://wms.yourdomain.com"
    echo "  $0 --timeout 30 --retry-count 3"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-url)
            BACKEND_URL="$2"
            shift 2
            ;;
        --frontend-url)
            FRONTEND_URL="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --retry-count)
            RETRY_COUNT="$2"
            shift 2
            ;;
        --retry-delay)
            RETRY_DELAY="$2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Run validation
check_dependencies
main