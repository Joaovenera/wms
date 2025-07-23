import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Package, Plus, Minus, Check, AlertCircle, Scan, 
  MapPin, User, Calendar, Hash, Layers
} from "lucide-react";
import { type Pallet, type Position, type Product, type InsertUcp } from "@/types/api";
import QrScanner from "@/components/qr-scanner";

interface UcpCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  suggestedProducts?: { productId: number; quantity: number; lot?: string; expiryDate?: string; internalCode?: string }[];
}

interface ProductSelection {
  productId: number;
  quantity: number;
  lot?: string;
  expiryDate?: string;
  internalCode?: string; // CI - Código Interno
  product?: Product;
}

export default function UcpCreationWizard({ isOpen, onClose, suggestedProducts = [] }: UcpCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPalletId, setSelectedPalletId] = useState<number | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<ProductSelection[]>([]);
  const [observations, setObservations] = useState("");
  const [ucpCode, setUcpCode] = useState("");
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const { toast } = useToast();

  const { data: availablePallets } = useQuery<Pallet[]>({
    queryKey: ['/api/pallets/available-for-ucp'],
  });

  const { data: positions } = useQuery<Position[]>({
    queryKey: ['/api/positions'],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const { data: availableUcps } = useQuery<any[]>({
    queryKey: ['/api/ucps/available'],
    enabled: selectedProducts.length > 0,
  });

  // Generate UCP code when wizard opens
  useEffect(() => {
    if (isOpen && !ucpCode) {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
      const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
      setUcpCode(`UCP-${dateStr}-${randomNum}`);
    }
  }, [isOpen, ucpCode]);

  // Initialize with suggested products
  useEffect(() => {
    if (suggestedProducts.length > 0 && products) {
      const initialProducts = suggestedProducts.map(item => ({
        ...item,
        product: products.find(p => p.id === item.productId)
      }));
      setSelectedProducts(initialProducts);
    }
  }, [suggestedProducts, products]);

  const createUcpMutation = useMutation({
    mutationFn: async (data: { ucp: InsertUcp; items: ProductSelection[] }) => {
      await apiRequest('POST', '/api/ucps/comprehensive', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ucps'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Sucesso",
        description: "UCP criada com sucesso e produtos associados",
      });
      onClose();
      resetWizard();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleQrCodeScan = async (scannedCode: string) => {
    try {
      const position = positions?.find(p => p.code === scannedCode);
      
      if (position) {
        if (position.status === 'available') {
          setSelectedPositionId(position.id);
          setIsQrScannerOpen(false);
          toast({
            title: "Posição selecionada",
            description: `Posição ${position.code} selecionada com sucesso`,
          });
        } else {
          toast({
            title: "Posição não disponível",
            description: `A posição ${position.code} não está disponível para armazenamento`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Posição não encontrada",
          description: `Código ${scannedCode} não corresponde a nenhuma posição cadastrada`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao processar QR Code",
        description: "Não foi possível processar o código escaneado",
        variant: "destructive",
      });
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setSelectedPalletId(null);
    setSelectedPositionId(null);
    setSelectedProducts([]);
    setObservations("");
    setUcpCode("");
    setIsQrScannerOpen(false);
  };

  const addProduct = (productId: number) => {
    const product = products?.find(p => p.id === productId);
    if (product && !selectedProducts.find(p => p.productId === productId)) {
      setSelectedProducts([...selectedProducts, {
        productId,
        quantity: 1,
        product,
        internalCode: `CI-${Date.now()}` // Generate temporary CI
      }]);
    }
  };

  const updateProduct = (index: number, updates: Partial<ProductSelection>) => {
    const updated = [...selectedProducts];
    updated[index] = { ...updated[index], ...updates };
    setSelectedProducts(updated);
  };

  const removeProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const availablePositions = positions?.filter(p => p.status === "disponivel") || [];

  const canProceedToStep2 = selectedProducts.length > 0;
  const canProceedToStep3 = selectedPalletId !== null;
  const canCreateUcp = selectedPalletId !== null && selectedProducts.length > 0;

  const handleCreateUcp = () => {
    if (!canCreateUcp) return;

    const ucpData: InsertUcp = {
      code: ucpCode,
      palletId: selectedPalletId,
      positionId: selectedPositionId,
      status: "active",
      observations,
      createdBy: 1, // TODO: Get from auth context
    };

    createUcpMutation.mutate({
      ucp: ucpData,
      items: selectedProducts
    });
  };

  const stepTitles = [
    "Seleção de Produtos",
    "Escolha do Pallet",
    "Localização e Finalização"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Criação de Nova UCP - {stepTitles[currentStep - 1]}
          </DialogTitle>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${currentStep >= step 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
                }
              `}>
                {currentStep > step ? <Check className="h-4 w-4" /> : step}
              </div>
              {step < 3 && (
                <div className={`
                  w-16 h-1 mx-2
                  ${currentStep > step ? 'bg-primary' : 'bg-muted'}
                `} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Product Selection */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Código da UCP</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {ucpCode}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Produtos da UCP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Select onValueChange={(value) => addProduct(parseInt(value))}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecionar produto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.filter(p => 
                        p.isActive && !selectedProducts.find(sp => sp.productId === p.id)
                      ).map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name} - {product.sku}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon">
                    <Scan className="h-4 w-4" />
                  </Button>
                </div>

                {selectedProducts.length > 0 && (
                  <ScrollArea className="h-64 border rounded-lg p-4">
                    <div className="space-y-3">
                      {selectedProducts.map((item, index) => (
                        <Card key={index} className="p-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-sm font-medium">
                                {item.product?.name}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                SKU: {item.product?.sku}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  placeholder="Qtd"
                                  value={item.quantity}
                                  onChange={(e) => updateProduct(index, { 
                                    quantity: parseInt(e.target.value) || 1 
                                  })}
                                  className="w-20"
                                />
                                <Input
                                  placeholder="Lote"
                                  value={item.lot || ""}
                                  onChange={(e) => updateProduct(index, { lot: e.target.value })}
                                  className="flex-1"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="CI"
                                  value={item.internalCode || ""}
                                  onChange={(e) => updateProduct(index, { 
                                    internalCode: e.target.value 
                                  })}
                                  className="flex-1"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeProduct(index)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {selectedProducts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum produto selecionado</p>
                    <p className="text-sm">Adicione produtos para continuar</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                onClick={() => setCurrentStep(2)} 
                disabled={!canProceedToStep2}
              >
                Próximo: Escolher Pallet
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Pallet Selection */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pallets Disponíveis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                  {availablePallets?.map((pallet) => (
                    <Card 
                      key={pallet.id}
                      className={`cursor-pointer transition-colors ${
                        selectedPalletId === pallet.id 
                          ? 'ring-2 ring-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedPalletId(pallet.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{pallet.code}</p>
                            <p className="text-sm text-muted-foreground">
                              {pallet.type} - {pallet.material}
                            </p>
                          </div>
                          <Badge variant={pallet.status === "disponivel" ? "secondary" : "outline"}>
                            {pallet.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {(!availablePallets || availablePallets.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum pallet disponível</p>
                    <p className="text-sm">Todos os pallets estão em uso</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Voltar
              </Button>
              <Button 
                onClick={() => setCurrentStep(3)} 
                disabled={!canProceedToStep3}
              >
                Próximo: Finalizar
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Location and Finalization */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Posição no Armazém (Opcional)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select 
                      onValueChange={(value) => setSelectedPositionId(parseInt(value))}
                      value={selectedPositionId?.toString() || ""}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar posição..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePositions.map((position) => (
                          <SelectItem key={position.id} value={position.id.toString()}>
                            {position.code} - Rua {position.street} - {position.side === 'E' ? 'Esquerdo' : 'Direito'} - Nível {position.level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsQrScannerOpen(true)}
                    className="shrink-0"
                  >
                    <Scan className="h-4 w-4" />
                  </Button>
                </div>
                {selectedPositionId && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Posição selecionada: {positions?.find(p => p.id === selectedPositionId)?.code}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Observações sobre a UCP..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumo da UCP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Código:</span>
                  <Badge variant="outline">{ucpCode}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Pallet:</span>
                  <span>{availablePallets?.find(p => p.id === selectedPalletId)?.code}</span>
                </div>
                <div className="flex justify-between">
                  <span>Posição:</span>
                  <span>
                    {selectedPositionId 
                      ? positions?.find(p => p.id === selectedPositionId)?.code 
                      : "Não definida"
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Produtos:</span>
                  <span>{selectedProducts.length} item(s)</span>
                </div>
                <Separator />
                <ScrollArea className="h-32">
                  {selectedProducts.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm py-1">
                      <span>{item.product?.name}</span>
                      <span>Qty: {item.quantity}</span>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                Voltar
              </Button>
              <Button 
                onClick={handleCreateUcp}
                disabled={!canCreateUcp || createUcpMutation.isPending}
              >
                {createUcpMutation.isPending ? "Criando..." : "Criar UCP"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* QR Scanner for Position Selection */}
      {isQrScannerOpen && (
        <QrScanner
          onScan={handleQrCodeScan}
          onClose={() => setIsQrScannerOpen(false)}
        />
      )}
    </Dialog>
  );
}