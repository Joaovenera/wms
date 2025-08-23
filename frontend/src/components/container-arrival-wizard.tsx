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
import { PhotoUploadGrid } from "./photo-upload-grid";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Container,
  Truck, 
  Package, 
  Plus, 
  Trash2, 
  CheckCircle,
  AlertTriangle,
  Loader2,
  Info,
  ArrowRight,
  ArrowLeft,
  Calendar,
  User,
  Phone,
  FileText,
  Camera,
  Ship,
  Lock,
  Calculator
} from "lucide-react";
import { ContainerArrival, ContainerItem, ContainerPhoto } from "@/types/container";
import { apiRequest } from "@/lib/queryClient";

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

interface ContainerArrivalWizardProps {
  onContainerCreated?: (containerId: number) => void;
}

const WIZARD_STEPS = [
  { id: 'basic', title: 'Informações Básicas', icon: Info },
  { id: 'container', title: 'Dados do Container', icon: Container },
  { id: 'photos', title: 'Registro Fotográfico', icon: Camera },
  { id: 'products', title: 'Produtos', icon: Package },
  { id: 'review', title: 'Finalização', icon: CheckCircle }
];

export function ContainerArrivalWizard({ onContainerCreated }: ContainerArrivalWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado do container
  const [containerData, setContainerData] = useState<Partial<ContainerArrival>>({
    status: 'awaiting',
    photos: [],
    items: [],
    supplierName: '',
    estimatedArrival: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Estados para adicionar produtos
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [productQuantity, setProductQuantity] = useState("");
  const [productNotes, setProductNotes] = useState("");
  const [productCondition, setProductCondition] = useState<"good" | "damaged" | "missing">("good");

  const queryClient = useQueryClient();

  // Criar container
  const createContainerMutation = useMutation({
    mutationFn: async (data: Partial<ContainerArrival>) => {
      const res = await apiRequest('POST', '/api/container-arrivals', data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao criar container');
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
      case 1: // Container
        return !!(containerData.containerNumber && containerData.sealNumber);
      case 2: // Fotos
        return containerData.photos?.length === 4;
      case 3: // Produtos
        return (containerData.items?.length || 0) > 0;
      case 4: // Review
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
      condition: productCondition
    };

    setContainerData(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));

    // Reset form
    setSelectedProduct(null);
    setProductQuantity("");
    setProductNotes("");
    setProductCondition("good");
    setShowAddProductDialog(false);
  };

  // Remover produto
  const removeProduct = (index: number) => {
    setContainerData(prev => ({
      ...prev,
      items: prev.items?.filter((_, i) => i !== index) || []
    }));
  };

  // Finalizar criação do container
  const handleCreateContainer = async () => {
    setIsSubmitting(true);
    
    try {
      const result = await createContainerMutation.mutateAsync({
        ...containerData,
        actualArrival: new Date().toISOString(),
        status: containerData.photos?.length === 4 ? 'completed' : 'documenting'
      });

      queryClient.invalidateQueries({ queryKey: ['/api/container-arrivals'] });
      onContainerCreated?.(result.id);
      
    } catch (error) {
      console.error('Erro ao criar container:', error);
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

  const totalCubicVolume = containerData.items?.reduce((sum, item) => 
    sum + (item.totalCubicVolume || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header com progresso */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Ship className="h-6 w-6" />
              Novo Container - {WIZARD_STEPS[currentStep].title}
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
                Informações Básicas do Container
              </CardTitle>
              <CardDescription>
                Configure as informações iniciais antes da chegada do container
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

        {/* Etapa 2: Dados do Container */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Container className="h-5 w-5 text-blue-600" />
                Dados do Container e Transportador
              </CardTitle>
              <CardDescription>
                Informações preenchidas quando o container chegar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="containerNumber">Número do Container *</Label>
                  <Input
                    id="containerNumber"
                    value={containerData.containerNumber || ''}
                    onChange={(e) => setContainerData(prev => ({
                      ...prev,
                      containerNumber: e.target.value.toUpperCase()
                    }))}
                    placeholder="Ex: MSKU1234567"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="sealNumber">Número do Lacre *</Label>
                  <Input
                    id="sealNumber"
                    value={containerData.sealNumber || ''}
                    onChange={(e) => setContainerData(prev => ({
                      ...prev,
                      sealNumber: e.target.value.toUpperCase()
                    }))}
                    placeholder="Ex: ABC123456"
                  />
                </div>
              </div>

              <Separator />
              
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Informações do Transportador
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="transporterName">Nome do Transportador</Label>
                  <Input
                    id="transporterName"
                    value={containerData.transporterName || ''}
                    onChange={(e) => setContainerData(prev => ({
                      ...prev,
                      transporterName: e.target.value
                    }))}
                    placeholder="Nome da empresa transportadora"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="transporterContact">Contato do Transportador</Label>
                  <Input
                    id="transporterContact"
                    value={containerData.transporterContact || ''}
                    onChange={(e) => setContainerData(prev => ({
                      ...prev,
                      transporterContact: e.target.value
                    }))}
                    placeholder="Telefone ou email"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="driverName">Nome do Motorista</Label>
                  <Input
                    id="driverName"
                    value={containerData.driverName || ''}
                    onChange={(e) => setContainerData(prev => ({
                      ...prev,
                      driverName: e.target.value
                    }))}
                    placeholder="Nome do motorista"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="vehicleInfo">Informações do Veículo</Label>
                  <Input
                    id="vehicleInfo"
                    value={containerData.vehicleInfo || ''}
                    onChange={(e) => setContainerData(prev => ({
                      ...prev,
                      vehicleInfo: e.target.value
                    }))}
                    placeholder="Placa, modelo, etc."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Etapa 3: Fotos */}
        {currentStep === 2 && (
          <PhotoUploadGrid
            photos={containerData.photos || []}
            onPhotosChange={(photos) => setContainerData(prev => ({
              ...prev,
              photos
            }))}
          />
        )}

        {/* Etapa 4: Produtos */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    Produtos do Container
                  </CardTitle>
                  <CardDescription>
                    Adicione os produtos que chegaram no container
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
              {(containerData.items?.length || 0) === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">Nenhum produto adicionado</p>
                  <p className="text-sm text-gray-400">
                    Clique em "Adicionar Produto" para começar
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {containerData.items?.map((item, index) => (
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
                                item.condition === 'good' ? 'bg-green-100 text-green-800' :
                                item.condition === 'damaged' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }
                            >
                              {item.condition === 'good' ? 'Bom Estado' :
                               item.condition === 'damaged' ? 'Danificado' : 'Faltando'}
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
                              <span className="text-gray-600">Estado:</span>
                              <p className="font-medium">{
                                item.condition === 'good' ? 'Perfeito' :
                                item.condition === 'damaged' ? 'Com Avarias' : 'Faltante'
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
                          <span className="font-medium">Resumo do Container:</span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-700">
                            {containerData.items?.length} produto(s) • {totalCubicVolume.toFixed(3)} m³
                          </div>
                          <div className="text-sm text-blue-600">
                            {containerData.items?.reduce((sum, item) => sum + parseFloat(item.quantity), 0).toLocaleString('pt-BR')} unidades
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

        {/* Etapa 5: Review */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Revisão e Finalização
                </CardTitle>
                <CardDescription>
                  Confirme todas as informações antes de registrar o container
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Resumo das informações */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Informações Básicas</h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>Fornecedor:</strong> {containerData.supplierName}</p>
                      <p><strong>Data Estimada:</strong> {new Date(containerData.estimatedArrival!).toLocaleDateString('pt-BR')}</p>
                      {containerData.notes && <p><strong>Observações:</strong> {containerData.notes}</p>}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Container</h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>Número:</strong> {containerData.containerNumber}</p>
                      <p><strong>Lacre:</strong> {containerData.sealNumber}</p>
                      <p><strong>Transportador:</strong> {containerData.transporterName || 'Não informado'}</p>
                      <p><strong>Motorista:</strong> {containerData.driverName || 'Não informado'}</p>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="font-semibold text-lg mb-4">Documentação Fotográfica</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {containerData.photos?.map((photo, index) => (
                      <div key={photo.id} className="space-y-2">
                        <img 
                          src={photo.url} 
                          alt={photo.type}
                          className="w-full aspect-video object-cover rounded border"
                        />
                        <p className="text-xs text-center text-gray-600">
                          {photo.type.replace('_', ' ').toUpperCase()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="font-semibold text-lg mb-4">Produtos ({containerData.items?.length})</h3>
                  <div className="space-y-2">
                    {containerData.items?.map((item, index) => (
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
                  
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-700">
                        {totalCubicVolume.toFixed(3)} m³ TOTAL
                      </div>
                      <div className="text-green-600">
                        {containerData.items?.reduce((sum, item) => sum + parseFloat(item.quantity), 0).toLocaleString('pt-BR')} unidades em {containerData.items?.length} produtos
                      </div>
                    </div>
                  </div>
                </div>
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
                onClick={handleCreateContainer}
                disabled={!validateCurrentStep() || isSubmitting}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Registrar Container
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog para adicionar produto */}
      <Dialog open={showAddProductDialog} onOpenChange={setShowAddProductDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Adicionar Produto ao Container</DialogTitle>
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
                    <Label htmlFor="condition">Condição</Label>
                    <select 
                      className="w-full p-2 border rounded"
                      value={productCondition}
                      onChange={(e) => setProductCondition(e.target.value as any)}
                    >
                      <option value="good">Bom Estado</option>
                      <option value="damaged">Danificado</option>
                      <option value="missing">Faltando</option>
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
                setProductCondition("good");
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