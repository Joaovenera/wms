import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MapPin, Plus, Edit, Trash2, Search, RefreshCw, Filter, Package, CheckCircle, QrCode } from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertPositionSchema, type Position, type InsertPosition, type PalletStructure } from "@shared/schema";
import QRCodeDialog from "@/components/qr-code-dialog";

// Função para gerar código PP-RUA-POSIÇÃO-NÍVEL
const generatePositionCode = (street: string, position: number, level: number) => {
  const streetPadded = street.padStart(2, '0');
  const positionPadded = position.toString().padStart(2, '0');
  return `PP-${streetPadded}-${positionPadded}-${level}`;
};

// Função para determinar o lado baseado na posição (pares=direita, ímpares=esquerda)
const getSideFromPosition = (position: number) => {
  return position % 2 === 0 ? 'D' : 'E';
};

export default function Positions() {
  const isMobile = useMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [streetFilter, setStreetFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [qrCodeDialog, setQrCodeDialog] = useState<{ isOpen: boolean; position?: Position }>({ isOpen: false });

  // Query para buscar posições
  const { data: positions = [], isLoading, refetch } = useQuery<Position[]>({
    queryKey: ['/api/positions'],
    refetchInterval: 30000, // Refresh automático a cada 30 segundos
  });

  // Query para buscar estruturas de porta-paletes
  const { data: structures = [] } = useQuery<PalletStructure[]>({
    queryKey: ['/api/pallet-structures'],
  });

  // Form setup
  const form = useForm<InsertPosition>({
    resolver: zodResolver(insertPositionSchema),
    defaultValues: {
      street: "",
      side: "E",
      position: 1,
      level: 0,
      rackType: "conventional",
      maxPallets: 1,
      status: "available",
      restrictions: "",
      observations: "",
    },
  });

  // Mutation para criar posição
  const createMutation = useMutation({
    mutationFn: async (data: InsertPosition) => {
      const response = await apiRequest("POST", "/api/positions", data);
      return response;
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Posição criada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar posição",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar posição
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertPosition> }) => {
      const response = await apiRequest("PATCH", `/api/positions/${id}`, data);
      return response;
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Posição atualizada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
      setIsDialogOpen(false);
      setEditingPosition(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar posição",
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar posição
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/positions/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Posição removida com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover posição",
        variant: "destructive",
      });
    },
  });

  // Gerar código automaticamente quando street, position ou level mudarem
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'street' || name === 'position' || name === 'level') {
        const street = value.street || "";
        const position = value.position || 1;
        const level = value.level || 0;
        
        if (street && position !== undefined && level !== undefined) {
          const newCode = generatePositionCode(street, position, level);
          const newSide = getSideFromPosition(position);
          
          form.setValue('code', newCode);
          form.setValue('side', newSide);
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);

  // Filtrar posições
  const filteredPositions = positions.filter(position => {
    const matchesSearch = position.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         position.street.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || position.status === statusFilter;
    const matchesStreet = streetFilter === "all" || position.street === streetFilter;
    
    return matchesSearch && matchesStatus && matchesStreet;
  });

  // Obter listas únicas para filtros
  const uniqueStreets = Array.from(new Set(positions.map(p => p.street))).sort();
  const statusOptions = [
    { value: "available", label: "Disponível", color: "bg-green-100 text-green-800" },
    { value: "occupied", label: "Ocupado", color: "bg-orange-100 text-orange-800" },
    { value: "reserved", label: "Reservado", color: "bg-blue-100 text-blue-800" },
    { value: "maintenance", label: "Manutenção", color: "bg-yellow-100 text-yellow-800" },
    { value: "blocked", label: "Bloqueado", color: "bg-red-100 text-red-800" }
  ];

  const onSubmit = (data: InsertPosition) => {
    if (editingPosition) {
      updateMutation.mutate({ id: editingPosition.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (position: Position) => {
    setEditingPosition(position);
    form.reset({
      code: position.code,
      street: position.street,
      side: position.side,
      position: position.position,
      level: position.level,
      rackType: position.rackType || "conventional",
      maxPallets: position.maxPallets,
      status: position.status,
      restrictions: position.restrictions || undefined,
      observations: position.observations || undefined,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (position: Position) => {
    if (confirm(`Tem certeza que deseja remover a posição ${position.code}?`)) {
      deleteMutation.mutate(position.id);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusOption = statusOptions.find(s => s.value === status);
    return statusOption ? (
      <Badge className={statusOption.color}>
        {statusOption.label}
      </Badge>
    ) : (
      <Badge variant="outline">{status}</Badge>
    );
  };

  const getStatusIcon = (position: Position) => {
    if (position.status === 'occupied' || position.currentPalletId) {
      return <Package className="h-4 w-4 text-orange-600" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  };

  const handleShowQRCode = (position: Position) => {
    setQrCodeDialog({ isOpen: true, position });
  };

  const handleCloseQRCode = () => {
    setQrCodeDialog({ isOpen: false });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Posições</h1>
          <p className="text-muted-foreground">
            Gerencie as posições de armazenamento do armazém
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setEditingPosition(null);
                form.reset();
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Posição
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPosition ? "Editar Posição" : "Nova Posição"}
              </DialogTitle>
              <DialogDescription>
                {editingPosition 
                  ? "Atualize as informações da posição." 
                  : "Crie uma nova posição de armazenamento. O código será gerado automaticamente."
                }
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rua</FormLabel>
                        <FormControl>
                          <Input placeholder="01, 02, 03..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posição</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            placeholder="1, 2, 3..."
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nível</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            placeholder="0, 1, 2..."
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código (Gerado automaticamente)</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-gray-50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="side"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lado (Automático)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            readOnly 
                            className="bg-gray-50"
                            value={field.value === 'E' ? 'E - Esquerdo' : 'D - Direito'}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="rackType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Rack</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="conventional">Convencional</SelectItem>
                            <SelectItem value="drive-in">Drive-in</SelectItem>
                            <SelectItem value="push-back">Push-back</SelectItem>
                            <SelectItem value="cantilever">Cantilever</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxPallets"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Máx. Pallets</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
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
                  name="restrictions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restrições (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Ex: Apenas produtos frágeis, peso máximo 500kg..."
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="observations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Observações adicionais..."
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por código ou rua..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {statusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={streetFilter} onValueChange={setStreetFilter}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Rua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {uniqueStreets.map(street => (
                  <SelectItem key={street} value={street}>
                    Rua {street}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Lista de posições */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando posições...</p>
        </div>
      ) : filteredPositions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {positions.length === 0 ? "Nenhuma posição cadastrada" : "Nenhuma posição encontrada"}
            </h3>
            <p className="text-gray-500 mb-4">
              {positions.length === 0 
                ? "Comece criando a primeira posição de armazenamento."
                : "Tente ajustar os filtros ou termos de busca."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'}`}>
          {filteredPositions.map((position) => (
            <Card key={position.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(position)}
                    <CardTitle className="text-lg">{position.code}</CardTitle>
                  </div>
                  {getStatusBadge(position.status)}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Rua:</span>
                    <span className="ml-2 font-medium">{position.street}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Lado:</span>
                    <span className="ml-2 font-medium">
                      {position.side === 'E' ? 'Esquerdo' : 'Direito'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Posição:</span>
                    <span className="ml-2 font-medium">{position.position}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Nível:</span>
                    <span className="ml-2 font-medium">{position.level}</span>
                  </div>
                </div>

                <div className="text-sm">
                  <span className="text-gray-600">Tipo:</span>
                  <span className="ml-2 font-medium capitalize">
                    {position.rackType || "Convencional"}
                  </span>
                </div>

                <div className="text-sm">
                  <span className="text-gray-600">Capacidade:</span>
                  <span className="ml-2 font-medium">{position.maxPallets} pallet(s)</span>
                </div>

                {position.restrictions && (
                  <div className="text-sm">
                    <span className="text-gray-600">Restrições:</span>
                    <p className="text-gray-800 mt-1">{position.restrictions}</p>
                  </div>
                )}

                {position.observations && (
                  <div className="text-sm">
                    <span className="text-gray-600">Observações:</span>
                    <p className="text-gray-800 mt-1">{position.observations}</p>
                  </div>
                )}

                <Separator />
                
                <div className="flex justify-between items-center pt-2">
                  <div className="text-xs text-gray-500">
                    {position.createdAt ? new Date(position.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleShowQRCode(position)}
                      title="Gerar QR Code"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(position)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover a posição {position.code}? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDelete(position)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* QR Code Dialog */}
      <QRCodeDialog
        isOpen={qrCodeDialog.isOpen}
        onClose={handleCloseQRCode}
        palletCode={qrCodeDialog.position?.code || ""}
        palletData={qrCodeDialog.position ? {
          code: qrCodeDialog.position.code,
          type: "Posição",
          material: qrCodeDialog.position.rackType || "Convencional",
          dimensions: `Rua ${qrCodeDialog.position.street} - Posição ${qrCodeDialog.position.position} - Nível ${qrCodeDialog.position.level}`,
          maxWeight: `${qrCodeDialog.position.maxPallets} pallet(s)`
        } : undefined}
      />
    </div>
  );
}