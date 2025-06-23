import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertUcpSchema, type Ucp, type InsertUcp, type Pallet, type Position } from "@shared/schema";
import { 
  Plus, Search, Edit, Trash2, Package, QrCode, MapPin, 
  Activity, Clock, Archive, RefreshCw, Filter, Eye,
  TrendingUp, BarChart3, Layers, Move, AlertCircle
} from "lucide-react";

interface UcpWithRelations extends Ucp {
  pallet?: Pallet;
  position?: Position;
}

export default function UCPs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUcp, setEditingUcp] = useState<UcpWithRelations | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { toast } = useToast();

  const { data: ucps, isLoading } = useQuery<UcpWithRelations[]>({
    queryKey: ['/api/ucps'],
  });

  const { data: pallets } = useQuery<Pallet[]>({
    queryKey: ['/api/pallets'],
  });

  const { data: positions } = useQuery<Position[]>({
    queryKey: ['/api/positions'],
  });

  const form = useForm<InsertUcp>({
    resolver: zodResolver(insertUcpSchema.omit({ createdBy: true })),
    defaultValues: {
      code: "",
      palletId: undefined,
      positionId: undefined,
      status: "active",
      observations: "",
    },
  });

  const generateUcpCode = () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
    return `UCP-${dateStr}-${randomNum}`;
  };

  const createMutation = useMutation({
    mutationFn: async (data: InsertUcp) => {
      await apiRequest('POST', '/api/ucps', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ucps'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
      toast({
        title: "Sucesso",
        description: "UCP criada com sucesso",
      });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertUcp> }) => {
      await apiRequest('PUT', `/api/ucps/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ucps'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
      toast({
        title: "Sucesso",
        description: "UCP atualizada com sucesso",
      });
      setIsCreateOpen(false);
      setEditingUcp(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/ucps/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ucps'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
      toast({
        title: "Sucesso",
        description: "UCP excluída com sucesso",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredUcps = ucps?.filter(ucp => {
    const matchesSearch = ucp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ucp.pallet?.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ucp.position?.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || ucp.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  // Estatísticas das UCPs
  const ucpStats = {
    total: ucps?.length || 0,
    active: ucps?.filter(u => u.status === 'active').length || 0,
    empty: ucps?.filter(u => u.status === 'empty').length || 0,
    archived: ucps?.filter(u => u.status === 'archived').length || 0,
    withPallet: ucps?.filter(u => u.pallet).length || 0,
    withPosition: ucps?.filter(u => u.position).length || 0,
  };

  const availablePallets = pallets?.filter(p => p.status === 'available') || [];
  const availablePositions = positions?.filter(p => p.status === 'available') || [];

  const onSubmit = (data: InsertUcp) => {
    if (editingUcp) {
      updateMutation.mutate({ id: editingUcp.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (ucp: UcpWithRelations) => {
    setEditingUcp(ucp);
    form.reset({
      code: ucp.code,
      palletId: ucp.palletId || undefined,
      positionId: ucp.positionId || undefined,
      status: ucp.status,
      observations: ucp.observations || "",
    });
    setIsCreateOpen(true);
  };

  const handleDelete = (ucp: UcpWithRelations) => {
    if (confirm(`Tem certeza que deseja excluir a UCP ${ucp.code}?`)) {
      deleteMutation.mutate(ucp.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-white';
      case 'empty': return 'bg-warning text-white';
      case 'archived': return 'bg-gray-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativa';
      case 'empty': return 'Vazia';
      case 'archived': return 'Arquivada';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Activity className="h-4 w-4" />;
      case 'empty': return <AlertCircle className="h-4 w-4" />;
      case 'archived': return <Archive className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="animate-fadeInUp">
          <h1 className="text-3xl font-bold text-gray-900">📦 UCPs</h1>
          <p className="text-gray-600">Unidades de Carga Paletizada</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/ucps'] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button 
                className="animate-fadeInUp"
                style={{ animationDelay: '100ms' }}
                onClick={() => {
                  setEditingUcp(null);
                  form.reset({
                    code: generateUcpCode(),
                    palletId: undefined,
                    positionId: undefined,
                    status: "active",
                    observations: "",
                  });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova UCP
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingUcp ? "Editar UCP" : "Nova UCP"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código</FormLabel>
                        <FormControl>
                          <Input placeholder="UCP-20250623-0001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="palletId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pallet</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} 
                            value={field.value?.toString() || ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um pallet" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availablePallets.map((pallet) => (
                                <SelectItem key={pallet.id} value={pallet.id.toString()}>
                                  {pallet.code} - {pallet.type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="positionId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Posição</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} 
                            value={field.value?.toString() || ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma posição" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availablePositions.map((position) => (
                                <SelectItem key={position.id} value={position.id.toString()}>
                                  {position.code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Ativa</SelectItem>
                            <SelectItem value="empty">Vazia</SelectItem>
                            <SelectItem value="archived">Arquivada</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="observations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setIsCreateOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {editingUcp ? "Atualizar" : "Criar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="card-hover animate-fadeInUp" style={{ animationDelay: '0ms' }}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{ucpStats.total}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover animate-fadeInUp" style={{ animationDelay: '50ms' }}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ativas</p>
                <p className="text-2xl font-bold text-success">{ucpStats.active}</p>
              </div>
              <Activity className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover animate-fadeInUp" style={{ animationDelay: '100ms' }}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Vazias</p>
                <p className="text-2xl font-bold text-warning">{ucpStats.empty}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover animate-fadeInUp" style={{ animationDelay: '150ms' }}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Arquivadas</p>
                <p className="text-2xl font-bold text-gray-600">{ucpStats.archived}</p>
              </div>
              <Archive className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover animate-fadeInUp" style={{ animationDelay: '200ms' }}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">C/ Pallet</p>
                <p className="text-2xl font-bold text-primary">{ucpStats.withPallet}</p>
              </div>
              <QrCode className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover animate-fadeInUp" style={{ animationDelay: '250ms' }}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">C/ Posição</p>
                <p className="text-2xl font-bold text-success">{ucpStats.withPosition}</p>
              </div>
              <MapPin className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar UCPs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="empty">Vazias</SelectItem>
            <SelectItem value="archived">Arquivadas</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* UCPs Grid/List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
          {filteredUcps.map((ucp, index) => (
            <Card key={ucp.id} className={`card-hover animate-fadeInUp ${viewMode === "list" ? "flex flex-row" : ""}`} style={{ animationDelay: `${index * 100}ms` }}>
              <CardHeader className={`${viewMode === "list" ? "flex-1 pb-3" : "pb-3"}`}>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    {getStatusIcon(ucp.status)}
                    <span className="ml-2">{ucp.code}</span>
                  </CardTitle>
                  <Badge className={getStatusColor(ucp.status)}>
                    {getStatusLabel(ucp.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className={viewMode === "list" ? "flex-1" : ""}>
                <div className="space-y-3">
                  {ucp.pallet && (
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                      <div className="flex items-center">
                        <QrCode className="h-4 w-4 text-primary mr-2" />
                        <span className="text-sm font-medium">Pallet:</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-primary">{ucp.pallet.code}</span>
                        <p className="text-xs text-blue-600">{ucp.pallet.type}</p>
                      </div>
                    </div>
                  )}
                  
                  {ucp.position && (
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-success mr-2" />
                        <span className="text-sm font-medium">Posição:</span>
                      </div>
                      <span className="text-sm font-bold text-success">{ucp.position.code}</span>
                    </div>
                  )}

                  {!ucp.pallet && !ucp.position && (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
                      <AlertCircle className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Sem pallet ou posição definida</p>
                    </div>
                  )}

                  {ucp.observations && (
                    <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <strong>Observações:</strong>
                      <p className="mt-1">{ucp.observations}</p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end space-x-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(ucp)}
                    className="hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(ucp)}
                    disabled={deleteMutation.isPending}
                    className="hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredUcps.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-12 animate-fadeInUp">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma UCP encontrada
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== "all" 
                  ? "Tente ajustar os filtros de busca" 
                  : "Comece criando uma nova UCP"}
              </p>
              {!searchTerm && statusFilter === "all" && (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeira UCP
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}