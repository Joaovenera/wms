import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Package2, MapPin, Camera, Download, Eye, X, Package, Target } from "lucide-react";
import { PackagingManager } from "./packaging-manager";
import { StockConsolidationView } from "./stock-consolidation-view";
import { PickingOptimizer } from "./picking-optimizer";
import { PackagingScanner } from "./packaging-scanner";

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: number;
  productName: string;
}

export default function ProductDetailsModal({ 
  isOpen, 
  onClose, 
  productId, 
  productName 
}: ProductDetailsModalProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Fetch product with stock details
  const { data: productData, isLoading, error } = useQuery({
    queryKey: ['/api/products', productId, 'details'],
    queryFn: async () => {
      console.log('Fetching product details for ID:', productId);
      const res = await apiRequest('GET', `/api/products/${productId}?includeStock=true`);
      const data = await res.json();
      console.log('Product data received:', data);
      return data;
    },
    enabled: isOpen && !!productId,
    retry: false, // Disable retry for debugging
  });

  // Fetch product photos (using legacy format for compatibility)
  const { data: photos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['/api/products', productId, 'photos'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/products/${productId}/photos?legacy=true`);
      return await res.json();
    },
    enabled: isOpen && !!productId,
  });

  const downloadPhoto = async (photo: any) => {
    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = photo.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading photo:', error);
    }
  };

  // Debug logs
  console.log('Product Details Modal State:', {
    isOpen,
    productId,
    productData,
    isLoading,
    error
  });

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Package2 className="h-5 w-5 mr-2" />
              Detalhes do Produto: {productName}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <Package2 className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <p className="text-red-500">Erro ao carregar dados do produto</p>
              <p className="text-gray-500 text-sm">{error.message}</p>
            </div>
          ) : productData ? (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                <TabsTrigger value="stock">Estoque</TabsTrigger>
                <TabsTrigger value="packaging">Embalagens</TabsTrigger>
                <TabsTrigger value="consolidation">Consolidado</TabsTrigger>
                <TabsTrigger value="picking">Separação</TabsTrigger>
                <TabsTrigger value="photos">Fotos</TabsTrigger>
                <TabsTrigger value="specifications">Especificações</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Informações Básicas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">ID:</span>
                        <span className="font-mono">{productData?.sku || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Nome:</span>
                        <span className="font-medium">{productData?.name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <Badge variant={productData.isActive ? "default" : "secondary"}>
                          {productData.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      {productData.category && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Categoria:</span>
                          <span className="text-right">{productData.category}</span>
                        </div>
                      )}
                      {productData.brand && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Marca:</span>
                          <span>{productData.brand}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Unidade:</span>
                        <span>{productData.unit}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Estoque Resumo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">
                          {productData.totalStock || 0}
                        </div>
                        <div className="text-gray-600">
                          {productData.unit} em estoque
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          Distribuído em {productData.ucpStock?.length || 0} UCP(s)
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {productData.description && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Descrição</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700">{productData.description}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="stock" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <MapPin className="h-5 w-5 mr-2" />
                      Localização do Estoque
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {productData.ucpStock && productData.ucpStock.length > 0 ? (
                      <div className="space-y-3">
                        {productData.ucpStock.map((ucp: any, index: number) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <Package2 className="h-4 w-4 mr-2 text-blue-500" />
                                <span className="font-medium text-lg">
                                  {ucp.ucpCode || ucp.ucp_code || 'Sem código'}
                                </span>
                                <Badge variant="outline" className="ml-2">
                                  {ucp.ucpType || ucp.ucp_type || 'Tipo N/A'}
                                </Badge>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-blue-600">
                                  {parseFloat(ucp.quantity)}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {productData.unit}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">Posição:</span>
                                <span className="ml-1">{ucp.positionCode || ucp.position_code || 'Sem posição'}</span>
                              </div>
                              {ucp.lot && (
                                <div>
                                  <span className="font-medium">Lote:</span>
                                  <span className="ml-1">{ucp.lot}</span>
                                </div>
                              )}
                              {ucp.expiryDate || ucp.expiry_date ? (
                                <div>
                                  <span className="font-medium">Validade:</span>
                                  <span className="ml-1">
                                    {new Date(ucp.expiryDate || ucp.expiry_date).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                              ) : null}
                              {ucp.internalCode || ucp.internal_code ? (
                                <div>
                                  <span className="font-medium">Código Interno:</span>
                                  <span className="ml-1">{ucp.internalCode || ucp.internal_code}</span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">Sem estoque disponível</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="photos" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Camera className="h-5 w-5 mr-2" />
                      Fotos do Produto
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {photosLoading ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="aspect-square" />
                        ))}
                      </div>
                    ) : photos && photos.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {photos.map((photo: any) => (
                          <div key={photo.id} className="relative group">
                            <div className="aspect-square overflow-hidden rounded-lg border">
                              <img
                                src={photo.url}
                                alt={photo.filename}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />
                            </div>
                            
                            {photo.isPrimary && (
                              <Badge className="absolute top-2 left-2 bg-green-500">
                                Principal
                              </Badge>
                            )}
                            
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setSelectedPhoto(photo.url)}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => downloadPhoto(photo)}
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            <div className="mt-1 text-xs text-gray-500 truncate">
                              {photo.filename}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">Nenhuma foto disponível</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="specifications" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Características</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {productData.weight && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Peso:</span>
                          <span>{productData.weight} kg</span>
                        </div>
                      )}
                      {productData.barcode && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Código de Barras:</span>
                          <span className="font-mono">{productData.barcode}</span>
                        </div>
                      )}
                      {productData.dimensions && 
                       productData.dimensions.length > 0 && 
                       productData.dimensions.width > 0 && 
                       productData.dimensions.height > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Dimensões:</span>
                          <span>
                            {productData.dimensions.length} x {productData.dimensions.width} x {productData.dimensions.height} cm
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Controles</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Requer Lote:</span>
                        <Badge variant={productData.requiresLot ? "default" : "secondary"}>
                          {productData.requiresLot ? "Sim" : "Não"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Requer Validade:</span>
                        <Badge variant={productData.requiresExpiry ? "default" : "secondary"}>
                          {productData.requiresExpiry ? "Sim" : "Não"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Estoque Mínimo:</span>
                        <span>{productData.minStock || 0}</span>
                      </div>
                      {productData.maxStock && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Estoque Máximo:</span>
                          <span>{productData.maxStock}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="packaging" className="space-y-4">
                <PackagingManager product={productData} />
              </TabsContent>

              <TabsContent value="consolidation" className="space-y-4">
                <StockConsolidationView product={productData} />
              </TabsContent>

              <TabsContent value="picking" className="space-y-4">
                <div className="grid gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Otimização de Separação
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PickingOptimizer product={productData} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Scanner de Embalagens
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PackagingScanner
                        onPackagingFound={(packaging) => {
                          console.log("Embalagem encontrada:", packaging);
                        }}
                      />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-8">
              <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {productData === null ? "Produto não encontrado" : "Carregando dados do produto..."}
              </p>
              {productData !== null && (
                <p className="text-sm text-gray-400 mt-2">
                  Debug: productData = {JSON.stringify(productData)}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full-screen photo modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-full max-h-full p-4">
            <Button
              className="absolute top-4 right-4 bg-black bg-opacity-50 hover:bg-opacity-70"
              size="sm"
              onClick={() => setSelectedPhoto(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <img
              src={selectedPhoto}
              alt="Foto ampliada"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}