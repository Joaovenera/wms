import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Ship,
  Search,
  Filter,
  RefreshCw,
  Plus,
  SortAsc,
  SortDesc,
  Grid,
  List,
  Download,
  AlertCircle
} from "lucide-react";
import { ContainerCard } from "@/components/container-card";
import { ContainerArrivalWizard } from "@/components/container-arrival-wizard";
import { CONTAINER_STATUS_CONFIG, ContainerArrival } from "@/types/container";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";

interface ContainerListProps {
  onContainerSelect?: (container: ContainerArrival) => void;
  initialStatus?: string;
  compactView?: boolean;
  showActions?: boolean;
}

interface FilterState {
  status: string;
  search: string;
  sortBy: 'created_at' | 'estimated_arrival' | 'container_number' | 'supplier_name';
  sortOrder: 'asc' | 'desc';
}

export function ContainerList({ 
  onContainerSelect, 
  initialStatus = 'all',
  compactView = false,
  showActions = true 
}: ContainerListProps) {
  const [filters, setFilters] = useState<FilterState>({
    status: initialStatus,
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc'
  });
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showWizard, setShowWizard] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<ContainerArrival | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  const queryClient = useQueryClient();

  // Fetch containers with filters
  const { 
    data: containers, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['container-arrivals', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }
      
      if (filters.search.trim()) {
        params.append('search', filters.search.trim());
      }
      
      params.append('limit', '50');
      params.append('offset', '0');
      
      const url = `/api/container-arrivals${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await apiRequest('GET', url);
      return await res.json();
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Status update mutation
  const statusUpdateMutation = useMutation({
    mutationFn: async ({ containerId, newStatus }: { containerId: number; newStatus: string }) => {
      const res = await apiRequest('PUT', `/api/container-arrivals/${containerId}/status`, {
        status: newStatus
      });
      return await res.json();
    },
    onSuccess: () => {
      toast.success('Status atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['container-arrivals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/container-arrivals/stats'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar status: ' + (error.message || 'Erro desconhecido'));
    }
  });

  // Delete container mutation
  const deleteMutation = useMutation({
    mutationFn: async (containerId: number) => {
      const res = await apiRequest('DELETE', `/api/container-arrivals/${containerId}`);
      return await res.json();
    },
    onSuccess: () => {
      toast.success('Container removido com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['container-arrivals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/container-arrivals/stats'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao remover container: ' + (error.message || 'Erro desconhecido'));
    }
  });

  // Handlers
  const handleStatusChange = (container: ContainerArrival, newStatus: string) => {
    if (container.id) {
      statusUpdateMutation.mutate({ 
        containerId: container.id, 
        newStatus 
      });
    }
  };

  const handleDelete = (container: ContainerArrival) => {
    if (container.id && window.confirm('Tem certeza que deseja excluir este container?')) {
      deleteMutation.mutate(container.id);
    }
  };

  const handleView = (container: ContainerArrival) => {
    setSelectedContainer(container);
    if (onContainerSelect) {
      onContainerSelect(container);
    }
  };

  const handleEdit = (container: ContainerArrival) => {
    // TODO: Implementar edição
    toast.info('Edição em desenvolvimento');
  };

  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({ ...prev, status }));
  };

  const handleSort = (field: FilterState['sortBy']) => {
    setFilters(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportContainers = async () => {
    try {
      // TODO: Implementar exportação
      toast.info('Exportação em desenvolvimento');
    } catch (error) {
      toast.error('Erro ao exportar containers');
    }
  };

  // Sort containers
  const sortedContainers = containers ? [...containers].sort((a, b) => {
    const aVal = a[filters.sortBy];
    const bVal = b[filters.sortBy];
    
    if (filters.sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  }) : [];

  const getStatusCounts = () => {
    if (!containers) return {};
    
    return containers.reduce((acc: Record<string, number>, container: any) => {
      acc[container.status] = (acc[container.status] || 0) + 1;
      return acc;
    }, {});
  };

  const statusCounts = getStatusCounts();

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Erro ao Carregar Containers
          </h3>
          <p className="text-gray-600 text-center mb-4">
            Não foi possível carregar a lista de containers. Verifique sua conexão.
          </p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Ship className="h-7 w-7 text-blue-600" />
            Containers
          </h2>
          <p className="text-gray-600">
            {isLoading ? 'Carregando...' : `${containers?.length || 0} container(s) encontrado(s)`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportContainers}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>

          <Button onClick={() => setShowWizard(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Container
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buscar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Container, lacre, fornecedor..."
                    value={filters.search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Status filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <Select value={filters.status} onValueChange={handleStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      Todos ({containers?.length || 0})
                    </SelectItem>
                    {Object.entries(CONTAINER_STATUS_CONFIG).map(([status, config]) => (
                      <SelectItem key={status} value={status}>
                        {config.label} ({statusCounts[status] || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort by */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ordenar por
                </label>
                <Select 
                  value={filters.sortBy} 
                  onValueChange={(value) => handleSort(value as FilterState['sortBy'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Data de Criação</SelectItem>
                    <SelectItem value="estimated_arrival">Previsão de Chegada</SelectItem>
                    <SelectItem value="container_number">Número do Container</SelectItem>
                    <SelectItem value="supplier_name">Fornecedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ordem
                </label>
                <Button
                  variant="outline"
                  onClick={() => setFilters(prev => ({ 
                    ...prev, 
                    sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' 
                  }))}
                  className="w-full justify-start"
                >
                  {filters.sortOrder === 'asc' ? (
                    <SortAsc className="h-4 w-4 mr-2" />
                  ) : (
                    <SortDesc className="h-4 w-4 mr-2" />
                  )}
                  {filters.sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
                </Button>
              </div>
            </div>

            {/* Active filters */}
            {(filters.status !== 'all' || filters.search) && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <span className="text-sm font-medium text-gray-700">Filtros ativos:</span>
                
                {filters.status !== 'all' && (
                  <Badge variant="secondary">
                    Status: {CONTAINER_STATUS_CONFIG[filters.status]?.label || filters.status}
                  </Badge>
                )}
                
                {filters.search && (
                  <Badge variant="secondary">
                    Busca: "{filters.search}"
                  </Badge>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({
                    status: 'all',
                    search: '',
                    sortBy: 'created_at',
                    sortOrder: 'desc'
                  })}
                >
                  Limpar filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!containers || containers.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Ship className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhum container encontrado
            </h3>
            <p className="text-gray-600 text-center mb-6">
              {filters.search || filters.status !== 'all' 
                ? 'Nenhum container corresponde aos filtros aplicados.'
                : 'Não há containers cadastrados ainda.'}
            </p>
            
            {filters.search || filters.status !== 'all' ? (
              <Button
                variant="outline"
                onClick={() => setFilters({
                  status: 'all',
                  search: '',
                  sortBy: 'created_at',
                  sortOrder: 'desc'
                })}
              >
                Limpar Filtros
              </Button>
            ) : (
              <Button onClick={() => setShowWizard(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Container
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Container list */}
      {!isLoading && sortedContainers && sortedContainers.length > 0 && (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4'
            : 'space-y-4'
        }>
          {sortedContainers.map((container: any) => (
            <ContainerCard
              key={container.id}
              container={container}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              compact={compactView}
              showActions={showActions}
            />
          ))}
        </div>
      )}

      {/* Wizards and Modals */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Registrar Nova Chegada de Container</DialogTitle>
            <DialogDescription>
              Preencha as informações do container e faça o registro fotográfico
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto">
            <ContainerArrivalWizard
              onComplete={() => {
                setShowWizard(false);
                refetch();
              }}
              onCancel={() => setShowWizard(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Container details modal */}
      {selectedContainer && (
        <Dialog open={!!selectedContainer} onOpenChange={() => setSelectedContainer(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                Container {selectedContainer.containerNumber}
              </DialogTitle>
              <DialogDescription>
                Detalhes completos do container
              </DialogDescription>
            </DialogHeader>
            {/* TODO: Add ContainerDetails component */}
            <div className="p-4">
              <p>Detalhes completos em desenvolvimento...</p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}