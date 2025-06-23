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
import { MapPin, Plus, Edit, Trash2, Search, RefreshCw, Filter, Settings } from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertPositionSchema, type Position, type InsertPosition } from "@shared/schema";
import PalletLayoutConfigurator from "@/components/pallet-layout-configurator";

// Configuração padrão do layout
const defaultLayoutConfig = {
  rows: 3,
  cols: 3,
  totalPallets: 9,
  slots: Array.from({ length: 9 }, (_, i) => ({
    id: `slot-${i}`,
    row: Math.floor(i / 3),
    col: i % 3,
    width: 1,
    height: 1,
    occupied: false,
    palletType: undefined
  }))
};

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
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [layoutConfig, setLayoutConfig] = useState<{
    rows: number;
    cols: number;
    totalPallets: number;
    slots: Array<{
      id: string;
      row: number;
      col: number;
      width: number;
      height: number;
      occupied: boolean;
      palletType?: string;
    }>;
  }>(defaultLayoutConfig);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);

  // Query para buscar posições
  const { data: positions = [], isLoading, refetch } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
    refetchInterval: 30000,
  });

  // Mutation para criar posição
  const createMutation = useMutation({
    mutationFn: async (data: InsertPosition) => {
      const res = await apiRequest("POST", "/api/positions", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      setIsAddDialogOpen(false);
      toast({
        title: "Sucesso",
        description: "Porta-pallet cadastrado com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar posição
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertPosition> }) => {
      const res = await apiRequest("PATCH", `/api/positions/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      setIsEditDialogOpen(false);
      setEditingPosition(null);
      toast({
        title: "Sucesso",
        description: "Porta-pallet atualizado com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
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
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      toast({
        title: "Sucesso",
        description: "Porta-pallet removido com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Formulário de criação
  const addForm = useForm<InsertPosition>({
    resolver: zodResolver(insertPositionSchema),
    defaultValues: {
      code: "",
      street: "",
      position: 1,
      level: 0,
      side: "E",
      maxPallets: 1,
      hasDivision: false,
      layoutConfig: null,
      status: "available",
      rackType: "Convencional",
      corridor: "",
      restrictions: "",
      observations: "",
      createdBy: 2, // ID do usuário atual - será substituído por user.id no backend
    },
  });

  // Formulário de edição
  const editForm = useForm<InsertPosition>({
    resolver: zodResolver(insertPositionSchema),
  });

  // Atualizar código automaticamente baseado na rua, posição e nível
  const updatePositionCode = (street: string, position: number, level: number, form: any) => {
    const code = generatePositionCode(street, position, level);
    const side = getSideFromPosition(position);
    form.setValue("code", code);
    form.setValue("side", side);
  };

  // Watch para mudanças nos campos e atualizar código automaticamente
  const watchStreet = addForm.watch("street");
  const watchPosition = addForm.watch("position");
  const watchLevel = addForm.watch("level");

  useEffect(() => {
    if (watchStreet && watchPosition !== undefined && watchLevel !== undefined) {
      updatePositionCode(watchStreet, watchPosition, watchLevel, addForm);
    }
  }, [watchStreet, watchPosition, watchLevel]);

  // Configurar formulário de edição
  useEffect(() => {
    if (editingPosition) {
      editForm.reset({
        code: editingPosition.code,
        street: editingPosition.street,
        position: editingPosition.position,
        level: editingPosition.level,
        side: editingPosition.side,
        maxPallets: editingPosition.maxPallets,
        hasDivision: editingPosition.hasDivision,
        layoutConfig: editingPosition.layoutConfig,
        status: editingPosition.status,
        rackType: editingPosition.rackType || "",
        corridor: editingPosition.corridor || "",
        restrictions: editingPosition.restrictions || "",
        observations: editingPosition.observations || "",
        createdBy: editingPosition.createdBy,
      });

      // Configurar layout do configurador visual
      if (editingPosition.layoutConfig) {
        setLayoutConfig(editingPosition.layoutConfig as any);
      } else {
        setLayoutConfig({
          maxPallets: editingPosition.maxPallets,
          hasDivision: editingPosition.hasDivision,
          slots: Array.from({ length: editingPosition.maxPallets }, (_, i) => ({
            id: `slot-${i}`,
            occupied: false,
            palletType: undefined
          }))
        });
      }
    }
  }, [editingPosition]);

  // Filtrar posições
  const filteredPositions = positions.filter((position) => {
    const matchesSearch = 
      position.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      position.street.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (position.rackType?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesStatus = filterStatus === "all" || position.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Função para submeter criação
  const onSubmit = (data: InsertPosition) => {
    const finalData = {
      ...data,
      layoutConfig: layoutConfig,
      maxPallets: layoutConfig.totalPallets || 1,
      hasDivision: layoutConfig.slots.some(s => s.width > 1 || s.height > 1),
    };
    createMutation.mutate(finalData);
  };

  // Função para submeter edição
  const onEdit = (data: InsertPosition) => {
    if (!editingPosition) return;
    
    const finalData = {
      ...data,
      layoutConfig: layoutConfig,
      maxPallets: layoutConfig.totalPallets || 1,
      hasDivision: layoutConfig.slots.some(s => s.width > 1 || s.height > 1),
    };
    updateMutation.mutate({ id: editingPosition.id, data: finalData });
  };

  // Função para editar posição
  const handleEdit = (position: Position) => {
    setEditingPosition(position);
    setIsEditDialogOpen(true);
  };

  // Função para deletar posição
  const handleDelete = (position: Position) => {
    deleteMutation.mutate(position.id);
  };

  // Função para obter cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-green-100 text-green-800";
      case "occupied": return "bg-orange-100 text-orange-800";
      case "reserved": return "bg-blue-100 text-blue-800";
      case "maintenance": return "bg-yellow-100 text-yellow-800";
      case "blocked": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Função para obter cor do lado
  const getSideColor = (side: string) => {
    return side === "E" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800";
  };

  if (isMobile) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Porta-Pallets</h1>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Porta-Pallet</DialogTitle>
                <DialogDescription>
                  Cadastre um novo porta-pallet com configuração visual
                </DialogDescription>
              </DialogHeader>
              <Form {...addForm}>
                <form onSubmit={addForm.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={addForm.control}
                      name="street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rua</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="01" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addForm.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Posição</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              min={1}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              placeholder="01" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={addForm.control}
                      name="level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nível</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              min={0}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              placeholder="0" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addForm.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código</FormLabel>
                          <FormControl>
                            <Input {...field} readOnly className="bg-gray-50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={addForm.control}
                    name="rackType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Rack</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue="Convencional">
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Convencional">Convencional</SelectItem>
                            <SelectItem value="Drive-in">Drive-in</SelectItem>
                            <SelectItem value="Push-back">Push-back</SelectItem>
                            <SelectItem value="Cantilever">Cantilever</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Configurador visual */}
                  <div className="border rounded-lg p-3">
                    <PalletLayoutConfigurator
                      config={layoutConfig}
                      onChange={setLayoutConfig}
                    />
                  </div>

                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Busca e filtros */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por código, rua ou tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="available">Disponível</SelectItem>
              <SelectItem value="occupied">Ocupado</SelectItem>
              <SelectItem value="reserved">Reservado</SelectItem>
              <SelectItem value="maintenance">Manutenção</SelectItem>
              <SelectItem value="blocked">Bloqueado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de posições */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-gray-500">Carregando porta-pallets...</p>
            </div>
          ) : filteredPositions.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">Nenhum porta-pallet encontrado</p>
            </div>
          ) : (
            filteredPositions.map((position) => (
              <Card key={position.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-lg">{position.code}</h3>
                      <p className="text-sm text-gray-600">
                        Rua {position.street} • Pos {position.position} • Nível {position.level}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Badge className={getSideColor(position.side)}>
                        {position.side === "E" ? "Esquerdo" : "Direito"}
                      </Badge>
                      <Badge className={getStatusColor(position.status)}>
                        {position.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-gray-500">Tipo:</span>
                      <p className="font-medium">{position.rackType || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Capacidade:</span>
                      <p className="font-medium">
                        {position.maxPallets} pallet{position.maxPallets > 1 ? 's' : ''}
                        {position.hasDivision ? ' + divisão' : ''}
                      </p>
                    </div>
                  </div>

                  {position.observations && (
                    <p className="text-sm text-gray-600 mb-3">{position.observations}</p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(position)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1">
                          <Trash2 className="w-4 h-4 mr-1" />
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Deseja realmente excluir o porta-pallet {position.code}?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(position)}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Dialog de edição */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Porta-Pallet</DialogTitle>
              <DialogDescription>
                Modifique as informações do porta-pallet
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={editForm.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rua</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="01" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posição</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min={1}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            placeholder="01" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={editForm.control}
                    name="level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nível</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min={0}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            placeholder="0" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-gray-50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="available">Disponível</SelectItem>
                          <SelectItem value="occupied">Ocupado</SelectItem>
                          <SelectItem value="reserved">Reservado</SelectItem>
                          <SelectItem value="maintenance">Manutenção</SelectItem>
                          <SelectItem value="blocked">Bloqueado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="rackType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Rack</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Convencional">Convencional</SelectItem>
                          <SelectItem value="Drive-in">Drive-in</SelectItem>
                          <SelectItem value="Push-back">Push-back</SelectItem>
                          <SelectItem value="Cantilever">Cantilever</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Configurador visual */}
                <div className="border rounded-lg p-3">
                  <PalletLayoutConfigurator
                    config={layoutConfig}
                    onChange={setLayoutConfig}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="restrictions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restrições</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          value={field.value || ""} 
                          placeholder="Restrições de armazenagem..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
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

                <DialogFooter>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Desktop version seria similar mas com layout de tabela...
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Porta-Pallets</h1>
          <p className="text-gray-600">Sistema de endereçamento PP-RUA-POSIÇÃO-NÍVEL</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Porta-Pallet
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Porta-Pallet</DialogTitle>
              <DialogDescription>
                Cadastre um novo porta-pallet com configuração visual completa
              </DialogDescription>
            </DialogHeader>
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  <FormField
                    control={addForm.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rua</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="01" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posição</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min={1}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            placeholder="01" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nível</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min={0}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            placeholder="0" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código Gerado</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-gray-50 font-mono" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={addForm.control}
                    name="rackType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Rack</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue="Convencional">
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Convencional">Convencional</SelectItem>
                            <SelectItem value="Drive-in">Drive-in</SelectItem>
                            <SelectItem value="Push-back">Push-back</SelectItem>
                            <SelectItem value="Cantilever">Cantilever</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue="available">
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="available">Disponível</SelectItem>
                            <SelectItem value="occupied">Ocupado</SelectItem>
                            <SelectItem value="reserved">Reservado</SelectItem>
                            <SelectItem value="maintenance">Manutenção</SelectItem>
                            <SelectItem value="blocked">Bloqueado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Configurador visual */}
                <div className="border rounded-lg p-4">
                  <PalletLayoutConfigurator
                    config={layoutConfig}
                    onChange={setLayoutConfig}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={addForm.control}
                    name="restrictions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Restrições</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            value={field.value || ""} 
                            placeholder="Restrições de armazenagem..."
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="observations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            value={field.value || ""} 
                            placeholder="Observações gerais..."
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Salvando..." : "Salvar Porta-Pallet"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros e busca */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por código, rua ou tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="available">Disponível</SelectItem>
              <SelectItem value="occupied">Ocupado</SelectItem>
              <SelectItem value="reserved">Reservado</SelectItem>
              <SelectItem value="maintenance">Manutenção</SelectItem>
              <SelectItem value="blocked">Bloqueado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Tabela de posições */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Lista de Porta-Pallets</span>
            <Badge variant="outline">
              {filteredPositions.length} {filteredPositions.length === 1 ? 'posição' : 'posições'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Carregando porta-pallets...</p>
            </div>
          ) : filteredPositions.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">Nenhum porta-pallet encontrado</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || filterStatus !== "all" 
                  ? "Tente ajustar os filtros de busca"
                  : "Cadastre o primeiro porta-pallet do sistema"
                }
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Porta-Pallet
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Código</th>
                    <th className="text-left p-3 font-semibold">Localização</th>
                    <th className="text-left p-3 font-semibold">Tipo/Capacidade</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold">Lado</th>
                    <th className="text-left p-3 font-semibold">Configuração</th>
                    <th className="text-center p-3 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPositions.map((position) => (
                    <tr key={position.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-mono font-bold text-blue-600">
                          {position.code}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          <div>Rua {position.street}</div>
                          <div className="text-sm text-gray-600">
                            Posição {position.position} • Nível {position.level}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="font-medium">{position.rackType || "N/A"}</div>
                          <div className="text-sm text-gray-600">
                            {position.maxPallets} pallet{position.maxPallets > 1 ? 's' : ''}
                            {position.hasDivision ? ' + divisão' : ''}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge className={getStatusColor(position.status)}>
                          {position.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge className={getSideColor(position.side)}>
                          {position.side === "E" ? "Esquerdo" : "Direito"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {/* Mini visualização da configuração */}
                          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded">
                            <div className="w-1 h-4 bg-red-500 rounded"></div>
                            {Array.from({ length: position.maxPallets }, (_, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <div className="w-4 h-3 border border-blue-300 bg-blue-50 rounded-sm"></div>
                                {i === 0 && position.hasDivision && position.maxPallets === 2 && (
                                  <div className="w-0.5 h-3 bg-red-500 rounded-full"></div>
                                )}
                              </div>
                            ))}
                            <div className="w-1 h-4 bg-red-500 rounded"></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(position)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Editar
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="w-4 h-4 mr-1" />
                                Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Deseja realmente excluir o porta-pallet {position.code}?
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(position)}
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de edição para desktop */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Porta-Pallet</DialogTitle>
            <DialogDescription>
              Modifique as informações e configuração visual do porta-pallet
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <FormField
                  control={editForm.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rua</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="01" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Posição</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          min={1}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          placeholder="01" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nível</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          min={0}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          placeholder="0" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código Gerado</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly className="bg-gray-50 font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="available">Disponível</SelectItem>
                          <SelectItem value="occupied">Ocupado</SelectItem>
                          <SelectItem value="reserved">Reservado</SelectItem>
                          <SelectItem value="maintenance">Manutenção</SelectItem>
                          <SelectItem value="blocked">Bloqueado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="rackType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Rack</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Convencional">Convencional</SelectItem>
                          <SelectItem value="Drive-in">Drive-in</SelectItem>
                          <SelectItem value="Push-back">Push-back</SelectItem>
                          <SelectItem value="Cantilever">Cantilever</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="corridor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Corredor (Compatibilidade)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ""} 
                          placeholder="A01, A02..." 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Configurador visual */}
              <div className="border rounded-lg p-4">
                <PalletLayoutConfigurator
                  config={layoutConfig}
                  onChange={setLayoutConfig}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="restrictions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restrições</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          value={field.value || ""} 
                          placeholder="Restrições de armazenagem..."
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="observations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          value={field.value || ""} 
                          placeholder="Observações gerais..."
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}