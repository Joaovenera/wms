import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Package, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Edit,
  Search,
  Filter,
  SortAsc,
  MoreHorizontal,
  XCircle,
  Eye,
  Target
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface LoadingItem {
  id: number;
  productName: string;
  productSku: string;
  requestedQuantity: string;
  loadedQuantity: string;
  notLoadedQuantity: string;
  scannedAt?: string;
  confirmedAt?: string;
  divergenceReason?: string;
  divergenceComments?: string;
}

interface ItemProgressTrackerProps {
  items: LoadingItem[];
  onEditItem?: (item: LoadingItem) => void;
  onRegisterDivergence?: (item: LoadingItem) => void;
  onViewDetails?: (item: LoadingItem) => void;
  className?: string;
  executionStatus?: string;
}

type SortField = 'name' | 'sku' | 'status' | 'quantity' | 'progress';
type SortDirection = 'asc' | 'desc';
type FilterStatus = 'all' | 'completed' | 'partial' | 'pending' | 'divergence';

export function ItemProgressTracker({ 
  items, 
  onEditItem, 
  onRegisterDivergence, 
  onViewDetails,
  executionStatus = 'em_andamento',
  className 
}: ItemProgressTrackerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  // Filter and sort items
  const filteredAndSortedItems = items
    .filter(item => {
      // Search filter
      const matchesSearch = 
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productSku.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      // Status filter
      if (filterStatus === 'all') return true;
      
      const itemStatus = getItemStatus(item);
      return itemStatus.key === filterStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.productName.localeCompare(b.productName);
          break;
        case 'sku':
          comparison = a.productSku.localeCompare(b.productSku);
          break;
        case 'status':
          const statusA = getItemStatus(a);
          const statusB = getItemStatus(b);
          comparison = statusA.priority - statusB.priority;
          break;
        case 'quantity':
          comparison = parseFloat(a.requestedQuantity) - parseFloat(b.requestedQuantity);
          break;
        case 'progress':
          const progressA = getItemProgress(a);
          const progressB = getItemProgress(b);
          comparison = progressA - progressB;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const handleSelectItem = (itemId: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === filteredAndSortedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredAndSortedItems.map(item => item.id)));
    }
  };

  const statusCounts = items.reduce((acc, item) => {
    const status = getItemStatus(item);
    acc[status.key] = (acc[status.key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controls Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Rastreamento de Itens
              <Badge variant="secondary" className="ml-2">
                {filteredAndSortedItems.length} de {items.length}
              </Badge>
            </CardTitle>
            
            {selectedItems.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="default">
                  {selectedItems.size} selecionados
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedItems(new Set())}
                >
                  Limpar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Status Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatusPill
              label="Todos"
              count={items.length}
              isActive={filterStatus === 'all'}
              onClick={() => setFilterStatus('all')}
              color="gray"
            />
            <StatusPill
              label="Completo"
              count={statusCounts.completed || 0}
              isActive={filterStatus === 'completed'}
              onClick={() => setFilterStatus('completed')}
              color="green"
            />
            <StatusPill
              label="Parcial"
              count={statusCounts.partial || 0}
              isActive={filterStatus === 'partial'}
              onClick={() => setFilterStatus('partial')}
              color="yellow"
            />
            <StatusPill
              label="Pendente"
              count={statusCounts.pending || 0}
              isActive={filterStatus === 'pending'}
              onClick={() => setFilterStatus('pending')}
              color="blue"
            />
            <StatusPill
              label="Divergência"
              count={statusCounts.divergence || 0}
              isActive={filterStatus === 'divergence'}
              onClick={() => setFilterStatus('divergence')}
              color="red"
            />
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nome</SelectItem>
                  <SelectItem value="sku">SKU</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="quantity">Quantidade</SelectItem>
                  <SelectItem value="progress">Progresso</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              >
                <SortAsc className={cn(
                  "h-4 w-4 transition-transform",
                  sortDirection === 'desc' && "rotate-180"
                )} />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="flex items-center gap-2"
              >
                <input
                  type="checkbox"
                  checked={selectedItems.size === filteredAndSortedItems.length && filteredAndSortedItems.length > 0}
                  onChange={() => {}}
                  className="rounded"
                />
                Todos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      <div className="space-y-3">
        {filteredAndSortedItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center">
                {searchTerm || filterStatus !== 'all' 
                  ? "Nenhum item encontrado com os filtros aplicados"
                  : "Nenhum item na lista de carregamento"
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAndSortedItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isSelected={selectedItems.has(item.id)}
              onSelect={() => handleSelectItem(item.id)}
              onEdit={() => onEditItem?.(item)}
              onRegisterDivergence={() => onRegisterDivergence?.(item)}
              onViewDetails={() => onViewDetails?.(item)}
              executionStatus={executionStatus}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface StatusPillProps {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  color: 'gray' | 'green' | 'yellow' | 'blue' | 'red';
}

function StatusPill({ label, count, isActive, onClick, color }: StatusPillProps) {
  const colorClasses = {
    gray: 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300',
    green: 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300',
    yellow: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-300',
    blue: 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300',
    red: 'bg-red-100 hover:bg-red-200 text-red-800 border-red-300'
  };

  const activeClasses = {
    gray: 'bg-gray-200 border-gray-400',
    green: 'bg-green-200 border-green-400',
    yellow: 'bg-yellow-200 border-yellow-400',
    blue: 'bg-blue-200 border-blue-400',  
    red: 'bg-red-200 border-red-400'
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center p-3 rounded-lg border-2 transition-colors cursor-pointer",
        isActive ? activeClasses[color] : colorClasses[color]
      )}
    >
      <div className="text-lg font-bold">{count}</div>
      <div className="text-xs">{label}</div>
    </button>
  );
}

interface ItemCardProps {
  item: LoadingItem;
  isSelected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onRegisterDivergence?: () => void;
  onViewDetails?: () => void;
  executionStatus: string;
}

function ItemCard({ 
  item, 
  isSelected, 
  onSelect, 
  onEdit, 
  onRegisterDivergence, 
  onViewDetails,
  executionStatus 
}: ItemCardProps) {
  const status = getItemStatus(item);
  const progress = getItemProgress(item);
  const StatusIcon = status.icon;

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-md",
      isSelected && "ring-2 ring-blue-500 shadow-md",
      executionStatus === 'em_andamento' && "hover:bg-blue-50 cursor-pointer"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Selection Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="mt-1 rounded"
          />

          {/* Item Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-lg truncate">{item.productName}</h4>
                <p className="text-sm text-gray-600">SKU: {item.productSku}</p>
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                <Badge variant={status.variant} className="flex items-center gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </Badge>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onViewDetails}>
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Detalhes
                    </DropdownMenuItem>
                    {executionStatus === 'em_andamento' && (
                      <>
                        <DropdownMenuItem onClick={onEdit}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar Quantidade
                        </DropdownMenuItem>
                        {!item.divergenceReason && (
                          <DropdownMenuItem onClick={onRegisterDivergence}>
                            <XCircle className="h-4 w-4 mr-2" />
                            Registrar Divergência
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span>Progresso</span>
                <span className="font-medium">{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} />
            </div>

            {/* Quantities */}
            <div className="grid grid-cols-3 gap-4 text-sm mb-3">
              <div>
                <span className="text-gray-600">Solicitado:</span>
                <p className="font-semibold text-lg">{item.requestedQuantity}</p>
              </div>
              <div>
                <span className="text-gray-600">Carregado:</span>
                <p className="font-semibold text-lg text-green-600">{item.loadedQuantity}</p>
              </div>
              <div>
                <span className="text-gray-600">Faltante:</span>
                <p className="font-semibold text-lg text-red-600">{item.notLoadedQuantity}</p>
              </div>
            </div>

            {/* Divergence Info */}
            {item.divergenceReason && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium text-yellow-800">Divergência</span>
                </div>
                <p className="text-sm text-yellow-700">
                  {getDivergenceReasonLabel(item.divergenceReason)}
                </p>
                {item.divergenceComments && (
                  <p className="text-sm text-yellow-700 mt-1">
                    {item.divergenceComments}
                  </p>
                )}
              </div>
            )}

            {/* Timestamps */}
            {(item.scannedAt || item.confirmedAt) && (
              <div className="text-xs text-gray-500 space-y-1">
                {item.scannedAt && (
                  <p>Escaneado: {new Date(item.scannedAt).toLocaleString('pt-BR')}</p>
                )}
                {item.confirmedAt && (
                  <p>Confirmado: {new Date(item.confirmedAt).toLocaleString('pt-BR')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper functions
function getItemStatus(item: LoadingItem) {
  if (item.divergenceReason) {
    return { 
      key: 'divergence', 
      label: 'Divergência', 
      variant: 'destructive' as const, 
      icon: AlertTriangle, 
      priority: 1 
    };
  }
  
  if (item.confirmedAt) {
    const loaded = parseFloat(item.loadedQuantity);
    const requested = parseFloat(item.requestedQuantity);
    
    if (loaded === requested) {
      return { 
        key: 'completed', 
        label: 'Completo', 
        variant: 'default' as const, 
        icon: CheckCircle, 
        priority: 4 
      };
    } else if (loaded > 0) {
      return { 
        key: 'partial', 
        label: 'Parcial', 
        variant: 'secondary' as const, 
        icon: AlertTriangle, 
        priority: 2 
      };
    } else {
      return { 
        key: 'pending', 
        label: 'Não Carregado', 
        variant: 'destructive' as const, 
        icon: XCircle, 
        priority: 1 
      };
    }
  }
  
  return { 
    key: 'pending', 
    label: 'Pendente', 
    variant: 'outline' as const, 
    icon: Clock, 
    priority: 3 
  };
}

function getItemProgress(item: LoadingItem): number {
  if (!item.confirmedAt) return 0;
  
  const loaded = parseFloat(item.loadedQuantity);
  const requested = parseFloat(item.requestedQuantity);
  
  return requested > 0 ? Math.min((loaded / requested) * 100, 100) : 0;
}

function getDivergenceReasonLabel(reason?: string): string {
  const reasons = {
    'falta_espaco': 'Falta de espaço no caminhão',
    'item_avariado': 'Item avariado',
    'divergencia_estoque': 'Divergência de estoque',
    'item_nao_localizado': 'Item não localizado'
  };
  return reasons[reason as keyof typeof reasons] || reason || 'Não especificado';
}