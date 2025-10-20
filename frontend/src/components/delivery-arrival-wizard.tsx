import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProductSearchWithStock } from "./product-search-with-stock";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { 
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
  MapPin,
  FileText,
  Building
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getPlaceholderVehicleId } from "@/lib/placeholderVehicles";
import { ArrivalItem } from "@/types/container";

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

interface DeliveryArrivalWizardProps {
  onPlanCreated?: (planId: number) => void;
}

export function DeliveryArrivalWizard({ onPlanCreated }: DeliveryArrivalWizardProps) {
  const [arrivalItems, setArrivalItems] = useState<ArrivalItem[]>([]);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  
  // Basic information
  const [supplierName, setSupplierName] = useState("");
  const [estimatedArrival, setEstimatedArrival] = useState("");
  const [notes, setNotes] = useState("");
  
  // Delivery information (optional - transportadora)
  const [transporterName, setTransporterName] = useState("");
  
  // Item addition state
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const [quantityError, setQuantityError] = useState("");

  const queryClient = useQueryClient();

  // Create delivery arrival plan
  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      // Para entregas via transportadora, usar placeholder específico
      const vehicleId = await getPlaceholderVehicleId('delivery');
      
      const planData = {
        ...data,
        type: 'delivery-arrival-plan',
        status: 'planejamento',
        vehicleId, // Usar veículo placeholder para entregas
        notes: `PLANO DE ENTREGA - ${data.notes || ''}`.trim()
      };
      const res = await apiRequest('POST', '/api/transfer-requests', planData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao criar plano de entrega');
      }
      return await res.json();
    },
    onError: (error) => {
      console.error('Error creating delivery arrival plan:', error);
    }
  });

  // Add item to plan
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

  // Calculate cubic volume
  const calculateCubicVolume = (product: ProductWithStock, quantity: number): number => {
    if (!product.dimensions) return 0;
    
    const { length, width, height } = product.dimensions;
    const volumeM3 = (length / 100) * (width / 100) * (height / 100);
    return volumeM3 * quantity;
  };

  // Validate quantity
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

    // Check if product already exists
    const existingItemIndex = arrivalItems.findIndex(item => item.productId === selectedProduct.id);
    
    if (existingItemIndex >= 0) {
      // Update existing item
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

  const handleCreatePlan = async () => {
    if (!supplierName || !estimatedArrival || arrivalItems.length === 0) return;

    try {
      // Create the delivery arrival plan
      const planData = {
        supplierName,
        estimatedArrival,
        notes,
        transporterName: transporterName || undefined,
        // Para planos de entrega via transportadora
        fromLocation: 'Fornecedor',
        toLocation: 'Armazém'
      };

      const createdPlan = await createPlanMutation.mutateAsync(planData);

      // Add all items to plan
      for (const item of arrivalItems) {
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

      // Invalidate cache and reset form
      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests'] });
      
      // Reset form
      setSupplierName("");
      setEstimatedArrival("");
      setNotes("");
      setTransporterName("");
      setArrivalItems([]);
      
      // Call callback
      onPlanCreated?.(createdPlan.id);
      
    } catch (error) {
      console.error('Error creating delivery arrival plan:', error);
    }
  };

  // Calculate progress
  const wizardProgress = () => {
    let progress = 0;
    if (supplierName) progress += 25;
    if (estimatedArrival) progress += 25;
    if (arrivalItems.length > 0) progress += 50;
    return progress;
  };

  const totalCubicVolume = arrivalItems.reduce((sum, item) => sum + (item.totalCubicVolume || 0), 0);
  const isFormValid = supplierName && estimatedArrival && arrivalItems.length > 0;

  // Reset quantity error when product changes
  useEffect(() => {
    setQuantityError("");
    setItemQuantity("");
  }, [selectedProduct]);

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="border-purple-200 bg-purple-50/30">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="flex items-center gap-2 text-purple-900">
              <Package className="h-5 w-5" />
              Plano de Entrega - Transportadora
            </CardTitle>
            <div className="text-sm text-purple-700 font-medium">
              {wizardProgress().toFixed(0)}% completo
            </div>
          </div>
          <Progress value={wizardProgress()} className="mb-3" />
          <CardDescription className="text-purple-700">
            Configure o plano de entrega de mercadoria via transportadora
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-purple-600" />
            Informações da Entrega
          </CardTitle>
          <CardDescription>
            Dados essenciais sobre a entrega da mercadoria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplierName">Fornecedor/Origem *</Label>
              <Input
                id="supplierName"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Nome do fornecedor"
                required
              />
            </div>
            <div>
              <Label htmlFor="estimatedArrival">Estimativa de Chegada *</Label>
              <Input
                id="estimatedArrival"
                type="datetime-local"
                value={estimatedArrival}
                onChange={(e) => setEstimatedArrival(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="transporterName">Nome da Transportadora (Opcional)</Label>
            <Input
              id="transporterName"
              value={transporterName}
              onChange={(e) => setTransporterName(e.target.value)}
              placeholder="Nome da empresa transportadora (se conhecida)"
            />
            <p className="text-sm text-gray-500 mt-1">
              Geralmente não sabemos qual transportadora fará a entrega
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Information Notice */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-yellow-900 mb-1">
                Dados de Execução
              </h3>
              <p className="text-yellow-800 text-sm leading-relaxed">
                Para entregas via transportadora, geralmente não temos informações sobre 
                veículo, placa, motorista ou detalhes específicos do transporte antecipadamente. 
                Dados específicos da entrega serão coletados durante a execução na página de 
                <strong> Execução de Carregamento</strong> quando a entrega chegar.
                Este plano define apenas o que esperamos receber.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-purple-600" />
                Itens do Plano de Entrega
              </CardTitle>
              <CardDescription>
                Produtos planejados para entrega
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowAddItemDialog(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-4 w-4" />
              Adicionar Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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
                <div key={index} className="border rounded-lg p-4 hover:bg-purple-50/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{item.productName}</h4>
                        <Badge variant="outline" className="text-xs">
                          SKU: {item.productSku}
                        </Badge>
                        <Badge className="bg-purple-100 text-purple-800 border-purple-300">
                          <Package className="h-3 w-3 mr-1" />
                          Plano Entrega
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Quantidade:</span>
                          <p className="font-medium text-lg">{parseFloat(item.quantity).toLocaleString('pt-BR')} un</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Cubagem Unitária:</span>
                          <p className="font-medium">{(item.unitCubicVolume || 0).toFixed(4)} m³</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Cubagem Total:</span>
                          <p className="font-medium text-lg">{(item.totalCubicVolume || 0).toFixed(3)} m³</p>
                        </div>
                      </div>
                      
                      {item.notes && (
                        <div className="mt-3 p-2 bg-purple-50 rounded">
                          <p className="text-sm text-purple-700">
                            <strong>Observações:</strong> {item.notes}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
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

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Observações da Entrega
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações sobre a entrega via transportadora..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Summary and Create Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-600" />
                Resumo do Plano de Entrega
              </div>
              <div className="text-sm text-gray-600">
                {arrivalItems.length} produto(s) • {' '}
                {arrivalItems.reduce((sum, item) => sum + parseFloat(item.quantity), 0).toLocaleString('pt-BR')} unidades esperadas • {' '}
                {totalCubicVolume.toFixed(3)} m³ estimados
              </div>
            </div>
            <Button
              onClick={handleCreatePlan}
              disabled={!isFormValid || createPlanMutation.isPending}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {createPlanMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Criar Plano de Entrega
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-600" />
              Adicionar Item à Entrega
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <Label>Produto</Label>
              <ProductSearchWithStock
                onProductSelect={setSelectedProduct}
                selectedProduct={selectedProduct}
                showOnlyInStock={false}
              />
            </div>

            {selectedProduct && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity">Quantidade</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={itemQuantity}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      placeholder="0"
                      min="0.01"
                      step="0.01"
                    />
                    {quantityError && (
                      <Alert className="mt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{quantityError}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                  
                  <div>
                    <Label>Cubagem Calculada</Label>
                    <div className="h-10 flex items-center">
                      {selectedProduct.dimensions && itemQuantity && !quantityError ? (
                        <span className="font-medium text-purple-600">
                          {calculateCubicVolume(selectedProduct, parseFloat(itemQuantity)).toFixed(3)} m³
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="itemNotes">Observações</Label>
                  <Textarea
                    id="itemNotes"
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    placeholder="Observações sobre este item..."
                    rows={3}
                  />
                </div>
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
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}