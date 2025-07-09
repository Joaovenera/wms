import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Building2, Plus, Edit2, Trash2, MapPin, RefreshCw, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type InsertPalletStructure, type PalletStructure, type Position } from "@/types/api";
import { insertPortaPalletSchema } from "@/types/schemas";
import PalletStructureViewer from "@/components/pallet-structure-viewer";
import QRCodeDialog from "@/components/qr-code-dialog";
import { useAuth } from "@/hooks/useAuth";

// Schema específico para porta paletes
const portaPalletFormSchema = z.object({
  street: z.string().min(1, "Rua é obrigatória").regex(/^\d{2}$/, "Rua deve ter 2 dígitos (ex: 01)"),
  side: z.enum(["E", "D"], { required_error: "Lado é obrigatório" }),
  maxPositions: z.number().min(1, "Mínimo 1 posição"),
  maxLevels: z.number().min(0, "Mínimo 0 níveis"),
  rackType: z.string().default("conventional"),
  status: z.string().default("active"),
  observations: z.string().optional(),
});

type PortaPalletForm = z.infer<typeof portaPalletFormSchema>;

export default function PortaPaletes() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState<PalletStructure | null>(null);
  const [qrCodeDialog, setQrCodeDialog] = useState<{ isOpen: boolean; structure?: PalletStructure }>({ isOpen: false });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Query para buscar estruturas de porta paletes
  const { data: structures = [], isLoading, refetch } = useQuery<PalletStructure[]>({
    queryKey: ['/api/pallet-structures'],
  });

  // Query para buscar posições
  const { data: positions = [] } = useQuery<Position[]>({
    queryKey: ['/api/positions'],
  });

  // Mutation para criar estrutura
  const createMutation = useMutation({
    mutationFn: async (data: PortaPalletForm) => {
      if (!user || !(user as any).id) throw new Error("Usuário não autenticado");
      
      // Gerar nome automaticamente
      const sideText = data.side === "E" ? "Esquerdo" : "Direito";
      const structureData = {
        ...data,
        name: `Porta-Pallet Rua ${data.street} Lado ${sideText}`,
        createdBy: (user as any).id,
      };
      
      const response = await apiRequest('POST', '/api/pallet-structures', structureData);
      return response;
    },
    onSuccess: (newStructure: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pallet-structures'] });
      queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
      toast({
        title: "Sucesso",
        description: `Porta-Pallet criado e posições geradas automaticamente.`,
      });
      setIsOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar porta-pallet",
        variant: "destructive",
      });
    },
  });

  // Mutation para deletar estrutura
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/pallet-structures/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pallet-structures'] });
      queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
      toast({
        title: "Sucesso",
        description: "Porta-Pallet removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover porta-pallet",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar estrutura
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; data: PortaPalletForm }) => {
      if (!user || !(user as any).id) throw new Error("Usuário não autenticado");
      
      // Gerar nome automaticamente
      const sideText = data.data.side === "E" ? "Esquerdo" : "Direito";
      const structureData = {
        ...data.data,
        name: `Porta-Pallet Rua ${data.data.street} Lado ${sideText}`,
        updatedBy: (user as any).id,
      };
      
      const response = await apiRequest('PUT', `/api/pallet-structures/${data.id}`, structureData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pallet-structures'] });
      queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
      toast({
        title: "Sucesso",
        description: "Porta-Pallet atualizado com sucesso.",
      });
      setEditingStructure(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar porta-pallet",
        variant: "destructive",
      });
    },
  });

  const form = useForm<PortaPalletForm>({
    resolver: zodResolver(portaPalletFormSchema),
    defaultValues: {
      street: "",
      side: "E" as const,
      maxPositions: 10,
      maxLevels: 5,
      rackType: "conventional",
      status: "active",
      observations: "",
    },
  });

  // Preencher formulário quando uma estrutura for selecionada para edição
  useEffect(() => {
    if (editingStructure) {
      form.reset({
        street: editingStructure.street,
        side: editingStructure.side as "E" | "D",
        maxPositions: editingStructure.maxPositions,
        maxLevels: editingStructure.maxLevels,
        rackType: editingStructure.rackType || "conventional",
        status: editingStructure.status || "active",
        observations: editingStructure.observations || "",
      });
    } else {
      form.reset({
        street: "",
        side: "E" as const,
        maxPositions: 10,
        maxLevels: 5,
        rackType: "conventional",
        status: "active",
        observations: "",
      });
    }
  }, [editingStructure, form]);

  const onSubmit = (data: PortaPalletForm) => {
    if (editingStructure) {
      updateMutation.mutate({ id: editingStructure.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (structure: PalletStructure) => {
    if (confirm(`Tem certeza que deseja remover o porta-pallet "${structure.name}"? Todas as posições associadas também serão removidas.`)) {
      deleteMutation.mutate(structure.id);
    }
  };

  const handleShowQRCode = (structure: PalletStructure) => {
    setQrCodeDialog({ isOpen: true, structure });
  };

  // Função para obter posições relacionadas a uma estrutura
  const getStructurePositions = (structureId: number) => {
    return positions.filter(pos => pos.structureId === structureId);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Porta Paletes</h1>
          <p className="text-muted-foreground">
            Gerencie as estruturas de porta-pallets do armazém
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Porta-Pallet
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Porta-Pallet</DialogTitle>
                <DialogDescription>
                  Configure uma nova estrutura de porta-pallet. As posições serão criadas automaticamente.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rua</FormLabel>
                          <FormControl>
                            <Input placeholder="01" {...field} maxLength={2} />
                          </FormControl>
                          <FormDescription>
                            Número da rua (2 dígitos, ex: 01, 02)
                          </FormDescription>
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o lado" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="E">Esquerdo (E)</SelectItem>
                              <SelectItem value="D">Direito (D)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Lado da rua onde está localizado
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="maxPositions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Posições</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Número de posições horizontais
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maxLevels"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Níveis</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Níveis verticais (onde 0 = térreo)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="rackType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Rack</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="conventional">Convencional</SelectItem>
                            <SelectItem value="drive-in">Drive-in</SelectItem>
                            <SelectItem value="push-back">Push-back</SelectItem>
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
                          <Textarea placeholder="Observações sobre a estrutura..." {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? "Criando..." : "Criar Porta-Pallet"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={!!editingStructure} onOpenChange={(open) => !open && setEditingStructure(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Porta-Pallet</DialogTitle>
            <DialogDescription>
              Modifique as configurações da estrutura de porta-pallet.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rua</FormLabel>
                      <FormControl>
                        <Input placeholder="01" {...field} maxLength={2} />
                      </FormControl>
                      <FormDescription>
                        Número da rua (2 dígitos, ex: 01, 02)
                      </FormDescription>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o lado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="E">E - Esquerdo (Ímpares)</SelectItem>
                          <SelectItem value="D">D - Direito (Pares)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Lado da rua para posicionamento
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="maxPositions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Posições</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={20} 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Posições horizontais na estrutura
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxLevels"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Níveis</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={0} 
                          max={10} 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Níveis verticais (onde 0 = térreo)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="rackType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Rack</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="conventional">Convencional</SelectItem>
                        <SelectItem value="drive-in">Drive-in</SelectItem>
                        <SelectItem value="push-back">Push-back</SelectItem>
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
                      <Textarea placeholder="Observações sobre a estrutura..." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingStructure(null)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Atualizando..." : "Atualizar Porta-Pallet"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Carregando porta-pallets...</p>
          </div>
        </div>
      ) : structures.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Building2 className="h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhum porta-pallet configurado
            </h3>
            <p className="text-gray-500 text-center mb-4">
              Crie sua primeira estrutura de porta-pallet para começar a organizar o armazém.
            </p>
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Porta-Pallet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {structures.map((structure: PalletStructure) => (
            <Card key={structure.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      {structure.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Rua {structure.street} • Lado {structure.side === "E" ? "Esquerdo" : "Direito"}
                    </CardDescription>
                  </div>
                  <Badge variant={structure.status === "active" ? "default" : "secondary"}>
                    {structure.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-gray-600">Posições</Label>
                    <p className="font-medium">{structure.maxPositions}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Níveis</Label>
                    <p className="font-medium">{structure.maxLevels + 1}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Total de Vagas</Label>
                    <p className="font-medium">{structure.maxPositions * (structure.maxLevels + 1)}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Tipo</Label>
                    <p className="font-medium capitalize">{structure.rackType || "Convencional"}</p>
                  </div>
                </div>

                {structure.observations && (
                  <div>
                    <Label className="text-gray-600">Observações</Label>
                    <p className="text-sm text-gray-800 mt-1">{structure.observations}</p>
                  </div>
                )}

                <PalletStructureViewer 
                  structure={structure}
                  positions={getStructurePositions(structure.id)}
                  compact={true}
                />

                <Separator />
                
                <div className="flex justify-between items-center pt-2">
                  <div className="text-xs text-gray-500">
                    Criado em {structure.createdAt ? new Date(structure.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditingStructure(structure)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShowQRCode(structure)}
                      title="Gerar QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDelete(structure)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
        onClose={() => setQrCodeDialog({ isOpen: false })}
        palletCode={qrCodeDialog.structure ? `STRUCTURE-${qrCodeDialog.structure.id}` : ""}
        palletData={qrCodeDialog.structure ? {
          code: `STRUCTURE-${qrCodeDialog.structure.id}`,
          type: "PORTA-PALLET",
          material: qrCodeDialog.structure.name,
          dimensions: `${qrCodeDialog.structure.maxPositions} posições x ${qrCodeDialog.structure.maxLevels + 1} níveis`,
          maxWeight: `Tipo: ${qrCodeDialog.structure.rackType || "Convencional"}`
        } : undefined}
      />
    </div>
  );
}