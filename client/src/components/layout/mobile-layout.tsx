import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Home, QrCode, Package, CheckSquare, User, Warehouse, Wifi, Box } from "lucide-react";

interface MobileLayoutProps {
  children: ReactNode;
}

export default function MobileLayout({ children }: MobileLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  const navigation = [
    { name: "Início", href: "/", icon: Home },
    { name: "Pallets", href: "/pallets", icon: Box },
    { name: "Scanner", href: "/scanner", icon: QrCode },
    { name: "Estoque", href: "/inventory", icon: Package },
    { name: "Perfil", href: "/profile", icon: User },
  ];

  return (
    <div className="min-h-screen bg-warehouse-bg">
      {/* Mobile Header */}
      <header className="bg-primary text-white shadow-lg sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <Warehouse className="h-6 w-6" />
            <h1 className="text-lg font-medium">MWS Mobile</h1>
          </div>
          <div className="flex items-center space-x-3">
            <Wifi className="h-5 w-5" />
            <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium">
                {user?.firstName?.charAt(0) || user?.email?.charAt(0) || "U"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20 p-4">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-warehouse-border px-4 py-2 z-40">
        <div className="flex justify-around items-center">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link key={item.name} href={item.href}>
                <div className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                  isActive 
                    ? "text-primary bg-primary/10" 
                    : "text-gray-600 hover:text-gray-800"
                }`}>
                  <Icon className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">{item.name}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button */}
      <div className="fixed bottom-24 right-4 z-40">
        <Link href="/scanner">
          <Button 
            size="lg"
            className="w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          >
            <QrCode className="h-6 w-6" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
