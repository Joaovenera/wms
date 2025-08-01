import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
// import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useMobile } from "@/hooks/use-mobile";
import React, { useEffect, Suspense, startTransition } from "react";
import { performanceMonitor } from "@/utils/performanceMonitor";

// Import eager-loaded components for faster initial experience
import Auth from "@/pages/auth";
import NotFound from "@/pages/not-found";

// Import lazy-loaded components for optimal code splitting
import {
  LazyDashboard,
  LazyPallets,
  LazyPortaPaletes,
  LazyPositions,
  LazyPalletStructures,
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
  LazyMobileLayout,
  LazyDesktopLayout
} from "@/components/lazy/LazyPageComponents";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const isMobile = useMobile();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Auth />;
  }

  if (isMobile) {
    return (
      <LazyMobileLayout>
        <Switch>
          <Route path="/" component={LazyMobileHome} />
          <Route path="/pallets" component={LazyMobilePallets} />
          <Route path="/scanner" component={LazyMobileScanner} />
          <Route component={NotFound} />
        </Switch>
      </LazyMobileLayout>
    );
  }

  return (
    <LazyDesktopLayout>
      <Switch>
        <Route path="/" component={LazyDashboard} />
        <Route path="/pallets" component={LazyPallets} />
        <Route path="/porta-paletes" component={LazyPortaPaletes} />
        <Route path="/positions" component={LazyPositions} />
        <Route path="/pallet-structures" component={LazyPalletStructures} />
        <Route path="/ucps" component={LazyUCPs} />
        <Route path="/products" component={LazyProducts} />
        <Route path="/vehicles" component={LazyVehicles} />
        <Route path="/users" component={LazyUsers} />
        <Route path="/warehouse-tracking" component={LazyWarehouseTracking} />
        <Route path="/transfer-planning" component={LazyTransferPlanning} />
        <Route path="/loading-execution" component={LazyLoadingExecution} />
        <Route path="/transfer-reports" component={LazyTransferReports} />
        <Route component={NotFound} />
      </Switch>
    </LazyDesktopLayout>
  );
}

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Algo deu errado</h2>
            <p className="text-gray-600 mb-4">Por favor, recarregue a página</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  // Initialize service worker and performance monitoring
  useEffect(() => {
    // Register service worker for caching
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch(console.error);
    }

    // Initialize performance monitoring
    if (import.meta.env.DEV) {
      console.log('🚀 Lazy Loading Performance Monitor initialized');
      
      // Track initial app load with startTransition
      startTransition(() => {
        const appLoadTracker = performanceMonitor.trackRouteTransition('initial', window.location.pathname);
        setTimeout(() => appLoadTracker.end(), 100);
      });
    }

    // Preload critical components on idle
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        // Preload commonly used heavy components
        import('@/components/warehouse-map').catch(() => {});
        import('@/components/qr-scanner').catch(() => {});
      });
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Toaster />
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
          <Router />
        </Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
