import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { VehicleSelector } from "./vehicle-selector";
import { CapacityIndicator } from "./capacity-indicator";
import { ProductSearchField } from "./product-search-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Truck, 
  Package, 
  Plus, 
  Trash2, 
  Send,
  AlertTriangle,
  CheckCircle,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Vehicle {
  id: number;
  code: string;
  name: string;
  type: string;
  cubicCapacity: string;
  weightCapacity?: string;
  status: string;
}

interface Product {
  id: number;
  sku: string;
  name: string;
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemNotes, setItemNotes] = useState("");

  const queryClient = useQueryClient();

  // Calcular totais
  const totalCubicVolume = transferItems.reduce((sum, item) => sum + item.totalCubicVolume, 0);
  const effectiveCapacity = selectedVehicle ? parseFloat(selectedVehicle.cubicCapacity) * 0.9 : 0;
  const capacityUsagePercent = effectiveCapacity > 0 ? (totalCubicVolume / effectiveCapacity) * 100 : 0;

  // Produtos não precisam ser carregados aqui pois o ProductSearchSelector faz isso

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
  const calculateCubicVolume = (product: Product, quantity: number): number => {
    if (!product.dimensions) return 0;
    
    const { length, width, height } = product.dimensions;
    // Converter cm para metros e calcular m³
    const volumeM3 = (length / 100) * (width / 100) * (height / 100);
    return volumeM3 * quantity;
  };

  const handleAddItem = () => {
    if (!selectedProduct || !itemQuantity) return;

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
      notes: itemNotes
    };

    setTransferItems([...transferItems, newItem]);
    
    // Reset form
    setSelectedProduct(null);
    setItemQuantity("");
    setItemNotes("");
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-6 w-6" />
            Planejamento de Transferência
          </CardTitle>
          <CardDescription>
            Crie um novo pedido de transferência calculando automaticamente a cubagem dos itens
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Locais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Locais de Transferência</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Local de Origem</Label>
            <Input
              value={fromLocation}
              onChange={(e) => setFromLocation(e.target.value)}
              placeholder="Ex: Santa Catarina"
            />
          </div>
          <div className="space-y-2">
            <Label>Local de Destino</Label>
            <Input
              value={toLocation}
              onChange={(e) => setToLocation(e.target.value)}
              placeholder="Ex: São Paulo"
            />
          </div>
        </CardContent>
      </Card>

      {/* Seleção de Veículo */}
      <VehicleSelector
        selectedVehicleId={selectedVehicle?.id}
        onVehicleSelect={setSelectedVehicle}
      />

      {/* Indicador de Capacidade */}
      {selectedVehicle && (
        <CapacityIndicator
          totalCubicVolume={totalCubicVolume}
          effectiveCapacity={effectiveCapacity}
          vehicleName={selectedVehicle.name}
        />
      )}

      {/* Lista de Itens */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Itens da Transferência
              </CardTitle>
              <CardDescription>
                {transferItems.length} {transferItems.length === 1 ? 'item adicionado' : 'itens adicionados'}
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowAddItemDialog(true)}
              disabled={!selectedVehicle || !canAddMoreItems}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isOverCapacity && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                A capacidade do veículo foi excedida. Remova alguns itens ou selecione outro veículo.
              </AlertDescription>
            </Alert>
          )}

          {transferItems.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum item adicionado ainda</p>
              <p className="text-sm text-gray-400">
                Selecione um veículo e comece a adicionar itens
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transferItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium">{item.productName}</h4>
                      <p className="text-sm text-gray-600">SKU: {item.productSku}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Quantidade:</span>
                      <p className="font-semibold">{item.quantity}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Cubagem Unit.:</span>
                      <p className="font-semibold">{item.unitCubicVolume.toFixed(4)} m³</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Cubagem Total:</span>
                      <p className="font-semibold text-blue-600">{item.totalCubicVolume.toFixed(3)} m³</p>
                    </div>
                  </div>
                  
                  {item.notes && (
                    <div className="mt-2 pt-2 border-t">
                      <span className="text-sm text-gray-600">Observações: </span>
                      <span className="text-sm">{item.notes}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Observações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Adicione observações sobre esta transferência..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Ações */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {transferItems.length > 0 && (
                <div className="flex items-center gap-4">
                  <span>Total de itens: <strong>{transferItems.length}</strong></span>
                  <span>Cubagem total: <strong>{totalCubicVolume.toFixed(3)} m³</strong></span>
                  <span>Utilização: <strong>{capacityUsagePercent.toFixed(1)}%</strong></span>
                </div>
              )}
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
              Criar Pedido de Transferência
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para adicionar item */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Item à Transferência</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <ProductSearchField
              onProductSelect={setSelectedProduct}
              selectedProduct={selectedProduct}
            />

            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                value={itemQuantity}
                onChange={(e) => setItemQuantity(e.target.value)}
                placeholder="Ex: 100"
                min="0"
                step="0.001"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                placeholder="Observações sobre este item..."
                rows={2}
              />
            </div>

            {selectedProduct && itemQuantity && (
              <div className="border rounded-lg p-3 bg-blue-50">
                <p className="text-sm text-blue-700">
                  <strong>Cubagem estimada:</strong>{" "}
                  {(() => {
                    const volume = calculateCubicVolume(selectedProduct, parseFloat(itemQuantity || "0"));
                    return `${volume.toFixed(4)} m³`;
                  })()}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={!selectedProduct || !itemQuantity}
            >
              Adicionar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}