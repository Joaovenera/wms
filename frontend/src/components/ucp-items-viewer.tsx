import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Package, Calendar, Hash, Layers, 
  RefreshCw, AlertCircle, Truck, MapPin, Clock, ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import UcpItemTransfer from "./ucp-item-transfer";

interface UcpItemsViewerProps {
  ucpId: number;
  ucpCode: string;
  isOpen: boolean;
  onClose: () => void;
}

interface UcpDetails {
  id: number;
  code: string;
  status: string;
  observations?: string;
  createdAt: string;
  pallet?: {
    id: number;
    code: string;
    type: string;
    material: string;
  };
  position?: {
    id: number;
    code: string;
    street: string;
    side: string;
    level: number;
  };
  items?: Array<{
    id: number;
    quantity: string;
    lot?: string;
    expiryDate?: string;
    internalCode?: string;
    addedAt: string;
    product?: {
      id: number;
      name: string;
      sku: string;
      description?: string;
      category?: string;
      brand?: string;
      unit?: string;
    };
  }>;
}

export default function UcpItemsViewer({ ucpId, ucpCode, isOpen, onClose }: UcpItemsViewerProps) {
  const [transferItem, setTransferItem] = useState<any>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  const { data: ucpDetails, isLoading, refetch } = useQuery<UcpDetails>({
    queryKey: [`/api/ucps/${ucpId}`],
    enabled: isOpen && ucpId > 0,
    staleTime: 0, // Always consider data stale to fetch fresh data
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Always refetch when component mounts
  });

  // Debug log to check if data is coming correctly
  console.log('UcpItemsViewer - UCP Details:', ucpDetails);
  console.log('UcpItemsViewer - UCP ID:', ucpId, 'Is Open:', isOpen);

  const handleTransferItem = (item: any) => {
    setTransferItem({
      id: item.id,
      ucpId: ucpId,
      ucpCode: ucpCode,
      quantity: item.quantity,
      lot: item.lot,
      internalCode: item.internalCode,
      product: item.product,
    });
    setIsTransferOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Ativa</Badge>;
      case "empty":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Vazia</Badge>;
      case "archived":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Arquivada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTotalQuantity = () => {
    if (!ucpDetails?.items || ucpDetails.items.length === 0) return 0;
    return ucpDetails.items.reduce((total, item) => total + parseInt(item.quantity), 0);
  };

  const getUniqueProducts = () => {
    if (!ucpDetails?.items || ucpDetails.items.length === 0) return 0;
    const productIds = new Set(ucpDetails.items.map(item => item.product?.id).filter(id => id !== undefined));
    return productIds.size;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Itens da UCP {ucpCode}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[700px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando detalhes...</span>
            </div>
          ) : ucpDetails ? (
            <div className="space-y-6">
              {/* UCP Summary */}
              <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      Informações da UCP
                    </span>
                    {getStatusBadge(ucpDetails.status)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Código:</span>
                        <Badge variant="outline" className="font-mono">{ucpDetails.code}</Badge>
                      </div>
                      
                      {ucpDetails.pallet && (
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-green-500" />
                          <span className="font-medium">Pallet:</span>
                          <Badge variant="outline">{ucpDetails.pallet.code}</Badge>
                          <span className="text-sm text-muted-foreground">
                            ({ucpDetails.pallet.type} - {ucpDetails.pallet.material})
                          </span>
                        </div>
                      )}
                      
                      {ucpDetails.position && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-orange-500" />
                          <span className="font-medium">Posição:</span>
                          <Badge variant="outline">{ucpDetails.position.code}</Badge>
                          <span className="text-sm text-muted-foreground">
                            (Rua {ucpDetails.position.street} - {ucpDetails.position.side === 'E' ? 'Esquerdo' : 'Direito'} - Nível {ucpDetails.position.level})
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-purple-500" />
                        <span className="font-medium">Criada em:</span>
                        <span className="text-sm">
                          {format(new Date(ucpDetails.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      

                      
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-teal-500" />
                        <span className="font-medium">Resumo:</span>
                        <Badge variant="secondary" className="text-xs">
                          {getUniqueProducts()} produto(s) únicos
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {getTotalQuantity()} unidades total
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  {ucpDetails.observations && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                        <div>
                          <span className="font-medium text-yellow-800">Observações:</span>
                          <p className="text-sm text-yellow-700 mt-1">{ucpDetails.observations}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Items List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Produtos ({ucpDetails.items?.length || 0} itens)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ucpDetails.items && ucpDetails.items.length > 0 ? (
                    <div className="space-y-4">
                      {ucpDetails.items.map((item, index) => (
                        <Card key={item.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
                          <CardContent className="pt-4">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                              {/* Product Info */}
                              <div className="lg:col-span-2">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <h4 className="font-semibold text-lg text-gray-900">
                                      {item.product?.name || 'Produto não encontrado'}
                                    </h4>
                                    <p className="text-sm text-muted-foreground font-mono">
                                      SKU: {item.product?.sku || 'N/A'}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className="text-lg px-3 py-1">
                                    {item.quantity} {item.product?.unit || 'un'}
                                  </Badge>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  {item.product?.category && (
                                    <div>
                                      <span className="font-medium text-gray-600">Categoria:</span>
                                      <p className="text-gray-900">{item.product.category}</p>
                                    </div>
                                  )}
                                  
                                  {item.product?.brand && (
                                    <div>
                                      <span className="font-medium text-gray-600">Marca:</span>
                                      <p className="text-gray-900">{item.product.brand}</p>
                                    </div>
                                  )}
                                  
                                  {item.lot && (
                                    <div>
                                      <span className="font-medium text-gray-600">Lote:</span>
                                      <p className="text-gray-900 font-mono">{item.lot}</p>
                                    </div>
                                  )}
                                  
                                  {item.internalCode && (
                                    <div>
                                      <span className="font-medium text-gray-600">Código Interno:</span>
                                      <p className="text-gray-900 font-mono">{item.internalCode}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Additional Info */}
                              <div className="space-y-3">
                                {item.expiryDate && (
                                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-4 w-4 text-red-600" />
                                      <span className="font-medium text-red-800">Validade:</span>
                                    </div>
                                    <p className="text-sm text-red-700 mt-1">
                                      {format(new Date(item.expiryDate), "dd/MM/yyyy", { locale: ptBR })}
                                    </p>
                                  </div>
                                )}
                                
                                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-gray-600" />
                                    <span className="font-medium text-gray-800">Adicionado em:</span>
                                  </div>
                                  <p className="text-sm text-gray-700 mt-1">
                                    {format(new Date(item.addedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                </div>

                                {/* Botão de Transferência */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleTransferItem(item)}
                                  className="w-full"
                                >
                                  <ArrowRight className="h-4 w-4 mr-1" />
                                  Transferir Item
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                          
                          {index < (ucpDetails.items?.length || 0) - 1 && <Separator className="my-2" />}
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">Nenhum item encontrado</h3>
                      <p className="text-sm">Esta UCP não possui produtos associados</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Erro ao carregar detalhes</h3>
              <p className="text-sm">Não foi possível carregar os detalhes da UCP</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>

      {/* Modal de Transferência */}
      {transferItem && (
        <UcpItemTransfer
          isOpen={isTransferOpen}
          onClose={() => setIsTransferOpen(false)}
          sourceItem={transferItem}
        />
      )}
    </Dialog>
  );
} 