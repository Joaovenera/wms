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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Truck, 
  Package, 
  Plus, 
  Trash2, 
  Send,
  AlertTriangle,
  Loader2
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
}

interface TransferPlanningWizardProps {
  onTransferCreated?: (transferId: number) => void;
}

export function TransferPlanningWizard({ onTransferCreated }: TransferPlanningWizardProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [fromLocation, setFromLocation] = useState("Santa Catarina");
  const [toLocation, setToLocation] = useState("São Paulo");
  const [notes, setNotes] = useState("");
  
  // State para adicionar item
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const [quantityError, setQuantityError] = useState("");

  const queryClient = useQueryClient();

  // Calcular totais
  const totalCubicVolume = transferItems.reduce((sum, item) => sum + item.totalCubicVolume, 0);
  const effectiveCapacity = selectedVehicle ? 
    (selectedVehicle.cargoAreaLength * selectedVehicle.cargoAreaWidth * selectedVehicle.cargoAreaHeight) * 0.9 : 0;
  const capacityUsagePercent = effectiveCapacity > 0 ? (totalCubicVolume / effectiveCapacity) * 100 : 0;

  // Create transfer request
  const createTransferMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/transfer-requests', data);
      return await res.json();
    }
    // Invalidação será feita manualmente no handleCreateTransfer
  });

  // Add item to transfer request
  const addItemMutation = useMutation({
    mutationFn: async ({ transferId, itemData }: { transferId: number, itemData: any }) => {
      const res = await apiRequest('POST', `/api/transfer-requests/${transferId}/items`, itemData);
      return await res.json();
    }
    // Não invalidamos aqui para evitar reload durante a criação
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

    const newItem: TransferItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      productSku: selectedProduct.sku,
      quantity: itemQuantity,
      unitCubicVolume,
      totalCubicVolume,
      availableStock: selectedProduct.totalStock || 0,
      notes: itemNotes
    };

    setTransferItems([...transferItems, newItem]);
    
    // Reset form
    setSelectedProduct(null);
    setItemQuantity("");
    setItemNotes("");
    setQuantityError("");
    setShowAddItemDialog(false);
  };

  const handleRemoveItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const handleCreateTransfer = async () => {
    if (!selectedVehicle || transferItems.length === 0) return;

    try {
      // 1. Criar o pedido de transferência
      const transferData = {
        vehicleId: selectedVehicle.id,
        fromLocation,
        toLocation,
        notes
      };

      const createdTransfer = await createTransferMutation.mutateAsync(transferData);

      // 2. Adicionar todos os itens
      for (const item of transferItems) {
        const itemData = {
          productId: item.productId,
          quantity: item.quantity,
          notes: item.notes
        };
        
        await addItemMutation.mutateAsync({
          transferId: createdTransfer.id,
          itemData
        });
      }

      // 3. Invalidar cache e resetar form apenas no final
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests'] });
      
      // Reset form
      setSelectedVehicle(null);
      setTransferItems([]);
      setNotes("");
      
      // Chamar callback apenas no final
      onTransferCreated?.(createdTransfer.id);
      
    } catch (error) {
      console.error('Error creating transfer:', error);
    }
  };

  const canAddMoreItems = capacityUsagePercent < 100;
  const isOverCapacity = capacityUsagePercent > 100;

  // Reset quantity error when product changes
  useEffect(() => {
    setQuantityError("");
    setItemQuantity("");
  }, [selectedProduct]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Nova Transferência
          </CardTitle>
          <CardDescription>
            Configure os detalhes da transferência com validação de estoque
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
          <CardTitle>Locais de Origem e Destino</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromLocation">De</Label>
              <Input
                id="fromLocation"
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                placeholder="Local de origem"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toLocation">Para</Label>
              <Input
                id="toLocation"
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                placeholder="Local de destino"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Itens da Transferência</CardTitle>
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
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{item.productName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          SKU: {item.productSku}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Estoque: {item.availableStock}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 mt-2">
                        <span>Quantidade: {item.quantity}</span>
                        <span className="ml-4">
                          Cubagem: {item.totalCubicVolume.toFixed(3)} m³
                        </span>
                      </div>
                      {item.notes && (
                        <p className="text-sm text-gray-500 mt-1">
                          Obs: {item.notes}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
            <div className="text-sm text-gray-600">
              {transferItems.length} item(s) • {totalCubicVolume.toFixed(3)} m³ total
            </div>
            <Button
              onClick={handleCreateTransfer}
              disabled={
                !selectedVehicle ||
                transferItems.length === 0 ||
                isOverCapacity ||
                createTransferMutation.isPending
              }
              className="flex items-center gap-2"
            >
              {createTransferMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Criar Transferência
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Item</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <ProductSearchWithStock
              onProductSelect={setSelectedProduct}
              selectedProduct={selectedProduct}
              showOnlyInStock={true}
            />

            {selectedProduct && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantidade</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={itemQuantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    placeholder="Digite a quantidade"
                    min="0.01"
                    step="0.01"
                  />
                  {quantityError && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {quantityError}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Estoque disponível: {getAvailableStockForProduct(selectedProduct.id, selectedProduct.totalStock || 0)} {selectedProduct.unit}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="itemNotes">Observações</Label>
                  <Textarea
                    id="itemNotes"
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    placeholder="Observações sobre este item..."
                    rows={2}
                  />
                </div>

                {selectedProduct.dimensions && itemQuantity && !quantityError && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Cubagem calculada:</strong> {' '}
                      {calculateCubicVolume(selectedProduct, parseFloat(itemQuantity)).toFixed(3)} m³
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddItemDialog(false);
                setSelectedProduct(null);
                setItemQuantity("");
                setItemNotes("");
                setQuantityError("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={!selectedProduct || !itemQuantity || !!quantityError}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}