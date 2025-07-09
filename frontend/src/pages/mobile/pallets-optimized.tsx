import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  AlertCircle,
  RefreshCw,
  Loader2,
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
import { DialogDescription } from "@/components/ui/dialog";
import {
  insertPalletSchema,
  type InsertPallet,
  type Pallet,
} from "@/types/api";
import { insertPalletSchema } from "@/types/schemas";
import { apiRequest } from "@/lib/queryClient";
import { optimizedQueryClient } from "@/lib/optimizedQueryClient";
import { useToast } from "@/hooks/use-toast";
import PalletForm from "@/components/pallet-form";
import CameraCapture from "@/components/camera-capture";
import QRCodeDialog from "@/components/qr-code-dialog";

// Optimized status info with memoization
const getStatusInfo = (status: string) => {
  const statusMap = {
    available: {
      label: "Disponível",
      icon: CheckCircle,
      color: "bg-green-100 text-green-800 border-green-200",
      iconColor: "text-green-600",
    },
    in_use: {
      label: "Em Uso",
      icon: Clock,
      color: "bg-blue-100 text-blue-800 border-blue-200",
      iconColor: "text-blue-600",
    },
    defective: {
      label: "Defeituoso",
      icon: XCircle,
      color: "bg-red-100 text-red-800 border-red-200",
      iconColor: "text-red-600",
    },
    maintenance: {
      label: "Manutenção",
      icon: Wrench,
      color: "bg-yellow-100 text-yellow-800 border-yellow-200",
      iconColor: "text-yellow-600",
    },
    discard: {
      label: "Descarte",
      icon: AlertCircle,
      color: "bg-gray-100 text-gray-800 border-gray-200",
      iconColor: "text-gray-600",
    },
  };
  return statusMap[status as keyof typeof statusMap] || statusMap.discard;
};

// Optimized image component with lazy loading
const OptimizedImage = ({ src, alt, className, onClick }: {
  src: string;
  alt: string;
  className: string;
  onClick?: () => void;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) return null;

  return (
    <div className={`relative ${className}`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
          <Image className="h-6 w-6 text-gray-400" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity`}
        onClick={onClick}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
};

// Virtual scrolling hook for large lists
const useVirtualScroll = (items: Pallet[], itemHeight: number = 180) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const start = Math.floor(scrollTop / itemHeight);
      const end = Math.min(start + Math.ceil(containerHeight / itemHeight) + 2, items.length);
      setVisibleRange({ start, end });
    };

    const handleResize = () => {
      setContainerHeight(window.innerHeight);
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [items.length, itemHeight, containerHeight]);

  return visibleRange;
};

// Main optimized component
export default function OptimizedMobilePallets() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPallet, setEditingPallet] = useState<Pallet | null>(null);
  const [showImageViewer, setShowImageViewer] = useState<string | null>(null);
  const [qrCodeDialog, setQrCodeDialog] = useState<{
    isOpen: boolean;
    pallet: Pallet | null;
  }>({
    isOpen: false,
    pallet: null,
  });
  const { toast } = useToast();

  // Optimized data fetching with reduced refetch
  const {
    data: pallets,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<Pallet[]>({
    queryKey: ["/api/pallets"],
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchInterval: false, // Disable automatic refetch
  });

  // Debounced search to reduce API calls
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      // Only refetch if search term is significant
      if (term.length >= 2 || term.length === 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/pallets"] });
      }
    }, 500),
    []
  );

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  // Memoized filtered pallets
  const filteredPallets = useMemo(() => {
    if (!pallets) return [];
    
    return pallets.filter((pallet) => {
      const matchesSearch = searchTerm.length < 2 || 
        pallet.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pallet.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pallet.material.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || pallet.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [pallets, searchTerm, statusFilter]);

  // Virtual scrolling for performance
  const visibleRange = useVirtualScroll(filteredPallets);
  const visiblePallets = filteredPallets.slice(visibleRange.start, visibleRange.end);

  // Optimized mutations with minimal invalidation
  const createMutation = useMutation({
    mutationFn: async (data: InsertPallet) => {
      const res = await apiRequest("POST", "/api/pallets", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pallets"] });
      setIsCreateOpen(false);
      setEditingPallet(null);
      toast({
        title: "Sucesso",
        description: "Pallet criado com sucesso!",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<InsertPallet>;
    }) => {
      const res = await apiRequest("PUT", `/api/pallets/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pallets"] });
      setIsCreateOpen(false);
      setEditingPallet(null);
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

  // Optimized handlers
  const handleEdit = useCallback((pallet: Pallet) => {
    setEditingPallet(pallet);
    setIsCreateOpen(true);
  }, []);

  const handleDelete = useCallback((pallet: Pallet) => {
    if (confirm(`Tem certeza que deseja excluir o pallet ${pallet.code}?`)) {
      deleteMutation.mutate(pallet.id);
    }
  }, [deleteMutation]);

  const handleShowQRCode = useCallback((pallet: Pallet) => {
    setQrCodeDialog({ isOpen: true, pallet });
  }, []);

  const handleCloseQRCode = useCallback(() => {
    setQrCodeDialog({ isOpen: false, pallet: null });
  }, []);

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pallets</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={() => {
                  setEditingPallet(null);
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
                <DialogDescription>
                  {editingPallet
                    ? "Modifique as informações do pallet abaixo"
                    : "Preencha os dados para criar um novo pallet"}
                </DialogDescription>
              </DialogHeader>
              <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <PalletForm
                  editingPallet={editingPallet}
                  onSubmit={(data) => {
                    if (editingPallet) {
                      updateMutation.mutate({ id: editingPallet.id, data });
                    } else {
                      createMutation.mutate(data);
                    }
                  }}
                  isLoading={createMutation.isPending || updateMutation.isPending}
                />
              </Suspense>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar pallets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
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

      {/* Performance Stats */}
      <div className="text-xs text-gray-500 flex justify-between">
        <span>Total: {filteredPallets.length}</span>
        <span>Visível: {visiblePallets.length}</span>
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
          {/* Virtual scrolling spacer */}
          <div style={{ height: visibleRange.start * 180 }} />
          
          {visiblePallets.map((pallet) => {
            const statusInfo = getStatusInfo(pallet.status);
            const StatusIcon = statusInfo.icon;

            return (
              <Card key={pallet.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {pallet.code}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {pallet.type} • {pallet.material}
                      </p>
                    </div>
                    <Badge
                      className={`${statusInfo.color} border text-xs px-2 py-1`}
                    >
                      <StatusIcon
                        className={`h-3 w-3 mr-1 ${statusInfo.iconColor}`}
                      />
                      {statusInfo.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <div>
                      <span className="text-gray-500">Dimensões:</span>
                      <p className="font-medium">
                        {pallet.width}×{pallet.length}×{pallet.height}cm
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Peso Máx:</span>
                      <p className="font-medium">{pallet.maxWeight}kg</p>
                    </div>
                  </div>

                  {pallet.photoUrl && (
                    <div className="mb-3">
                      <OptimizedImage
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
            );
          })}
          
          {/* Virtual scrolling spacer */}
          <div style={{ height: (filteredPallets.length - visibleRange.end) * 180 }} />

          {filteredPallets.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nenhum pallet encontrado
            </div>
          )}
        </div>
      )}

      {/* Image Viewer */}
      {showImageViewer && (
        <Dialog
          open={!!showImageViewer}
          onOpenChange={() => setShowImageViewer(null)}
        >
          <DialogContent className="max-w-sm mx-4">
            <DialogHeader>
              <DialogTitle>Foto do Pallet</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <OptimizedImage
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
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <QRCodeDialog
            isOpen={qrCodeDialog.isOpen}
            onClose={handleCloseQRCode}
            palletCode={qrCodeDialog.pallet.code}
            palletData={{
              code: qrCodeDialog.pallet.code,
              type: qrCodeDialog.pallet.type,
              material: qrCodeDialog.pallet.material,
              dimensions: `${qrCodeDialog.pallet.width}×${qrCodeDialog.pallet.length}×${qrCodeDialog.pallet.height}cm`,
              maxWeight: `${qrCodeDialog.pallet.maxWeight}kg`,
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

// Debounce utility function
function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}