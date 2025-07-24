import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ImageIcon, Plus, Trash2, Star, 
  Upload, History, Clock, User, ChevronLeft, 
  ChevronRight, X, ZoomIn, Download, CheckSquare, 
  Square, Check
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProductPhotoManagerProps {
  isOpen: boolean;
  onClose: () => void;
  productId: number;
  productName: string;
}

interface ProductPhoto {
  id: number;
  filename: string;
  url: string;
  path: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  isPrimary: boolean;
  uploadedAt: string;
  uploadedBy?: {
    id: number;
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

interface PhotoHistory {
  id: number;
  action: string;
  filename?: string;
  isPrimary?: boolean;
  performedAt: string;
  notes?: string;
  performedBy?: {
    id: number;
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

export default function ProductPhotoManager({ 
  isOpen, 
  onClose, 
  productId, 
  productName 
}: ProductPhotoManagerProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<{ file: File; preview: string; isPrimary: boolean }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [loadFullResolution, setLoadFullResolution] = useState(false);
  const { toast } = useToast();

  // Fetch product photos (thumbnails by default)
  const { data: photos = [], isLoading: photosLoading, refetch: refetchPhotos } = useQuery<ProductPhoto[]>({
    queryKey: [`/api/products/${productId}/photos`, { full: loadFullResolution }],
    queryFn: async () => {
      const url = `/api/products/${productId}/photos${loadFullResolution ? '?full=true' : ''}`;
      const response = await apiRequest('GET', url);
      return response.json();
    },
    enabled: isOpen && productId > 0,
  });

  // Fetch photo history
  const { data: history = [], isLoading: historyLoading } = useQuery<PhotoHistory[]>({
    queryKey: [`/api/products/${productId}/photo-history`],
    enabled: isOpen && productId > 0,
  });


  // Remove photo mutation
  const removeMutation = useMutation({
    mutationFn: async (photoId: number) => {
      const response = await apiRequest('DELETE', `/api/product-photos/${photoId}`, {
        notes: 'Photo removed by user'
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "🗑️ Foto Removida",
        description: "A foto foi removida com sucesso.",
      });
      refetchPhotos();
      queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}/photo-history`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao Remover",
        description: error.message || "Erro ao remover foto",
        variant: "destructive",
      });
    },
  });

  // Set primary photo mutation
  const setPrimaryMutation = useMutation({
    mutationFn: async (photoId: number) => {
      const response = await apiRequest('PUT', `/api/product-photos/${photoId}/set-primary`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "⭐ Foto Principal",
        description: "Foto definida como principal com sucesso.",
      });
      refetchPhotos();
      queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}/photo-history`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao definir foto principal",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate files
    const validFiles: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Arquivo Inválido",
          description: `${file.name} não é uma imagem válida.`,
          variant: "destructive",
        });
        continue;
      }

      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        toast({
          title: "Arquivo Muito Grande",
          description: `${file.name} deve ter no máximo 100MB.`,
          variant: "destructive",
        });
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setSelectedFiles(validFiles);
    
    // Generate previews for all valid files
    const previewPromises = validFiles.map((file, index) => {
      return new Promise<{ file: File; preview: string; isPrimary: boolean }>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            file,
            preview: e.target?.result as string,
            isPrimary: photos.length === 0 && index === 0, // First file is primary if no photos exist
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(previewPromises).then((previews) => {
      setUploadPreviews(previews);
    });
  };

  const handleBulkUpload = async () => {
    if (uploadPreviews.length === 0) return;
    
    setIsUploading(true);
    
    // Initialize progress for all files
    const initialProgress = uploadPreviews.reduce((acc, preview) => {
      acc[preview.file.name] = 0;
      return acc;
    }, {} as { [key: string]: number });
    setUploadProgress(initialProgress);
    
    // Create upload promises for all files simultaneously
    const uploadPromises = uploadPreviews.map(async (preview) => {
      const progressKey = preview.file.name;
      
      try {
        // Convert file to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(preview.file);
        });
        
        const base64 = await base64Promise;
        
        // Update progress to 25% after base64 conversion
        setUploadProgress(prev => ({ ...prev, [progressKey]: 25 }));
        
        const photoData = {
          filename: preview.file.name,
          path: `/uploads/products/${productId}/${preview.file.name}`,
          url: base64,
          size: preview.file.size,
          mimeType: preview.file.type,
          width: null,
          height: null,
          isPrimary: preview.isPrimary,
          productId,
        };

        // Update progress to 50% before API call
        setUploadProgress(prev => ({ ...prev, [progressKey]: 50 }));
        
        const response = await apiRequest('POST', `/api/products/${productId}/photos`, photoData);
        await response.json();
        
        // Update progress to 100% after successful upload
        setUploadProgress(prev => ({ ...prev, [progressKey]: 100 }));
        
        return { success: true, filename: preview.file.name };
        
      } catch (error) {
        console.error(`Error uploading ${preview.file.name}:`, error);
        
        // Mark as failed in progress
        setUploadProgress(prev => ({ ...prev, [progressKey]: -1 }));
        
        return { success: false, filename: preview.file.name, error };
      }
    });
    
    try {
      // Wait for all uploads to complete simultaneously
      const results = await Promise.all(uploadPromises);
      
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;
      
      if (successCount > 0) {
        toast({
          title: "📸 Upload Concluído!",
          description: `${successCount} foto(s) enviada(s) com sucesso.${failedCount > 0 ? ` ${failedCount} falharam.` : ''}`,
        });
        
        // Reset form
        setSelectedFiles([]);
        setUploadPreviews([]);
        setUploadProgress({});
        
        // Refetch data
        refetchPhotos();
        queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}/photo-history`] });
      } else {
        toast({
          title: "Erro no Upload",
          description: "Nenhuma foto foi enviada com sucesso.",
          variant: "destructive",
        });
      }
      
      // Show individual error messages for failed uploads
      const failedUploads = results.filter(r => !r.success);
      failedUploads.forEach((result, index) => {
        // Delay error messages to avoid spam
        setTimeout(() => {
          toast({
            title: "Erro no Upload",
            description: `Erro ao enviar ${result.filename}`,
            variant: "destructive",
          });
        }, index * 1000);
      });
      
    } catch (error) {
      console.error('Bulk upload error:', error);
      toast({
        title: "Erro no Upload",
        description: "Erro durante o upload das fotos",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const togglePrimaryPhoto = (index: number) => {
    setUploadPreviews(prev => 
      prev.map((preview, i) => ({
        ...preview,
        isPrimary: i === index
      }))
    );
  };

  const removePreview = (index: number) => {
    const newPreviews = uploadPreviews.filter((_, i) => i !== index);
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    
    // If we removed the primary photo, set the first remaining as primary
    if (newPreviews.length > 0 && !newPreviews.some(p => p.isPrimary)) {
      newPreviews[0].isPrimary = true;
    }
    
    setUploadPreviews(newPreviews);
    setSelectedFiles(newFiles);
  };

  const handleRemovePhoto = (photoId: number) => {
    if (confirm('Tem certeza que deseja remover esta foto?')) {
      removeMutation.mutate(photoId);
    }
  };

  const handleSetPrimary = (photoId: number) => {
    setPrimaryMutation.mutate(photoId);
  };

  const openGallery = (photoIndex: number) => {
    setCurrentPhotoIndex(photoIndex);
    setGalleryOpen(true);
  };

  const closeGallery = () => {
    setGalleryOpen(false);
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (photos.length === 0) return;
    
    if (direction === 'prev') {
      setCurrentPhotoIndex(prev => prev === 0 ? photos.length - 1 : prev - 1);
    } else {
      setCurrentPhotoIndex(prev => prev === photos.length - 1 ? 0 : prev + 1);
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!galleryOpen) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          navigatePhoto('prev');
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigatePhoto('next');
          break;
        case 'Escape':
          e.preventDefault();
          closeGallery();
          break;
      }
    };

    if (galleryOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [galleryOpen, photos.length]);

  // Download functionality
  const downloadPhoto = async (photo: ProductPhoto) => {
    try {
      // Get full resolution URL for download
      const fullResResponse = await apiRequest('GET', `/api/product-photos/${photo.id}?full=true`);
      const fullResPhoto = await fullResResponse.json();
      
      const response = await fetch(fullResPhoto.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = photo.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "📥 Download Concluído",
        description: `${photo.filename} foi baixado com sucesso.`,
      });
    } catch (error) {
      toast({
        title: "Erro no Download",
        description: "Não foi possível baixar a imagem.",
        variant: "destructive",
      });
    }
  };

  // Selection functions
  const togglePhotoSelection = (photoId: number) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const selectAllPhotos = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)));
    }
  };

  const downloadSelectedPhotos = async () => {
    if (selectedPhotos.size === 0) return;

    const selectedPhotoObjects = photos.filter(p => selectedPhotos.has(p.id));
    
    for (const photo of selectedPhotoObjects) {
      await downloadPhoto(photo);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    toast({
      title: "📦 Downloads Concluídos",
      description: `${selectedPhotos.size} foto(s) foram baixadas com sucesso.`,
    });
    
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };

  const cancelSelection = () => {
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'added':
        return <Badge className="bg-green-100 text-green-800">Adicionada</Badge>;
      case 'removed':
        return <Badge className="bg-red-100 text-red-800">Removida</Badge>;
      case 'set_primary':
        return <Badge className="bg-blue-100 text-blue-800">Definida como Principal</Badge>;
      case 'unset_primary':
        return <Badge className="bg-gray-100 text-gray-800">Removida como Principal</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Gerenciar Fotos - {productName}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="photos" className="w-full">
            <div className="flex justify-between items-center mb-4">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="photos" className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Fotos ({photos.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico
                </TabsTrigger>
              </TabsList>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLoadFullResolution(!loadFullResolution)}
                className="flex items-center gap-2"
                disabled={photosLoading}
              >
                <ZoomIn className="h-4 w-4" />
                {loadFullResolution ? 'Thumbnails' : 'Alta Resolução'}
              </Button>
            </div>

            <TabsContent value="photos" className="space-y-4">
              {/* Upload Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Nova Foto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="photo-upload">Selecionar Arquivos</Label>
                    <Input
                      id="photo-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      disabled={isUploading}
                    />
                    {selectedFiles.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {selectedFiles.length} arquivo(s) selecionado(s)
                      </div>
                    )}
                  </div>
                  
                  {uploadPreviews.length > 0 && (
                    <div className="space-y-4">
                      <Label>Prévia das Fotos</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-64 overflow-y-auto">
                        {uploadPreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <div className="aspect-square bg-gray-50 rounded border overflow-hidden">
                              <img 
                                src={preview.preview} 
                                alt={preview.file.name} 
                                className="w-full h-full object-contain"
                              />
                            </div>
                            
                            {/* Upload Progress */}
                            {isUploading && uploadProgress[preview.file.name] !== undefined && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                                {uploadProgress[preview.file.name] === -1 ? (
                                  <div className="text-red-400 text-sm font-medium">
                                    Erro!
                                  </div>
                                ) : (
                                  <div className="text-white text-sm">
                                    {uploadProgress[preview.file.name]}%
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Primary Badge */}
                            {preview.isPrimary && (
                              <div className="absolute top-1 left-1">
                                <Badge className="bg-blue-500 text-white text-xs">
                                  <Star className="h-2 w-2 mr-1" />
                                  Principal
                                </Badge>
                              </div>
                            )}
                            
                            {/* Remove Button */}
                            {!isUploading && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removePreview(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                            
                            <div className="mt-1 space-y-1">
                              <div className="text-xs font-medium truncate">
                                {preview.file.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatFileSize(preview.file.size)}
                              </div>
                              
                              {/* Primary Toggle */}
                              {!isUploading && (
                                <Button
                                  size="sm"
                                  variant={preview.isPrimary ? "default" : "outline"}
                                  className="w-full h-6 text-xs"
                                  onClick={() => togglePrimaryPhoto(index)}
                                  disabled={preview.isPrimary}
                                >
                                  {preview.isPrimary ? "Principal" : "Tornar Principal"}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex items-center justify-between pt-2">
                        <div className="text-sm text-muted-foreground">
                          {uploadPreviews.filter(p => p.isPrimary).length > 0 ? (
                            <>
                              <Star className="h-4 w-4 inline mr-1" />
                              Uma foto será definida como principal
                            </>
                          ) : (
                            "Selecione uma foto como principal"
                          )}
                        </div>
                        <Button 
                          onClick={handleBulkUpload}
                          disabled={isUploading || uploadPreviews.length === 0}
                          className="flex items-center gap-2"
                        >
                          <Upload className="h-4 w-4" />
                          {isUploading ? (
                            `Enviando... (${Object.values(uploadProgress).filter(p => p === 100).length}/${uploadPreviews.length})`
                          ) : (
                            `Enviar ${uploadPreviews.length} Foto(s)`
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Selection Toolbar */}
              {photos.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {!isSelectionMode ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSelectionMode(true)}
                      >
                        <CheckSquare className="h-4 w-4 mr-2" />
                        Selecionar Fotos
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={selectAllPhotos}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          {selectedPhotos.size === photos.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {selectedPhotos.size} selecionada(s)
                        </span>
                      </>
                    )}
                  </div>
                  
                  {isSelectionMode && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={downloadSelectedPhotos}
                        disabled={selectedPhotos.size === 0}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Baixar ({selectedPhotos.size})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelSelection}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Photos Grid */}
              <ScrollArea className="h-[400px]">
                {photosLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Carregando fotos...</div>
                  </div>
                ) : photos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mb-2" />
                    <p>Nenhuma foto encontrada</p>
                    <p className="text-sm">Adicione a primeira foto do produto</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {photos.map((photo, index) => (
                      <Card key={photo.id} className={`relative ${photo.isPrimary ? 'ring-2 ring-blue-500' : ''} ${selectedPhotos.has(photo.id) && isSelectionMode ? 'ring-2 ring-green-500' : ''}`}>
                        <CardContent className="p-3">
                          <div 
                            className="relative group cursor-pointer overflow-hidden rounded bg-gray-50" 
                            onClick={() => isSelectionMode ? togglePhotoSelection(photo.id) : openGallery(index)}
                          >
                            <div className="relative w-full" style={{ paddingBottom: '75%' }}>
                              <img 
                                src={photo.url} 
                                alt={photo.filename}
                                className="absolute inset-0 w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 rounded flex items-center justify-center">
                                {!isSelectionMode ? (
                                  <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                                ) : (
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    {selectedPhotos.has(photo.id) ? (
                                      <CheckSquare className="h-8 w-8 text-green-500" />
                                    ) : (
                                      <Square className="h-8 w-8 text-white" />
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {isSelectionMode && (
                                <div className="absolute top-2 right-2 z-10">
                                  {selectedPhotos.has(photo.id) ? (
                                    <CheckSquare className="h-5 w-5 text-green-500 bg-white rounded" />
                                  ) : (
                                    <Square className="h-5 w-5 text-gray-400 bg-white rounded" />
                                  )}
                                </div>
                              )}
                              
                              {photo.isPrimary && (
                                <div className="absolute top-2 left-2 z-10">
                                  <Badge variant="secondary" className="bg-blue-500 text-white">
                                    <Star className="h-3 w-3 mr-1" />
                                    Principal
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-2 mt-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium truncate flex-1">
                                {photo.filename}
                              </span>
                            </div>
                            
                            <div className="text-xs text-muted-foreground">
                              <div>{formatFileSize(photo.size)}</div>
                              <div>
                                Por: {photo.uploadedBy?.firstName || photo.uploadedBy?.email || 'Usuário'}
                              </div>
                              <div>
                                {format(new Date(photo.uploadedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </div>
                            </div>

                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadPhoto(photo)}
                                className="flex-1 text-xs px-2 py-1 h-auto"
                                title="Baixar foto"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                              {!photo.isPrimary && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSetPrimary(photo.id)}
                                  disabled={setPrimaryMutation.isPending}
                                  className="flex-1 text-xs px-2 py-1 h-auto"
                                  title="Tornar principal"
                                >
                                  <Star className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRemovePhoto(photo.id)}
                                disabled={removeMutation.isPending}
                                className="flex-1 text-xs px-2 py-1 h-auto"
                                title="Remover foto"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history">
              <ScrollArea className="h-[500px]">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Carregando histórico...</div>
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mb-2" />
                    <p>Nenhum histórico encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((entry) => (
                      <Card key={entry.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                {getActionBadge(entry.action)}
                                {entry.filename && (
                                  <span className="text-sm font-medium">{entry.filename}</span>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {entry.performedBy?.firstName || entry.performedBy?.email || 'Usuário'}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(entry.performedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </div>
                              </div>
                              
                              {entry.notes && (
                                <p className="text-sm text-muted-foreground">{entry.notes}</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Gallery Modal */}
      {galleryOpen && photos.length > 0 && (
        <Dialog open={galleryOpen} onOpenChange={closeGallery}>
          <DialogContent className="max-w-7xl max-h-[95vh] p-0 bg-black/95">
            <div className="relative w-full h-[95vh] flex items-center justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                onClick={closeGallery}
              >
                <X className="h-6 w-6" />
              </Button>

              {photos.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                    onClick={() => navigatePhoto('prev')}
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                    onClick={() => navigatePhoto('next')}
                  >
                    <ChevronRight className="h-8 w-8" />
                  </Button>
                </>
              )}

              <div className="relative max-w-full max-h-full flex items-center justify-center p-8">
                <img
                  src={photos[currentPhotoIndex]?.url}
                  alt={photos[currentPhotoIndex]?.filename}
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              <div className="absolute bottom-4 left-4 right-4 bg-black/80 text-white p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium text-lg mb-1">
                      {photos[currentPhotoIndex]?.filename}
                    </h3>
                    <div className="text-sm text-gray-300 space-y-1">
                      <div>
                        Tamanho: {formatFileSize(photos[currentPhotoIndex]?.size || 0)}
                      </div>
                      <div>
                        Enviado por: {photos[currentPhotoIndex]?.uploadedBy?.firstName || photos[currentPhotoIndex]?.uploadedBy?.email || 'Usuário'}
                      </div>
                      <div>
                        {format(new Date(photos[currentPhotoIndex]?.uploadedAt || new Date()), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {photos[currentPhotoIndex]?.isPrimary && (
                      <Badge className="bg-blue-500">
                        <Star className="h-3 w-3 mr-1" />
                        Principal
                      </Badge>
                    )}
                    {photos.length > 1 && (
                      <div className="text-sm bg-white/20 px-2 py-1 rounded">
                        {currentPhotoIndex + 1} de {photos.length}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => downloadPhoto(photos[currentPhotoIndex])}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Baixar
                  </Button>
                  {!photos[currentPhotoIndex]?.isPrimary && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSetPrimary(photos[currentPhotoIndex]?.id)}
                      disabled={setPrimaryMutation.isPending}
                    >
                      <Star className="h-3 w-3 mr-1" />
                      Tornar Principal
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRemovePhoto(photos[currentPhotoIndex]?.id)}
                    disabled={removeMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remover
                  </Button>
                </div>
              </div>

              {photos.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-2xl">
                  <div className="flex gap-2 p-2 bg-black/80 rounded-lg overflow-x-auto">
                    {photos.map((photo, index) => (
                      <button
                        key={photo.id}
                        onClick={() => setCurrentPhotoIndex(index)}
                        className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-colors ${
                          index === currentPhotoIndex ? 'border-blue-500' : 'border-transparent hover:border-white/50'
                        }`}
                      >
                        <img
                          src={photo.url}
                          alt={photo.filename}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}