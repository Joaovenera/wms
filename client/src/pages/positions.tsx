import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertPositionSchema, type Position, type InsertPosition } from "@shared/schema";
import { Plus, Search, Edit, Trash2, MapPin, Building, Layers, Info, CheckCircle, ArrowRight, Copy } from "lucide-react";

// Templates pré-definidos para diferentes configurações de armazém
const WAREHOUSE_TEMPLATES = {
  standard: {
    name: "Armazém Padrão",
    description: "Configuração típica com corredores A-Z e 4 níveis",
    example: "RUA01-E-A01-N01",
    rackType: "Convencional",
    maxPallets: 2,
    streets: ["RUA01", "RUA02", "RUA03"],
    corridors: ["A01", "A02", "A03", "B01", "B02", "B03"],
    levels: ["N01", "N02", "N03", "N04"]
  },
  compact: {
    name: "Armazém Compacto",
    description: "Alta densidade com drive-in",
    example: "A-E-01-N1",
    rackType: "Drive-in",
    maxPallets: 8,
    streets: ["A", "B", "C"],
    corridors: ["01", "02", "03", "04"],
    levels: ["N1", "N2", "N3"]
  },
  custom: {
    name: "Personalizado",
    description: "Configure manualmente todos os campos",
    example: "Definido pelo usuário",
    rackType: "Convencional",
    maxPallets: 1
  }
};

export default function Positions() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof WAREHOUSE_TEMPLATES | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
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

  // Aplicar template selecionado
  const applyTemplate = (templateKey: keyof typeof WAREHOUSE_TEMPLATES) => {
    const template = WAREHOUSE_TEMPLATES[templateKey];
    if (templateKey !== 'custom') {
      form.setValue('rackType', template.rackType);
      form.setValue('maxPallets', template.maxPallets);
    }
    setSelectedTemplate(templateKey);
    setCurrentStep(2);
  };

  // Gerar código baseado nos valores atuais
  const generateLiveCode = () => {
    const street = form.watch("street");
    const side = form.watch("side");
    const corridor = form.watch("corridor");
    const level = form.watch("level");
    
    if (!street || !side || !corridor || !level) return "";
    return `${street}-${side}-${corridor}-${level}`;
  };

  // Resetar formulário ao fechar
  const resetForm = () => {
    form.reset();
    setSelectedTemplate(null);
    setCurrentStep(1);
    setEditingPosition(null);
  };

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
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                resetForm();
              }}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Posição
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {editingPosition ? "Editar Posição" : "Assistente de Criação de Porta-Pallets"}
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                Configure facilmente as posições do seu armazém com nosso assistente passo a passo
              </DialogDescription>
            </DialogHeader>
            
            {!editingPosition ? (
              <Tabs value={currentStep.toString()} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="1" className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    1. Tipo de Armazém
                  </TabsTrigger>
                  <TabsTrigger value="2" className="flex items-center gap-2" disabled={!selectedTemplate}>
                    <MapPin className="h-4 w-4" />
                    2. Localização
                  </TabsTrigger>
                  <TabsTrigger value="3" className="flex items-center gap-2" disabled={currentStep < 3}>
                    <CheckCircle className="h-4 w-4" />
                    3. Finalizar
                  </TabsTrigger>
                </TabsList>

                {/* Etapa 1: Seleção de Template */}
                <TabsContent value="1" className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold mb-2">Escolha o Tipo de Armazém</h3>
                    <p className="text-gray-600">Selecione um template que melhor se adequa ao seu armazém</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(WAREHOUSE_TEMPLATES).map(([key, template]) => (
                      <Card 
                        key={key}
                        className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
                          selectedTemplate === key ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
                        }`}
                        onClick={() => applyTemplate(key as keyof typeof WAREHOUSE_TEMPLATES)}
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center justify-between">
                            {template.name}
                            {selectedTemplate === key && <CheckCircle className="h-5 w-5 text-blue-500" />}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Exemplo:</span>
                              <code className="bg-gray-100 px-2 py-1 rounded text-xs">{template.example}</code>
                            </div>
                            {key !== 'custom' && (
                              <>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Tipo:</span>
                                  <span>{template.rackType}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Max Pallets:</span>
                                  <span>{template.maxPallets}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* Etapa 2: Configuração da Localização */}
                <TabsContent value="2" className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold mb-2">Configure a Localização</h3>
                    <p className="text-gray-600">Defina os detalhes da posição no armazém</p>
                  </div>

                  <Form {...form}>
                    <div className="space-y-6">
                      {/* Preview do código em tempo real */}
                      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-dashed border-blue-200">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <Label className="text-sm font-medium text-gray-600">Código da Posição (Gerado Automaticamente)</Label>
                            <div className="mt-2 p-4 bg-white rounded-lg border-2 border-blue-200">
                              <code className="text-2xl font-bold text-blue-600">
                                {generateLiveCode() || "Preencha os campos abaixo"}
                              </code>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              onClick={() => {
                                if (generateLiveCode()) {
                                  navigator.clipboard.writeText(generateLiveCode());
                                  toast({ title: "Código copiado!", description: "O código foi copiado para a área de transferência" });
                                }
                              }}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copiar Código
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Campos de localização */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <FormField
                          control={form.control}
                          name="street"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                Rua
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="RUA01" {...field} className="font-mono" />
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
                                <Input placeholder="A01" {...field} className="font-mono" />
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
                                <Input placeholder="N01" {...field} className="font-mono" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Sugestões baseadas no template selecionado */}
                      {selectedTemplate && selectedTemplate !== 'custom' && (
                        <Card className="bg-yellow-50 border-yellow-200">
                          <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Info className="h-4 w-4" />
                              Sugestões para {WAREHOUSE_TEMPLATES[selectedTemplate].name}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <strong>Ruas sugeridas:</strong>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {WAREHOUSE_TEMPLATES[selectedTemplate].streets?.map((street) => (
                                    <Badge key={street} variant="outline" className="cursor-pointer" onClick={() => form.setValue('street', street)}>
                                      {street}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <strong>Corredores sugeridos:</strong>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {WAREHOUSE_TEMPLATES[selectedTemplate].corridors?.map((corridor) => (
                                    <Badge key={corridor} variant="outline" className="cursor-pointer" onClick={() => form.setValue('corridor', corridor)}>
                                      {corridor}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <strong>Níveis sugeridos:</strong>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {WAREHOUSE_TEMPLATES[selectedTemplate].levels?.map((level) => (
                                    <Badge key={level} variant="outline" className="cursor-pointer" onClick={() => form.setValue('level', level)}>
                                      {level}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Botões de navegação */}
                      <div className="flex justify-between">
                        <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>
                          Voltar
                        </Button>
                        <Button 
                          type="button" 
                          onClick={() => {
                            if (generateLiveCode()) {
                              form.setValue('code', generateLiveCode());
                              setCurrentStep(3);
                            } else {
                              toast({ title: "Campos obrigatórios", description: "Preencha todos os campos de localização", variant: "destructive" });
                            }
                          }}
                          disabled={!generateLiveCode()}
                        >
                          Próximo
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </Form>
                </TabsContent>

                {/* Etapa 3: Finalização */}
                <TabsContent value="3" className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold mb-2">Configurações Finais</h3>
                    <p className="text-gray-600">Complete as informações da posição e finalize o cadastro</p>
                  </div>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      {/* Resumo da configuração */}
                      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-green-700">
                            <CheckCircle className="h-5 w-5" />
                            Resumo da Configuração
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <strong>Código da Posição:</strong>
                              <div className="mt-1 p-2 bg-white rounded border">
                                <code className="text-lg font-bold text-blue-600">{generateLiveCode()}</code>
                              </div>
                            </div>
                            <div>
                              <strong>Template Selecionado:</strong>
                              <div className="mt-1 p-2 bg-white rounded border">
                                {selectedTemplate && WAREHOUSE_TEMPLATES[selectedTemplate].name}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Configurações específicas do porta-pallet */}
                      <div className="grid grid-cols-2 gap-6">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Layers className="h-5 w-5" />
                              Tipo de Porta-Pallet
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="rackType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Tipo</FormLabel>
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
                                      <SelectItem value="Flow-rack">Flow-rack</SelectItem>
                                      <SelectItem value="Pallet-shuttle">Pallet-shuttle</SelectItem>
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
                                  <FormLabel>Capacidade Máxima de Pallets</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      min="1" 
                                      max="20" 
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
                                  <FormLabel>Status Inicial</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Status" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="available">✅ Disponível</SelectItem>
                                      <SelectItem value="maintenance">🔧 Manutenção</SelectItem>
                                      <SelectItem value="blocked">🚫 Bloqueada</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Info className="h-5 w-5" />
                              Informações Adicionais
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="restrictions"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Restrições de Armazenagem</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="Ex: Apenas produtos não perecíveis, peso máximo 1000kg..."
                                      className="min-h-[80px]"
                                      {...field}
                                      value={field.value || ""}
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
                                    <Textarea 
                                      placeholder="Observações gerais sobre esta posição..."
                                      className="min-h-[80px]"
                                      {...field}
                                      value={field.value || ""}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>
                      </div>

                      {/* Botões de ação */}
                      <div className="flex justify-between">
                        <Button type="button" variant="outline" onClick={() => setCurrentStep(2)}>
                          Voltar
                        </Button>
                        <div className="flex gap-3">
                          <Button type="button" variant="outline" onClick={() => resetForm()}>
                            Cancelar
                          </Button>
                          <Button 
                            type="submit" 
                            className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-8"
                            disabled={createMutation.isPending}
                          >
                            {createMutation.isPending ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Criando...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Criar Posição
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            ) : (
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
            )}
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
