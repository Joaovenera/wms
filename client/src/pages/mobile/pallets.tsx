import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Search, 
  Camera, 
  QrCode, 
  Edit, 
  Trash2, 
  Image,
  CheckCircle,
  Clock,
  XCircle,
  Wrench,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPalletSchema, type InsertPallet, type Pallet } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CameraCapture from "@/components/camera-capture";
import QRCodeDialog from "@/components/qr-code-dialog";

// Status info for mobile display
const getStatusInfo = (status: string) => {
  switch (status) {
    case 'available':
      return {
        label: 'Disponível',
        icon: CheckCircle,
        color: 'bg-green-100 text-green-800 border-green-200',
        iconColor: 'text-green-600',
      };
    case 'in_use':
      return {
        label: 'Em Uso',
        icon: Clock,
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        iconColor: 'text-blue-600',
      };
    case 'defective':
      return {
        label: 'Defeituoso',
        icon: XCircle,
        color: 'bg-red-100 text-red-800 border-red-200',
        iconColor: 'text-red-600',
      };
    case 'maintenance':
      return {
        label: 'Manutenção',
        icon: Wrench,
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        iconColor: 'text-yellow-600',
      };
    case 'discard':
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

export default function MobilePallets() {
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

  const form = useForm<InsertPallet>({
    resolver: zodResolver(insertPalletSchema),
    defaultValues: {
      code: "",
      type: "",
      material: "",
      width: 0,
      length: 0,
      height: 0,
      maxWeight: "0",
      createdBy: 1,
      status: "available",
      photoUrl: "",
      observations: "",
    },
  });

  const { data: pallets, isLoading } = useQuery<Pallet[]>({
    queryKey: ["/api/pallets"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertPallet) => {
      const res = await apiRequest("POST", "/api/pallets", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pallets"] });
      setIsCreateOpen(false);
      setEditingPallet(null);
      form.reset();
      setPhotoPreview(null);
      toast({
        title: "Sucesso",
        description: "Pallet criado com sucesso!",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertPallet> }) => {
      const res = await apiRequest("PUT", `/api/pallets/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pallets"] });
      setIsCreateOpen(false);
      setEditingPallet(null);
      form.reset();
      setPhotoPreview(null);
      toast({
        title: "Sucesso",
        description: "Pallet atualizado com sucesso!",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/pallets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pallets"] });
      toast({
        title: "Sucesso",
        description: "Pallet excluído com sucesso!",
      });
    },
  });

  const filteredPallets = pallets?.filter(pallet => {
    const matchesSearch = pallet.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pallet.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pallet.material.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || pallet.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const handleCameraCapture = (imageData: string) => {
    if (imageData && imageData !== 'data:,') {
      setPhotoPreview(imageData);
      form.setValue('photoUrl', imageData);
    }
    setIsCameraOpen(false);
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
    form.reset({
      code: pallet.code,
      type: pallet.type,
      material: pallet.material,
      width: pallet.width,
      length: pallet.length,
      height: pallet.height,
      maxWeight: pallet.maxWeight.toString(),
      createdBy: pallet.createdBy,
      status: pallet.status,
      photoUrl: pallet.photoUrl || "",
      observations: pallet.observations || "",
    });
    setPhotoPreview(pallet.photoUrl);
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
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pallets</h1>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button 
              size="sm"
              onClick={() => {
                setEditingPallet(null);
                form.reset();
                setPhotoPreview(null);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm mx-4 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPallet ? "Editar Pallet" : "Novo Pallet"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código</FormLabel>
                      <FormControl>
                        <Input placeholder="PLT0001" {...field} />
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

                <div className="grid grid-cols-2 gap-2">
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
                            onChange={(e) => field.onChange(Number(e.target.value))}
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
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="height"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Altura (cm)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            {...field} 
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peso Máx (kg)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
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
                          <SelectItem value="available">Disponível</SelectItem>
                          <SelectItem value="in_use">Em Uso</SelectItem>
                          <SelectItem value="defective">Defeituoso</SelectItem>
                          <SelectItem value="maintenance">Manutenção</SelectItem>
                          <SelectItem value="discard">Descarte</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Photo Section */}
                <div className="space-y-3">
                  <FormLabel>Foto do Pallet</FormLabel>
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCameraOpen(true)}
                      className="flex-1"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {photoPreview ? "Alterar Foto" : "Tirar Foto"}
                    </Button>
                  </div>
                  
                  {photoPreview && (
                    <div className="mt-2">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-32 object-cover rounded-lg border"
                        onClick={() => setShowImageViewer(photoPreview)}
                      />
                    </div>
                  )}
                  
                  <FormField
                    control={form.control}
                    name="photoUrl"
                    render={({ field }) => (
                      <FormControl>
                        <Input type="hidden" {...field} value={field.value || ""} />
                      </FormControl>
                    )}
                  />
                </div>

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

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingPallet ? "Atualizar" : "Criar"} Pallet
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar pallets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="available">Disponível</SelectItem>
            <SelectItem value="in_use">Em Uso</SelectItem>
            <SelectItem value="defective">Defeituoso</SelectItem>
            <SelectItem value="maintenance">Manutenção</SelectItem>
            <SelectItem value="discard">Descarte</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pallets List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredPallets.map((pallet, index) => {
              const statusInfo = getStatusInfo(pallet.status);
              const StatusIcon = statusInfo.icon;
              
              return (
                <motion.div
                  key={pallet.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ 
                    duration: 0.3, 
                    delay: index * 0.1 
                  }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{pallet.code}</h3>
                          <p className="text-sm text-gray-600">{pallet.type} • {pallet.material}</p>
                        </div>
                        <Badge className={`${statusInfo.color} border text-xs px-2 py-1`}>
                          <StatusIcon className={`h-3 w-3 mr-1 ${statusInfo.iconColor}`} />
                          {statusInfo.label}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                        <div>
                          <span className="text-gray-500">Dimensões:</span>
                          <p className="font-medium">{pallet.width}×{pallet.length}×{pallet.height}cm</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Peso Máx:</span>
                          <p className="font-medium">{pallet.maxWeight}kg</p>
                        </div>
                      </div>

                      {pallet.photoUrl && (
                        <div className="mb-3">
                          <img
                            src={pallet.photoUrl}
                            alt={`Foto do pallet ${pallet.code}`}
                            className="w-full h-24 object-cover rounded-lg cursor-pointer"
                            onClick={() => setShowImageViewer(pallet.photoUrl!)}
                          />
                        </div>
                      )}
                      
                      <div className="flex justify-end space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleShowQRCode(pallet)}
                          title="QR Code"
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
          
          {filteredPallets.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nenhum pallet encontrado
            </div>
          )}
        </div>
      )}

      {/* Camera Capture */}
      <CameraCapture
        isOpen={isCameraOpen}
        onCapture={handleCameraCapture}
        onClose={() => setIsCameraOpen(false)}
      />

      {/* Image Viewer */}
      {showImageViewer && (
        <Dialog open={!!showImageViewer} onOpenChange={() => setShowImageViewer(null)}>
          <DialogContent className="max-w-sm mx-4">
            <DialogHeader>
              <DialogTitle>Foto do Pallet</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <img
                src={showImageViewer}
                alt="Foto do pallet"
                className="w-full h-auto rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* QR Code Dialog */}
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