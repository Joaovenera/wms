import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { 
  Warehouse, 
  BarChart3, 
  Package, 
  MapPin, 
  Building2,
  Box, 
  Package2, 
  Users, 
  FileText,
  Bell,
  Settings,
  LogOut
} from "lucide-react";

interface DesktopLayoutProps {
  children: ReactNode;
}

export default function DesktopLayout({ children }: DesktopLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  const navigation = [
    { name: "Dashboard", href: "/", icon: BarChart3 },
    { name: "Pallets", href: "/pallets", icon: Package },
    { name: "Posições", href: "/positions", icon: MapPin },
    { name: "Estruturas", href: "/pallet-structures", icon: Building2 },
    { name: "UCPs", href: "/ucps", icon: Box },
    { name: "Produtos", href: "/products", icon: Package2 },
    { name: "Relatórios", href: "/reports", icon: FileText },
    { name: "Usuários", href: "/users", icon: Users },
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-warehouse-bg">
      {/* Desktop Header */}
      <header className="bg-white shadow-sm border-b border-warehouse-border">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <Warehouse className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-gray-800">MWS - Sistema de Controle de Estoque</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span>Sistema Online</span>
            </div>
            <Button variant="ghost" size="sm">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm">
              <Settings className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user?.firstName?.charAt(0) || user?.email?.charAt(0) || "A"}
                </span>
              </div>
              <div className="text-sm">
                <div className="font-medium text-gray-700">
                  {user?.firstName || user?.email || "Admin"}
                </div>
                <div className="text-gray-500 capitalize">
                  {user?.role || "Administrador"}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <nav className="w-64 bg-white shadow-sm border-r border-warehouse-border min-h-screen">
          <div className="p-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                
                return (
                  <li key={item.name}>
                    <Link href={item.href}>
                      <div className={`flex items-center space-x-3 p-3 rounded-lg transition-colors cursor-pointer ${
                        isActive 
                          ? "bg-primary/10 text-primary font-medium" 
                          : "text-gray-700 hover:bg-gray-100"
                      }`}>
                        <Icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
