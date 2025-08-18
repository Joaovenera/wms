import React, { memo, useCallback, useMemo, useState } from 'react';
import { LoadingItem } from '@/types/api';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  Search,
  Filter,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { VirtualScrollList } from './VirtualScrollList';
import { useOptimizedList } from '../hooks/useVirtualization';

// LoadingItem interface now imported from types/api.ts

interface LoadingItemsListProps {
  items: LoadingItem[];
  execution: any;
  onItemClick: (item: LoadingItem) => void;
  onDivergenceClick: (item: LoadingItem) => void;
  isLoading?: boolean;
  enableVirtualization?: boolean;
}

type SortField = 'name' | 'status' | 'quantity' | 'time';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'pending' | 'completed' | 'partial' | 'divergence';

const DIVERGENCE_REASONS = [
  { value: 'falta_espaco', label: 'Falta de espaço no caminhão' },
  { value: 'item_avariado', label: 'Item avariado' },
  { value: 'divergencia_estoque', label: 'Divergência de estoque' },
  { value: 'item_nao_localizado', label: 'Item não localizado' },
];

const ITEM_HEIGHT = 180; // Approximate height of each item card

export const LoadingItemsList = memo<LoadingItemsListProps>(({
  items,
  execution,
  onItemClick,
  onDivergenceClick,
  isLoading = false,
  enableVirtualization = true
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Get item status for sorting and filtering
  const getItemStatus = useCallback((item: LoadingItem) => {
    if (item.confirmedAt) {
      const loaded = parseFloat(item.loadedQuantity);
      const requested = parseFloat(item.requestedQuantity);
      
      if (loaded === requested) {
        return { type: 'completed', label: 'Completo', icon: CheckCircle, priority: 1 };
      } else if (loaded > 0) {
        return { type: 'partial', label: 'Parcial', icon: AlertTriangle, priority: 2 };
      } else {
        return { type: 'not_loaded', label: 'Não Carregado', icon: XCircle, priority: 3 };
      }
    }
    return { type: 'pending', label: 'Pendente', icon: Clock, priority: 4 };
  }, []);

  // Filter and sort items
  const processedItems = useMemo(() => {
    let filtered = items.filter(item => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          item.productName.toLowerCase().includes(searchLower) ||
          item.productSku.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filter !== 'all') {
        const status = getItemStatus(item);
        switch (filter) {
          case 'pending':
            return status.type === 'pending';
          case 'completed':
            return status.type === 'completed';
          case 'partial':
            return status.type === 'partial';
          case 'divergence':
            return !!item.divergenceReason;
          default:
            return true;
        }
      }

      return true;
    });

    // Sort items
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.productName.toLowerCase();
          bValue = b.productName.toLowerCase();
          break;
        case 'status':
          aValue = getItemStatus(a).priority;
          bValue = getItemStatus(b).priority;
          break;
        case 'quantity':
          aValue = parseFloat(a.requestedQuantity);
          bValue = parseFloat(b.requestedQuantity);
          break;
        case 'time':
          aValue = a.confirmedAt ? new Date(a.confirmedAt).getTime() : 0;
          bValue = b.confirmedAt ? new Date(b.confirmedAt).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [items, searchTerm, filter, sortField, sortDirection, getItemStatus]);

  // Progressive loading for better performance
  const { renderedItems, isRendering, renderProgress } = useOptimizedList(
    processedItems,
    {
      batchSize: 20,
      renderDelay: 16,
      priorityIndexes: processedItems
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !item.confirmedAt || item.divergenceReason)
        .map(({ index }) => index)
        .slice(0, 10) // Prioritize first 10 incomplete or divergent items
    }
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />;
  };

  const getFilterBadgeColor = (filterType: FilterType) => {
    const counts = {
      all: items.length,
      pending: items.filter(item => getItemStatus(item).type === 'pending').length,
      completed: items.filter(item => getItemStatus(item).type === 'completed').length,
      partial: items.filter(item => getItemStatus(item).type === 'partial').length,
      divergence: items.filter(item => !!item.divergenceReason).length,
    };

    return {
      count: counts[filterType],
      active: filter === filterType
    };
  };

  // Render individual item
  const renderItem = useCallback(({ item, index, style }: any) => {
    const loadingItem = item as LoadingItem;
    const status = getItemStatus(loadingItem);
    const StatusIcon = status.icon;
    const loadedQuantity = parseFloat(loadingItem.loadedQuantity);
    const requestedQuantity = parseFloat(loadingItem.requestedQuantity);
    const notLoadedQuantity = parseFloat(loadingItem.notLoadedQuantity);

    return (
      <div style={style} className="px-4 pb-4">
        <Card 
          className={`transition-all duration-200 hover:shadow-md cursor-pointer ${
            execution.status === 'em_andamento' 
              ? 'hover:bg-blue-50 active:scale-98' 
              : 'opacity-75'
          }`}
          onClick={() => execution.status === 'em_andamento' && onItemClick(loadingItem)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-base truncate">
                  {loadingItem.productName}
                </h4>
                <p className="text-sm text-gray-600">SKU: {loadingItem.productSku}</p>
                {execution.status === 'em_andamento' && (
                  <p className="text-xs text-blue-600 mt-1">
                    {loadingItem.confirmedAt 
                      ? '✏️ Clique para editar quantidade carregada' 
                      : '👆 Clique para informar quantidade carregada'
                    }
                  </p>
                )}
              </div>
              <Badge 
                variant={status.type === 'completed' ? 'default' : 
                        status.type === 'partial' ? 'secondary' : 
                        status.type === 'not_loaded' ? 'destructive' : 'outline'}
                className="flex items-center gap-1 ml-2"
              >
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm mb-3">
              <div className="text-center">
                <span className="text-gray-600 block text-xs">Solicitado</span>
                <p className="font-semibold text-lg">{requestedQuantity}</p>
              </div>
              <div className="text-center">
                <span className="text-gray-600 block text-xs">Carregado</span>
                <p className="font-semibold text-lg text-green-600">{loadedQuantity}</p>
              </div>
              <div className="text-center">
                <span className="text-gray-600 block text-xs">Faltante</span>
                <p className="font-semibold text-lg text-red-600">{notLoadedQuantity}</p>
              </div>
            </div>

            {/* Progress bar for individual item */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${requestedQuantity > 0 ? (loadedQuantity / requestedQuantity) * 100 : 0}%` }}
              />
            </div>

            {loadingItem.divergenceReason && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium text-yellow-800 text-sm">Divergência registrada</span>
                </div>
                <p className="text-sm text-yellow-700">
                  <strong>Motivo:</strong> {DIVERGENCE_REASONS.find(r => r.value === loadingItem.divergenceReason)?.label}
                </p>
                {loadingItem.divergenceComments && (
                  <p className="text-sm text-yellow-700 mt-1">
                    <strong>Comentários:</strong> {loadingItem.divergenceComments}
                  </p>
                )}
              </div>
            )}

            {execution.status === 'em_andamento' && !loadingItem.confirmedAt && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDivergenceClick(loadingItem);
                  }}
                  className="flex items-center gap-1"
                >
                  <XCircle className="h-3 w-3" />
                  Registrar Divergência
                </Button>
              </div>
            )}

            {loadingItem.scannedAt && (
              <p className="text-xs text-gray-500 mt-2">
                Escaneado em: {new Date(loadingItem.scannedAt).toLocaleString('pt-BR')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }, [execution, getItemStatus, onItemClick, onDivergenceClick]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="h-8 bg-gray-200 rounded"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtros
              {(filter !== 'all' || searchTerm) && (
                <Badge variant="secondary" className="ml-1">
                  {filter !== 'all' ? 1 : 0 + (searchTerm ? 1 : 0)}
                </Badge>
              )}
            </Button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex flex-wrap gap-2 mb-4">
                {(['all', 'pending', 'completed', 'partial', 'divergence'] as FilterType[]).map((filterType) => {
                  const { count, active } = getFilterBadgeColor(filterType);
                  const labels = {
                    all: 'Todos',
                    pending: 'Pendentes',
                    completed: 'Completos',
                    partial: 'Parciais',
                    divergence: 'Divergências'
                  };

                  return (
                    <Button
                      key={filterType}
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter(filterType)}
                      className="flex items-center gap-1"
                    >
                      {labels[filterType]}
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {count}
                      </Badge>
                    </Button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-600 mr-2">Ordenar por:</span>
                {(['name', 'status', 'quantity', 'time'] as SortField[]).map((field) => {
                  const labels = {
                    name: 'Nome',
                    status: 'Status',
                    quantity: 'Quantidade',
                    time: 'Horário'
                  };

                  return (
                    <Button
                      key={field}
                      variant={sortField === field ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handleSort(field)}
                      className="flex items-center gap-1"
                    >
                      {labels[field]}
                      {getSortIcon(field)}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Progress info */}
          {isRendering && (
            <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              Renderizando itens... {Math.round(renderProgress)}%
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items List */}
      {processedItems.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-gray-400 mb-2">
              {searchTerm || filter !== 'all' ? '🔍' : '📦'}
            </div>
            <p className="text-gray-500">
              {searchTerm || filter !== 'all' 
                ? 'Nenhum item encontrado com os filtros aplicados'
                : 'Nenhum item encontrado'
              }
            </p>
            {(searchTerm || filter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setFilter('all');
                }}
                className="mt-2"
              >
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : enableVirtualization && processedItems.length > 20 ? (
        <VirtualScrollList
          items={renderedItems}
          itemHeight={ITEM_HEIGHT}
          height={600}
          renderItem={renderItem}
          className="border rounded-lg bg-white"
          loading={isRendering}
          loadingComponent={
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-500">Carregando itens...</p>
              </div>
            </div>
          }
        />
      ) : (
        <div className="space-y-0">
          {renderedItems.map((item, index) => 
            renderItem({ item, index, style: {} })
          )}
        </div>
      )}

      {/* Summary info */}
      <div className="text-xs text-gray-500 text-center">
        Mostrando {renderedItems.length} de {processedItems.length} itens
        {processedItems.length !== items.length && ` (${items.length} total)`}
      </div>
    </div>
  );
});

LoadingItemsList.displayName = 'LoadingItemsList';

export default LoadingItemsList;