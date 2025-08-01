# WMS API Documentation

## Overview

The Warehouse Management System (WMS) provides a comprehensive RESTful API for managing warehouse operations, including pallets, products, UCPs (Unidades de Carga Paletizada), transfers, and packaging compositions.

## Base URL

```
http://localhost:3000/api
```

## Authentication

The API uses session-based authentication with Express sessions. All endpoints except `/auth/login` and `/auth/register` require authentication.

### Authentication Endpoints

#### POST /auth/login
Authenticate user and create session.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin"
  }
}
```

#### POST /auth/register
Register new user account.

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "confirmPassword": "password123",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "operator"
}
```

#### POST /auth/logout
Logout current user and destroy session.

#### GET /auth/me
Get current authenticated user information.

## Core Entities

### Pallets (`/api/pallets`)

#### GET /api/pallets
List all pallets with pagination.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)
- `search` (string): Search by code or type
- `status` (string): Filter by status

**Response:**
```json
{
  "pallets": [
    {
      "id": 1,
      "code": "PLT-001",
      "type": "PBR",
      "material": "Madeira",
      "width": 120,
      "length": 100,
      "height": 15,
      "maxWeight": "2000.00",
      "status": "disponivel",
      "photoUrl": "/uploads/pallet-001.jpg",
      "observations": "Good condition",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

#### POST /api/pallets
Create new pallet.

**Request Body:**
```json
{
  "code": "PLT-002",
  "type": "Europeu",
  "material": "Madeira",
  "width": 120,
  "length": 80,
  "height": 15,
  "maxWeight": "1500.00",
  "status": "disponivel"
}
```

#### GET /api/pallets/:id
Get specific pallet by ID.

#### PUT /api/pallets/:id
Update pallet information.

#### DELETE /api/pallets/:id
Delete pallet (soft delete).

### Products (`/api/products`)

#### GET /api/products
List all products with stock information.

**Query Parameters:**
- `page`, `limit`: Pagination
- `search`: Search by SKU or name
- `category`: Filter by category
- `withStock`: Include stock information (default: true)

**Response:**
```json
{
  "products": [
    {
      "id": 1,
      "sku": "PROD-001",
      "name": "Product A",
      "description": "High quality product",
      "category": "Electronics",
      "brand": "BrandX",
      "unit": "un",
      "weight": "1.5",
      "dimensions": {
        "width": 10,
        "length": 15,
        "height": 5
      },
      "barcode": "1234567890123",
      "totalStock": 150,
      "ucpStock": [
        {
          "ucpCode": "UCP-001",
          "positionCode": "PP-01-01-0",
          "quantity": "50.000"
        }
      ]
    }
  ]
}
```

#### POST /api/products
Create new product.

#### POST /api/products/:id/photos
Upload product photos (multipart/form-data).

### UCPs - Unidades de Carga Paletizada (`/api/ucps`)

#### GET /api/ucps
List UCPs with items and position information.

#### POST /api/ucps
Create new UCP.

**Request Body:**
```json
{
  "code": "UCP-20250731-001",
  "palletId": 1,
  "positionId": 5,
  "observations": "Initial UCP creation"
}
```

#### POST /api/ucps/:id/items
Add item to UCP.

**Request Body:**
```json
{
  "productId": 1,
  "quantity": "25.000",
  "lot": "LOT-001",
  "expiryDate": "2025-12-31",
  "packagingTypeId": 1
}
```

### Packaging System (`/api/packaging`)

#### POST /api/packaging/types
Create packaging type hierarchy.

**Request Body:**
```json
{
  "productId": 1,
  "name": "Caixa",
  "barcode": "1234567890123",
  "baseUnitQuantity": "12.000",
  "isBaseUnit": false,
  "level": 2,
  "dimensions": {
    "width": 30,
    "length": 20,
    "height": 15
  }
}
```

#### GET /api/packaging/products/:productId/stock
Get consolidated stock by packaging type.

#### POST /api/packaging/optimize-picking
Get optimized picking plan for requested quantity.

**Request Body:**
```json
{
  "productId": 1,
  "requestedQuantity": 150
}
```

#### POST /api/packaging/composition
Create packaging composition with multiple products.

**Request Body:**
```json
{
  "products": [
    {
      "productId": 1,
      "quantity": 100,
      "packagingTypeId": 2
    },
    {
      "productId": 2,
      "quantity": 50
    }
  ],
  "palletId": 1,
  "constraints": {
    "maxWeight": 2000,
    "maxHeight": 180,
    "maxVolume": 1.8
  }
}
```

**Response:**
```json
{
  "isValid": true,
  "efficiency": 85.5,
  "layout": {
    "layers": 3,
    "itemsPerLayer": 50,
    "totalItems": 150
  },
  "weight": {
    "total": 1750,
    "limit": 2000,
    "utilization": 87.5
  },
  "recommendations": [
    "Consider using smaller packaging for better space utilization",
    "Current arrangement provides good stability"
  ],
  "warnings": []
}
```

### Vehicles (`/api/vehicles`)

Fleet management endpoints for vehicle registration and capacity planning.

#### GET /api/vehicles
List all vehicles with capacity information.

#### POST /api/vehicles
Register new vehicle.

**Request Body:**
```json
{
  "code": "VH-001",
  "name": "Truck A",
  "brand": "Mercedes-Benz",
  "model": "Atego 1719",
  "licensePlate": "ABC-1234",
  "type": "Caminhão",
  "weightCapacity": "5000 kg",
  "cargoAreaLength": 6.2,
  "cargoAreaWidth": 2.4,
  "cargoAreaHeight": 2.5
}
```

### Transfer System

#### Transfer Requests (`/api/transfer-requests`)
Plan and manage transfer operations between locations.

#### Loading Executions (`/api/loading-executions`)
Execute planned transfers with real-time progress tracking.

#### Transfer Reports (`/api/transfer-reports`)
Generate comprehensive transfer reports and analytics.

## WebSocket Events

The system provides real-time updates through WebSocket connections:

### Connection
```javascript
const socket = io('http://localhost:3000');
```

### Events
- `ucp:created` - New UCP created
- `ucp:updated` - UCP information updated
- `item:added` - Item added to UCP
- `item:transferred` - Item transferred between UCPs
- `position:occupied` - Position status changed to occupied
- `position:available` - Position became available
- `stock:updated` - Product stock levels changed

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Validation Error",
  "message": "Invalid input data",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Validation Error
- `500` - Internal Server Error

## Rate Limiting

API endpoints are rate limited to prevent abuse:
- General endpoints: 100 requests per 15 minutes
- Authentication endpoints: 5 requests per 15 minutes
- File upload endpoints: 10 requests per minute

## Data Validation

All input data is validated using Zod schemas:
- Email format validation
- Required field validation
- Type checking (numbers, strings, dates)
- Custom business logic validation
- SQL injection prevention

## Caching Strategy

The API implements intelligent caching:
- Redis for session storage
- Query result caching for expensive operations
- Cache invalidation on data updates
- Performance monitoring and optimization

## Security Features

- Session-based authentication
- CORS configuration
- Helmet security headers
- Request sanitization
- Rate limiting
- Input validation
- SQL injection prevention
- XSS protection

## Performance Optimizations

- Database query optimization
- Pagination for large datasets
- Lazy loading of related data
- Connection pooling
- Response compression
- Static file caching
- Monitoring and alerting