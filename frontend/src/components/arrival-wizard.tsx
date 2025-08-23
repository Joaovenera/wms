import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VehicleSelector } from "./vehicle-selector";
import { CapacityIndicator } from "./capacity-indicator";
import { ProductSearchWithStock } from "./product-search-with-stock";
import { LocationSelector } from "./location-selector";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { 
  PackageOpen,
  Package, 
  Plus, 
  Trash2, 
  CheckCircle,
  AlertTriangle,
  Loader2,
  Info,
  ArrowDown,
  Warehouse,
  Calculator,
  Clock,
  Package2,
  MapPin
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Vehicle {
  id: number;
  code: string;
  name: string;
  brand: string;
  model: string;
  licensePlate: string;
  type: string;
  weightCapacity: string;
  cargoAreaLength: number;
  cargoAreaWidth: number;
  cargoAreaHeight: number;
  status: string;
}

interface ProductWithStock {
  id: number;
  sku: string;
  name: string;
  unit: string;
  totalStock?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
}

interface ArrivalItem {
  id?: number;
  productId: number;
  productName: string;
  productSku: string;
  quantity: string;
  unitCubicVolume: number;
  totalCubicVolume: number;
  notes?: string;
}

interface ArrivalWizardProps {
  onArrivalCreated?: (arrivalId: number) => void;
}

export function ArrivalWizard({ onArrivalCreated }: ArrivalWizardProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [arrivalItems, setArrivalItems] = useState<ArrivalItem[]>([]);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [fromLocation, setFromLocation] = useState("Fornecedor");
  const [toLocation, setToLocation] = useState("Santa Catarina");
  const [notes, setNotes] = useState("");
  
  // State para adicionar item
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const [quantityError, setQuantityError] = useState("");

  const queryClient = useQueryClient();

  // Calcular totais
  const totalCubicVolume = arrivalItems.reduce((sum, item) => sum + item.totalCubicVolume, 0);
  const effectiveCapacity = selectedVehicle ? 
    (selectedVehicle.cargoAreaLength * selectedVehicle.cargoAreaWidth * selectedVehicle.cargoAreaHeight) * 0.9 : 0;
  const capacityUsagePercent = effectiveCapacity > 0 ? (totalCubicVolume / effectiveCapacity) * 100 : 0;

  // Create arrival request (usando as mesmas rotas de transfer mas com contexto diferente)
  const createArrivalMutation = useMutation({
    mutationFn: async (data: any) => {
      // Usa a mesma API de transfer mas marca como chegada nos notes
      const arrivalData = {
        ...data,
        notes: `CHEGADA DE MERCADORIA - ${data.notes || ''}`.trim()
      };
      const res = await apiRequest('POST', '/api/transfer-requests', arrivalData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao criar chegada');
      }
      return await res.json();
    },
    onError: (error) => {
      console.error('Error creating arrival:', error);
    }
  });

  // Add item to arrival request
  const addItemMutation = useMutation({
    mutationFn: async ({ arrivalId, itemData }: { arrivalId: number, itemData: any }) => {
      const res = await apiRequest('POST', `/api/transfer-requests/${arrivalId}/items`, itemData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao adicionar item');
      }
      return await res.json();
    },
    onError: (error) => {
      console.error('Error adding item:', error);
    }
  });

  // Função para calcular cubagem do produto
  const calculateCubicVolume = (product: ProductWithStock, quantity: number): number => {
    if (!product.dimensions) return 0;
    
    const { length, width, height } = product.dimensions;
    // Converter cm para metros e calcular m³
    const volumeM3 = (length / 100) * (width / 100) * (height / 100);
    return volumeM3 * quantity;
  };

  // Validar quantidade (para chegadas, não há limite de estoque)
  const validateQuantity = (quantity: string): string => {
    const numQuantity = parseFloat(quantity);
    
    if (isNaN(numQuantity) || numQuantity <= 0) {
      return "Quantidade deve ser um número maior que zero";
    }
    
    return "";
  };

  const handleQuantityChange = (value: string) => {
    setItemQuantity(value);
    
    if (value) {
      const error = validateQuantity(value);
      setQuantityError(error);
    } else {
      setQuantityError("");
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct || !itemQuantity) return;
    
    const error = validateQuantity(itemQuantity);
    
    if (error) {
      setQuantityError(error);
      return;
    }

    const quantity = parseFloat(itemQuantity);
    const unitCubicVolume = calculateCubicVolume(selectedProduct, 1);
    const totalCubicVolume = calculateCubicVolume(selectedProduct, quantity);

    // Check if product already exists in arrivalItems
    const existingItemIndex = arrivalItems.findIndex(item => item.productId === selectedProduct.id);
    
    if (existingItemIndex >= 0) {
      // Update existing item by adding quantities
      const existingItem = arrivalItems[existingItemIndex];
      const newQuantity = parseFloat(existingItem.quantity) + quantity;
      const newTotalCubicVolume = calculateCubicVolume(selectedProduct, newQuantity);
      
      const updatedItem: ArrivalItem = {
        ...existingItem,
        quantity: newQuantity.toString(),
        totalCubicVolume: newTotalCubicVolume,
        notes: itemNotes ? `${existingItem.notes || ''}${existingItem.notes ? '; ' : ''}${itemNotes}` : existingItem.notes
      };
      
      const updatedItems = [...arrivalItems];
      updatedItems[existingItemIndex] = updatedItem;
      setArrivalItems(updatedItems);
    } else {
      // Create new item
      const newItem: ArrivalItem = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productSku: selectedProduct.sku,
        quantity: itemQuantity,
        unitCubicVolume,
        totalCubicVolume,
        notes: itemNotes
      };
      
      setArrivalItems([...arrivalItems, newItem]);
    }
    
    // Reset form
    setSelectedProduct(null);
    setItemQuantity("");
    setItemNotes("");
    setQuantityError("");
    setShowAddItemDialog(false);
  };

  const handleRemoveItem = (index: number) => {
    setArrivalItems(arrivalItems.filter((_, i) => i !== index));
  };

  const handleCreateArrival = async () => {
    if (!selectedVehicle || arrivalItems.length === 0) return;

    try {
      // 1. Criar o pedido de chegada
      const arrivalData = {
        vehicleId: selectedVehicle.id,
        fromLocation,
        toLocation,
        notes
      };

      const createdArrival = await createArrivalMutation.mutateAsync(arrivalData);

      // 2. Adicionar todos os itens
      for (const item of arrivalItems) {
        const itemData = {
          productId: item.productId,
          quantity: item.quantity,
          notes: item.notes
        };
        
        await addItemMutation.mutateAsync({
          arrivalId: createdArrival.id,
          itemData
        });
      }

      // 3. Invalidar cache e resetar form apenas no final
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests'] });
      
      // Reset form
      setSelectedVehicle(null);
      setArrivalItems([]);
      setFromLocation("Fornecedor");
      setToLocation("Santa Catarina");
      setNotes("");
      
      // Chamar callback apenas no final
      onArrivalCreated?.(createdArrival.id);
      
    } catch (error) {
      console.error('Error creating arrival:', error);
    }
  };

  const canAddMoreItems = capacityUsagePercent < 100;
  const isOverCapacity = capacityUsagePercent > 100;

  // Reset quantity error when product changes
  useEffect(() => {
    setQuantityError("");
    setItemQuantity("");
  }, [selectedProduct]);

  // Calculate progress for wizard
  const wizardProgress = () => {
    let progress = 0;
    progress += 25; // Tipo fixo como chegada
    if (selectedVehicle) progress += 25;
    if (fromLocation && toLocation) progress += 25;
    if (arrivalItems.length > 0) progress += 25;
    return progress;
  };

  const isFormValid = selectedVehicle && arrivalItems.length > 0 && !isOverCapacity;

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="border-green-200 bg-green-50/30">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="flex items-center gap-2 text-green-900">
              <PackageOpen className="h-5 w-5" />
              Nova Chegada de Mercadoria
            </CardTitle>
            <div className="text-sm text-green-700 font-medium">
              {wizardProgress().toFixed(0)}% completo
            </div>
          </div>
          <Progress value={wizardProgress()} className="mb-3" />
          <CardDescription className="text-green-700">
            Configure os detalhes da chegada de mercadorias sem limite de estoque
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Vehicle Selection */}
      <VehicleSelector
        selectedVehicleId={selectedVehicle?.id}
        onVehicleSelect={setSelectedVehicle}
      />

      {/* Locations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-green-600" />
            Origem e Destino da Chegada
          </CardTitle>
          <CardDescription>
            Defina de onde as mercadorias estão chegando e onde serão recebidas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <LocationSelector
              id="fromLocation"
              value={fromLocation}
              onChange={setFromLocation}
              label="Fornecedor/Origem"
              placeholder="Nome do fornecedor"
            />
            <LocationSelector
              id="toLocation"
              value={toLocation}
              onChange={setToLocation}
              label="Destino/Armazém"
              placeholder="Local de recebimento"
            />
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-green-600" />
                Itens da Chegada
              </CardTitle>
              <CardDescription>
                Adicione produtos que estão chegando (sem limite de estoque)
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowAddItemDialog(true)}
              disabled={!canAddMoreItems}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isOverCapacity && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                A cubagem total excede a capacidade do veículo!
              </AlertDescription>
            </Alert>
          )}

          {arrivalItems.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum item adicionado</p>
              <p className="text-sm text-gray-400">
                Clique em "Adicionar Item" para começar
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {arrivalItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 hover:bg-green-50/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{item.productName}</h4>
                        <Badge variant="outline" className="text-xs">
                          SKU: {item.productSku}
                        </Badge>
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          <ArrowDown className="h-3 w-3 mr-1" />
                          Chegada
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Quantidade:</span>
                          <p className="font-medium text-lg">{parseFloat(item.quantity).toLocaleString('pt-BR')} un</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Cubagem Unitária:</span>
                          <p className="font-medium">{item.unitCubicVolume.toFixed(4)} m³</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Cubagem Total:</span>
                          <p className="font-medium text-lg">{item.totalCubicVolume.toFixed(3)} m³</p>
                        </div>
                      </div>
                      
                      {item.notes && (
                        <div className="mt-3 p-2 bg-green-50 rounded">
                          <p className="text-sm text-green-700">
                            <strong>Observações:</strong> {item.notes}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProduct({
                            id: item.productId,
                            sku: item.productSku,
                            name: item.productName,
                            unit: 'un'
                          });
                          setItemQuantity('');
                          setItemNotes(item.notes || '');
                          setShowAddItemDialog(true);
                        }}
                        className="text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar Mais
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Capacity Indicator */}
      {selectedVehicle && (
        <CapacityIndicator
          totalCubicVolume={totalCubicVolume}
          effectiveCapacity={effectiveCapacity}
          vehicleName={selectedVehicle.name}
        />
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Observações da Chegada</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações sobre a chegada de mercadorias..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Create Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium flex items-center gap-2">
                <PackageOpen className="h-4 w-4 text-green-600" />
                Resumo da Chegada de Mercadoria
              </div>
              <div className="text-sm text-gray-600">
                {arrivalItems.length} produto(s) distintos • {' '}
                {arrivalItems.reduce((sum, item) => sum + parseFloat(item.quantity), 0).toLocaleString('pt-BR')} unidades • {' '}
                {totalCubicVolume.toFixed(3)} m³ total
              </div>
            </div>
            <Button
              onClick={handleCreateArrival}
              disabled={
                !selectedVehicle ||
                arrivalItems.length === 0 ||
                isOverCapacity ||
                createArrivalMutation.isPending
              }
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              {createArrivalMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Registrar Chegada
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-7xl w-[95vw] max-h-[98vh] h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Plus className="h-6 w-6 text-green-600" />
              Adicionar Item à Chegada
            </DialogTitle>
            <CardDescription className="text-lg">
              Selecione um produto e defina a quantidade que está chegando
            </CardDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 h-full">
            {/* Left Column - Product Selection */}
            <div className="space-y-6 min-h-0">
              <div className="space-y-3">
                <Label className="text-lg font-medium">Seleção de Produto</Label>
                <ProductSearchWithStock
                  onProductSelect={setSelectedProduct}
                  selectedProduct={selectedProduct}
                  showOnlyInStock={false}
                />
              </div>

              {/* Product Details Card */}
              {selectedProduct && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Package className="h-6 w-6 text-green-600" />
                      Detalhes do Produto
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <Label className="text-base font-medium text-gray-600">Nome</Label>
                        <p className="text-base font-semibold">{selectedProduct.name}</p>
                      </div>
                      <div>
                        <Label className="text-base font-medium text-gray-600">SKU</Label>
                        <p className="text-base font-semibold">{selectedProduct.sku}</p>
                      </div>
                      <div>
                        <Label className="text-base font-medium text-gray-600">ID</Label>
                        <p className="text-base font-semibold">{selectedProduct.id}</p>
                      </div>
                      <div>
                        <Label className="text-base font-medium text-gray-600">Unidade</Label>
                        <p className="text-base font-semibold">{selectedProduct.unit}</p>
                      </div>
                    </div>
                    
                    {selectedProduct.dimensions && (
                      <div className="pt-3 border-t">
                        <Label className="text-base font-medium text-gray-600">Dimensões</Label>
                        <p className="text-base">
                          {selectedProduct.dimensions.length} × {selectedProduct.dimensions.width} × {selectedProduct.dimensions.height} cm
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Quantity and Notes or Welcome State */}
            <div className="space-y-6 min-h-0">
              {selectedProduct ? (
                <>
                  {/* Arrival Information */}
                  <Card className="border-green-200 bg-green-50">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl flex items-center gap-2">
                        <ArrowDown className="h-6 w-6 text-green-600" />
                        Chegada de Mercadoria
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-medium text-gray-600">Status</Label>
                          <p className="text-2xl font-bold text-green-700">
                            Sem Limite de Estoque
                          </p>
                        </div>
                        <Badge variant="default" className="bg-green-600 text-lg px-4 py-2">
                          Chegada
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quantity Input */}
                  <div className="space-y-4">
                    <Label htmlFor="quantity" className="text-lg font-medium">Quantidade</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const currentQty = parseFloat(itemQuantity) || 0;
                          const newQty = Math.max(0, currentQty - 1);
                          handleQuantityChange(newQty.toString());
                        }}
                        className="h-16 text-xl font-bold"
                      >
                        -1
                      </Button>
                      <Input
                        id="quantity"
                        type="number"
                        value={itemQuantity}
                        onChange={(e) => handleQuantityChange(e.target.value)}
                        placeholder="0.00"
                        min="0.01"
                        step="0.01"
                        className="h-16 text-center text-xl font-semibold"
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          const currentQty = parseFloat(itemQuantity) || 0;
                          const newQty = currentQty + 1;
                          handleQuantityChange(newQty.toString());
                        }}
                        className="h-16 text-xl font-bold"
                      >
                        +1
                      </Button>
                    </div>
                    
                    {/* Quick Quantity Buttons */}
                    <div className="grid grid-cols-4 gap-3">
                      {[1, 5, 10, 50].map((qty) => (
                        <Button
                          key={qty}
                          variant="outline"
                          size="lg"
                          onClick={() => {
                            const currentQty = parseFloat(itemQuantity) || 0;
                            const newQty = currentQty + qty;
                            handleQuantityChange(newQty.toString());
                          }}
                          className="h-12 text-base"
                        >
                          +{qty}
                        </Button>
                      ))}
                    </div>

                    {quantityError && (
                      <Alert className="border-red-200 bg-red-50 text-red-800">
                        <AlertTriangle className="h-5 w-5" />
                        <AlertDescription className="text-base">{quantityError}</AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-3">
                    <Label htmlFor="itemNotes" className="text-lg font-medium">Observações</Label>
                    <Textarea
                      id="itemNotes"
                      value={itemNotes}
                      onChange={(e) => setItemNotes(e.target.value)}
                      placeholder="Observações sobre este item da chegada..."
                      rows={4}
                      className="resize-none text-base"
                    />
                  </div>

                  {/* Calculated Volume */}
                  {selectedProduct.dimensions && itemQuantity && !quantityError && (
                    <Card className="border-green-200 bg-green-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Calculator className="h-5 w-5 text-green-600" />
                            <span className="font-medium text-green-900 text-lg">Cubagem Calculada</span>
                          </div>
                          <span className="text-2xl font-bold text-green-700">
                            {calculateCubicVolume(selectedProduct, parseFloat(itemQuantity)).toFixed(3)} m³
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                /* Welcome State - When no product is selected */
                <div className="h-full flex flex-col items-center justify-center space-y-8 p-8">
                  <Card className="w-full max-w-md border-dashed border-2 border-green-300 bg-green-50/50">
                    <CardContent className="pt-8 pb-8">
                      <div className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                          <PackageOpen className="h-8 w-8 text-green-600" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            Selecione um Produto
                          </h3>
                          <p className="text-gray-600 text-base leading-relaxed">
                            Use a pesquisa acima para encontrar e selecionar um produto que está chegando.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Tips for Arrivals */}
                  <Card className="w-full max-w-md border-gray-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Info className="h-5 w-5 text-green-600" />
                        Chegada de Mercadoria
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm text-gray-600">
                          <strong>Sem limite de estoque</strong> - adicione qualquer quantidade
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm text-gray-600">
                          Produtos podem ser <strong>novos</strong> ou <strong>existentes</strong> no estoque
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm text-gray-600">
                          Defina a <strong>quantidade chegada</strong> e <strong>observações</strong>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-3 pt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddItemDialog(false);
                setSelectedProduct(null);
                setItemQuantity("");
                setItemNotes("");
                setQuantityError("");
              }}
              className="min-w-[140px] h-12 text-base"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={!selectedProduct || !itemQuantity || !!quantityError}
              className="min-w-[140px] h-12 text-base bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-5 w-5 mr-2" />
              Adicionar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}