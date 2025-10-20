
import { LoadingItem } from "@/types/api";
import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { GestureHandler } from "@/components/mobile/GestureHandler";

interface MobileLoadingExecutionItemsProps {
  items: LoadingItem[];
  onTap: (item: LoadingItem) => void;
  onLongPress: (item: LoadingItem) => void;
  executionStatus: string;
}

const getItemStatus = (item: LoadingItem) => {
  if (item.confirmedAt) {
    const loaded = parseFloat(item.loadedQuantity);
    const requested = parseFloat(item.requestedQuantity);
    if (loaded === requested) return { label: 'Completo', variant: 'default' as const, icon: CheckCircle };
    if (loaded > 0) return { label: 'Parcial', variant: 'secondary' as const, icon: AlertTriangle };
    return { label: 'Não Carregado', variant: 'destructive' as const, icon: XCircle };
  }
  return { label: 'Pendente', variant: 'outline' as const, icon: Clock };
};

const MobileLoadingItemCard = memo(({ item, onTap, onLongPress, executionStatus }: { item: LoadingItem; onTap: (item: LoadingItem) => void; onLongPress: (item: LoadingItem) => void; executionStatus: string; }) => {
  const status = getItemStatus(item);
  const StatusIcon = status.icon;

  return (
    <GestureHandler onTap={() => onTap(item)} onLongPress={() => onLongPress(item)} enabled={executionStatus === 'em_andamento'}>
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-base truncate">{item.productName}</h4>
              <p className="text-sm text-gray-600">SKU: {item.productSku}</p>
            </div>
            <Badge variant={status.variant} className="ml-2 flex-shrink-0">
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center"><p className="text-xs text-gray-500 mb-1">Solicitado</p><p className="text-lg font-semibold">{item.requestedQuantity}</p></div>
            <div className="text-center"><p className="text-xs text-gray-500 mb-1">Carregado</p><p className="text-lg font-semibold text-green-600">{item.loadedQuantity}</p></div>
            <div className="text-center"><p className="text-xs text-gray-500 mb-1">Faltante</p><p className="text-lg font-semibold text-red-600">{item.notLoadedQuantity}</p></div>
          </div>
        </CardContent>
      </Card>
    </GestureHandler>
  );
});

MobileLoadingItemCard.displayName = 'MobileLoadingItemCard';

export const MobileLoadingExecutionItems = ({ items, onTap, onLongPress, executionStatus }: MobileLoadingExecutionItemsProps) => (
  <div className="space-y-3">
    {items.map(item => <MobileLoadingItemCard key={item.id} item={item} onTap={onTap} onLongPress={onLongPress} executionStatus={executionStatus} />)}
  </div>
);
