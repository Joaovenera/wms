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
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertUcpSchema, type Ucp, type InsertUcp, type Pallet, type Position } from "@shared/schema";
import { Plus, Search, Edit, Trash2, Package, QrCode, MapPin } from "lucide-react";

interface UcpWithRelations extends Ucp {
  pallet?: Pallet;
  position?: Position;
}

export default function UCPs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUcp, setEditingUcp] = useState<UcpWithRelations | null>(null);
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

  const filteredUcps = ucps?.filter(ucp =>
    ucp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ucp.pallet?.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ucp.position?.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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
      case 'active': return 'bg-success';
      case 'empty': return 'bg-warning';
      case 'archived': return 'bg-gray-500';
      default: return 'bg-gray-400';
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">UCPs</h1>
          <p className="text-gray-600">Unidades de Carga Paletizada</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button 
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
                        <Textarea {...field} />
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

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar UCPs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* UCPs Grid */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUcps.map((ucp) => (
            <Card key={ucp.id} className="card-hover">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Package className="h-5 w-5 mr-2" />
                    {ucp.code}
                  </CardTitle>
                  <Badge className={getStatusColor(ucp.status)}>
                    {getStatusLabel(ucp.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ucp.pallet && (
                    <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                      <div className="flex items-center">
                        <QrCode className="h-4 w-4 text-primary mr-2" />
                        <span className="text-sm font-medium">Pallet:</span>
                      </div>
                      <span className="text-sm font-bold text-primary">{ucp.pallet.code}</span>
                    </div>
                  )}
                  
                  {ucp.position && (
                    <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-success mr-2" />
                        <span className="text-sm font-medium">Posição:</span>
                      </div>
                      <span className="text-sm font-bold text-success">{ucp.position.code}</span>
                    </div>
                  )}

                  {ucp.observations && (
                    <div className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                      {ucp.observations}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end space-x-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(ucp)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(ucp)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredUcps.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma UCP encontrada
              </h3>
              <p className="text-gray-600">
                {searchTerm ? "Tente ajustar os filtros de busca" : "Comece criando uma nova UCP"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
