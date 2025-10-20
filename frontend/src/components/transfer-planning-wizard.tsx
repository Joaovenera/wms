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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Truck, 
  Package, 
  Plus, 
  Trash2, 
  Send,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Info,
  Save,
  ArrowRight,
  MapPin,
  Calculator,
  Clock,
  Package2
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

interface TransferItem {
  id?: number;
  productId: number;
  productName: string;
  productSku: string;
  quantity: string;
  unitCubicVolume: number;
  totalCubicVolume: number;
  availableStock: number;
  notes?: string;
  itemType?: "mandatory" | "optional";
}

interface TransferPlanningWizardProps {
  onPlanCreated?: (planId: number) => void;
}

export function TransferPlanningWizard({ onPlanCreated }: TransferPlanningWizardProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [transferType] = useState<"saida">("saida"); // Always saida for transfers
  const [fromLocation, setFromLocation] = useState("Santa Catarina");
  const [toLocation, setToLocation] = useState("São Paulo");
  const [notes, setNotes] = useState("");
  
  // State para adicionar item
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const [itemType, setItemType] = useState<"mandatory" | "optional">("mandatory");
  const [quantityError, setQuantityError] = useState("");

  const queryClient = useQueryClient();

  // Calcular totais
  const totalCubicVolume = transferItems.reduce((sum, item) => sum + item.totalCubicVolume, 0);
  const effectiveCapacity = selectedVehicle ? 
    (selectedVehicle.cargoAreaLength * selectedVehicle.cargoAreaWidth * selectedVehicle.cargoAreaHeight) * 0.9 : 0;
  const capacityUsagePercent = effectiveCapacity > 0 ? (totalCubicVolume / effectiveCapacity) * 100 : 0;

  // Create transfer plan
  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      const planData = {
        ...data,
        type: 'transfer-plan',
        status: 'planejamento'
      };
      const res = await apiRequest('POST', '/api/transfer-requests', planData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao criar plano de transferência');
      }
      return await res.json();
    },
    onError: (error) => {
      console.error('Error creating transfer plan:', error);
    }
  });

  // Add item to transfer plan
  const addItemMutation = useMutation({
    mutationFn: async ({ planId, itemData }: { planId: number, itemData: any }) => {
      const res = await apiRequest('POST', `/api/transfer-requests/${planId}/items`, itemData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao adicionar item ao plano');
      }
      return await res.json();
    },
    onError: (error) => {
      console.error('Error adding item to plan:', error);
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

  // Validar quantidade contra estoque
  const validateQuantity = (quantity: string, availableStock: number): string => {
    const numQuantity = parseFloat(quantity);
    
    if (isNaN(numQuantity) || numQuantity <= 0) {
      return "Quantidade deve ser um número maior que zero";
    }
    
    if (numQuantity > availableStock) {
      return `Quantidade excede estoque disponível (${availableStock})`;
    }
    
    return "";
  };

  // Validar se ainda há estoque disponível considerando items já adicionados
  const getAvailableStockForProduct = (productId: number, originalStock: number): number => {
    const usedQuantity = transferItems
      .filter(item => item.productId === productId)
      .reduce((sum, item) => sum + parseFloat(item.quantity), 0);
    
    return Math.max(0, originalStock - usedQuantity);
  };

  const handleQuantityChange = (value: string) => {
    setItemQuantity(value);
    
    if (selectedProduct && value) {
      const availableStock = getAvailableStockForProduct(selectedProduct.id, selectedProduct.totalStock || 0);
      const error = validateQuantity(value, availableStock);
      setQuantityError(error);
    } else {
      setQuantityError("");
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct || !itemQuantity) return;
    
    const availableStock = getAvailableStockForProduct(selectedProduct.id, selectedProduct.totalStock || 0);
    const error = validateQuantity(itemQuantity, availableStock);
    
    if (error) {
      setQuantityError(error);
      return;
    }

    const quantity = parseFloat(itemQuantity);
    const unitCubicVolume = calculateCubicVolume(selectedProduct, 1);
    const totalCubicVolume = calculateCubicVolume(selectedProduct, quantity);

    // Check if product already exists in transferItems
    const existingItemIndex = transferItems.findIndex(item => item.productId === selectedProduct.id);
    
    if (existingItemIndex >= 0) {
      // Update existing item by adding quantities
      const existingItem = transferItems[existingItemIndex];
      const newQuantity = parseFloat(existingItem.quantity) + quantity;
      const newTotalCubicVolume = calculateCubicVolume(selectedProduct, newQuantity);
      
      const updatedItem: TransferItem = {
        ...existingItem,
        quantity: newQuantity.toString(),
        totalCubicVolume: newTotalCubicVolume,
        notes: itemNotes ? `${existingItem.notes || ''}${existingItem.notes ? '; ' : ''}${itemNotes}` : existingItem.notes,
        itemType: itemType
      };
      
      const updatedItems = [...transferItems];
      updatedItems[existingItemIndex] = updatedItem;
      setTransferItems(updatedItems);
    } else {
      // Create new item
      const newItem: TransferItem = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productSku: selectedProduct.sku,
        quantity: itemQuantity,
        unitCubicVolume,
        totalCubicVolume,
        availableStock: selectedProduct.totalStock || 0,
        notes: itemNotes,
        itemType: itemType
      };
      
      setTransferItems([...transferItems, newItem]);
    }
    
    // Reset form
    setSelectedProduct(null);
    setItemQuantity("");
    setItemNotes("");
    setItemType("mandatory");
    setQuantityError("");
    setShowAddItemDialog(false);
  };

  const handleRemoveItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const handleCreatePlan = async () => {
    if (!selectedVehicle || transferItems.length === 0) return;

    try {
      // 1. Criar o plano de transferência
      const planData = {
        vehicleId: selectedVehicle.id,
        fromLocation,
        toLocation,
        notes
      };

      const createdPlan = await createPlanMutation.mutateAsync(planData);

      // 2. Adicionar todos os itens ao plano
      for (const item of transferItems) {
        const itemData = {
          productId: item.productId,
          quantity: item.quantity,
          notes: item.notes
        };
        
        await addItemMutation.mutateAsync({
          planId: createdPlan.id,
          itemData
        });
      }

      // 3. Invalidar cache e resetar form apenas no final
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests'] });
      
      // Reset form
      setSelectedVehicle(null);
      setTransferItems([]);
      setFromLocation("Santa Catarina");
      setToLocation("São Paulo");
      setNotes("");
      
      // Chamar callback apenas no final
      onPlanCreated?.(createdPlan.id);
      
    } catch (error) {
      console.error('Error creating transfer plan:', error);
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
    if (selectedVehicle) progress += 30;
    if (fromLocation && toLocation) progress += 30;
    if (transferItems.length > 0) progress += 40;
    return progress;
  };

  const isFormValid = selectedVehicle && transferItems.length > 0 && !isOverCapacity;

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Truck className="h-5 w-5" />
              Plano de Transferência
            </CardTitle>
            <div className="text-sm text-blue-700 font-medium">
              {wizardProgress().toFixed(0)}% completo
            </div>
          </div>
          <Progress value={wizardProgress()} className="mb-3" />
          <CardDescription className="text-blue-700">
            Configure o plano de transferência com validação de estoque em tempo real
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Transfer Type Selection */}
      {/* Information Notice */}
      <Card className="border-yellow-200 bg-yellow-50/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-yellow-900 mb-1">
                Plano de Transferência
              </h3>
              <p className="text-yellow-800 text-sm leading-relaxed">
                Este wizard cria um <strong>plano de transferência</strong> com itens obrigatórios e opcionais. 
                Durante a execução na página de <strong>Execução de Carregamento</strong>, os itens reais 
                serão coletados e validados contra este plano.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Selection */}
      <VehicleSelector
        selectedVehicleId={selectedVehicle?.id}
        onVehicleSelect={setSelectedVehicle}
      />

      {/* Locations */}
      <Card>
        <CardHeader>
          <CardTitle>
            Origem e Destino do Plano
          </CardTitle>
          <CardDescription>
            Defina a rota planejada para a transferência de mercadorias
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <LocationSelector
              id="fromLocation"
              value={fromLocation}
              onChange={setFromLocation}
              label="Origem"
              placeholder="Local de origem"
            />
            <LocationSelector
              id="toLocation"
              value={toLocation}
              onChange={setToLocation}
              label="Destino"
              placeholder="Local de destino"
            />
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Itens do Plano de Transferência</CardTitle>
              <CardDescription>
                Adicione produtos que estão em estoque
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

          {transferItems.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum item adicionado</p>
              <p className="text-sm text-gray-400">
                Clique em "Adicionar Item" para começar
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transferItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{item.productName}</h4>
                        <Badge variant="outline" className="text-xs">
                          SKU: {item.productSku}
                        </Badge>
                        <Badge className={
                          item.itemType === "mandatory" 
                            ? "bg-red-100 text-red-800 border-red-300" 
                            : "bg-blue-100 text-blue-800 border-blue-300"
                        }>
                          {item.itemType === "mandatory" ? "Obrigatório" : "Opcional"}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Quantidade:</span>
                          <p className="font-medium text-lg">{parseFloat(item.quantity).toLocaleString('pt-BR')} un</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Estoque Disponível:</span>
                          <p className="font-medium">
                            {(item.availableStock - parseFloat(item.quantity)).toLocaleString('pt-BR')} un
                          </p>
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
                        <div className="mt-3 p-2 bg-blue-50 rounded">
                          <p className="text-sm text-blue-700">
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
                            unit: 'un',
                            totalStock: item.availableStock
                          });
                          setItemQuantity('');
                          setItemNotes(item.notes || '');
                          setItemType(item.itemType || "mandatory");
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
          <CardTitle>Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações sobre a transferência..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Create Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">
                Resumo do Plano de Transferência
              </div>
              <div className="text-sm text-gray-600">
                {transferItems.length} produto(s) distintos • {' '}
                {transferItems.reduce((sum, item) => sum + parseFloat(item.quantity), 0).toLocaleString('pt-BR')} unidades • {' '}
                {totalCubicVolume.toFixed(3)} m³ total
              </div>
            </div>
            <Button
              onClick={handleCreatePlan}
              disabled={
                !selectedVehicle ||
                transferItems.length === 0 ||
                isOverCapacity ||
                createPlanMutation.isPending
              }
              className="flex items-center gap-2"
            >
              {createPlanMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Criar Plano de Transferência
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-7xl w-[95vw] max-h-[98vh] h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Plus className="h-6 w-6" />
              Adicionar Item ao Plano de Transferência
            </DialogTitle>
            <CardDescription className="text-lg">
              Selecione um produto em estoque e defina a quantidade para o plano de transferência
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
                  showOnlyInStock={true}
                />
              </div>

              {/* Product Details Card */}
              {selectedProduct && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Package className="h-6 w-6 text-blue-600" />
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
                  {/* Stock Information */}
                  <Card className="border-green-200 bg-green-50">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl flex items-center gap-2">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        Informações de Estoque
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-medium text-gray-600">Estoque Disponível</Label>
                          <p className="text-3xl font-bold text-green-700">
                            {getAvailableStockForProduct(selectedProduct.id, selectedProduct.totalStock || 0)} {selectedProduct.unit}
                          </p>
                        </div>
                        <Badge variant="default" className="bg-green-600 text-lg px-4 py-2">
                          Em Estoque
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
                        className="h-12 text-lg font-bold"
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
                        className="h-12 text-center text-lg font-semibold"
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          const currentQty = parseFloat(itemQuantity) || 0;
                          const maxQty = getAvailableStockForProduct(selectedProduct.id, selectedProduct.totalStock || 0);
                          const newQty = Math.min(maxQty, currentQty + 1);
                          handleQuantityChange(newQty.toString());
                        }}
                        className="h-12 text-lg font-bold"
                      >
                        +1
                      </Button>
                    </div>
                    
                    {/* Quick Quantity Buttons */}
                    <div className="grid grid-cols-4 gap-3">
                      {[0.25, 0.5, 1, 5].map((qty) => (
                        <Button
                          key={qty}
                          variant="outline"
                          size="lg"
                          onClick={() => {
                            const currentQty = parseFloat(itemQuantity) || 0;
                            const newQty = currentQty + qty;
                            const maxQty = getAvailableStockForProduct(selectedProduct.id, selectedProduct.totalStock || 0);
                            handleQuantityChange(Math.min(maxQty, newQty).toString());
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

                  {/* Item Type */}
                  <div className="space-y-3">
                    <Label htmlFor="itemType" className="text-lg font-medium">Tipo do Item no Plano</Label>
                    <select 
                      id="itemType"
                      className="w-full p-3 border rounded text-base"
                      value={itemType}
                      onChange={(e) => setItemType(e.target.value as "mandatory" | "optional")}
                    >
                      <option value="mandatory">Obrigatório - Deve ser carregado</option>
                      <option value="optional">Opcional - Carregado se houver espaço</option>
                    </select>
                    <p className="text-sm text-gray-600">
                      Itens obrigatórios devem ser carregados, opcionais podem ser incluídos se houver espaço disponível
                    </p>
                  </div>

                  {/* Notes */}
                  <div className="space-y-3">
                    <Label htmlFor="itemNotes" className="text-lg font-medium">Observações</Label>
                    <Textarea
                      id="itemNotes"
                      value={itemNotes}
                      onChange={(e) => setItemNotes(e.target.value)}
                      placeholder="Observações sobre este item..."
                      rows={3}
                      className="resize-none text-base"
                    />
                  </div>

                  {/* Calculated Volume */}
                  {selectedProduct.dimensions && itemQuantity && !quantityError && (
                    <Card className="border-blue-200 bg-blue-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Calculator className="h-5 w-5 text-blue-600" />
                            <span className="font-medium text-blue-900 text-lg">Cubagem Calculada</span>
                          </div>
                          <span className="text-2xl font-bold text-blue-700">
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
                  {/* Welcome Card */}
                  <Card className="w-full max-w-md border-dashed border-2 border-gray-300 bg-gray-50/50">
                    <CardContent className="pt-8 pb-8">
                      <div className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            Selecione um Produto
                          </h3>
                          <p className="text-gray-600 text-base leading-relaxed">
                            Use a pesquisa acima para encontrar e selecionar um produto em estoque que deseja adicionar ao plano de transferência.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Tips */}
                  <Card className="w-full max-w-md border-gray-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Info className="h-5 w-5 text-blue-600" />
                        Dicas Rápidas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm text-gray-600">
                          Pesquise por <strong>ID</strong>, <strong>SKU</strong> ou <strong>nome</strong> do produto
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm text-gray-600">
                          Apenas produtos com <strong>estoque disponível</strong> são exibidos
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm text-gray-600">
                          Após selecionar, defina a <strong>quantidade</strong> e <strong>observações</strong>
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Products (if available) */}
                  <Card className="w-full max-w-md border-gray-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-600" />
                        Produtos Recentes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-4">
                        <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">
                          Produtos usados recentemente aparecerão aqui para acesso rápido
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
                setItemType("mandatory");
                setQuantityError("");
              }}
              className="min-w-[140px] h-12 text-base"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={!selectedProduct || !itemQuantity || !!quantityError}
              className="min-w-[140px] h-12 text-base"
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