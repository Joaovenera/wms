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
import { insertPositionSchema, type Position, type InsertPosition } from "@shared/schema";
import { Plus, Search, Edit, Trash2, MapPin } from "lucide-react";

export default function Positions() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const { toast } = useToast();

  const { data: positions, isLoading } = useQuery<Position[]>({
    queryKey: ['/api/positions'],
  });

  const form = useForm<InsertPosition>({
    resolver: zodResolver(insertPositionSchema.omit({ createdBy: true })),
    defaultValues: {
      code: "",
      street: "",
      side: "",
      corridor: "",
      level: "",
      rackType: "",
      maxPallets: 1,
      restrictions: "",
      status: "available",
      observations: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertPosition) => {
      await apiRequest('POST', '/api/positions', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
      toast({
        title: "Sucesso",
        description: "Posição criada com sucesso",
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
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertPosition> }) => {
      await apiRequest('PUT', `/api/positions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
      toast({
        title: "Sucesso",
        description: "Posição atualizada com sucesso",
      });
      setEditingPosition(null);
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
      await apiRequest('DELETE', `/api/positions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
      toast({
        title: "Sucesso",
        description: "Posição excluída com sucesso",
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

  const filteredPositions = positions?.filter(position =>
    position.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    position.street.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const generateCode = (street: string, side: string, corridor: string, level: string) => {
    if (street && side && corridor && level) {
      return `${street}-${side}-${corridor}-${level}`;
    }
    return "";
  };

  const onSubmit = (data: InsertPosition) => {
    const code = generateCode(data.street, data.side, data.corridor, data.level);
    const positionData = { ...data, code };
    
    if (editingPosition) {
      updateMutation.mutate({ id: editingPosition.id, data: positionData });
    } else {
      createMutation.mutate(positionData);
    }
  };

  const handleEdit = (position: Position) => {
    setEditingPosition(position);
    form.reset({
      code: position.code,
      street: position.street,
      side: position.side,
      corridor: position.corridor,
      level: position.level,
      rackType: position.rackType || "",
      maxPallets: position.maxPallets,
      restrictions: position.restrictions || "",
      status: position.status,
      observations: position.observations || "",
    });
    setIsCreateOpen(true);
  };

  const handleDelete = (position: Position) => {
    if (confirm(`Tem certeza que deseja excluir a posição ${position.code}?`)) {
      deleteMutation.mutate(position.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-success';
      case 'occupied': return 'bg-destructive';
      case 'reserved': return 'bg-warning';
      case 'maintenance': return 'bg-primary';
      case 'blocked': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Disponível';
      case 'occupied': return 'Ocupada';
      case 'reserved': return 'Reservada';
      case 'maintenance': return 'Manutenção';
      case 'blocked': return 'Bloqueada';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Posições</h1>
          <p className="text-gray-600">Gerenciamento de posições do armazém</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPosition ? "Editar Posição" : "Nova Posição"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rua</FormLabel>
                        <FormControl>
                          <Input placeholder="RUA01" {...field} />
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
                        <FormLabel>Lado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Lado" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="E">E (Esquerdo)</SelectItem>
                            <SelectItem value="D">D (Direito)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="corridor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Corredor</FormLabel>
                        <FormControl>
                          <Input placeholder="A01" {...field} />
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
                          <Input placeholder="N01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Auto-generated code preview */}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <Label className="text-sm font-medium text-gray-600">Código Gerado:</Label>
                  <p className="text-lg font-mono font-bold text-primary">
                    {generateCode(
                      form.watch("street"),
                      form.watch("side"),
                      form.watch("corridor"),
                      form.watch("level")
                    ) || "RUA01-E-A01-N01"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="rackType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Porta-Pallet</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                            <SelectItem value="available">Disponível</SelectItem>
                            <SelectItem value="occupied">Ocupada</SelectItem>
                            <SelectItem value="reserved">Reservada</SelectItem>
                            <SelectItem value="maintenance">Manutenção</SelectItem>
                            <SelectItem value="blocked">Bloqueada</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="maxPallets"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacidade Máxima (Pallets)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1"
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="restrictions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restrições</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Ex: apenas produtos refrigerados, carga máxima 1000kg..."
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
                    {editingPosition ? "Atualizar" : "Criar"}
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
            placeholder="Buscar posições..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Positions Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPositions.map((position) => (
            <Card key={position.id} className="card-hover">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-lg">
                    <MapPin className="h-4 w-4 mr-2" />
                    {position.code}
                  </CardTitle>
                  <Badge className={getStatusColor(position.status)}>
                    {getStatusLabel(position.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tipo:</span>
                    <span className="font-medium">{position.rackType || "N/A"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Capacidade:</span>
                    <span className="font-medium">{position.maxPallets} pallet(s)</span>
                  </div>
                  {position.restrictions && (
                    <div className="text-sm text-gray-600 mt-2 p-2 bg-yellow-50 rounded border-l-4 border-yellow-400">
                      <strong>Restrições:</strong> {position.restrictions}
                    </div>
                  )}
                  {position.observations && (
                    <div className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                      {position.observations}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end space-x-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(position)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(position)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredPositions.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-12">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma posição encontrada
              </h3>
              <p className="text-gray-600">
                {searchTerm ? "Tente ajustar os filtros de busca" : "Comece criando uma nova posição"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
