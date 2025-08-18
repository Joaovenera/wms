/**
 * Lazy Page Components Stub
 * Minimal implementation for build compatibility
 */

import React from 'react';

// Stub implementations for lazy-loaded components
export const LazyDashboard = React.lazy(() => import('@/pages/dashboard'));
export const LazyPallets = React.lazy(() => import('@/pages/pallets'));
export const LazyPortaPaletes = React.lazy(() => import('@/pages/porta-paletes'));
export const LazyPositions = React.lazy(() => import('@/pages/positions'));
export const LazyUCPs = React.lazy(() => import('@/pages/ucps'));
export const LazyProducts = React.lazy(() => import('@/pages/products'));
export const LazyUsers = React.lazy(() => import('@/pages/users'));
export const LazyVehicles = React.lazy(() => import('@/pages/vehicles'));
export const LazyWarehouseTracking = React.lazy(() => import('@/pages/warehouse-tracking'));
export const LazyTransferPlanning = React.lazy(() => import('@/pages/transfer-planning'));
export const LazyLoadingExecution = React.lazy(() => import('@/pages/loading-execution'));
export const LazyTransferReports = React.lazy(() => import('@/pages/transfer-reports'));
export const LazyMobileHome = React.lazy(() => import('@/pages/mobile/pallets'));
export const LazyMobileScanner = React.lazy(() => import('@/pages/mobile/scanner'));
export const LazyMobilePallets = React.lazy(() => import('@/pages/mobile/pallets'));
export const LazyMobileProducts = React.lazy(() => import('@/pages/mobile/products'));
export const LazyMobileLayout = React.lazy(() => import('@/components/layout/mobile-layout'));
export const LazyDesktopLayout = React.lazy(() => import('@/components/layout/desktop-layout'));

export default {
  LazyDashboard,
  LazyPallets,
  LazyPortaPaletes,
  LazyPositions,
  LazyUCPs,
  LazyProducts,
  LazyUsers,
  LazyVehicles,
  LazyWarehouseTracking,
  LazyTransferPlanning,
  LazyLoadingExecution,
  LazyTransferReports,
  LazyMobileHome,
  LazyMobileScanner,
  LazyMobilePallets,
  LazyMobileProducts,
  LazyMobileLayout,
  LazyDesktopLayout
};