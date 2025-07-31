import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
// import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useMobile } from "@/hooks/use-mobile";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Auth from "@/pages/auth";
import Dashboard from "@/pages/dashboard";
import Pallets from "@/pages/pallets";
import PortaPaletes from "@/pages/porta-paletes";
import Positions from "@/pages/positions";
import PalletStructures from "@/pages/pallet-structures";
import UCPs from "@/pages/ucps";
import Products from "@/pages/products";
import Users from "@/pages/users";
import Vehicles from "@/pages/vehicles";
import WarehouseTracking from "@/pages/warehouse-tracking";
import TransferPlanning from "@/pages/transfer-planning";
import LoadingExecution from "@/pages/loading-execution";
import TransferReports from "@/pages/transfer-reports";
import MobileHome from "@/pages/mobile/home";
import MobileScanner from "@/pages/mobile/scanner";
import MobilePallets from "@/pages/mobile/pallets";
import MobileLayout from "@/components/layout/mobile-layout";
import DesktopLayout from "@/components/layout/desktop-layout";

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
      <MobileLayout>
        <Switch>
          <Route path="/" component={MobileHome} />
          <Route path="/pallets" component={MobilePallets} />
          <Route path="/scanner" component={MobileScanner} />
          <Route component={NotFound} />
        </Switch>
      </MobileLayout>
    );
  }

  return (
    <DesktopLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/pallets" component={Pallets} />
        <Route path="/porta-paletes" component={PortaPaletes} />
        <Route path="/positions" component={Positions} />
        <Route path="/pallet-structures" component={PalletStructures} />
        <Route path="/ucps" component={UCPs} />
        <Route path="/products" component={Products} />
        <Route path="/vehicles" component={Vehicles} />
        <Route path="/users" component={Users} />
        <Route path="/warehouse-tracking" component={WarehouseTracking} />
        <Route path="/transfer-planning" component={TransferPlanning} />
        <Route path="/loading-execution" component={LoadingExecution} />
        <Route path="/transfer-reports" component={TransferReports} />
        <Route component={NotFound} />
      </Switch>
    </DesktopLayout>
  );
}

function App() {
  // Initialize service worker for performance optimizations
  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.DEV) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Router />
    </QueryClientProvider>
  );
}

export default App;
