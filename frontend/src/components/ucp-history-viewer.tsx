import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Clock, User, Package, MapPin, ArrowRight, 
  Plus, Minus, Archive, RefreshCw, AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UcpHistoryViewerProps {
  ucpId: number;
  isOpen: boolean;
  onClose: () => void;
}

interface HistoryEntry {
  id: number;
  action: string;
  description: string;
  oldValue?: any;
  newValue?: any;
  timestamp: string;
  performedByUser?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  item?: {
    id: number;
    quantity: string;
    product?: {
      name: string;
      sku: string;
    };
  };
  fromPosition?: {
    code: string;
    street: string;
  };
  toPosition?: {
    code: string;
    street: string;
  };
}

export default function UcpHistoryViewer({ ucpId, isOpen, onClose }: UcpHistoryViewerProps) {
  const { data: history, isLoading } = useQuery<HistoryEntry[]>({
    queryKey: [`/api/ucps/${ucpId}/history`],
    enabled: isOpen && ucpId > 0,
  });

  // Debug log to check if data is coming correctly
  console.log('UcpHistoryViewer - History data:', history);
  console.log('UcpHistoryViewer - UCP ID:', ucpId, 'Is Open:', isOpen);

  const getActionIcon = (action: string | undefined) => {
    if (!action) {
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
    
    switch (action) {
      case 'created':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'item_added':
        return <Package className="h-4 w-4 text-blue-500" />;
      case 'item_removed':
        return <Minus className="h-4 w-4 text-red-500" />;
      case 'moved':
        return <MapPin className="h-4 w-4 text-orange-500" />;
      case 'status_changed':
        return <RefreshCw className="h-4 w-4 text-purple-500" />;
      case 'dismantled':
        return <Archive className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionColor = (action: string | undefined) => {
    if (!action) {
      return 'bg-gray-50 border-gray-200';
    }
    
    switch (action) {
      case 'created':
        return 'bg-green-50 border-green-200';
      case 'item_added':
        return 'bg-blue-50 border-blue-200';
      case 'item_removed':
        return 'bg-red-50 border-red-200';
      case 'moved':
        return 'bg-orange-50 border-orange-200';
      case 'status_changed':
        return 'bg-purple-50 border-purple-200';
      case 'dismantled':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatActionDescription = (entry: HistoryEntry) => {
    if (!entry.action) {
      return 'Ação não especificada';
    }
    
    switch (entry.action) {
      case 'created':
        return `UCP criada no sistema`;
      case 'item_added':
        return `Produto ${entry.item?.product?.name || 'desconhecido'} adicionado (Qtd: ${entry.item?.quantity || 0})`;
      case 'item_removed':
        return `Produto ${entry.item?.product?.name || 'desconhecido'} removido (Qtd: ${entry.item?.quantity || 0})`;
      case 'moved':
        return (
          <div className="flex items-center gap-2">
            <span>Movida de</span>
            <Badge variant="outline">{entry.fromPosition?.code || 'N/A'}</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline">{entry.toPosition?.code || 'N/A'}</Badge>
          </div>
        );
      case 'status_changed':
        return (
          <div className="flex items-center gap-2">
            <span>Status alterado:</span>
            <Badge variant="outline">{entry.oldValue?.status || 'N/A'}</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline">{entry.newValue?.status || 'N/A'}</Badge>
          </div>
        );
      case 'dismantled':
        return `UCP desmontada e arquivada`;
      default:
        return entry.description;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico da UCP
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[600px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando histórico...</span>
            </div>
          ) : history && history.length > 0 ? (
            <div className="space-y-4">
              {history.map((entry, index) => (
                <Card 
                  key={entry.id} 
                  className={`transition-all hover:shadow-sm ${getActionColor(entry.action)}`}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {getActionIcon(entry.action)}
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {entry.action ? entry.action.replace('_', ' ').toUpperCase() : 'AÇÃO DESCONHECIDA'}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {(() => {
                                if (!entry.timestamp) return 'Data não disponível';
                                const date = new Date(entry.timestamp);
                                if (isNaN(date.getTime())) return 'Data inválida';
                                return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
                              })()}
                            </span>
                          </div>
                          
                          {entry.performedByUser && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>
                                {entry.performedByUser.firstName} {entry.performedByUser.lastName}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-sm">
                          {formatActionDescription(entry)}
                        </div>
                        
                        {entry.description && entry.description !== formatActionDescription(entry) && (
                          <div className="text-xs text-muted-foreground italic">
                            {entry.description}
                          </div>
                        )}
                        
                        {/* Additional details for specific actions */}
                        {entry.action === 'item_added' && entry.item && (
                          <div className="mt-2 p-2 bg-background rounded border text-xs space-y-1">
                            <div className="font-medium">Detalhes do produto:</div>
                            <div>SKU: {entry.item.product?.sku}</div>
                            <div>Quantidade: {entry.item.quantity}</div>
                            {entry.fromPosition && (
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Adicionado de:</span>
                                <Badge variant="outline">{entry.fromPosition.code}</Badge>
                                <span className="text-muted-foreground">({entry.fromPosition.street})</span>
                              </div>
                            )}
                          </div>
                        )}
                        {entry.action === 'item_removed' && entry.item && (
                          <div className="mt-2 p-2 bg-background rounded border text-xs space-y-1">
                            <div className="font-medium">Detalhes do produto:</div>
                            <div>SKU: {entry.item.product?.sku}</div>
                            <div>Quantidade: {entry.item.quantity}</div>
                            {entry.toPosition && (
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Removido para:</span>
                                <Badge variant="outline">{entry.toPosition.code}</Badge>
                                <span className="text-muted-foreground">({entry.toPosition.street})</span>
                              </div>
                            )}
                          </div>
                        )}
                        {entry.action === 'moved' && (entry.fromPosition || entry.toPosition) && (
                          <div className="mt-2 p-2 bg-background rounded border text-xs">
                            <div className="font-medium">Movimentação:</div>
                            {entry.fromPosition && (
                              <div>De: {entry.fromPosition.code} - {entry.fromPosition.street}</div>
                            )}
                            {entry.toPosition && (
                              <div>Para: {entry.toPosition.code} - {entry.toPosition.street}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  
                  {index < history.length - 1 && <Separator className="my-2" />}
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum histórico encontrado</p>
              <p className="text-sm">Esta UCP ainda não possui movimentações registradas</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}