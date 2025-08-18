import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  Zap,
  X,
  Settings,
  Filter,
  Clock,
  TrendingUp,
  Target,
  Package
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NotificationType = 'success' | 'warning' | 'error' | 'info' | 'milestone' | 'suggestion';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  persistent: boolean;
  data?: any;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  variant?: 'default' | 'secondary' | 'destructive';
  onClick: () => void;
}

interface NotificationCenterProps {
  className?: string;
  maxNotifications?: number;
  autoHideDelay?: number;
}

export function NotificationCenter({ 
  className, 
  maxNotifications = 50,
  autoHideDelay = 5000 
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');
  const [isOpen, setIsOpen] = useState(false);

  // Subscribe to notification events
  useEffect(() => {
    const handleNotification = (event: CustomEvent<Notification>) => {
      addNotification(event.detail);
    };

    window.addEventListener('wms-notification' as any, handleNotification);
    return () => window.removeEventListener('wms-notification' as any, handleNotification);
  }, []);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      read: false
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, maxNotifications);
      return updated;
    });

    // Show toast for non-persistent notifications
    if (!notification.persistent) {
      const toastFunction = getToastFunction(notification.type);
      toastFunction(notification.title, {
        description: notification.message,
        duration: autoHideDelay
      });
    }

    // Auto-hide non-persistent notifications
    if (!notification.persistent) {
      setTimeout(() => {
        removeNotification(id);
      }, autoHideDelay);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const filteredNotifications = notifications.filter(n => 
    filter === 'all' || n.type === filter
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className={cn("relative", className)}>
      {/* Notification Bell */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Panel */}
      {isOpen && (
        <Card className="absolute right-0 top-12 w-96 max-h-[600px] shadow-lg border z-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificações
                {unreadCount > 0 && (
                  <Badge variant="secondary">{unreadCount} novas</Badge>
                )}
              </CardTitle>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                >
                  Marcar como lidas
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  disabled={notifications.length === 0}
                >
                  Limpar tudo
                </Button>
              </div>
              
              <NotificationFilter
                current={filter}
                onChange={setFilter}
                counts={getNotificationCounts(notifications)}
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Bell className="h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-2">Nenhuma notificação</p>
                  <p className="text-sm text-gray-400">
                    {filter === 'all' 
                      ? "Você está em dia com todas as notificações"
                      : `Nenhuma notificação do tipo ${getFilterLabel(filter)}`
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onRead={() => markAsRead(notification.id)}
                      onRemove={() => removeNotification(notification.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onRead: () => void;
  onRemove: () => void;
}

function NotificationItem({ notification, onRead, onRemove }: NotificationItemProps) {
  const iconMap = {
    success: CheckCircle,
    warning: AlertTriangle,
    error: AlertTriangle,
    info: Info,
    milestone: Target,
    suggestion: TrendingUp
  };

  const colorMap = {
    success: 'text-green-600 bg-green-50',
    warning: 'text-yellow-600 bg-yellow-50',
    error: 'text-red-600 bg-red-50',
    info: 'text-blue-600 bg-blue-50',
    milestone: 'text-purple-600 bg-purple-50',
    suggestion: 'text-indigo-600 bg-indigo-50'
  };

  const Icon = iconMap[notification.type];
  const colors = colorMap[notification.type];

  return (
    <div 
      className={cn(
        "p-4 border-l-4 hover:bg-gray-50 cursor-pointer transition-colors",
        !notification.read && "bg-blue-50 border-l-blue-500",
        notification.read && "border-l-gray-200"
      )}
      onClick={onRead}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-full", colors)}>
          <Icon className="h-4 w-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <h4 className={cn(
              "font-medium truncate",
              !notification.read && "font-semibold"
            )}>
              {notification.title}
            </h4>
            
            <div className="flex items-center gap-2 ml-2">
              {!notification.read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              {formatTimestamp(notification.timestamp)}
            </div>
            
            {notification.type && (
              <Badge variant="secondary" className="text-xs">
                {getFilterLabel(notification.type)}
              </Badge>
            )}
          </div>

          {/* Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="flex gap-2 mt-3">
              {notification.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                  className="text-xs"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface NotificationFilterProps {
  current: NotificationType | 'all';
  onChange: (filter: NotificationType | 'all') => void;
  counts: Record<NotificationType | 'all', number>;
}

function NotificationFilter({ current, onChange, counts }: NotificationFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const filters: Array<{ key: NotificationType | 'all'; label: string; icon: any }> = [
    { key: 'all', label: 'Todas', icon: Bell },
    { key: 'success', label: 'Sucesso', icon: CheckCircle },
    { key: 'warning', label: 'Avisos', icon: AlertTriangle },
    { key: 'error', label: 'Erros', icon: AlertTriangle },
    { key: 'info', label: 'Informações', icon: Info },
    { key: 'milestone', label: 'Marcos', icon: Target },
    { key: 'suggestion', label: 'Sugestões', icon: TrendingUp }
  ];

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <Filter className="h-3 w-3" />
        {getFilterLabel(current)}
        {counts[current] > 0 && (
          <Badge variant="secondary" className="text-xs">
            {counts[current]}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <Card className="absolute right-0 top-10 w-48 shadow-lg border z-50">
          <CardContent className="p-2">
            <div className="space-y-1">
              {filters.map((filter) => {
                const Icon = filter.icon;
                return (
                  <Button
                    key={filter.key}
                    variant={current === filter.key ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      onChange(filter.key);
                      setIsOpen(false);
                    }}
                    className="w-full justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-3 w-3" />
                      {filter.label}
                    </div>
                    {counts[filter.key] > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {counts[filter.key]}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Utility functions
function getToastFunction(type: NotificationType) {
  switch (type) {
    case 'success':
      return toast.success;
    case 'error':
      return toast.error;
    case 'warning':
      return toast.warning;
    default:
      return toast;
  }
}

function getFilterLabel(filter: NotificationType | 'all'): string {
  const labels = {
    all: 'Todas',
    success: 'Sucesso',
    warning: 'Avisos', 
    error: 'Erros',
    info: 'Info',
    milestone: 'Marcos',
    suggestion: 'Sugestões'
  };
  return labels[filter] || filter;
}

function getNotificationCounts(notifications: Notification[]): Record<NotificationType | 'all', number> {
  const counts = notifications.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    acc.all = (acc.all || 0) + 1;
    return acc;
  }, {} as Record<NotificationType | 'all', number>);

  // Ensure all keys exist
  return {
    all: counts.all || 0,
    success: counts.success || 0,
    warning: counts.warning || 0,
    error: counts.error || 0,
    info: counts.info || 0,
    milestone: counts.milestone || 0,
    suggestion: counts.suggestion || 0
  };
}

function formatTimestamp(timestamp: Date): string {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d atrás`;
  } else if (hours > 0) {
    return `${hours}h atrás`;
  } else if (minutes > 0) {
    return `${minutes}m atrás`;
  } else {
    return 'Agora';
  }
}

// Export notification utility
export const notify = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
  const event = new CustomEvent('wms-notification', { detail: notification });
  window.dispatchEvent(event);
};

// Pre-built notification types for common scenarios
export const NotificationHelpers = {
  itemScanned: (productName: string) => notify({
    type: 'success',
    title: 'Item Escaneado',
    message: `${productName} foi escaneado com sucesso`,
    persistent: false
  }),

  itemCompleted: (productName: string) => notify({
    type: 'success',
    title: 'Item Carregado',
    message: `${productName} foi carregado completamente`,
    persistent: false
  }),

  divergenceDetected: (productName: string, reason: string) => notify({
    type: 'warning',
    title: 'Divergência Detectada',
    message: `${productName}: ${reason}`,
    persistent: true
  }),

  milestoneReached: (percentage: number) => notify({
    type: 'milestone',
    title: 'Marco Atingido',
    message: `${percentage}% do carregamento foi concluído`,
    persistent: false
  }),

  executionCompleted: (itemCount: number) => notify({
    type: 'success', 
    title: 'Carregamento Finalizado',
    message: `Todos os ${itemCount} itens foram processados`,
    persistent: true
  }),

  optimizationSuggestion: (suggestion: string) => notify({
    type: 'suggestion',
    title: 'Sugestão de Otimização',
    message: suggestion,
    persistent: true
  }),

  systemError: (error: string) => notify({
    type: 'error',
    title: 'Erro do Sistema',
    message: error,
    persistent: true
  })
};