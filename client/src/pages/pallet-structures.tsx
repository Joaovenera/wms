import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Plus, Trash2, Edit, Grid3X3, Eye, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useMobile } from "@/hooks/use-mobile";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertPalletStructureSchema, type PalletStructure, type InsertPalletStructure } from "@shared/schema";
import QRCodeDialog from "@/components/qr-code-dialog";

export default function PalletStructures() {
  const isMobile = useMobile();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState<PalletStructure | null>(null);
  const [previewStructure, setPreviewStructure] = useState<PalletStructure | null>(null);
  const [qrCodeDialog, setQrCodeDialog] = useState<{ isOpen: boolean; structure?: PalletStructure }>({ isOpen: false });

  // Query para buscar estruturas
  const { data: structures = [], isLoading, refetch } = useQuery<PalletStructure[]>({
    queryKey: ["/api/pallet-structures"],
    refetchInterval: 30000,
  });

  // Mutation para criar estrutura
  const createMutation = useMutation({
    mutationFn: async (data: InsertPalletStructure) => {
      const res = await apiRequest("POST", "/api/pallet-structures", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pallet-structures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      setIsAddDialogOpen(false);
      toast({
        title: "Sucesso",
        description: "Estrutura criada e vagas geradas automaticamente!",
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

  // Mutation para deletar estrutura
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/pallet-structures/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pallet-structures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      toast({
        title: "Sucesso",
        description: "Estrutura e todas as vagas removidas!",
      });
    },
  });

  // Form para criar/editar estrutura
  const form = useForm<InsertPalletStructure>({
    resolver: zodResolver(insertPalletStructureSchema),
    defaultValues: {
      name: "",
      street: "",
      side: "E",
      maxPositions: 7,
      maxLevels: 4,
      rackType: "conventional",
      status: "active",
      observations: "",
      createdBy: 2, // TODO: pegar do contexto de autenticação
    },
  });

  const onSubmit = (data: InsertPalletStructure) => {
    const structureName = `Porta-Pallet Rua ${data.street} Lado ${data.side}`;
    createMutation.mutate({
      ...data,
      name: structureName,
    });
  };

  const handleDelete = (structure: PalletStructure) => {
    if (confirm(`Deseja remover a estrutura "${structure.name}" e todas as suas vagas?`)) {
      deleteMutation.mutate(structure.id);
    }
  };

  const handleShowQRCode = (structure: PalletStructure) => {
    console.log("QR Code clicked for structure:", structure.name);
    setQrCodeDialog({ isOpen: true, structure });
  };

  const handleCloseQRCode = () => {
    setQrCodeDialog({ isOpen: false });
  };

  // Renderizar preview da estrutura
  const renderStructurePreview = (structure: PalletStructure) => {
    const positions = [];
    
    // Gerar matriz de vagas [posição,nível]
    for (let level = structure.maxLevels - 1; level >= 0; level--) {
      const row = [];
      for (let position = 1; position <= structure.maxPositions; position++) {
        row.push(`[${position},${level}]`);
      }
      positions.push(row);
    }

    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="font-semibold text-lg">{structure.name}</h3>
          <p className="text-sm text-gray-600">
            Rua {structure.street} • Lado {structure.side === 'E' ? 'Esquerdo' : 'Direito'} • 
            {structure.side === 'E' ? ' Posições Ímpares' : ' Posições Pares'}
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="text-center mb-3">
            <Badge variant="outline" className="mb-2">
              Estrutura {structure.maxPositions}x{structure.maxLevels}
            </Badge>
          </div>
          
          {/* Cabeçalho com números das posições */}
          <div className="grid grid-cols-8 gap-1 mb-2">
            <div className="text-xs text-center font-semibold">NÍVEL</div>
            {Array.from({ length: structure.maxPositions }, (_, i) => (
              <div key={i} className="text-xs text-center font-semibold">
                POS {i + 1}
              </div>
            ))}
          </div>

          {/* Matriz de vagas */}
          {positions.map((row, levelIndex) => (
            <div key={levelIndex} className="grid grid-cols-8 gap-1 mb-1">
              <div className="text-xs text-center font-semibold bg-blue-100 p-1 rounded">
                {structure.maxLevels - 1 - levelIndex}
              </div>
              {row.map((code, posIndex) => (
                <div
                  key={posIndex}
                  className="text-xs text-center bg-white border border-gray-300 p-1 rounded hover:bg-blue-50"
                >
                  {code}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="text-xs text-gray-600 space-y-1">
          <p>• Total de vagas: {structure.maxPositions * structure.maxLevels}</p>
          <p>• Endereçamento: [posição,nível]</p>
          <p>• Lado {structure.side === 'E' ? 'Esquerdo (ímpares)' : 'Direito (pares)'}</p>
          <p>• Tipo: {structure.rackType}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Estruturas de Porta-Pallets</h1>
            <p className="text-gray-600">
              Cadastre estruturas que geram automaticamente todas as vagas
            </p>
          </div>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Estrutura
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Estrutura</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rua</FormLabel>
                        <FormControl>
                          <Input placeholder="01" {...field} />
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="E">E - Esquerdo (Ímpares)</SelectItem>
                            <SelectItem value="D">D - Direito (Pares)</SelectItem>
                          </SelectContent>
                        </Select>
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
                        <FormLabel>Número de Posições (1-7)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            max={7} 
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
                    name="maxLevels"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de Níveis (1-4)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            max={4} 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
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
                      <FormLabel>Tipo de Estrutura</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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
                  name="observations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Observações sobre a estrutura..."
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">O que será criado:</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• 1 estrutura de porta-pallet</li>
                    <li>• {form.watch("maxPositions") * form.watch("maxLevels")} vagas automáticas</li>
                    <li>• Endereçamento [posição,nível] para cada vaga</li>
                    <li>• Lado {form.watch("side")} - posições {form.watch("side") === 'E' ? 'ímpares' : 'pares'}</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Criando..." : "Criar Estrutura"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de estruturas */}
      <div className="grid gap-6">
        {isLoading ? (
          <div className="text-center py-8">Carregando estruturas...</div>
        ) : structures.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                Nenhuma estrutura cadastrada
              </h3>
              <p className="text-gray-500 mb-4">
                Cadastre sua primeira estrutura de porta-pallet
              </p>
            </CardContent>
          </Card>
        ) : (
          structures.map((structure) => (
            <Card key={structure.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      {structure.name}
                    </CardTitle>
                    <div className="flex items-center gap-4 mt-2">
                      <Badge variant="outline">
                        Rua {structure.street}
                      </Badge>
                      <Badge variant="outline">
                        Lado {structure.side === 'E' ? 'Esquerdo' : 'Direito'}
                      </Badge>
                      <Badge variant="outline">
                        {structure.maxPositions}x{structure.maxLevels}
                      </Badge>
                      <Badge variant={structure.status === 'active' ? 'default' : 'secondary'}>
                        {structure.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          Visualizar
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>Visualização da Estrutura</DialogTitle>
                        </DialogHeader>
                        {renderStructurePreview(structure)}
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShowQRCode(structure)}
                      title="Gerar QR Code"
                    >
                      <QrCode className="w-4 h-4 mr-1" />
                      QR
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(structure)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Total de Vagas:</span>
                    <br />
                    {structure.maxPositions * structure.maxLevels}
                  </div>
                  <div>
                    <span className="font-medium">Tipo:</span>
                    <br />
                    {structure.rackType}
                  </div>
                  <div>
                    <span className="font-medium">Posições:</span>
                    <br />
                    {structure.side === 'E' ? 'Ímpares (1,3,5,7)' : 'Pares (2,4,6)'}
                  </div>
                  <div>
                    <span className="font-medium">Criado em:</span>
                    <br />
                    {structure.createdAt ? new Date(structure.createdAt).toLocaleDateString() : '-'}
                  </div>
                </div>
                {structure.observations && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <span className="font-medium text-sm">Observações:</span>
                      <p className="text-sm text-gray-600 mt-1">{structure.observations}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* QR Code Dialog */}
      <QRCodeDialog
        isOpen={qrCodeDialog.isOpen}
        onClose={handleCloseQRCode}
        palletCode={qrCodeDialog.structure?.name || ""}
        palletData={qrCodeDialog.structure ? {
          code: qrCodeDialog.structure.name,
          type: "Porta-Pallet",
          material: `Rua ${qrCodeDialog.structure.street} - Lado ${qrCodeDialog.structure.side === 'E' ? 'Esquerdo' : 'Direito'}`,
          dimensions: `${qrCodeDialog.structure.maxPositions} posições x ${qrCodeDialog.structure.maxLevels} níveis`,
          maxWeight: `${qrCodeDialog.structure.maxPositions * qrCodeDialog.structure.maxLevels} vagas totais`
        } : undefined}
      />
    </div>
  );
}