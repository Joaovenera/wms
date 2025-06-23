import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useMobile } from "@/hooks/use-mobile";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Pallets from "@/pages/pallets";
import Positions from "@/pages/positions";
import UCPs from "@/pages/ucps";
import Products from "@/pages/products";
import Users from "@/pages/users";
import MobileHome from "@/pages/mobile/home";
import MobileScanner from "@/pages/mobile/scanner";
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
    return <Landing />;
  }

  if (isMobile) {
    return (
      <MobileLayout>
        <Switch>
          <Route path="/" component={MobileHome} />
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
        <Route path="/positions" component={Positions} />
        <Route path="/ucps" component={UCPs} />
        <Route path="/products" component={Products} />
        <Route component={NotFound} />
      </Switch>
    </DesktopLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
