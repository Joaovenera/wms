import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { type Pallet, type InsertPallet } from "@/types/api";
import { insertPalletSchema } from "@/types/schemas";
import { Plus, Search, Edit, Trash2, Layers as PalletIcon, Camera, Image, CheckCircle, AlertCircle, Wrench, XCircle, Clock, Eye, QrCode, Printer, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CameraCapture from "@/components/camera-capture";
import QRCodeDialog from "@/components/qr-code-dialog";

// Função para obter informações do status
const getStatusInfo = (status: string) => {
  switch (status) {
    case 'disponivel':
      return {
        label: 'Disponível',
        icon: CheckCircle,
        color: 'bg-green-100 text-green-800 border-green-200',
        iconColor: 'text-green-600',
      };
    case 'em_uso':
      return {
        label: 'Em Uso',
        icon: Clock,
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        iconColor: 'text-blue-600',
      };
    case 'defeituoso':
      return {
        label: 'Defeituoso',
        icon: XCircle,
        color: 'bg-red-100 text-red-800 border-red-200',
        iconColor: 'text-red-600',
      };
    case 'manutencao':
      return {
        label: 'Manutenção',
        icon: Wrench,
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        iconColor: 'text-yellow-600',
      };
    case 'descarte':
      return {
        label: 'Descarte',
        icon: AlertCircle,
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        iconColor: 'text-gray-600',
      };
    default:
      return {
        label: 'Indefinido',
        icon: AlertCircle,
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        iconColor: 'text-gray-600',
      };
  }
};

// Valores padrão para cada tipo de pallet
const palletTypeDefaults = {
  PBR: {
    width: 100,
    length: 120,
    height: 14,
    maxWeight: 1500
  },
  Europeu: {
    width: 80,
    length: 120,
    height: 14.4,
    maxWeight: 1500
  },
  Chep: {
    width: 110,
    length: 110,
    height: 15,
    maxWeight: 1250
  },
  Americano: {
    width: 101.6,
    length: 121.9,
    height: 14,
    maxWeight: 1360
  }
};

export default function Pallets() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPallet, setEditingPallet] = useState<Pallet | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showImageViewer, setShowImageViewer] = useState<string | null>(null);
  const [qrCodeDialog, setQrCodeDialog] = useState<{ isOpen: boolean; pallet: Pallet | null }>({
    isOpen: false,
    pallet: null
  });
  const { toast } = useToast();

  const { data: pallets, isLoading, refetch } = useQuery<Pallet[]>({
    queryKey: ['/api/pallets'],
  });

  // Atualização automática quando filtros mudam
  useEffect(() => {
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      refetch();
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, refetch]);

  // Função para forçar atualização
  const forceRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
    queryClient.refetchQueries({ queryKey: ['/api/pallets'] });
    refetch();
  };

  // Handler para Enter no campo de busca
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      forceRefresh();
    }
  };

  const form = useForm<InsertPallet>({
    resolver: zodResolver(insertPalletSchema.omit({ createdBy: true })),
    defaultValues: {
      code: "",
      type: "",
      material: "",
      width: 0,
      length: 0,
      height: 0,
      maxWeight: "0",
      status: "disponivel",
      photoUrl: "",
      observations: "",
    },
  });

  // Busca o próximo código automático quando abre o diálogo de criação
  const generateNextCode = async () => {
    if (!editingPallet) {
      try {
        const response = await fetch('/api/pallets/next-code');
        if (response.ok) {
          const data = await response.json();
          form.setValue('code', data.code);
        }
      } catch (error) {
        console.error('Erro ao gerar próximo código:', error);
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: InsertPallet) => {
      await apiRequest('POST', '/api/pallets', data);
    },
    onSuccess: () => {
      // Invalida todas as queries relacionadas a pallets
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      // Força refetch imediato
      queryClient.refetchQueries({ queryKey: ['/api/pallets'] });
      toast({
        title: "Sucesso",
        description: "Layers criado com sucesso",
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
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertPallet> }) => {
      await apiRequest('PUT', `/api/pallets/${id}`, data);
    },
    onSuccess: () => {
      // Invalida todas as queries relacionadas a pallets
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      // Força refetch imediato
      queryClient.refetchQueries({ queryKey: ['/api/pallets'] });
      toast({
        title: "Sucesso",
        description: "Layers atualizado com sucesso",
      });
      setEditingPallet(null);
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
      await apiRequest('DELETE', `/api/pallets/${id}`);
    },
    onSuccess: () => {
      // Invalida todas as queries relacionadas a pallets
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      // Força refetch imediato
      queryClient.refetchQueries({ queryKey: ['/api/pallets'] });
      toast({
        title: "Sucesso",
        description: "Layers excluído com sucesso",
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

  // Log dos dados recebidos para debug
  console.log('Dados dos pallets recebidos:', pallets);
  console.log('Status filter atual:', statusFilter);

  const filteredPallets = pallets?.filter(pallet => {
    const matchesSearch = !searchTerm || 
      pallet.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pallet.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pallet.material.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || pallet.status === statusFilter;
    
    console.log(`Pallet ${pallet.code}: status="${pallet.status}", filter="${statusFilter}", matchesStatus=${matchesStatus}, matchesSearch=${matchesSearch}`);
    
    return matchesSearch && matchesStatus;
  }) || [];

  console.log(`Total pallets: ${pallets?.length || 0}, Filtered: ${filteredPallets.length}`);

  const handleCameraCapture = (imageData: string) => {
    if (imageData && imageData !== 'data:,') {
      setPhotoPreview(imageData);
      form.setValue('photoUrl', imageData);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    form.setValue('photoUrl', '');
  };

  const onSubmit = (data: InsertPallet) => {
    if (editingPallet) {
      updateMutation.mutate({ id: editingPallet.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (pallet: Pallet) => {
    setEditingPallet(pallet);
    setPhotoPreview(pallet.photoUrl || null);
    form.reset({
      code: pallet.code,
      type: pallet.type,
      material: pallet.material,
      width: pallet.width,
      length: pallet.length,
      height: pallet.height,
      maxWeight: pallet.maxWeight,
      status: pallet.status,
      photoUrl: pallet.photoUrl || "",
      observations: pallet.observations || "",
    });
    setIsCreateOpen(true);
  };

  const handleDelete = (pallet: Pallet) => {
    if (confirm(`Tem certeza que deseja excluir o pallet ${pallet.code}?`)) {
      deleteMutation.mutate(pallet.id);
    }
  };

  const handleShowQRCode = (pallet: Pallet) => {
    setQrCodeDialog({ isOpen: true, pallet });
  };

  const handleCloseQRCode = () => {
    setQrCodeDialog({ isOpen: false, pallet: null });
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pallets</h1>
          <p className="text-gray-600">Gerenciamento de pallets do armazém</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
              queryClient.refetchQueries({ queryKey: ['/api/pallets'] });
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Recarregar
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  setEditingPallet(null);
                  form.reset();
                  setPhotoPreview(null);
                  generateNextCode();
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Pallet
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPallet ? "Editar Layers" : "Nova Layers"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código</FormLabel>
                        <FormControl>
                          <div className="flex space-x-2">
                            <Input placeholder="PLT0001" {...field} className="flex-1" />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={generateNextCode}
                              title="Gerar código automático"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Aplicar valores padrão baseado no tipo selecionado
                            const defaults = palletTypeDefaults[value as keyof typeof palletTypeDefaults];
                            if (defaults) {
                              form.setValue('width', defaults.width);
                              form.setValue('length', defaults.length);
                              form.setValue('height', defaults.height);
                              form.setValue('maxWeight', defaults.maxWeight.toString());
                            }
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PBR">PBR</SelectItem>
                            <SelectItem value="Europeu">Europeu</SelectItem>
                            <SelectItem value="Chep">Chep</SelectItem>
                            <SelectItem value="Americano">Americano</SelectItem>
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
                    name="material"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Material</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o material" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Madeira">Madeira</SelectItem>
                            <SelectItem value="Plástico">Plástico</SelectItem>
                            <SelectItem value="Metal">Metal</SelectItem>
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
                                            <SelectItem value="disponivel">Disponível</SelectItem>
                <SelectItem value="em_uso">Em Uso</SelectItem>
                <SelectItem value="defeituoso">Defeituoso</SelectItem>
                <SelectItem value="recuperacao">Recuperação</SelectItem>
                <SelectItem value="descarte">Descarte</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="width"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Largura (cm)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
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
                    name="length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comprimento (cm)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
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
                    name="height"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Altura (cm)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
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
                  name="maxWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacidade Máxima (kg)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="photoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Foto do Pallet</FormLabel>
                      <div className="space-y-3">
                        {/* Preview da foto */}
                        {photoPreview && (
                          <div className="relative">
                            <img
                              src={photoPreview}
                              alt="Preview do pallet"
                              className="w-full h-48 object-cover rounded-lg border"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowImageViewer(photoPreview)}
                              className="absolute top-2 left-2"
                            >
                              <Image className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={handleRemovePhoto}
                              className="absolute top-2 right-2"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        
                        {/* Botões de ação */}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCameraOpen(true)}
                            className="flex-1"
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            {photoPreview ? 'Refazer Foto' : 'Capturar Foto'}
                          </Button>
                        </div>
                      </div>
                      <FormControl>
                        <Input type="hidden" {...field} value={field.value || ""} />
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
                    onClick={() => {
                      setIsCreateOpen(false);
                      setEditingPallet(null);
                      setPhotoPreview(null);
                      form.reset();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingPallet ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar pallets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos os Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
                            <SelectItem value="disponivel">Disponível</SelectItem>
                <SelectItem value="em_uso">Em Uso</SelectItem>
                <SelectItem value="defeituoso">Defeituoso</SelectItem>
                <SelectItem value="recuperacao">Manutenção</SelectItem>
                <SelectItem value="descarte">Descarte</SelectItem>
          </SelectContent>
        </Select>

      </div>

      {/* Pallets Grid */}
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
          <AnimatePresence>
            {filteredPallets.map((pallet, index) => {
              const statusInfo = getStatusInfo(pallet.status);
              const StatusIcon = statusInfo.icon;
              
              return (
                <motion.div
                  key={pallet.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ 
                    duration: 0.3, 
                    delay: index * 0.1 
                  }}
                  whileHover={{ 
                    scale: 1.02,
                    transition: { duration: 0.2 }
                  }}
                  className="group"
                >
                  <Card className="relative overflow-hidden border-2 hover:border-blue-200 transition-all duration-300 shadow-md hover:shadow-lg">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center">
                          <PalletIcon className="h-5 w-5 mr-2" />
                          {pallet.code}
                        </CardTitle>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${statusInfo.color}`}>
                          <StatusIcon className={`h-4 w-4 ${statusInfo.iconColor}`} />
                          <span className="text-sm font-medium">{statusInfo.label}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Tipo:</span>
                          <span className="font-medium">{pallet.type}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Material:</span>
                          <span className="font-medium">{pallet.material}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Dimensões:</span>
                          <span className="font-medium">
                            {pallet.width}×{pallet.length}×{pallet.height}cm
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Carga máx:</span>
                          <span className="font-medium">{pallet.maxWeight}kg</span>
                        </div>
                        {pallet.observations && (
                          <div className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                            {pallet.observations}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-end space-x-1 mt-4">
                        {pallet.photoUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowImageViewer(pallet.photoUrl!)}
                            title="Ver foto"
                          >
                            <Image className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleShowQRCode(pallet)}
                          title="Gerar QR Code"
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(pallet)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(pallet)}
                          disabled={deleteMutation.isPending}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {filteredPallets.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-12">
              <PalletIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum pallet encontrado
              </h3>
              <p className="text-gray-600">
                {searchTerm ? "Tente ajustar os filtros de busca" : "Comece criando um novo pallet"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Componente de Câmera */}
      <CameraCapture
        isOpen={isCameraOpen}
        onCapture={handleCameraCapture}
        onClose={() => setIsCameraOpen(false)}
      />

      {/* Visualizador de Imagem */}
      {showImageViewer && (
        <Dialog open={!!showImageViewer} onOpenChange={() => setShowImageViewer(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Visualizar Foto do Pallet</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <img
                src={showImageViewer}
                alt="Foto do pallet"
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Diálogo de QR Code */}
      {qrCodeDialog.pallet && (
        <QRCodeDialog
          isOpen={qrCodeDialog.isOpen}
          onClose={handleCloseQRCode}
          palletCode={qrCodeDialog.pallet.code}
          palletData={{
            code: qrCodeDialog.pallet.code,
            type: qrCodeDialog.pallet.type,
            material: qrCodeDialog.pallet.material,
            dimensions: `${qrCodeDialog.pallet.width}×${qrCodeDialog.pallet.length}×${qrCodeDialog.pallet.height}cm`,
            maxWeight: `${qrCodeDialog.pallet.maxWeight}kg`
          }}
        />
      )}
    </div>
  );
}
