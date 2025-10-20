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
import { Separator } from "@/components/ui/separator";
import { 
  Package, 
  Plus, 
  Trash2, 
  CheckCircle,
  AlertTriangle,
  Loader2,
  Info,
  ArrowRight,
  ArrowLeft,
  Ship,
  Calculator
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getPlaceholderVehicleId } from "@/lib/placeholderVehicles";

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

interface ContainerItem {
  productId: number;
  productName: string;
  productSku: string;
  quantity: string;
  unitCubicVolume: number;
  totalCubicVolume: number;
  notes?: string;
  expectedCondition?: "good" | "damaged" | "missing";
}

interface ContainerArrivalPlan {
  supplierName: string;
  estimatedArrival: string;
  notes: string;
  items: ContainerItem[];
}

interface ContainerArrivalWizardProps {
  onPlanCreated?: (planId: number) => void;
}

const WIZARD_STEPS = [
  { id: 'basic', title: 'Informações do Plano', icon: Info },
  { id: 'products', title: 'Produtos Esperados', icon: Package },
  { id: 'review', title: 'Revisão do Plano', icon: CheckCircle }
];

export function ContainerArrivalWizard({ onPlanCreated }: ContainerArrivalWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado do plano de container
  const [containerData, setContainerData] = useState<ContainerArrivalPlan>({
    supplierName: '',
    estimatedArrival: new Date().toISOString().split('T')[0],
    notes: '',
    items: []
  });

  // Estados para adicionar produtos
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [productQuantity, setProductQuantity] = useState("");
  const [productNotes, setProductNotes] = useState("");
  const [expectedCondition, setExpectedCondition] = useState<"good" | "damaged" | "missing">("good");

  const queryClient = useQueryClient();

  // Criar plano de container
  const createPlanMutation = useMutation({
    mutationFn: async (data: ContainerArrivalPlan) => {
      // Buscar o ID do veículo placeholder para containers
      const vehicleId = await getPlaceholderVehicleId('container');
      
      const planData = {
        type: 'container-arrival-plan',
        status: 'planejamento',
        vehicleId, // Usar veículo placeholder para containers
        supplierName: data.supplierName,
        estimatedArrival: data.estimatedArrival,
        notes: `PLANO DE CHEGADA DE CONTAINER - ${data.notes || ''}`.trim(),
        fromLocation: 'Porto',
        toLocation: 'Armazém',
        expectedItems: data.items
      };
      const res = await apiRequest('POST', '/api/transfer-requests', planData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao criar plano de container');
      }
      return await res.json();
    }
  });

  // Função para calcular cubagem do produto
  const calculateCubicVolume = (product: ProductWithStock, quantity: number): number => {
    if (!product.dimensions) return 0;
    
    const { length, width, height } = product.dimensions;
    const volumeM3 = (length / 100) * (width / 100) * (height / 100);
    return volumeM3 * quantity;
  };

  // Validar etapa atual
  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 0: // Básico
        return !!(containerData.supplierName && containerData.estimatedArrival);
      case 1: // Produtos
        return containerData.items.length > 0;
      case 2: // Review
        return true;
      default:
        return false;
    }
  };

  // Navegar entre etapas
  const goToStep = (stepIndex: number) => {
    if (stepIndex < currentStep || validateCurrentStep()) {
      setCurrentStep(stepIndex);
    }
  };

  const nextStep = () => {
    if (validateCurrentStep() && currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Adicionar produto
  const handleAddProduct = () => {
    if (!selectedProduct || !productQuantity) return;

    const quantity = parseFloat(productQuantity);
    const unitCubicVolume = calculateCubicVolume(selectedProduct, 1);
    const totalCubicVolume = calculateCubicVolume(selectedProduct, quantity);

    const newItem: ContainerItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      productSku: selectedProduct.sku,
      quantity: productQuantity,
      unitCubicVolume,
      totalCubicVolume,
      notes: productNotes,
      expectedCondition: expectedCondition
    };

    setContainerData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));

    // Reset form
    setSelectedProduct(null);
    setProductQuantity("");
    setProductNotes("");
    setExpectedCondition("good");
    setShowAddProductDialog(false);
  };

  // Remover produto
  const removeProduct = (index: number) => {
    setContainerData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Finalizar criação do plano de container
  const handleCreatePlan = async () => {
    setIsSubmitting(true);
    
    try {
      const result = await createPlanMutation.mutateAsync(containerData);

      queryClient.invalidateQueries({ queryKey: ['/api/transfer-requests'] });
      
      // Reset form
      setContainerData({
        supplierName: '',
        estimatedArrival: new Date().toISOString().split('T')[0],
        notes: '',
        items: []
      });
      setCurrentStep(0);
      
      onPlanCreated?.(result.id);
      
    } catch (error) {
      console.error('Erro ao criar plano de container:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calcular progresso
  const getProgress = (): number => {
    const totalSteps = WIZARD_STEPS.length;
    const completedSteps = currentStep;
    return (completedSteps / (totalSteps - 1)) * 100;
  };

  const totalCubicVolume = containerData.items.reduce((sum, item) => 
    sum + (item.totalCubicVolume || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header com progresso */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Ship className="h-6 w-6" />
              Plano de Container - {WIZARD_STEPS[currentStep].title}
            </CardTitle>
            <Badge variant="secondary">
              Etapa {currentStep + 1} de {WIZARD_STEPS.length}
            </Badge>
          </div>
          <Progress value={getProgress()} className="mb-4" />
          
          {/* Steps indicator */}
          <div className="flex items-center justify-between">
            {WIZARD_STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              const isAvailable = index <= currentStep || validateCurrentStep();
              
              return (
                <div
                  key={step.id}
                  className={`flex items-center cursor-pointer transition-colors ${
                    isAvailable ? 'hover:text-blue-700' : 'opacity-50 cursor-not-allowed'
                  }`}
                  onClick={() => isAvailable ? goToStep(index) : undefined}
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full mr-2 ${
                    isCompleted ? 'bg-green-500 text-white' :
                    isCurrent ? 'bg-blue-500 text-white' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    isCurrent ? 'text-blue-700' : 'text-gray-600'
                  }`}>
                    {step.title}
                  </span>
                  {index < WIZARD_STEPS.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-gray-400 ml-4 mr-4" />
                  )}
                </div>
              );
            })}
          </div>
        </CardHeader>
      </Card>

      {/* Conteúdo das etapas */}
      <div className="min-h-[500px]">
        {/* Etapa 1: Informações Básicas */}
        {currentStep === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                Informações do Plano de Container
              </CardTitle>
              <CardDescription>
                Configure o plano com as informações básicas da chegada esperada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="supplierName">Fornecedor *</Label>
                  <Input
                    id="supplierName"
                    value={containerData.supplierName || ''}
                    onChange={(e) => setContainerData(prev => ({
                      ...prev,
                      supplierName: e.target.value
                    }))}
                    placeholder="Nome do fornecedor"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="estimatedArrival">Data Estimada de Chegada *</Label>
                  <Input
                    id="estimatedArrival"
                    type="date"
                    value={containerData.estimatedArrival?.split('T')[0] || ''}
                    onChange={(e) => setContainerData(prev => ({
                      ...prev,
                      estimatedArrival: e.target.value
                    }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={containerData.notes || ''}
                  onChange={(e) => setContainerData(prev => ({
                    ...prev,
                    notes: e.target.value
                  }))}
                  placeholder="Observações sobre o container ou a chegada..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Informações sobre Execução */}
        {currentStep === 0 && (
          <Card className="border-yellow-200 bg-yellow-50/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-yellow-900 mb-1">
                    Informações da Execução
                  </h3>
                  <p className="text-yellow-800 text-sm leading-relaxed">
                    Os dados específicos do container (número, lacre), informações do transportador, fotos e quantidades reais 
                    serão coletados durante a execução na página de <strong>Execução de Carregamento</strong> quando o container chegar.
                    Este plano define apenas o que é esperado.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Etapa 2: Produtos */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    Produtos do Plano de Container
                  </CardTitle>
                  <CardDescription>
                    Adicione os produtos planejados para o container
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowAddProductDialog(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Produto
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {containerData.items.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">Nenhum produto adicionado</p>
                  <p className="text-sm text-gray-400">
                    Clique em "Adicionar Produto" para começar
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {containerData.items.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{item.productName}</h4>
                            <Badge variant="outline" className="text-xs">
                              SKU: {item.productSku}
                            </Badge>
                            <Badge 
                              className={
                                item.expectedCondition === 'good' ? 'bg-green-100 text-green-800' :
                                item.expectedCondition === 'damaged' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }
                            >
                              {item.expectedCondition === 'good' ? 'Esperado OK' :
                               item.expectedCondition === 'damaged' ? 'Pode vir Danificado' : 'Pode estar Faltando'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Quantidade:</span>
                              <p className="font-medium">{parseFloat(item.quantity).toLocaleString('pt-BR')}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Cubagem Unit.:</span>
                              <p className="font-medium">{(item.unitCubicVolume || 0).toFixed(4)} m³</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Cubagem Total:</span>
                              <p className="font-medium">{(item.totalCubicVolume || 0).toFixed(3)} m³</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Estado Esperado:</span>
                              <p className="font-medium">{
                                item.expectedCondition === 'good' ? 'Bom Estado' :
                                item.expectedCondition === 'damaged' ? 'Possivelmente Danificado' : 'Pode estar Faltando'
                              }</p>
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
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProduct(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Resumo */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-5 w-5 text-blue-600" />
                          <span className="font-medium">Resumo do Plano:</span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-700">
                            {containerData.items.length} produto(s) • {totalCubicVolume.toFixed(3)} m³ estimados
                          </div>
                          <div className="text-sm text-blue-600">
                            {containerData.items.reduce((sum, item) => sum + parseFloat(item.quantity), 0).toLocaleString('pt-BR')} unidades esperadas
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Etapa 3: Review */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Revisão do Plano
                </CardTitle>
                <CardDescription>
                  Confirme todas as informações antes de criar o plano de container
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Resumo das informações */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Informações do Plano</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Fornecedor:</strong> {containerData.supplierName}</p>
                    <p><strong>Data Estimada de Chegada:</strong> {new Date(containerData.estimatedArrival!).toLocaleDateString('pt-BR')}</p>
                    {containerData.notes && <p><strong>Observações:</strong> {containerData.notes}</p>}
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="font-semibold text-lg mb-4">Produtos Esperados ({containerData.items.length})</h3>
                  <div className="space-y-2">
                    {containerData.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <div>
                          <span className="font-medium">{item.productName}</span>
                          <span className="text-gray-500 ml-2">({item.productSku})</span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{parseFloat(item.quantity).toLocaleString('pt-BR')} un</div>
                          <div className="text-sm text-gray-600">{(item.totalCubicVolume || 0).toFixed(3)} m³</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-700">
                        {totalCubicVolume.toFixed(3)} m³ TOTAL ESTIMADO
                      </div>
                      <div className="text-blue-600">
                        {containerData.items.reduce((sum, item) => sum + parseFloat(item.quantity), 0).toLocaleString('pt-BR')} unidades em {containerData.items.length} produtos
                      </div>
                    </div>
                  </div>
                </div>
                
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Plano Completo:</strong> Este plano define o que esperamos receber. Durante a execução, os dados reais 
                    (quantidades, fotos, condições) serão coletados para comparação com este plano.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Anterior
            </Button>
            
            <div className="text-sm text-gray-600">
              {!validateCurrentStep() && currentStep < WIZARD_STEPS.length - 1 && (
                <span className="text-amber-600">
                  Complete os campos obrigatórios para continuar
                </span>
              )}
            </div>
            
            {currentStep < WIZARD_STEPS.length - 1 ? (
              <Button
                onClick={nextStep}
                disabled={!validateCurrentStep()}
                className="flex items-center gap-2"
              >
                Próximo
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleCreatePlan}
                disabled={!validateCurrentStep() || isSubmitting}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Criar Plano de Container
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog para adicionar produto */}
      <Dialog open={showAddProductDialog} onOpenChange={setShowAddProductDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Adicionar Produto ao Plano de Container</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium">Produto</Label>
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
                      value={productQuantity}
                      onChange={(e) => setProductQuantity(e.target.value)}
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="expectedCondition">Condição Esperada</Label>
                    <select 
                      className="w-full p-2 border rounded"
                      value={expectedCondition}
                      onChange={(e) => setExpectedCondition(e.target.value as any)}
                    >
                      <option value="good">Esperado em Bom Estado</option>
                      <option value="damaged">Pode vir Danificado</option>
                      <option value="missing">Pode estar Faltando</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="productNotes">Observações</Label>
                  <Textarea
                    id="productNotes"
                    value={productNotes}
                    onChange={(e) => setProductNotes(e.target.value)}
                    placeholder="Observações sobre este produto..."
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
                setShowAddProductDialog(false);
                setSelectedProduct(null);
                setProductQuantity("");
                setProductNotes("");
                setExpectedCondition("good");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddProduct}
              disabled={!selectedProduct || !productQuantity}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}