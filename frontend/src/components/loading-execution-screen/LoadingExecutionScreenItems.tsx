
import { LoadingItem } from "@/types/api";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";

interface LoadingExecutionScreenItemsProps {
  items: LoadingItem[];
  onItemClick: (item: LoadingItem) => void;
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

const LoadingItemCard = memo(({ item, onClick }: { item: LoadingItem; onClick: (item: LoadingItem) => void; }) => {
  const status = getItemStatus(item);
  const StatusIcon = status.icon;

  return (
    <div
      className="border rounded-lg p-4 transition-colors bg-blue-50 hover:bg-blue-100 cursor-pointer border-blue-200"
      onClick={() => onClick(item)}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-medium text-lg">{item.productName}</h4>
          <p className="text-sm text-gray-600">SKU: {item.productSku}</p>
        </div>
        <Badge variant={status.variant} className="flex items-center gap-1">
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div><span className="text-gray-600">Solicitado:</span><p className="font-semibold text-lg">{item.requestedQuantity}</p></div>
        <div><span className="text-gray-600">Carregado:</span><p className="font-semibold text-lg text-green-600">{item.loadedQuantity}</p></div>
        <div><span className="text-gray-600">Faltante:</span><p className="font-semibold text-lg text-red-600">{item.notLoadedQuantity}</p></div>
      </div>
    </div>
  );
});

LoadingItemCard.displayName = 'LoadingItemCard';

export const LoadingExecutionScreenItems = ({ items, onItemClick }: LoadingExecutionScreenItemsProps) => (
  <div className="space-y-3">
    {items.map(item => <LoadingItemCard key={item.id} item={item} onClick={onItemClick} />)}
  </div>
);
