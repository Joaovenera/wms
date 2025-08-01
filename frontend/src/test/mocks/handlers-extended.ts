import { http, HttpResponse } from 'msw';
import { Position } from '@/types/api';

// Mock data for positions
const mockPositions: Position[] = [
  {
    id: 1,
    street: 'A',
    number: 1,
    level: 1,
    side: 'L',
    status: 'disponivel',
    capacity: 100,
    currentStock: 0,
    productId: null,
    palletId: null,
    reservedBy: null,
    reservedAt: null,
    lastMovement: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 2,
    street: 'A',
    number: 2,
    level: 1,
    side: 'L',
    status: 'ocupada',
    capacity: 100,
    currentStock: 50,
    productId: 1,
    palletId: 1,
    reservedBy: null,
    reservedAt: null,
    lastMovement: new Date('2024-01-15'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15')
  }
];

// Mock data for products
const mockProducts = [
  {
    id: 1,
    sku: 'SKU001',
    name: 'Produto A',
    unit: 'UN',
    totalStock: 100,
    dimensions: {
      length: 10,
      width: 5,
      height: 3
    }
  },
  {
    id: 2,
    sku: 'SKU002', 
    name: 'Produto B',
    unit: 'KG',
    totalStock: 0,
    dimensions: {
      length: 20,
      width: 10,
      height: 5
    }
  }
];

// Mock user data
const mockUser = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin'
};

export const extendedHandlers = [
  // Positions API
  http.get('/api/positions', () => {
    return HttpResponse.json(mockPositions);
  }),

  // Products API
  http.get('/api/products', ({ request }) => {
    const url = new URL(request.url);
    const includeStock = url.searchParams.get('includeStock');
    
    if (includeStock === 'true') {
      return HttpResponse.json(mockProducts);
    }
    
    return HttpResponse.json(mockProducts.map(({ totalStock, ...product }) => product));
  }),

  // User API
  http.get('/api/user', () => {
    return HttpResponse.json(mockUser);
  }),

  // Packaging API
  http.get('/api/packaging/products/:productId', ({ params }) => {
    return HttpResponse.json([
      {
        id: 1,
        name: 'Caixa Pequena',
        type: 'box',
        productId: parseInt(params.productId as string)
      }
    ]);
  }),

  http.get('/api/packaging/products/:productId/hierarchy', ({ params }) => {
    return HttpResponse.json({
      levels: 2,
      packagings: [
        {
          id: 1,
          name: 'Unidade',
          level: 0,
          productId: parseInt(params.productId as string)
        },
        {
          id: 2,
          name: 'Caixa',
          level: 1,
          productId: parseInt(params.productId as string)
        }
      ]
    });
  }),

  http.get('/api/packaging/:id', ({ params }) => {
    return HttpResponse.json({
      id: parseInt(params.id as string),
      name: 'Test Packaging',
      type: 'box'
    });
  }),

  http.post('/api/packaging/scan', async ({ request }) => {
    const body = await request.json() as { barcode: string };
    
    if (body.barcode === 'invalid') {
      return new HttpResponse('Barcode not found', { status: 404 });
    }
    
    return HttpResponse.json({
      id: 1,
      name: 'Scanned Package',
      barcode: body.barcode
    });
  })
];