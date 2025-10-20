import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TransferPlanningWizard } from "../components/transfer-planning-wizard";
import { ArrivalWizard } from "../components/arrival-wizard";
import { ContainerArrivalWizard } from "../components/container-arrival-wizard";
import { TruckArrivalWizard } from "../components/truck-arrival-wizard";
import { DeliveryArrivalWizard } from "../components/delivery-arrival-wizard";
import { WithdrawalWizard } from "../components/withdrawal-wizard";
import { ArrivalSelectionWizard } from "../components/arrival-selection-wizard";
import { DepartureSelectionWizard } from "../components/departure-selection-wizard";
import { ContainerList } from "../components/container-list";
import { ContainerDashboard } from "../components/container-dashboard";
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
  Loader2,
  PackageOpen,
  ArrowDown,
  Ship,
  ArrowRight,
  UserCheck
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ArrivalType, DepartureType } from "@/types/container";
import { PlanApprovalDialog } from "../components/plan-approval-dialog";

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

type PageMode = 
  | "list"
  | "arrival-selection" 
  | "departure-selection"
  | "container-arrival"
  | "truck-arrival" 
  | "delivery-arrival"
  | "transfer"
  | "withdrawal";

export default function TransferPlanningPage() {
  const [activeTab, setActiveTab] = useState("planning");
  const [pageMode, setPageMode] = useState<PageMode>("list");
  const [selectedTransferId, setSelectedTransferId] = useState<number | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  
  // Approval-related state
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedRequestForApproval, setSelectedRequestForApproval] = useState<TransferRequest | null>(null);

  const queryClient = useQueryClient();

  // Fetch transfer requests
  const { data: transferRequests, refetch, isLoading, error } = useQuery({
    queryKey: ['/api/transfer-requests'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/transfer-requests');
      return await res.json();
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Approve plan mutation
  const approvePlanMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      const res = await apiRequest('PUT', `/api/transfer-requests/${id}/status`, {
        status: 'aprovado',
        notes
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests'] });
      setShowApprovalDialog(false);
      setSelectedRequestForApproval(null);
    },
  });

  // Reject plan mutation
  const rejectPlanMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      const res = await apiRequest('PUT', `/api/transfer-requests/${id}/status`, {
        status: 'cancelado',
        notes
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests'] });
      setShowApprovalDialog(false);
      setSelectedRequestForApproval(null);
    },
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

  const handleArrivalTypeSelect = (type: ArrivalType) => {
    switch (type) {
      case 'container':
        setPageMode('container-arrival');
        break;
      case 'truck':
        setPageMode('truck-arrival');
        break;
      case 'delivery':
        setPageMode('delivery-arrival');
        break;
    }
  };

  const handleDepartureTypeSelect = (type: DepartureType) => {
    switch (type) {
      case 'transfer':
        setPageMode('transfer');
        break;
      case 'withdrawal':
        setPageMode('withdrawal');
        break;
    }
  };

  const handlePlanCreated = () => {
    setPageMode("list");
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

  const handleApproveRequest = (request: TransferRequest) => {
    setSelectedRequestForApproval(request);
    setShowApprovalDialog(true);
  };

  const handleConfirmApproval = (notes?: string) => {
    if (selectedRequestForApproval) {
      approvePlanMutation.mutate({
        id: selectedRequestForApproval.id,
        notes
      });
    }
  };

  const handleConfirmRejection = (notes: string) => {
    if (selectedRequestForApproval) {
      rejectPlanMutation.mutate({
        id: selectedRequestForApproval.id,
        notes
      });
    }
  };

  const allRequests = transferRequests || [];
  const filteredRequests = getFilteredRequests(allRequests);
  
  // Separar transferências (saídas) de chegadas baseado nas notes
  const transferOnlyRequests = filteredRequests.filter((req: TransferRequest) => 
    !req.notes?.includes('CHEGADA DE MERCADORIA')
  );
  
  const arrivalOnlyRequests = filteredRequests.filter((req: TransferRequest) => 
    req.notes?.includes('CHEGADA DE MERCADORIA')
  );
  
  const planningRequests = transferOnlyRequests.filter((req: TransferRequest) => 
    req.status === 'planejamento'
  );
  
  const approvedRequests = transferOnlyRequests.filter((req: TransferRequest) => 
    ['aprovado', 'carregamento'].includes(req.status)
  );
  
  const transitRequests = transferOnlyRequests.filter((req: TransferRequest) => 
    ['transito', 'finalizado'].includes(req.status)
  );
  
  const getStatusCounts = () => {
    if (!transferRequests) return { planning: 0, approved: 0, transit: 0, arrivals: 0, all: 0 };
    
    return {
      planning: transferOnlyRequests.filter((req: TransferRequest) => req.status === 'planejamento').length,
      approved: transferOnlyRequests.filter((req: TransferRequest) => ['aprovado', 'carregamento'].includes(req.status)).length,
      transit: transferOnlyRequests.filter((req: TransferRequest) => ['transito', 'finalizado'].includes(req.status)).length,
      arrivals: arrivalOnlyRequests.length,
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
          {pageMode !== "list" ? (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPageMode("list")}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <div>
                {pageMode === "arrival-selection" && (
                  <>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                      <PackageOpen className="h-8 w-8 text-green-600" />
                      Planejar Chegada
                    </h1>
                    <p className="text-muted-foreground">
                      Selecione o tipo de chegada para planejar
                    </p>
                  </>
                )}
                {pageMode === "departure-selection" && (
                  <>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                      <ArrowRight className="h-8 w-8 text-blue-600" />
                      Planejar Saída
                    </h1>
                    <p className="text-muted-foreground">
                      Selecione o tipo de saída para planejar
                    </p>
                  </>
                )}
                {pageMode === "container-arrival" && (
                  <>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                      <Ship className="h-8 w-8 text-blue-600" />
                      Planejar Container
                    </h1>
                    <p className="text-muted-foreground">
                      Criar plano de chegada de container
                    </p>
                  </>
                )}
                {pageMode === "truck-arrival" && (
                  <>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                      <Truck className="h-8 w-8 text-green-600" />
                      Planejar Chegada de Caminhão
                    </h1>
                    <p className="text-muted-foreground">
                      Criar plano de chegada via caminhão
                    </p>
                  </>
                )}
                {pageMode === "delivery-arrival" && (
                  <>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                      <Package className="h-8 w-8 text-purple-600" />
                      Planejar Entrega
                    </h1>
                    <p className="text-muted-foreground">
                      Criar plano de entrega via transportadora
                    </p>
                  </>
                )}
                {pageMode === "transfer" && (
                  <>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                      <Truck className="h-8 w-8 text-blue-600" />
                      Planejar Transferência
                    </h1>
                    <p className="text-muted-foreground">
                      Criar plano de transferência com veículo e motorista
                    </p>
                  </>
                )}
                {pageMode === "withdrawal" && (
                  <>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                      <UserCheck className="h-8 w-8 text-orange-600" />
                      Planejar Retirada
                    </h1>
                    <p className="text-muted-foreground">
                      Criar plano de retirada de mercadoria por cliente
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-blue-50 to-orange-50 p-6 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-blue-800">Planejamento de Operações</h1>
                  <p className="text-blue-700 mt-1">
                    Crie e gerencie planos de chegadas e saídas de mercadoria
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-sm text-blue-600">
                    <Clock className="h-4 w-4" />
                    <span>Fase de Planejamento - Criação e Aprovação</span>
                  </div>
                </div>
              </div>
              
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-blue-600 mt-4">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Carregando dados...
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {pageMode === "list" && (
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
          
          {pageMode === "list" && (
            <>
              <Button
                onClick={() => setPageMode("arrival-selection")}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <PackageOpen className="h-4 w-4" />
                Planejar Chegada
              </Button>
              <Button
                onClick={() => setPageMode("departure-selection")}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <ArrowRight className="h-4 w-4" />
                Planejar Saída
              </Button>
            </>
          )}
        </div>
      </div>

      {pageMode === "arrival-selection" ? (
        <ArrivalSelectionWizard onArrivalTypeSelect={handleArrivalTypeSelect} />
      ) : pageMode === "departure-selection" ? (
        <DepartureSelectionWizard onDepartureTypeSelect={handleDepartureTypeSelect} />
      ) : pageMode === "container-arrival" ? (
        <ContainerArrivalWizard onPlanCreated={handlePlanCreated} />
      ) : pageMode === "truck-arrival" ? (
        <TruckArrivalWizard onPlanCreated={handlePlanCreated} />
      ) : pageMode === "delivery-arrival" ? (
        <DeliveryArrivalWizard onPlanCreated={handlePlanCreated} />
      ) : pageMode === "transfer" ? (
        <TransferPlanningWizard onPlanCreated={handlePlanCreated} />
      ) : pageMode === "withdrawal" ? (
        <WithdrawalWizard onPlanCreated={handlePlanCreated} />
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

      {pageMode === "list" && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="planning" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Planejamento</span>
              <span className="sm:hidden">Plan.</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {isLoading ? "..." : statusCounts.planning}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="approval" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-orange-600" />
              <span className="hidden sm:inline">Aprovação</span>
              <span className="sm:hidden">Apr.</span>
              <Badge variant="secondary" className="ml-1 text-xs bg-orange-100 text-orange-800">
                {isLoading ? "..." : statusCounts.planning}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="hidden sm:inline">Aprovados</span>
              <span className="sm:hidden">Aprov.</span>
              <Badge variant="secondary" className="ml-1 text-xs bg-green-100 text-green-800">
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
            <TabsTrigger value="arrivals" className="flex items-center gap-2">
              <PackageOpen className="h-4 w-4 text-green-600" />
              <span className="hidden sm:inline">Chegadas</span>
              <span className="sm:hidden">Cheg.</span>
              <Badge variant="secondary" className="ml-1 text-xs bg-green-100 text-green-800">
                {isLoading ? "..." : statusCounts.arrivals}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="containers" className="flex items-center gap-2">
              <Ship className="h-4 w-4 text-blue-600" />
              <span className="hidden sm:inline">Containers</span>
              <span className="sm:hidden">Cont.</span>
              <Badge variant="secondary" className="ml-1 text-xs bg-blue-100 text-blue-800">
                {isLoading ? "..." : "0"}
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
                    <div className="flex gap-2 justify-center">
                      <Button onClick={() => setPageMode("arrival-selection")} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                        <PackageOpen className="h-4 w-4" />
                        Nova Chegada
                      </Button>
                      <Button onClick={() => setPageMode("departure-selection")} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
                        <ArrowRight className="h-4 w-4" />
                        Nova Saída
                      </Button>
                    </div>
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

          <TabsContent value="approval" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-orange-600" />
                  Aprovação de Planos
                </h2>
                <p className="text-muted-foreground">Planos aguardando aprovação para execução</p>
              </div>
            </div>

            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por código, origem, destino..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Mais recentes</SelectItem>
                  <SelectItem value="oldest">Mais antigos</SelectItem>
                  <SelectItem value="code">Código</SelectItem>
                  <SelectItem value="capacity">Capacidade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <TransferListSkeleton key={i} />
                ))}
              </div>
            ) : error ? (
              <Alert className="border-red-200 bg-red-50 text-red-800">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Erro ao carregar planos: {error instanceof Error ? error.message : 'Erro desconhecido'}
                </AlertDescription>
              </Alert>
            ) : planningRequests.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum plano aguardando aprovação</h3>
                <p className="text-gray-500">Todos os planos foram aprovados ou não há planos em planejamento</p>
              </div>
            ) : (
              <div className="space-y-4">
                {planningRequests.map((request: TransferRequest) => (
                  <Card key={request.id} className="border-orange-200 bg-orange-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold">{request.code}</h3>
                          <p className="text-sm text-gray-600">
                            {request.type === 'transfer-plan' && `${request.fromLocation} → ${request.toLocation}`}
                            {request.type === 'container-arrival-plan' && `Chegada de Container - ${request.supplierName || 'Fornecedor não especificado'}`}
                            {request.type === 'truck-arrival-plan' && `Chegada de Caminhão - ${request.supplierName || 'Fornecedor não especificado'}`}
                            {request.type === 'delivery-arrival-plan' && `Entrega via Transportadora - ${request.transporterName || request.supplierName || 'Não especificado'}`}
                            {request.type === 'withdrawal-plan' && `Retirada do Cliente - ${request.clientInfo?.clientName || 'Cliente não especificado'}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="flex items-center gap-1 border-orange-300 text-orange-700">
                            <Clock className="h-3 w-3" />
                            Aguardando Aprovação
                          </Badge>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(request.id)}
                              className="flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              Detalhes
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApproveRequest(request)}
                              className="flex items-center gap-1 bg-orange-600 hover:bg-orange-700"
                            >
                              <CheckCircle className="h-3 w-3" />
                              Revisar e Aprovar
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Criado por:</span>
                          <p className="font-medium">{request.createdByName}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Data criação:</span>
                          <p className="font-medium">{formatDate(request.createdAt)}</p>
                        </div>
                        {request.vehicleName && (
                          <div>
                            <span className="text-gray-600">Veículo:</span>
                            <p className="font-medium">{request.vehicleName}</p>
                          </div>
                        )}
                        {request.capacityUsagePercent && (
                          <div>
                            <span className="text-gray-600">Utilização:</span>
                            <p className="font-medium">{parseFloat(request.capacityUsagePercent).toFixed(1)}%</p>
                          </div>
                        )}
                      </div>
                      
                      {request.notes && (
                        <div className="mt-3 p-3 bg-white rounded border border-orange-200">
                          <p className="text-sm">
                            <strong>Observações:</strong> {request.notes}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
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
                    <div className="flex gap-2 justify-center">
                      <Button onClick={() => setPageMode("arrival-selection")} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                        <PackageOpen className="h-4 w-4" />
                        Nova Chegada
                      </Button>
                      <Button onClick={() => setPageMode("departure-selection")} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
                        <ArrowRight className="h-4 w-4" />
                        Nova Saída
                      </Button>
                    </div>
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

          <TabsContent value="arrivals" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <PackageOpen className="h-5 w-5 text-green-600" />
                  Chegadas de Mercadoria
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Registros de chegada e recebimento de mercadorias
                </p>
              </div>
              {arrivalOnlyRequests.length > 0 && (
                <Badge variant="outline" className="text-green-700 border-green-300">
                  {arrivalOnlyRequests.length} chegada{arrivalOnlyRequests.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            
            {isLoading ? (
              <TransferListSkeleton />
            ) : arrivalOnlyRequests.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <PackageOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm || statusFilter !== "all" ? "Nenhum resultado encontrado" : "Nenhuma chegada registrada"}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm || statusFilter !== "all" 
                      ? "Tente ajustar os filtros de busca"
                      : "Clique em 'Nova Chegada' para registrar a primeira chegada de mercadoria"
                    }
                  </p>
                  {!searchTerm && statusFilter === "all" && (
                    <Button onClick={() => setPageMode("arrival-selection")} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                      <PackageOpen className="h-4 w-4" />
                      Nova Chegada
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {arrivalOnlyRequests.map((request: TransferRequest) => (
                  <div key={request.id} className="relative">
                    <div className="absolute top-3 right-3 z-10">
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        <ArrowDown className="h-3 w-3 mr-1" />
                        Chegada
                      </Badge>
                    </div>
                    <TransferCard
                      request={request}
                      onViewDetails={handleViewDetails}
                      showActions={true}
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="containers" className="space-y-6">
            <ContainerDashboard 
              onNewContainer={() => setPageMode("new-container")}
            />
            <ContainerList 
              showActions={true}
              compactView={false}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Modal de Detalhes */}
      <TransferDetailsModal
        transferId={selectedTransferId}
        open={showDetailsModal}
        onOpenChange={handleDetailsModalClose}
      />

      {/* Plan Approval Dialog */}
      <PlanApprovalDialog
        isOpen={showApprovalDialog}
        onClose={() => {
          setShowApprovalDialog(false);
          setSelectedRequestForApproval(null);
        }}
        transferRequest={selectedRequestForApproval}
        onApprove={handleConfirmApproval}
        onReject={handleConfirmRejection}
        isSubmitting={approvePlanMutation.isPending || rejectPlanMutation.isPending}
      />
    </div>
  );
}