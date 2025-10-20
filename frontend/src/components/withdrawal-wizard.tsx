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
  UserCheck,
  Package, 
  Plus, 
  Trash2, 
  CheckCircle,
  AlertTriangle,
  Loader2,
  Info,
  User,
  Warehouse,
  Calculator,
  FileText,
  Phone,
  IdCard,
  Building
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getPlaceholderVehicleId } from "@/lib/placeholderVehicles";
import { WithdrawalItem } from "@/types/container";

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

interface WithdrawalWizardProps {
  onPlanCreated?: (planId: number) => void;
}

export function WithdrawalWizard({ onPlanCreated }: WithdrawalWizardProps) {
  const [withdrawalItems, setWithdrawalItems] = useState<WithdrawalItem[]>([]);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  
  // Client information
  const [clientName, setClientName] = useState("");
  const [clientDocument, setClientDocument] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [notes, setNotes] = useState("");
  
  // Item addition state
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const [quantityError, setQuantityError] = useState("");

  const queryClient = useQueryClient();

  // Create withdrawal plan
  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      // Para retiradas de cliente, usar placeholder específico
      const vehicleId = await getPlaceholderVehicleId('withdrawal');
      
      const planData = {
        ...data,
        type: 'withdrawal-plan',
        status: 'planejamento',
        vehicleId, // Usar veículo placeholder para retiradas
        notes: `PLANO DE RETIRADA - ${data.notes || ''}`.trim()
      };
      const res = await apiRequest('POST', '/api/transfer-requests', planData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao criar plano de retirada');
      }
      return await res.json();
    },
    onError: (error) => {
      console.error('Error creating withdrawal plan:', error);
    }
  });

  // Add item to withdrawal plan
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

  // Validate quantity (for withdrawals, check stock limits)
  const validateQuantity = (quantity: string, availableStock: number = 0): string => {
    const numQuantity = parseFloat(quantity);
    
    if (isNaN(numQuantity) || numQuantity <= 0) {
      return "Quantidade deve ser um número maior que zero";
    }
    
    if (availableStock > 0 && numQuantity > availableStock) {
      return `Quantidade não pode exceder o estoque disponível (${availableStock})`;
    }
    
    return "";
  };

  const handleQuantityChange = (value: string) => {
    setItemQuantity(value);
    
    if (value && selectedProduct) {
      const error = validateQuantity(value, selectedProduct.totalStock);
      setQuantityError(error);
    } else {
      setQuantityError("");
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct || !itemQuantity) return;
    
    const error = validateQuantity(itemQuantity, selectedProduct.totalStock);
    
    if (error) {
      setQuantityError(error);
      return;
    }

    const quantity = parseFloat(itemQuantity);
    const unitCubicVolume = calculateCubicVolume(selectedProduct, 1);
    const totalCubicVolume = calculateCubicVolume(selectedProduct, quantity);

    // Check if product already exists
    const existingItemIndex = withdrawalItems.findIndex(item => item.productId === selectedProduct.id);
    
    if (existingItemIndex >= 0) {
      // Update existing item
      const existingItem = withdrawalItems[existingItemIndex];
      const newQuantity = parseFloat(existingItem.quantity) + quantity;
      const newTotalCubicVolume = calculateCubicVolume(selectedProduct, newQuantity);
      
      // Check if total quantity would exceed stock
      if (selectedProduct.totalStock && newQuantity > selectedProduct.totalStock) {
        setQuantityError(`Quantidade total não pode exceder o estoque disponível (${selectedProduct.totalStock})`);
        return;
      }
      
      const updatedItem: WithdrawalItem = {
        ...existingItem,
        quantity: newQuantity.toString(),
        totalCubicVolume: newTotalCubicVolume,
        notes: itemNotes ? `${existingItem.notes || ''}${existingItem.notes ? '; ' : ''}${itemNotes}` : existingItem.notes
      };
      
      const updatedItems = [...withdrawalItems];
      updatedItems[existingItemIndex] = updatedItem;
      setWithdrawalItems(updatedItems);
    } else {
      // Create new item
      const newItem: WithdrawalItem = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productSku: selectedProduct.sku,
        quantity: itemQuantity,
        unitCubicVolume,
        totalCubicVolume,
        availableStock: selectedProduct.totalStock,
        notes: itemNotes
      };
      
      setWithdrawalItems([...withdrawalItems, newItem]);
    }
    
    // Reset form
    setSelectedProduct(null);
    setItemQuantity("");
    setItemNotes("");
    setQuantityError("");
    setShowAddItemDialog(false);
  };

  const handleRemoveItem = (index: number) => {
    setWithdrawalItems(withdrawalItems.filter((_, i) => i !== index));
  };

  const handleCreatePlan = async () => {
    if (!clientName || withdrawalItems.length === 0) return;

    try {
      // Create the withdrawal plan
      const planData = {
        clientInfo: {
          clientName,
          clientDocument: clientDocument || undefined,
          contactInfo: contactInfo || undefined,
        },
        notes,
        // Para planos de retirada de cliente
        fromLocation: 'Armazém',
        toLocation: 'Cliente'
      };

      const createdPlan = await createPlanMutation.mutateAsync(planData);

      // Add all items to plan
      for (const item of withdrawalItems) {
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
      setClientName("");
      setClientDocument("");
      setContactInfo("");
      setNotes("");
      setWithdrawalItems([]);
      
      // Call callback
      onPlanCreated?.(createdPlan.id);
      
    } catch (error) {
      console.error('Error creating withdrawal plan:', error);
    }
  };

  // Calculate progress
  const wizardProgress = () => {
    let progress = 0;
    if (clientName) progress += 40;
    if (withdrawalItems.length > 0) progress += 60;
    return progress;
  };

  const totalCubicVolume = withdrawalItems.reduce((sum, item) => sum + (item.totalCubicVolume || 0), 0);
  const isFormValid = clientName && withdrawalItems.length > 0;

  // Reset quantity error when product changes
  useEffect(() => {
    setQuantityError("");
    setItemQuantity("");
  }, [selectedProduct]);

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="border-orange-200 bg-orange-50/30">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <UserCheck className="h-5 w-5" />
              Plano de Retirada - Cliente
            </CardTitle>
            <div className="text-sm text-orange-700 font-medium">
              {wizardProgress().toFixed(0)}% completo
            </div>
          </div>
          <Progress value={wizardProgress()} className="mb-3" />
          <CardDescription className="text-orange-700">
            Configure o plano de retirada de mercadoria por cliente
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Client Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-orange-600" />
            Informações do Cliente
          </CardTitle>
          <CardDescription>
            Dados do cliente que irá retirar a mercadoria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientName">Nome do Cliente *</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nome completo ou razão social"
                required
              />
            </div>
            <div>
              <Label htmlFor="clientDocument">CPF/CNPJ</Label>
              <Input
                id="clientDocument"
                value={clientDocument}
                onChange={(e) => setClientDocument(e.target.value)}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="contactInfo">Informações de Contato</Label>
            <Input
              id="contactInfo"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Telefone, e-mail ou outras informações de contato"
            />
          </div>
        </CardContent>
      </Card>

      {/* Information Notice */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-blue-900 mb-1">
                Plano de Retirada
              </h3>
              <p className="text-blue-800 text-sm leading-relaxed">
                Este wizard cria um <strong>plano de retirada</strong> para um cliente específico. 
                Durante a execução na página de <strong>Execução de Carregamento</strong>, 
                os dados reais da retirada (data, veículo, quantidades) serão coletados quando o cliente vier buscar.
                O sistema controlará o estoque disponível baseado neste plano.
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
                <Warehouse className="h-5 w-5 text-orange-600" />
                Itens do Plano de Retirada
              </CardTitle>
              <CardDescription>
                Produtos planejados para retirada (limitado ao estoque disponível)
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowAddItemDialog(true)}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
            >
              <Plus className="h-4 w-4" />
              Adicionar Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {withdrawalItems.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum item adicionado</p>
              <p className="text-sm text-gray-400">
                Clique em "Adicionar Item" para começar
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawalItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 hover:bg-orange-50/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{item.productName}</h4>
                        <Badge variant="outline" className="text-xs">
                          SKU: {item.productSku}
                        </Badge>
                        <Badge className="bg-orange-100 text-orange-800 border-orange-300">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Plano Retirada
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Quantidade:</span>
                          <p className="font-medium text-lg">{parseFloat(item.quantity).toLocaleString('pt-BR')} un</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Estoque Disponível:</span>
                          <p className="font-medium">{item.availableStock?.toLocaleString('pt-BR') || 'N/A'} un</p>
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
                        <div className="mt-3 p-2 bg-orange-50 rounded">
                          <p className="text-sm text-orange-700">
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
            Observações da Retirada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações sobre a retirada do cliente..."
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
                <UserCheck className="h-4 w-4 text-orange-600" />
                Resumo do Plano de Retirada
              </div>
              <div className="text-sm text-gray-600">
                {withdrawalItems.length} produto(s) • {' '}
                {withdrawalItems.reduce((sum, item) => sum + parseFloat(item.quantity), 0).toLocaleString('pt-BR')} unidades planejadas • {' '}
                {totalCubicVolume.toFixed(3)} m³ estimados
              </div>
            </div>
            <Button
              onClick={handleCreatePlan}
              disabled={!isFormValid || createPlanMutation.isPending}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
            >
              {createPlanMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Criar Plano de Retirada
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-orange-600" />
              Adicionar Item à Retirada
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <Label>Produto</Label>
              <ProductSearchWithStock
                onProductSelect={setSelectedProduct}
                selectedProduct={selectedProduct}
                showOnlyInStock={true}
              />
            </div>

            {selectedProduct && (
              <>
                <Alert className="border-blue-200 bg-blue-50">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Estoque disponível:</strong> {selectedProduct.totalStock?.toLocaleString('pt-BR') || 'N/A'} unidades
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity">Quantidade para Retirada</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={itemQuantity}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      placeholder="0"
                      min="0.01"
                      step="0.01"
                      max={selectedProduct.totalStock}
                    />
                    {quantityError && (
                      <Alert className="mt-2 border-red-200 bg-red-50">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-red-800">{quantityError}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                  
                  <div>
                    <Label>Cubagem Calculada</Label>
                    <div className="h-10 flex items-center">
                      {selectedProduct.dimensions && itemQuantity && !quantityError ? (
                        <span className="font-medium text-orange-600">
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
              className="bg-orange-600 hover:bg-orange-700"
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