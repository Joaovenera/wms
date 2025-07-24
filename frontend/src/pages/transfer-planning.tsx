import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TransferPlanningWizard } from "../components/transfer-planning-wizard";
import { TransferDetailsModal } from "../components/transfer-details-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Package, FileText, CheckCircle, Clock, AlertTriangle, Eye } from "lucide-react";
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

  // Fetch transfer requests
  const { data: transferRequests, isLoading, refetch } = useQuery({
    queryKey: ['/api/transfer-requests'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/transfer-requests');
      return await res.json();
    },
  });

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'planejamento': { label: 'Planejamento', variant: 'secondary' as const, icon: Clock },
      'aprovado': { label: 'Aprovado', variant: 'default' as const, icon: CheckCircle },
      'carregamento': { label: 'Carregamento', variant: 'outline' as const, icon: Package },
      'transito': { label: 'Em Trânsito', variant: 'default' as const, icon: Truck },
      'finalizado': { label: 'Finalizado', variant: 'default' as const, icon: CheckCircle },
      'cancelado': { label: 'Cancelado', variant: 'destructive' as const, icon: AlertTriangle },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || 
      { label: status, variant: 'outline' as const, icon: Clock };
    
    const Icon = statusInfo.icon;
    
    return (
      <Badge variant={statusInfo.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {statusInfo.label}
      </Badge>
    );
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

  const handleTransferCreated = (transferId: number) => {
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

  const planningRequests = transferRequests?.filter((req: TransferRequest) => 
    req.status === 'planejamento'
  ) || [];
  
  const approvedRequests = transferRequests?.filter((req: TransferRequest) => 
    ['aprovado', 'carregamento'].includes(req.status)
  ) || [];
  
  const transitRequests = transferRequests?.filter((req: TransferRequest) => 
    ['transito', 'finalizado'].includes(req.status)
  ) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transferências</h1>
          <p className="text-muted-foreground">
            Gerencie pedidos de transferência com controle de cubagem
          </p>
        </div>
        
        <Button
          onClick={() => setShowNewTransfer(true)}
          className="flex items-center gap-2"
        >
          <Package className="h-4 w-4" />
          Nova Transferência
        </Button>
      </div>

      {showNewTransfer ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Nova Transferência</h2>
            <Button
              variant="outline"
              onClick={() => setShowNewTransfer(false)}
            >
              Voltar à Lista
            </Button>
          </div>
          
          <TransferPlanningWizard onTransferCreated={handleTransferCreated} />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="planning" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Planejamento ({planningRequests.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Aprovados ({approvedRequests.length})
            </TabsTrigger>
            <TabsTrigger value="transit" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Em Trânsito ({transitRequests.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Todos ({transferRequests?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="planning" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Pedidos em Planejamento
                </CardTitle>
                <CardDescription>
                  Pedidos que ainda estão sendo planejados e podem ser editados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {planningRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhum pedido em planejamento</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {planningRequests.map((request: TransferRequest) => (
                      <div key={request.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{request.code}</h3>
                            <p className="text-sm text-gray-600">
                              {request.fromLocation} → {request.toLocation}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadge(request.status)}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDetails(request.id)}
                              className="flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              Ver Detalhes
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Veículo:</span>
                            <p className="font-medium">{request.vehicleName}</p>
                            <p className="text-xs text-gray-500">{request.vehicleCode}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Cubagem:</span>
                            <p className="font-medium">
                              {parseFloat(request.totalCubicVolume).toFixed(2)} m³
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Utilização:</span>
                            <p className="font-medium">
                              {parseFloat(request.capacityUsagePercent).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Criado em:</span>
                            <p className="font-medium">{formatDate(request.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Pedidos Aprovados
                </CardTitle>
                <CardDescription>
                  Pedidos aprovados aguardando carregamento ou em carregamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {approvedRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhum pedido aprovado</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {approvedRequests.map((request: TransferRequest) => (
                      <div key={request.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{request.code}</h3>
                            <p className="text-sm text-gray-600">
                              {request.fromLocation} → {request.toLocation}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadge(request.status)}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDetails(request.id)}
                              className="flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              Ver Detalhes
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Veículo:</span>
                            <p className="font-medium">{request.vehicleName}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Cubagem:</span>
                            <p className="font-medium">
                              {parseFloat(request.totalCubicVolume).toFixed(2)} m³
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Utilização:</span>
                            <p className="font-medium">
                              {parseFloat(request.capacityUsagePercent).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Criado:</span>
                            <p className="font-medium">{formatDate(request.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Em Trânsito e Finalizados
                </CardTitle>
                <CardDescription>
                  Pedidos em trânsito ou já finalizados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transitRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhum pedido em trânsito</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {transitRequests.map((request: TransferRequest) => (
                      <div key={request.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{request.code}</h3>
                            <p className="text-sm text-gray-600">
                              {request.fromLocation} → {request.toLocation}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadge(request.status)}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDetails(request.id)}
                              className="flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              Ver Detalhes
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Veículo:</span>
                            <p className="font-medium">{request.vehicleName}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Cubagem:</span>
                            <p className="font-medium">
                              {parseFloat(request.totalCubicVolume).toFixed(2)} m³
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Utilização:</span>
                            <p className="font-medium">
                              {parseFloat(request.capacityUsagePercent).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Criado:</span>
                            <p className="font-medium">{formatDate(request.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Todas as Transferências
                </CardTitle>
                <CardDescription>
                  Histórico completo de todas as transferências
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!transferRequests || transferRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhuma transferência encontrada</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {transferRequests.map((request: TransferRequest) => (
                      <div key={request.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{request.code}</h3>
                            <p className="text-sm text-gray-600">
                              {request.fromLocation} → {request.toLocation}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadge(request.status)}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDetails(request.id)}
                              className="flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              Ver Detalhes
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Veículo:</span>
                            <p className="font-medium">{request.vehicleName}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Cubagem:</span>
                            <p className="font-medium">
                              {parseFloat(request.totalCubicVolume).toFixed(2)} m³
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Utilização:</span>
                            <p className="font-medium">
                              {parseFloat(request.capacityUsagePercent).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Criado:</span>
                            <p className="font-medium">{formatDate(request.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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