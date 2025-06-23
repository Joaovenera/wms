import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Ucp, type Pallet, type Position, type Product } from "@shared/schema";
import { 
  Plus, Search, Trash2, Package, QrCode, MapPin, 
  Activity, Clock, Archive, RefreshCw, Filter, Eye,
  TrendingUp, BarChart3, Layers, Move, AlertCircle, Camera,
  History, PackagePlus, Users, Calendar, Hash, Truck
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import QRCodeDialog from "@/components/qr-code-dialog";
import QrScanner from "@/components/qr-scanner";
import UcpCreationWizard from "@/components/ucp-creation-wizard";
import UcpHistoryViewer from "@/components/ucp-history-viewer";

interface UcpWithRelations extends Ucp {
  pallet?: Pallet;
  position?: Position;
  items?: Array<{
    id: number;
    quantity: string;
    product?: Product;
    lot?: string;
    expiryDate?: string;
    internalCode?: string;
  }>;
}

interface UcpStats {
  total: number;
  active: number;
  empty: number;
  archived: number;
}

export default function ComprehensiveUCPs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isCreationWizardOpen, setIsCreationWizardOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [selectedUcp, setSelectedUcp] = useState<UcpWithRelations | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyUcpId, setHistoryUcpId] = useState<number | null>(null);
  const [dismantleDialog, setDismantleDialog] = useState<{ isOpen: boolean; ucp: UcpWithRelations | null }>({ isOpen: false, ucp: null });
  const { toast } = useToast();

  // Debounced search with automatic refresh
  useEffect(() => {
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/ucps'] });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, includeArchived]);

  const { data: ucps, isLoading, refetch } = useQuery<UcpWithRelations[]>({
    queryKey: ['/api/ucps', { includeArchived, status: statusFilter }],
    refetchInterval: 30000,
  });

  const { data: ucpStats } = useQuery<UcpStats>({
    queryKey: ['/api/ucps/stats'],
    refetchInterval: 30000,
  });

  // UCP Management Operations
  const dismantleUcpMutation = useMutation({
    mutationFn: async ({ ucpId, reason }: { ucpId: number; reason?: string }) => {
      await apiRequest('POST', `/api/ucps/${ucpId}/dismantle`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ucps'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ucps/stats'] });
      toast({
        title: "Sucesso",
        description: "UCP desmontada com sucesso",
      });
      setDismantleDialog({ isOpen: false, ucp: null });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleScanResult = (code: string) => {
    const foundUcp = ucps?.find(ucp => ucp.code === code);
    if (foundUcp) {
      setSelectedUcp(foundUcp);
      setIsQRDialogOpen(true);
    } else {
      toast({
        title: "UCP não encontrada",
        description: `Nenhuma UCP encontrada com o código: ${code}`,
        variant: "destructive",
      });
    }
    setIsScannerOpen(false);
  };

  const openHistory = (ucp: UcpWithRelations) => {
    setHistoryUcpId(ucp.id);
    setIsHistoryOpen(true);
  };

  const openDismantleDialog = (ucp: UcpWithRelations) => {
    setDismantleDialog({ isOpen: true, ucp });
  };

  const handleDismantleConfirm = () => {
    if (dismantleDialog.ucp) {
      dismantleUcpMutation.mutate({ 
        ucpId: dismantleDialog.ucp.id, 
        reason: "Desmontagem manual pelo usuário" 
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Ativa</Badge>;
      case "empty":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Vazia</Badge>;
      case "archived":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Arquivada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredUcps = ucps?.filter(ucp => {
    const matchesSearch = ucp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ucp.pallet?.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ucp.position?.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || ucp.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const statsCards = [
    {
      title: "Total UCPs",
      value: ucpStats?.total || 0,
      icon: Package,
      color: "bg-blue-500",
      description: "Total de UCPs no sistema"
    },
    {
      title: "UCPs Ativas",
      value: ucpStats?.active || 0,
      icon: Activity,
      color: "bg-green-500",
      description: "UCPs com produtos ativos"
    },
    {
      title: "UCPs Vazias",
      value: ucpStats?.empty || 0,
      icon: Archive,
      color: "bg-yellow-500",
      description: "UCPs sem produtos"
    },
    {
      title: "UCPs Arquivadas",
      value: ucpStats?.archived || 0,
      icon: Clock,
      color: "bg-gray-500",
      description: "UCPs desmontadas"
    }
  ];

  return (
    <div className="p-6 space-y-6 animate-fadeInUp">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Gerenciamento de UCPs
          </h1>
          <p className="text-muted-foreground mt-1">
            Sistema completo de controle de Unidades de Carga Paletizada
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsScannerOpen(true)}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Camera className="h-4 w-4 mr-2" />
            Escanear QR
          </Button>
          <Button
            onClick={() => setIsCreationWizardOpen(true)}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova UCP
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, index) => (
          <Card key={stat.title} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadeInUp" style={{ animationDelay: `${index * 100}ms` }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {stat.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold animate-countUp">
                      {stat.value}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${stat.color} bg-opacity-10`}>
                  <stat.icon className={`h-6 w-6 ${stat.color.replace('bg-', 'text-')}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters and Search */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código UCP, pallet ou posição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    refetch();
                  }
                }}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="empty">Vazias</SelectItem>
                <SelectItem value="archived">Arquivadas</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <Layers className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UCPs Grid/List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2 mb-4" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredUcps.length > 0 ? (
        <div className={viewMode === "grid" 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          : "space-y-4"
        }>
          {filteredUcps.map((ucp, index) => (
            <Card 
              key={ucp.id} 
              className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group animate-fadeInUp"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
                      <Package className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg group-hover:text-blue-600 transition-colors">
                        {ucp.code}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(ucp.createdAt || new Date()), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(ucp.status)}
                </div>

                <div className="space-y-3 mb-4">
                  {ucp.pallet && (
                    <div className="flex items-center gap-2 text-sm">
                      <Truck className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Pallet:</span>
                      <Badge variant="outline">{ucp.pallet.code}</Badge>
                    </div>
                  )}
                  
                  {ucp.position && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Posição:</span>
                      <Badge variant="outline">{ucp.position.code}</Badge>
                    </div>
                  )}

                  {ucp.items && ucp.items.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-purple-500" />
                      <span className="font-medium">Produtos:</span>
                      <Badge variant="secondary">{ucp.items.length} item(s)</Badge>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedUcp(ucp);
                      setIsQRDialogOpen(true);
                    }}
                  >
                    <QrCode className="h-3 w-3 mr-1" />
                    QR
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openHistory(ucp)}
                  >
                    <History className="h-3 w-3 mr-1" />
                    Histórico
                  </Button>
                  {ucp.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDismantleDialog(ucp)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Archive className="h-3 w-3 mr-1" />
                      Desmontar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">Nenhuma UCP encontrada</h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm 
                ? "Tente ajustar os filtros de busca" 
                : "Crie sua primeira UCP para começar"}
            </p>
            <Button
              onClick={() => setIsCreationWizardOpen(true)}
              className="bg-gradient-to-r from-blue-500 to-purple-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Nova UCP
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialogs and Modals */}
      <UcpCreationWizard
        isOpen={isCreationWizardOpen}
        onClose={() => setIsCreationWizardOpen(false)}
      />

      {selectedUcp && (
        <QRCodeDialog
          isOpen={isQRDialogOpen}
          onClose={() => {
            setIsQRDialogOpen(false);
            setSelectedUcp(null);
          }}
          palletCode={selectedUcp.code}
          palletData={{
            code: selectedUcp.code,
            type: "UCP",
            material: selectedUcp.pallet?.material || "N/A",
            dimensions: selectedUcp.pallet ? `${selectedUcp.pallet.width}x${selectedUcp.pallet.length}x${selectedUcp.pallet.height}cm` : "N/A",
            maxWeight: selectedUcp.pallet?.maxWeight || "N/A",
          }}
        />
      )}

      {isScannerOpen && (
        <QrScanner
          onScan={handleScanResult}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {historyUcpId && (
        <UcpHistoryViewer
          ucpId={historyUcpId}
          isOpen={isHistoryOpen}
          onClose={() => {
            setIsHistoryOpen(false);
            setHistoryUcpId(null);
          }}
        />
      )}

      <AlertDialog open={dismantleDialog.isOpen} onOpenChange={(open) => 
        !open && setDismantleDialog({ isOpen: false, ucp: null })
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Desmontagem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desmontar a UCP {dismantleDialog.ucp?.code}?
              Esta ação irá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Marcar todos os produtos como removidos</li>
                <li>Liberar o pallet para reuso</li>
                <li>Liberar a posição no armazém</li>
                <li>Arquivar a UCP permanentemente</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDismantleConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Desmontar UCP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}