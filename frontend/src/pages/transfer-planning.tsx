import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TransferPlanningWizard } from "../components/transfer-planning-wizard";
import { TransferDetailsModal } from "../components/transfer-details-modal";
import { TransferCard } from "../components/transfer-card";
import { TransferListSkeleton } from "../components/transfer-list-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Truck, 
  Package, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Eye, 
  Plus,
  ArrowLeft,
  Search,
  Filter,
  RefreshCw,
  Download,
  BarChart3,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TransferRequest {
  id: number;
  code: string;
  status: string;
  fromLocation: string;
  toLocation: string;
  totalCubicVolume: string;
  effectiveCapacity: string;
  capacityUsagePercent: string;
  createdAt: string;
  vehicleName: string;
  vehicleCode: string;
  createdByName: string;
}

export default function TransferPlanningPage() {
  const [activeTab, setActiveTab] = useState("planning");
  const [showNewTransfer, setShowNewTransfer] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<number | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Fetch transfer requests
  const { data: transferRequests, refetch, isLoading, error } = useQuery({
    queryKey: ['/api/transfer-requests'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/transfer-requests');
      return await res.json();
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Filter and sort requests
  const getFilteredRequests = (requests: TransferRequest[]) => {
    if (!requests) return [];
    
    let filtered = requests;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(req => 
        req.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.fromLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.toLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.vehicleName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(req => req.status === statusFilter);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "code":
          return a.code.localeCompare(b.code);
        case "capacity":
          return parseFloat(b.capacityUsagePercent) - parseFloat(a.capacityUsagePercent);
        default:
          return 0;
      }
    });
    
    return filtered;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleTransferCreated = () => {
    setShowNewTransfer(false);
    setActiveTab("planning");
    refetch();
  };

  const handleViewDetails = (transferId: number) => {
    setSelectedTransferId(transferId);
    setShowDetailsModal(true);
  };

  const handleDetailsModalClose = () => {
    setShowDetailsModal(false);
    setSelectedTransferId(null);
    refetch(); // Atualizar lista após possível mudança de status
  };

  const allRequests = transferRequests || [];
  const filteredRequests = getFilteredRequests(allRequests);
  
  const planningRequests = filteredRequests.filter((req: TransferRequest) => 
    req.status === 'planejamento'
  );
  
  const approvedRequests = filteredRequests.filter((req: TransferRequest) => 
    ['aprovado', 'carregamento'].includes(req.status)
  );
  
  const transitRequests = filteredRequests.filter((req: TransferRequest) => 
    ['transito', 'finalizado'].includes(req.status)
  );
  
  const getStatusCounts = () => {
    if (!transferRequests) return { planning: 0, approved: 0, transit: 0, all: 0 };
    
    return {
      planning: transferRequests.filter((req: TransferRequest) => req.status === 'planejamento').length,
      approved: transferRequests.filter((req: TransferRequest) => ['aprovado', 'carregamento'].includes(req.status)).length,
      transit: transferRequests.filter((req: TransferRequest) => ['transito', 'finalizado'].includes(req.status)).length,
      all: transferRequests.length
    };
  };
  
  const statusCounts = getStatusCounts();

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="max-w-md mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar transferências. Tente novamente mais tarde.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          {showNewTransfer ? (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewTransfer(false)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Nova Transferência</h1>
                <p className="text-muted-foreground">
                  Crie um novo pedido de transferência com controle de cubagem
                </p>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold tracking-tight">Transferências</h1>
              <p className="text-muted-foreground">
                Gerencie pedidos de transferência com controle de cubagem
              </p>
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Carregando transferências...
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {!showNewTransfer && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Relatórios
              </Button>
            </>
          )}
          
          {!showNewTransfer && (
            <Button
              onClick={() => setShowNewTransfer(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nova Transferência
            </Button>
          )}
        </div>
      </div>

      {showNewTransfer ? (
        <TransferPlanningWizard onTransferCreated={handleTransferCreated} />
      ) : (
        <>
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar por código, origem, destino ou veículo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="planejamento">Planejamento</SelectItem>
                      <SelectItem value="aprovado">Aprovado</SelectItem>
                      <SelectItem value="carregamento">Carregamento</SelectItem>
                      <SelectItem value="transito">Em Trânsito</SelectItem>
                      <SelectItem value="finalizado">Finalizado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Mais recentes</SelectItem>
                      <SelectItem value="oldest">Mais antigas</SelectItem>
                      <SelectItem value="code">Código</SelectItem>
                      <SelectItem value="capacity">Utilização</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {(searchTerm || statusFilter !== "all") && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                  <span>Mostrando {filteredRequests.length} de {transferRequests?.length || 0} transferências</span>
                  {searchTerm && (
                    <Badge variant="secondary" className="text-xs">
                      Busca: "{searchTerm}"
                    </Badge>
                  )}
                  {statusFilter !== "all" && (
                    <Badge variant="secondary" className="text-xs">
                      Status: {statusFilter}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!showNewTransfer && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="planning" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Planejamento</span>
              <span className="sm:hidden">Plan.</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {isLoading ? "..." : statusCounts.planning}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Aprovados</span>
              <span className="sm:hidden">Aprov.</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {isLoading ? "..." : statusCounts.approved}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="transit" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Em Trânsito</span>
              <span className="sm:hidden">Trâns.</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {isLoading ? "..." : statusCounts.transit}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Todos</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {isLoading ? "..." : statusCounts.all}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="planning" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  Pedidos em Planejamento
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Pedidos que ainda estão sendo planejados e podem ser editados
                </p>
              </div>
              {planningRequests.length > 0 && (
                <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                  {planningRequests.length} pedido{planningRequests.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            
            {isLoading ? (
              <TransferListSkeleton />
            ) : planningRequests.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm || statusFilter !== "all" ? "Nenhum resultado encontrado" : "Nenhum pedido em planejamento"}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm || statusFilter !== "all" 
                      ? "Tente ajustar os filtros de busca"
                      : "Clique em 'Nova Transferência' para criar o primeiro pedido"
                    }
                  </p>
                  {!searchTerm && statusFilter === "all" && (
                    <Button onClick={() => setShowNewTransfer(true)} className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Nova Transferência
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {planningRequests.map((request: TransferRequest) => (
                  <TransferCard
                    key={request.id}
                    request={request}
                    onViewDetails={handleViewDetails}
                    showActions={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Pedidos Aprovados
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Pedidos aprovados aguardando carregamento ou em carregamento
                </p>
              </div>
              {approvedRequests.length > 0 && (
                <Badge variant="outline" className="text-green-700 border-green-300">
                  {approvedRequests.length} pedido{approvedRequests.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            
            {isLoading ? (
              <TransferListSkeleton />
            ) : approvedRequests.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <CheckCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm || statusFilter !== "all" ? "Nenhum resultado encontrado" : "Nenhum pedido aprovado"}
                  </h3>
                  <p className="text-gray-500">
                    {searchTerm || statusFilter !== "all" 
                      ? "Tente ajustar os filtros de busca"
                      : "Os pedidos aparecerão aqui após serem aprovados"
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {approvedRequests.map((request: TransferRequest) => (
                  <TransferCard
                    key={request.id}
                    request={request}
                    onViewDetails={handleViewDetails}
                    showActions={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transit" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  Em Trânsito e Finalizados
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Pedidos em trânsito ou já finalizados
                </p>
              </div>
              {transitRequests.length > 0 && (
                <Badge variant="outline" className="text-blue-700 border-blue-300">
                  {transitRequests.length} pedido{transitRequests.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            
            {isLoading ? (
              <TransferListSkeleton />
            ) : transitRequests.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Truck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm || statusFilter !== "all" ? "Nenhum resultado encontrado" : "Nenhum pedido em trânsito"}
                  </h3>
                  <p className="text-gray-500">
                    {searchTerm || statusFilter !== "all" 
                      ? "Tente ajustar os filtros de busca"
                      : "Os pedidos aparecerão aqui quando iniciarem o transporte"
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {transitRequests.map((request: TransferRequest) => (
                  <TransferCard
                    key={request.id}
                    request={request}
                    onViewDetails={handleViewDetails}
                    showActions={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  Todas as Transferências
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Histórico completo de todas as transferências
                </p>
              </div>
              {filteredRequests.length > 0 && (
                <Badge variant="outline" className="text-gray-700 border-gray-300">
                  {filteredRequests.length} pedido{filteredRequests.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            
            {isLoading ? (
              <TransferListSkeleton />
            ) : filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm || statusFilter !== "all" ? "Nenhum resultado encontrado" : "Nenhuma transferência encontrada"}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm || statusFilter !== "all" 
                      ? "Tente ajustar os filtros de busca ou limpar os filtros"
                      : "Clique em 'Nova Transferência' para criar a primeira transferência"
                    }
                  </p>
                  {searchTerm || statusFilter !== "all" ? (
                    <div className="flex gap-2 justify-center">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSearchTerm("");
                          setStatusFilter("all");
                        }}
                      >
                        Limpar Filtros
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={() => setShowNewTransfer(true)} className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Nova Transferência
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredRequests.map((request: TransferRequest) => (
                  <TransferCard
                    key={request.id}
                    request={request}
                    onViewDetails={handleViewDetails}
                    showActions={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Modal de Detalhes */}
      <TransferDetailsModal
        transferId={selectedTransferId}
        open={showDetailsModal}
        onOpenChange={handleDetailsModalClose}
      />
    </div>
  );
}