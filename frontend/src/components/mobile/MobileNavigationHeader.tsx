import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Menu, 
  X, 
  Package, 
  QrCode, 
  Truck, 
  Users, 
  Settings,
  Wifi,
  WifiOff,
  Battery,
  Signal
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineManager } from '@/hooks/useOfflineManager';
import { Link, useLocation } from 'wouter';

interface MobileNavigationHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export function MobileNavigationHeader({ 
  title, 
  showBack, 
  onBack, 
  actions 
}: MobileNavigationHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { isOnline, pendingActions } = useOfflineManager();

  const navItems = [
    { path: '/', label: 'Início', icon: Package },
    { path: '/loading-execution', label: 'Carregamento', icon: Truck },
    { path: '/scanner', label: 'Scanner', icon: QrCode },
    { path: '/pallets', label: 'Pallets', icon: Package },
    { path: '/users', label: 'Usuários', icon: Users },
  ];

  const getSignalStrength = () => {
    // Simulate signal strength based on online status
    if (isOnline && navigator.onLine) return 4;
    if (isOnline) return 2;
    return 0;
  };

  const getBatteryLevel = () => {
    // In a real app, you'd use the Battery API
    // navigator.getBattery().then(battery => battery.level)
    return 85; // Simulated
  };

  return (
    <>
      {/* Status Bar */}
      <div className="bg-gray-900 text-white text-xs px-4 py-1 flex justify-between items-center safe-area-top">
        <div className="flex items-center gap-2">
          <span>{new Date().toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}</span>
          {!isOnline && (
            <Badge variant="destructive" className="text-xs px-1 py-0">
              Offline
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isOnline ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3 text-red-400" />
          )}
          <Signal className="h-3 w-3" />
          <Battery className="h-3 w-3" />
          <span className="text-xs">{getBatteryLevel()}%</span>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40 safe-area-left safe-area-right">
        <div className="flex items-center gap-3">
          {showBack ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="p-2 -ml-2"
            >
              ←
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMenu(true)}
              className="p-2 -ml-2"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          
          <div>
            <h1 className="text-lg font-semibold text-gray-900 truncate max-w-[200px]">
              {title || 'WMS'}
            </h1>
            {pendingActions > 0 && (
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                {pendingActions} ações pendentes
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actions}
          <div className="flex items-center gap-1">
            {!isOnline && (
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
            <div className="text-xs text-gray-500 hidden sm:block">
              {user?.name?.split(' ')[0]}
            </div>
          </div>
        </div>
      </header>

      {/* Side Menu Overlay */}
      {showMenu && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowMenu(false)}>
          <div 
            className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-xl transform transition-transform"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Menu Header */}
            <div className="bg-primary text-white p-4 safe-area-top">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">WMS Mobile</h2>
                  <p className="text-primary-foreground/80 text-sm">
                    {user?.name}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMenu(false)}
                  className="text-white hover:bg-primary-dark"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Menu Items */}
            <nav className="p-4 space-y-2 flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                
                return (
                  <Link key={item.path} href={item.path}>
                    <button
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        isActive 
                          ? 'bg-primary text-white' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setShowMenu(false)}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  </Link>
                );
              })}
            </nav>

            {/* Menu Footer */}
            <div className="p-4 border-t space-y-2 safe-area-bottom">
              <div className="flex items-center gap-2 text-sm text-gray-600 px-3 py-2">
                {isOnline ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    Conectado
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Modo Offline
                  </>
                )}
              </div>
              
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-700"
                onClick={() => {
                  setShowMenu(false);
                  // Navigate to settings
                }}
              >
                <Settings className="h-4 w-4 mr-3" />
                Configurações
              </Button>
              
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  logout();
                  setShowMenu(false);
                }}
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MobileNavigationHeader;