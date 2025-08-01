import { lazy } from 'react';
import { withLazyWrapper } from './LazyWrapper';

// Lazy load all page components with proper error boundaries
export const LazyDashboard = withLazyWrapper(
  lazy(() => import('@/pages/dashboard'))
);

export const LazyPallets = withLazyWrapper(
  lazy(() => import('@/pages/pallets'))
);

export const LazyPortaPaletes = withLazyWrapper(
  lazy(() => import('@/pages/porta-paletes'))
);

export const LazyPositions = withLazyWrapper(
  lazy(() => import('@/pages/positions'))
);

export const LazyPalletStructures = withLazyWrapper(
  lazy(() => import('@/pages/pallet-structures'))
);

export const LazyUCPs = withLazyWrapper(
  lazy(() => import('@/pages/ucps'))
);

export const LazyProducts = withLazyWrapper(
  lazy(() => import('@/pages/products'))
);

export const LazyUsers = withLazyWrapper(
  lazy(() => import('@/pages/users'))
);

export const LazyVehicles = withLazyWrapper(
  lazy(() => import('@/pages/vehicles'))
);

export const LazyWarehouseTracking = withLazyWrapper(
  lazy(() => import('@/pages/warehouse-tracking'))
);

export const LazyTransferPlanning = withLazyWrapper(
  lazy(() => import('@/pages/transfer-planning'))
);

export const LazyLoadingExecution = withLazyWrapper(
  lazy(() => import('@/pages/loading-execution'))
);

export const LazyTransferReports = withLazyWrapper(
  lazy(() => import('@/pages/transfer-reports'))
);

// Mobile page components
export const LazyMobileHome = withLazyWrapper(
  lazy(() => import('@/pages/mobile/home'))
);

export const LazyMobileScanner = withLazyWrapper(
  lazy(() => import('@/pages/mobile/scanner'))
);

export const LazyMobilePallets = withLazyWrapper(
  lazy(() => import('@/pages/mobile/pallets'))
);

// Layout components
export const LazyMobileLayout = withLazyWrapper(
  lazy(() => import('@/components/layout/mobile-layout'))
);

export const LazyDesktopLayout = withLazyWrapper(
  lazy(() => import('@/components/layout/desktop-layout'))
);

// Auth and error pages (keep these eager loaded for faster initial experience)
export const LazyAuth = withLazyWrapper(
  lazy(() => import('@/pages/auth'))
);

export const LazyNotFound = withLazyWrapper(
  lazy(() => import('@/pages/not-found'))
);