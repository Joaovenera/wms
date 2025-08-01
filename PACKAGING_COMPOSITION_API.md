# Packaging Composition API Documentation

## Overview

The Packaging Composition API provides advanced functionality for calculating optimal pallet compositions, managing composition lifecycles, and generating detailed reports for warehouse management systems.

## Features

- **Optimal Composition Calculation**: AI-powered algorithms to determine the best arrangement of products on pallets
- **Constraint Validation**: Validate compositions against weight, volume, and height limits
- **Lifecycle Management**: Full composition workflow from draft to execution
- **Assembly/Disassembly Operations**: Convert compositions to physical UCPs and vice versa
- **Intelligent Caching**: Performance-optimized caching for frequently used calculations
- **Comprehensive Reporting**: Detailed analytics and recommendations

## Base URL

```
/api/packaging
```

## Authentication

All endpoints require authentication via Bearer token:

```
Authorization: Bearer <your-jwt-token>
```

## Core Endpoints

### 1. Calculate Optimal Composition

Calculate the optimal arrangement of products on a pallet.

**Endpoint:** `POST /composition/calculate`

**Request Body:**
```json
{
  "products": [
    {
      "productId": 1,
      "quantity": 10,
      "packagingTypeId": 1
    }
  ],
  "palletId": 1,
  "constraints": {
    "maxWeight": 500,
    "maxHeight": 180,
    "maxVolume": 1.5
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "efficiency": 0.85,
    "layout": {
      "layers": 2,
      "itemsPerLayer": 12,
      "totalItems": 24,
      "arrangement": [
        {
          "productId": 1,
          "packagingTypeId": 1,
          "quantity": 10,
          "position": { "x": 0, "y": 0, "z": 0 },
          "dimensions": { "width": 30, "length": 20, "height": 15 }
        }
      ]
    },
    "weight": {
      "total": 125.5,
      "limit": 500,
      "utilization": 0.251
    },
    "volume": {
      "total": 0.72,
      "limit": 1.5,
      "utilization": 0.48
    },
    "height": {
      "total": 30,
      "limit": 180,
      "utilization": 0.167
    },
    "recommendations": [
      "Considere reorganizar os produtos para melhor aproveitamento do espaço"
    ],
    "warnings": [],
    "products": [
      {
        "productId": 1,
        "packagingTypeId": 1,
        "quantity": 10,
        "totalWeight": 55,
        "totalVolume": 0.09,
        "efficiency": 0.8,
        "canFit": true,
        "issues": []
      }
    ]
  }
}
```

### 2. Validate Composition

Validate composition constraints without full calculation.

**Endpoint:** `POST /composition/validate`

**Request Body:**
```json
{
  "products": [
    {
      "productId": 1,
      "quantity": 10,
      "packagingTypeId": 1
    }
  ],
  "palletId": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "violations": [],
    "warnings": [
      "Baixa eficiência de empacotamento (65.2%)"
    ],
    "metrics": {
      "totalWeight": 125.5,
      "totalVolume": 0.72,
      "totalHeight": 30,
      "efficiency": 0.652
    }
  }
}
```

### 3. Save Composition

Save a calculated composition to the database.

**Endpoint:** `POST /composition/save`

**Request Body:**
```json
{
  "name": "Composição Produtos A-C",
  "description": "Composição otimizada para produtos da categoria A",
  "products": [
    {
      "productId": 1,
      "quantity": 10,
      "packagingTypeId": 1
    }
  ],
  "palletId": 1,
  "constraints": {
    "maxWeight": 500,
    "maxHeight": 180
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "composition": {
      "id": 123,
      "name": "Composição Produtos A-C",
      "description": "Composição otimizada para produtos da categoria A",
      "palletId": 1,
      "status": "draft",
      "efficiency": "0.85",
      "totalWeight": "125.50",
      "totalVolume": "0.720000",
      "totalHeight": "30.00",
      "createdBy": 1,
      "createdAt": "2025-07-31T21:45:00.000Z",
      "updatedAt": "2025-07-31T21:45:00.000Z"
    },
    "result": {
      // Full composition result object
    }
  }
}
```

### 4. List Compositions

Retrieve paginated list of compositions with filtering.

**Endpoint:** `GET /composition/list`

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `status` (string): Filter by status (draft, validated, approved, executed)
- `userId` (number): Filter by creator

**Example:** `GET /composition/list?page=1&limit=10&status=approved`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "name": "Composição Produtos A-C",
      "status": "approved",
      "efficiency": "0.85",
      "totalWeight": "125.50",
      "createdAt": "2025-07-31T21:45:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

### 5. Get Composition Details

Retrieve detailed information about a specific composition.

**Endpoint:** `GET /composition/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "Composição Produtos A-C",
    "description": "Composição otimizada para produtos da categoria A",
    "palletId": 1,
    "status": "approved",
    "constraints": {
      "maxWeight": 500,
      "maxHeight": 180
    },
    "result": {
      // Full composition calculation result
    },
    "efficiency": "0.85",
    "totalWeight": "125.50",
    "totalVolume": "0.720000",
    "totalHeight": "30.00",
    "createdBy": 1,
    "approvedBy": 2,
    "approvedAt": "2025-07-31T22:00:00.000Z",
    "createdAt": "2025-07-31T21:45:00.000Z",
    "updatedAt": "2025-07-31T22:00:00.000Z",
    "items": [
      {
        "id": 456,
        "compositionId": 123,
        "productId": 1,
        "packagingTypeId": 1,
        "quantity": "10.000",
        "position": { "x": 0, "y": 0, "z": 0 },
        "dimensions": { "width": 30, "length": 20, "height": 15 },
        "weight": "55.000",
        "volume": "0.090000",
        "layer": 1,
        "sortOrder": 1,
        "addedBy": 1,
        "addedAt": "2025-07-31T21:45:01.000Z"
      }
    ]
  }
}
```

### 6. Update Composition Status

Update the status of a composition (draft → validated → approved → executed).

**Endpoint:** `PATCH /composition/:id/status`

**Request Body:**
```json
{
  "status": "approved"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "status": "approved",
    "approvedBy": 1,
    "approvedAt": "2025-07-31T22:00:00.000Z",
    "updatedAt": "2025-07-31T22:00:00.000Z"
  }
}
```

### 7. Generate Composition Report

Generate comprehensive reports with analytics and recommendations.

**Endpoint:** `POST /composition/report`

**Request Body:**
```json
{
  "compositionId": 123,
  "includeMetrics": true,
  "includeRecommendations": true,
  "includeCostAnalysis": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 789,
    "compositionId": 123,
    "reportType": "detailed",
    "title": "Relatório Detalhado - Composição Produtos A-C",
    "reportData": {
      "id": 123,
      "timestamp": "2025-07-31T22:15:00.000Z",
      "composition": {
        // Full composition result
      },
      "metrics": {
        "spaceUtilization": 0.8,
        "weightUtilization": 0.251,
        "heightUtilization": 0.167,
        "overallEfficiency": 0.85,
        "stabilityScore": 0.9,
        "riskAssessment": {
          "level": "low",
          "factors": [],
          "mitigation": []
        }
      },
      "recommendations": [
        {
          "type": "optimization",
          "priority": "medium",
          "message": "Considere otimizar o arranjo para melhor aproveitamento do espaço",
          "impact": "Melhoria de 15% na eficiência",
          "actionRequired": false
        }
      ],
      "costAnalysis": {
        "packagingCost": 25.50,
        "handlingCost": 15.75,
        "spaceCost": 45.20,
        "transportCost": 35.20,
        "totalCost": 121.65,
        "costPerUnit": 12.17,
        "alternatives": []
      },
      "executiveSummary": {
        "overallRating": "good",
        "keyMetrics": [
          {
            "name": "Eficiência",
            "value": 85,
            "unit": "%",
            "benchmark": 80,
            "status": "above"
          }
        ],
        "majorIssues": [],
        "topRecommendations": [
          "Considere otimizar o arranjo para melhor aproveitamento do espaço"
        ],
        "costImpact": {
          "current": 121.65,
          "potential": 109.49,
          "savings": 12.16
        }
      }
    },
    "generatedBy": 1,
    "generatedAt": "2025-07-31T22:15:00.000Z"
  }
}
```

## Assembly/Disassembly Operations

### 8. Assemble Composition

Convert an approved composition into a physical UCP.

**Endpoint:** `POST /composition/assemble`

**Request Body:**
```json
{
  "compositionId": 123,
  "targetUcpId": 456
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Composição Produtos A-C montada com sucesso na UCP UCP-001",
    "warnings": [
      "Produto 1 tem baixo estoque disponível"
    ]
  }
}
```

### 9. Disassemble Composition

Break down a composition from executed status.

**Endpoint:** `POST /composition/disassemble`

**Request Body:**
```json
{
  "compositionId": 123,
  "targetUcps": [
    {
      "productId": 1,
      "quantity": 5,
      "ucpId": 456
    },
    {
      "productId": 1,
      "quantity": 5,
      "ucpId": 457
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Composição Produtos A-C desmontada com sucesso",
    "warnings": []
  }
}
```

### 10. Delete Composition

Soft delete a composition (sets isActive to false).

**Endpoint:** `DELETE /composition/:id`

**Response:** `204 No Content`

## Legacy Packaging Endpoints

### Product Packaging Information

**Get packaging types for a product:**
```
GET /products/:productId
```

**Get packaging hierarchy:**
```
GET /products/:productId/hierarchy
```

**Scan packaging by barcode:**
```
POST /scan
```

**Optimize picking:**
```
POST /optimize-picking
```

**Convert quantities:**
```
POST /convert
```

### CRUD Operations

**Create packaging type:**
```
POST /
```

**Update packaging type:**
```
PUT /:id
```

**Delete packaging type:**
```
DELETE /:id
```

**Get packaging by ID:**
```
GET /:id
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional details (for validation errors)"
}
```

### Common Error Codes

- `VALIDATION_ERROR`: Invalid request data
- `COMPOSITION_NOT_FOUND`: Composition not found
- `PACKAGING_NOT_FOUND`: Packaging type not found
- `BUSINESS_RULE_VIOLATION`: Business rule violation
- `TOO_MANY_PRODUCTS`: More than 50 products in composition
- `WEIGHT_LIMIT_EXCEEDED`: Weight exceeds 2000kg limit
- `HEIGHT_LIMIT_EXCEEDED`: Height exceeds 300cm limit
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error

## Rate Limiting

Different endpoints have different rate limits:

- **Composition calculations**: 5 requests per minute
- **Assembly/Disassembly**: 5 requests per minute
- **Save operations**: 10 requests per minute
- **Other operations**: Standard rate limiting applies

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1643723400
```

## Performance Optimization

### Caching

The system implements intelligent caching:

- **Composition calculations** are cached for identical requests
- **Product details** are cached with automatic invalidation
- **Validation results** are cached for performance

Cache keys are generated based on request parameters, ensuring consistent results while maximizing cache hits.

### Complexity Handling

Requests are classified by complexity:

- **Low complexity**: ≤5 products, ≤50 total quantity
- **Medium complexity**: ≤20 products, ≤200 total quantity  
- **High complexity**: >20 products or >200 total quantity

Higher complexity requests get:
- Longer cache TTL
- Extended timeouts
- Performance monitoring

## Business Rules

### Composition Constraints

- Maximum 50 different products per composition
- Maximum weight constraint: 2000kg
- Maximum height constraint: 300cm
- Products must exist and be active
- Pallets must be available
- Packaging types must be valid for products

### Status Workflow

```
draft → validated → approved → executed
  ↑                              ↓
  ←─────── (can return) ─────────
```

- **Draft**: Initial creation, can be edited
- **Validated**: Passed constraint validation
- **Approved**: Ready for assembly (requires approval user)
- **Executed**: Physically assembled into UCP

### Assembly Requirements

- Composition must be in "approved" status
- Sufficient stock must be available for all products
- Target UCP must exist and be available
- Stock levels are validated before assembly

### Disassembly Requirements

- Composition must be in "executed" status
- Quantities must not exceed composition amounts
- Target UCPs must exist and have capacity

## Examples

### Complete Workflow Example

```javascript
// 1. Calculate composition
const calculation = await fetch('/api/packaging/composition/calculate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    products: [{ productId: 1, quantity: 10, packagingTypeId: 1 }],
    palletId: 1
  })
});

// 2. Save if satisfactory
if (calculation.data.efficiency > 0.7) {
  const saved = await fetch('/api/packaging/composition/save', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'My Composition',
      products: [{ productId: 1, quantity: 10, packagingTypeId: 1 }],
      palletId: 1
    })
  });
  
  const compositionId = saved.data.composition.id;
  
  // 3. Validate
  await fetch(`/api/packaging/composition/${compositionId}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'validated' })
  });
  
  // 4. Approve
  await fetch(`/api/packaging/composition/${compositionId}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'approved' })
  });
  
  // 5. Generate report
  const report = await fetch('/api/packaging/composition/report', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      compositionId: compositionId,
      includeMetrics: true,
      includeRecommendations: true,
      includeCostAnalysis: true
    })
  });
  
  // 6. Assemble
  await fetch('/api/packaging/composition/assemble', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      compositionId: compositionId,
      targetUcpId: 1
    })
  });
}
```

## Testing

### Unit Tests

Run unit tests for services:
```bash
npm run test:unit -- packaging-composition
```

### Integration Tests

Run full workflow integration tests:
```bash
npm run test:integration -- packaging-composition-workflows
```

### Performance Tests

Run performance benchmarks:
```bash
npm run test:performance -- composition
```

## Setup and Deployment

### Initial Setup

Run the setup script to initialize the composition system:

```bash
npx tsx src/scripts/setup-composition-system.ts
```

Options:
- `--skip-migration`: Skip database migrations
- `--skip-seed`: Skip test data seeding
- `--skip-cache`: Skip cache warmup
- `--skip-reports`: Skip sample report generation

### Database Migration

The composition system requires these new tables:
- `packaging_compositions`: Main composition records
- `composition_items`: Individual products within compositions
- `composition_reports`: Generated reports and analytics

Run the migration:
```sql
-- Execute: src/db/migrations/add_packaging_composition_tables.sql
```

### Cache Configuration

The system uses Redis for caching composition calculations. Ensure Redis is configured and running.

Cache settings can be adjusted in the `CompositionCacheService`:
- Default TTL: 1 hour
- Complex calculation TTL: 2 hours
- Product details TTL: 2 hours

### Monitoring

Monitor system performance through:
- Cache hit rates
- Request response times
- Composition calculation complexity
- Error rates by endpoint

Access monitoring data:
```javascript
GET /api/packaging/composition/stats
```

## Support

For issues or questions regarding the Packaging Composition API:

1. Check the error codes and messages
2. Review the business rules section
3. Verify request format against examples
4. Check rate limiting headers
5. Review cache behavior for performance issues

The system includes comprehensive logging and monitoring to help diagnose issues.