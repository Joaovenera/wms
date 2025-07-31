import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertVehicleSchema } from "@/types/schemas";
import { Vehicle, InsertVehicle } from "@/types/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Truck, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Package,
  Car,
  Building
} from "lucide-react";

const getStatusInfo = (status: string) => {
  const statusMap = {
    'disponivel': { label: 'Disponível', variant: 'default' as const, color: 'text-green-600' },
    'em_uso': { label: 'Em Uso', variant: 'secondary' as const, color: 'text-blue-600' },
    'manutencao': { label: 'Manutenção', variant: 'destructive' as const, color: 'text-red-600' },
    'inativo': { label: 'Inativo', variant: 'outline' as const, color: 'text-gray-500' },
  };
  
  return statusMap[status as keyof typeof statusMap] || 
    { label: status, variant: 'outline' as const, color: 'text-gray-500' };
};


export default function Vehicles() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isValid }
  } = useForm<InsertVehicle>({
    resolver: zodResolver(insertVehicleSchema),
    defaultValues: {
      status: "disponivel",
      isActive: true,
      createdBy: 1, // TODO: pegar do contexto do usuário
    }
  });

  // Fetch vehicles
  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['/api/vehicles'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/vehicles');
      return await res.json();
    },
  });

  // Create vehicle mutation
  const createVehicleMutation = useMutation({
    mutationFn: async (data: InsertVehicle) => {
      const res = await apiRequest('POST', '/api/vehicles', data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Veículo criado com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      setIsCreateDialogOpen(false);
      reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar veículo",
        variant: "destructive",
      });
    },
  });

  // Update vehicle mutation
  const updateVehicleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: InsertVehicle }) => {
      const res = await apiRequest('PUT', `/api/vehicles/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Veículo atualizado com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      setEditingVehicle(null);
      reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar veículo",
        variant: "destructive",
      });
    },
  });

  // Delete vehicle mutation
  const deleteVehicleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/vehicles/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Veículo excluído com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      setIsDeleteDialogOpen(false);
      setSelectedVehicle(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir veículo",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertVehicle) => {
    if (editingVehicle) {
      updateVehicleMutation.mutate({ id: editingVehicle.id, data });
    } else {
      createVehicleMutation.mutate(data);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    // Preencher o formulário com os dados do veículo
    Object.entries(vehicle).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
        setValue(key as keyof InsertVehicle, value);
      }
    });
    setIsCreateDialogOpen(true);
  };

  const handleDelete = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setIsDeleteDialogOpen(true);
  };

  const resetForm = () => {
    reset({
      status: "disponivel",
      isActive: true,
      createdBy: 1,
    });
    setEditingVehicle(null);
  };

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
    resetForm();
  };

  // Filter vehicles
  const filteredVehicles = vehicles?.filter((vehicle: Vehicle) => {
    const matchesSearch = 
      vehicle.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.licensePlate.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter;
    
    return matchesSearch && matchesStatus && vehicle.isActive;
  });

  // Calculate cargo area volume for display
  const calculateCargoVolume = (vehicle: Vehicle) => {
    return (vehicle.cargoAreaLength * vehicle.cargoAreaWidth * vehicle.cargoAreaHeight).toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Truck className="h-8 w-8 text-primary" />
            Gestão de Veículos
          </h1>
          <p className="text-gray-600 mt-1">
            Gerencie a frota de veículos para transferências e carregamentos
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Novo Veículo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {editingVehicle ? "Editar Veículo" : "Novo Veículo"}
              </DialogTitle>
              <DialogDescription>
                {editingVehicle ? "Atualize as informações do veículo" : "Cadastre um novo veículo na frota"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código *</Label>
                  <Input 
                    id="code"
                    {...register("code")}
                    placeholder="Ex: VHC001"
                  />
                  {errors.code && (
                    <p className="text-sm text-red-500">{errors.code.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input 
                    id="name"
                    {...register("name")}
                    placeholder="Ex: Caminhão Principal"
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">Marca *</Label>
                  <Input 
                    id="brand"
                    {...register("brand")}
                    placeholder="Ex: Mercedes-Benz"
                  />
                  {errors.brand && (
                    <p className="text-sm text-red-500">{errors.brand.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Modelo *</Label>
                  <Input 
                    id="model"
                    {...register("model")}
                    placeholder="Ex: Atego 1719"
                  />
                  {errors.model && (
                    <p className="text-sm text-red-500">{errors.model.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="licensePlate">Placa *</Label>
                  <Input 
                    id="licensePlate"
                    {...register("licensePlate")}
                    placeholder="Ex: ABC-1234"
                  />
                  {errors.licensePlate && (
                    <p className="text-sm text-red-500">{errors.licensePlate.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Tipo *</Label>
                  <Select onValueChange={(value) => setValue("type", value)} value={watch("type")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="caminhao">Caminhão</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="utilitario">Utilitário</SelectItem>
                      <SelectItem value="carreta">Carreta</SelectItem>
                      <SelectItem value="bitrem">Bitrem</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.type && (
                    <p className="text-sm text-red-500">{errors.type.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weightCapacity">Capacidade de Peso *</Label>
                <Input 
                  id="weightCapacity"
                  {...register("weightCapacity")}
                  placeholder="Ex: 5000 kg"
                />
                {errors.weightCapacity && (
                  <p className="text-sm text-red-500">{errors.weightCapacity.message}</p>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">Dimensões da Área de Carga *</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cargoAreaLength">Comprimento (m)</Label>
                    <Input 
                      id="cargoAreaLength"
                      type="number"
                      step="0.01"
                      {...register("cargoAreaLength", { valueAsNumber: true })}
                      placeholder="Ex: 6.20"
                    />
                    {errors.cargoAreaLength && (
                      <p className="text-sm text-red-500">{errors.cargoAreaLength.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cargoAreaWidth">Largura (m)</Label>
                    <Input 
                      id="cargoAreaWidth"
                      type="number"
                      step="0.01"
                      {...register("cargoAreaWidth", { valueAsNumber: true })}
                      placeholder="Ex: 2.40"
                    />
                    {errors.cargoAreaWidth && (
                      <p className="text-sm text-red-500">{errors.cargoAreaWidth.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cargoAreaHeight">Altura (m)</Label>
                    <Input 
                      id="cargoAreaHeight"
                      type="number"
                      step="0.01"
                      {...register("cargoAreaHeight", { valueAsNumber: true })}
                      placeholder="Ex: 2.70"
                    />
                    {errors.cargoAreaHeight && (
                      <p className="text-sm text-red-500">{errors.cargoAreaHeight.message}</p>
                    )}
                  </div>
                </div>
                {watch("cargoAreaLength") && watch("cargoAreaWidth") && watch("cargoAreaHeight") && (
                  <p className="text-sm text-blue-600">
                    Volume calculado: {(watch("cargoAreaLength") * watch("cargoAreaWidth") * watch("cargoAreaHeight")).toFixed(2)} m³
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select onValueChange={(value) => setValue("status", value)} value={watch("status")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="em_uso">Em Uso</SelectItem>
                    <SelectItem value="manutencao">Manutenção</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observations">Observações</Label>
                <Textarea 
                  id="observations"
                  {...register("observations")}
                  placeholder="Informações adicionais sobre o veículo..."
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeCreateDialog}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={!isValid || createVehicleMutation.isPending || updateVehicleMutation.isPending}
                >
                  {editingVehicle ? "Atualizar" : "Criar"} Veículo
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por código, nome, marca, modelo ou placa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="em_uso">Em Uso</SelectItem>
                  <SelectItem value="manutencao">Manutenção</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {vehicles?.filter((v: Vehicle) => v.isActive).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Disponíveis</p>
                <p className="text-2xl font-bold text-green-600">
                  {vehicles?.filter((v: Vehicle) => v.status === 'disponivel' && v.isActive).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Car className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Em Uso</p>
                <p className="text-2xl font-bold text-blue-600">
                  {vehicles?.filter((v: Vehicle) => v.status === 'em_uso' && v.isActive).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <Building className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Manutenção</p>
                <p className="text-2xl font-bold text-red-600">
                  {vehicles?.filter((v: Vehicle) => v.status === 'manutencao' && v.isActive).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Veículos da Frota</CardTitle>
          <CardDescription>
            {filteredVehicles?.length || 0} veículo(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Marca/Modelo</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Capacidade Peso</TableHead>
                    <TableHead>Dimensões Carga</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehicles?.map((vehicle: Vehicle) => (
                    <TableRow key={vehicle.id}>
                      <TableCell className="font-mono">{vehicle.code}</TableCell>
                      <TableCell className="font-medium">{vehicle.name}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{vehicle.brand}</div>
                          <div className="text-sm text-gray-500">{vehicle.model}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{vehicle.licensePlate}</TableCell>
                      <TableCell className="capitalize">{vehicle.type}</TableCell>
                      <TableCell>{vehicle.weightCapacity}</TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          <div>{vehicle.cargoAreaLength}m × {vehicle.cargoAreaWidth}m × {vehicle.cargoAreaHeight}m</div>
                        </div>
                      </TableCell>
                      <TableCell>{calculateCargoVolume(vehicle)} m³</TableCell>
                      <TableCell>
                        <Badge variant={getStatusInfo(vehicle.status).variant}>
                          {getStatusInfo(vehicle.status).label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(vehicle)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(vehicle)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredVehicles?.length === 0 && (
                <div className="text-center py-8">
                  <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhum veículo encontrado
                  </h3>
                  <p className="text-gray-500">
                    Não há veículos que correspondam aos filtros selecionados.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o veículo "{selectedVehicle?.name}" ({selectedVehicle?.code})?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedVehicle && deleteVehicleMutation.mutate(selectedVehicle.id)}
              disabled={deleteVehicleMutation.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}