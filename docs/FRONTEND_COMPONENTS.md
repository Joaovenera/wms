# Frontend Component Documentation

## Overview

The WMS frontend is built with React 18, TypeScript, and modern UI libraries, featuring a responsive design that works seamlessly across desktop and mobile devices. The component architecture follows atomic design principles with reusable components and consistent patterns.

## Technology Stack

- **React 18** - Modern React with concurrent features
- **TypeScript** - Type safety and enhanced developer experience
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Unstyled, accessible UI components
- **Framer Motion** - Animation and gesture library
- **TanStack Query** - Server state management
- **Wouter** - Lightweight client-side routing
- **Zod** - Schema validation

## Component Architecture

```
src/components/
├── ui/                     # Base UI components (shadcn/ui)
├── layout/                 # Layout components
├── features/               # Feature-specific components
├── forms/                  # Form components
└── mobile/                 # Mobile-optimized components
```

## Base UI Components (`/components/ui/`)

### Button Component

```tsx
// Versatile button component with multiple variants
interface ButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

// Usage
<Button variant="outline" size="lg" loading={isSubmitting}>
  Save Changes
</Button>
```

**Features:**
- Multiple visual variants
- Loading states with spinner
- Icon support
- Accessibility compliant
- Touch-friendly on mobile

### Input Component

```tsx
// Form input with validation states
interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'search';
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
}

// Usage with validation
<Input
  type="email"
  placeholder="Enter email address"
  value={email}
  onChange={setEmail}
  error={emailError}
  required
/>
```

### Dialog Component

```tsx
// Modal dialog with overlay
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Usage
<Dialog open={isOpen} onOpenChange={setIsOpen} title="Add New Product">
  <ProductForm onSubmit={handleSubmit} />
</Dialog>
```

### Table Component

```tsx
// Data table with sorting and pagination
interface TableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  loading?: boolean;
  onRowClick?: (row: T) => void;
}

// Usage
<Table
  data={products}
  columns={productColumns}
  pagination={paginationConfig}
  loading={isLoading}
  onRowClick={handleProductClick}
/>
```

## Feature Components

### Product Management

#### ProductSearchWithStock

```tsx
// Product search with real-time stock information
interface ProductSearchWithStockProps {
  onProductSelect: (product: Product) => void;
  placeholder?: string;
  disabled?: boolean;
  selectedProduct?: Product | null;
}

// Features:
// - Real-time search with debouncing
// - Stock level indicators
// - UCP location information
// - Barcode scanning integration
// - Mobile-optimized interface

<ProductSearchWithStock
  onProductSelect={handleProductSelect}
  placeholder="Search products by SKU or name..."
/>
```

#### ProductPhotoManager

```tsx
// Product photo upload and management
interface ProductPhotoManagerProps {
  productId: number;
  photos: ProductPhoto[];
  onPhotosChange: (photos: ProductPhoto[]) => void;
  maxPhotos?: number;
  allowPrimarySelection?: boolean;
}

// Features:
// - Drag & drop upload
// - Image preview with thumbnails
// - Primary photo selection
// - Bulk photo operations
// - Progress indicators
// - Error handling

<ProductPhotoManager
  productId={product.id}
  photos={product.photos}
  onPhotosChange={handlePhotosChange}
  maxPhotos={5}
  allowPrimarySelection
/>
```

### Warehouse Operations

#### PalletLayoutConfigurator

```tsx
// Visual pallet position layout configuration
interface PalletLayoutConfiguratorProps {
  structure: PalletStructure;
  positions: Position[];
  onPositionClick: (position: Position) => void;
  highlightedPositions?: number[];
  readonly?: boolean;
}

// Features:
// - Interactive grid layout
// - Position status visualization
// - Drag & drop support
// - Zoom and pan capabilities
// - Touch gestures for mobile
// - Real-time updates

<PalletLayoutConfigurator
  structure={selectedStructure}
  positions={positions}
  onPositionClick={handlePositionSelect}
  highlightedPositions={availablePositions}
/>
```

#### WarehouseMap

```tsx
// Interactive warehouse map with real-time status
interface WarehouseMapProps {
  structures: PalletStructure[];
  positions: Position[];
  ucps: Ucp[];
  selectedUcp?: Ucp | null;
  onUcpSelect: (ucp: Ucp) => void;
  viewMode?: 'overview' | 'detailed';
}

// Features:
// - SVG-based interactive map
// - Real-time status updates
// - Color-coded position status
// - Search and filter capabilities
// - Navigation breadcrumbs
// - Mobile gesture support

<WarehouseMap
  structures={structures}
  positions={positions}
  ucps={ucps}
  selectedUcp={selectedUcp}
  onUcpSelect={handleUcpSelect}
  viewMode="detailed"
/>
```

### UCP Management

#### UCPCreationWizard

```tsx
// Step-by-step UCP creation process
interface UCPCreationWizardProps {
  onComplete: (ucp: Ucp) => void;
  onCancel: () => void;
  initialData?: Partial<Ucp>;
}

// Steps:
// 1. Select pallet and position
// 2. Add initial products
// 3. Configure packaging
// 4. Review and confirm

<UCPCreationWizard
  onComplete={handleUcpCreated}
  onCancel={handleCancel}
  initialData={prefilledData}
/>
```

#### UCPItemsViewer

```tsx
// Display and manage UCP contents
interface UCPItemsViewerProps {
  ucp: Ucp;
  items: UcpItem[];
  onItemAdd: (item: Partial<UcpItem>) => void;
  onItemRemove: (itemId: number) => void;
  onItemTransfer: (itemId: number, targetUcpId: number) => void;
  editable?: boolean;
}

// Features:
// - Expandable item details
// - Bulk operations
// - Item transfer functionality
// - Packaging conversion
// - History tracking
// - Print labels

<UCPItemsViewer
  ucp={selectedUcp}
  items={ucpItems}
  onItemAdd={handleItemAdd}
  onItemRemove={handleItemRemove}
  onItemTransfer={handleItemTransfer}
  editable={canEdit}
/>
```

### Packaging System

#### PackagingCompositionSuite

```tsx
// Complete packaging composition interface
interface PackagingCompositionSuiteProps {
  products: Product[];
  pallets: Pallet[];
  onCompositionSave: (composition: PackagingComposition) => void;
  existingComposition?: PackagingComposition;
}

// Features:
// - Product selection with quantities
// - Pallet selection
// - Constraint configuration
// - Real-time validation
// - 3D visualization
// - Optimization suggestions
// - Report generation

<PackagingCompositionSuite
  products={availableProducts}
  pallets={availablePallets}
  onCompositionSave={handleSave}
  existingComposition={composition}
/>
```

#### CompositionVisualization

```tsx
// 3D visualization of packaging composition
interface CompositionVisualizationProps {
  composition: CompositionResult;
  interactive?: boolean;
  showMetrics?: boolean;
  onProductClick?: (productId: number) => void;
}

// Features:
// - 3D product arrangement
// - Layer-by-layer view
// - Efficiency metrics
// - Weight distribution
// - Interactive rotation
// - Export capabilities

<CompositionVisualization
  composition={optimizedComposition}
  interactive
  showMetrics
  onProductClick={handleProductHighlight}
/>
```

### Transfer Management

#### TransferPlanningWizard

```tsx
// Multi-step transfer planning interface
interface TransferPlanningWizardProps {
  vehicles: Vehicle[];
  onTransferCreate: (transfer: TransferRequest) => void;
  onCancel: () => void;
}

// Features:
// - Vehicle selection with capacity info
// - Product selection and quantities
// - Route planning
// - Capacity optimization
// - Load distribution
// - Schedule coordination

<TransferPlanningWizard
  vehicles={availableVehicles}
  onTransferCreate={handleTransferCreate}
  onCancel={handleCancel}
/>
```

#### LoadingExecutionScreen

```tsx
// Real-time loading execution interface
interface LoadingExecutionScreenProps {
  transferRequest: TransferRequest;
  execution: LoadingExecution;
  onItemScan: (barcode: string) => void;
  onQuantityConfirm: (itemId: number, quantity: number) => void;
  onExecutionComplete: () => void;
}

// Features:
// - Barcode scanning
// - Item checklist
// - Quantity confirmation
// - Divergence reporting
// - Progress tracking
// - Photo documentation

<LoadingExecutionScreen
  transferRequest={activeTransfer}
  execution={currentExecution}
  onItemScan={handleBarcodeScan}
  onQuantityConfirm={handleQuantityConfirm}
  onExecutionComplete={handleComplete}
/>
```

### Mobile Components

#### QRScanner

```tsx
// Camera-based QR/barcode scanner
interface QRScannerProps {
  onScan: (code: string, type: 'qr' | 'barcode') => void;
  onError: (error: string) => void;
  active: boolean;
  overlay?: React.ReactNode;
}

// Features:
// - Camera access
// - Multiple format support
// - Auto-focus
// - Flash control
// - Scan history
// - Audio feedback

<QRScanner
  onScan={handleCodeScan}
  onError={handleScanError}
  active={isScannerActive}
  overlay={<ScannerOverlay />}
/>
```

#### MobileNavigation

```tsx
// Mobile-optimized navigation
interface MobileNavigationProps {
  currentPath: string;
  notifications?: number;
  user: User;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

// Features:
// - Bottom tab navigation
// - Badge notifications
// - Quick actions
// - Gesture support
// - Offline indicators

<MobileNavigation
  currentPath="/pallets"
  notifications={unreadCount}
  user={currentUser}
  onNavigate={handleNavigation}
  onLogout={handleLogout}
/>
```

## State Management

### Global State with TanStack Query

```tsx
// Product queries
export const useProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useProductStock = (productId: number) => {
  return useQuery({
    queryKey: ['products', productId, 'stock'],
    queryFn: () => api.get(`/products/${productId}/stock`),
    enabled: !!productId,
    refetchInterval: 30000, // 30 seconds
  });
};

// UCP mutations
export const useCreateUcp = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: InsertUcp) => api.post('/ucps', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ucps'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
  });
};
```

### Component State Patterns

```tsx
// Complex form state with validation
const useProductForm = (initialData?: Product) => {
  const [formData, setFormData] = useState(initialData || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = useCallback((data: Partial<Product>) => {
    const result = productSchema.safeParse(data);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  }, []);

  const handleSubmit = useCallback(async (onSubmit: (data: Product) => Promise<void>) => {
    if (!validate(formData)) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(formData as Product);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validate]);

  return {
    formData,
    setFormData,
    errors,
    isSubmitting,
    validate,
    handleSubmit,
  };
};
```

## Responsive Design

### Breakpoint System

```css
/* Tailwind CSS breakpoints */
sm: 640px   /* Small devices (mobile landscape) */
md: 768px   /* Medium devices (tablets) */
lg: 1024px  /* Large devices (desktops) */
xl: 1280px  /* Extra large devices */
2xl: 1536px /* Extra extra large devices */
```

### Mobile-First Approach

```tsx
// Responsive component example
const ResponsiveLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="
      grid 
      grid-cols-1 
      gap-4 
      p-4
      md:grid-cols-2 
      md:gap-6 
      md:p-6
      lg:grid-cols-3 
      lg:gap-8 
      lg:p-8
    ">
      {children}
    </div>
  );
};
```

### Touch-Friendly Design

```tsx
// Touch-optimized button sizes
const TouchButton = ({ children, ...props }: ButtonProps) => {
  return (
    <Button
      className="
        min-h-[44px] 
        min-w-[44px] 
        touch-manipulation
        active:scale-95
        transition-transform
      "
      {...props}
    >
      {children}
    </Button>
  );
};
```

## Performance Optimizations

### Code Splitting

```tsx
// Lazy-loaded page components
const PalletsPage = lazy(() => import('../pages/pallets'));
const ProductsPage = lazy(() => import('../pages/products'));
const UCPsPage = lazy(() => import('../pages/ucps'));

// Route-based code splitting
const AppRouter = () => (
  <Suspense fallback={<LoadingSpinner />}>
    <Routes>
      <Route path="/pallets" component={PalletsPage} />
      <Route path="/products" component={ProductsPage} />
      <Route path="/ucps" component={UCPsPage} />
    </Routes>
  </Suspense>
);
```

### Virtual Scrolling

```tsx
// Large list virtualization
import { FixedSizeList as List } from 'react-window';

const VirtualizedProductList = ({ products }: { products: Product[] }) => {
  const Row = ({ index, style }: { index: number, style: React.CSSStyle }) => (
    <div style={style}>
      <ProductCard product={products[index]} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={products.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </List>
  );
};
```

### Optimistic Updates

```tsx
// Optimistic UI updates
const useOptimisticUcp = () => {
  const queryClient = useQueryClient();
  const createUcp = useCreateUcp();

  const optimisticCreate = useCallback(async (data: InsertUcp) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticUcp = { ...data, id: tempId };

    // Optimistically update cache
    queryClient.setQueryData(
      ['ucps'],
      (old: Ucp[]) => [...(old || []), optimisticUcp]
    );

    try {
      const result = await createUcp.mutateAsync(data);
      // Replace optimistic data with real data
      queryClient.setQueryData(
        ['ucps'],
        (old: Ucp[]) => old.map(ucp => 
          ucp.id === tempId ? result : ucp
        )
      );
    } catch (error) {
      // Revert optimistic update on error
      queryClient.setQueryData(
        ['ucps'],
        (old: Ucp[]) => old.filter(ucp => ucp.id !== tempId)
      );
      throw error;
    }
  }, [queryClient, createUcp]);

  return { optimisticCreate };
};
```

## Testing Strategy

### Component Testing

```tsx
// React Testing Library examples
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductSearchWithStock } from '../product-search-with-stock';

describe('ProductSearchWithStock', () => {
  it('should search products and display results', async () => {
    const onProductSelect = jest.fn();
    
    render(
      <ProductSearchWithStock 
        onProductSelect={onProductSelect}
        placeholder="Search products..."
      />
    );

    const searchInput = screen.getByPlaceholderText('Search products...');
    fireEvent.change(searchInput, { target: { value: 'PROD-001' } });

    await waitFor(() => {
      expect(screen.getByText('Product A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Product A'));
    expect(onProductSelect).toHaveBeenCalledWith(expect.objectContaining({
      sku: 'PROD-001',
      name: 'Product A'
    }));
  });
});
```

### Accessibility Testing

```tsx
// Accessibility compliance testing
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Button Component Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(
      <Button variant="primary" onClick={() => {}}>
        Click me
      </Button>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

## Deployment Considerations

### Build Optimization

```typescript
// Vite configuration for production
export default defineConfig({
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          charts: ['recharts'],
        },
      },
    },
  },
  plugins: [
    react(),
    // Bundle analyzer for production builds
    process.env.ANALYZE && bundleAnalyzer(),
  ],
});
```

### Progressive Web App

```typescript
// Service worker for offline capability
const CACHE_NAME = 'wms-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});
```

This component architecture provides a solid foundation for the WMS frontend, ensuring maintainability, performance, and excellent user experience across all devices.