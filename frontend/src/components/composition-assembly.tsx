import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Minus, 
  Package, 
  Scale, 
  Ruler, 
  AlertTriangle,
  CheckCircle,
  Search,
  X,
  Eye
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { ProductSearchWithStock } from "./product-search-with-stock";
import { useProductPackaging } from "../hooks/usePackaging";
import { 
  CompositionRequest, 
  CompositionProduct,
  CompositionConstraints,
  PackagingComposition,
  Product,
  Pallet,
  PackagingType
} from "../types/api";

interface CompositionAssemblyProps {
  initialComposition?: PackagingComposition;
  onCompositionCreate: (request: CompositionRequest, metadata: {
    name: string;
    description?: string;
  }) => void;
  onCompositionValidate: (request: CompositionRequest) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface ProductSelection extends CompositionProduct {
  product?: Product;
  packaging?: PackagingType;
  isValid?: boolean;
  errors?: string[];
}

export function CompositionAssembly({
  initialComposition,
  onCompositionCreate,
  onCompositionValidate,
  onCancel,
  isLoading = false
}: CompositionAssemblyProps) {
  const [name, setName] = useState(initialComposition?.name || "");
  const [description, setDescription] = useState(initialComposition?.description || "");
  const [selectedPalletId, setSelectedPalletId] = useState<number | null>(
    initialComposition?.palletId || null
  );
  const [products, setProducts] = useState<ProductSelection[]>(
    initialComposition?.products.map(p => ({ ...p, isValid: true })) || [
      { productId: 0, quantity: 1, isValid: false, errors: ["Produto não selecionado"] }
    ]
  );
  const [constraints, setConstraints] = useState<CompositionConstraints>(
    initialComposition?.constraints || {}
  );
  const [showAdvancedConstraints, setShowAdvancedConstraints] = useState(false);
  const { toast } = useToast();

  // Fetch available pallets
  const { data: pallets, isLoading: palletsLoading } = useQuery<Pallet[]>({
    queryKey: ['/api/pallets?status=disponivel'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/pallets?status=disponivel');
      return await res.json();
    }
  });

  // Validate form on changes
  useEffect(() => {
    validateForm();
  }, [name, selectedPalletId, products]);

  const validateForm = (): boolean => {
    const validProducts = products.filter(p => p.productId > 0 && p.quantity > 0);
    return (
      name.trim().length > 0 &&
      selectedPalletId !== null &&
      validProducts.length > 0
    );
  };

  const addProduct = () => {
    setProducts([
      ...products,
      { 
        productId: 0, 
        quantity: 1, 
        isValid: false, 
        errors: ["Produto não selecionado"] 
      }
    ]);
  };

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const updateProduct = (index: number, updates: Partial<ProductSelection>) => {
    const updatedProducts = [...products];
    updatedProducts[index] = { ...updatedProducts[index], ...updates };
    
    // Validate product
    const product = updatedProducts[index];
    const errors: string[] = [];
    
    if (!product.productId || product.productId === 0) {
      errors.push("Produto não selecionado");
    }
    if (!product.quantity || product.quantity <= 0) {
      errors.push("Quantidade deve ser maior que zero");
    }
    
    updatedProducts[index].errors = errors;
    updatedProducts[index].isValid = errors.length === 0;
    
    setProducts(updatedProducts);
  };

  const handleProductSelect = (index: number, product: Product | null) => {
    if (product) {
      updateProduct(index, {
        productId: product.id,
        product: product,
        packagingTypeId: undefined, // Reset packaging selection
        packaging: undefined
      });
    } else {
      updateProduct(index, {
        productId: 0,
        product: undefined,
        packagingTypeId: undefined,
        packaging: undefined
      });
    }
  };

  const handlePackagingSelect = (index: number, packagingId: string) => {
    const packagingTypeId = packagingId === "base" ? undefined : parseInt(packagingId);
    updateProduct(index, { packagingTypeId });
  };

  const buildCompositionRequest = (): CompositionRequest => {
    const validProducts = products.filter(p => p.isValid && p.productId > 0);
    
    return {
      products: validProducts.map(p => ({
        productId: p.productId,
        quantity: p.quantity,
        packagingTypeId: p.packagingTypeId
      })),
      palletId: selectedPalletId!,
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined
    };
  };

  const handleValidate = () => {
    if (!validateForm()) {
      toast({
        title: "Formulário inválido",
        description: "Preencha todos os campos obrigatórios antes de validar",
        variant: "destructive"
      });
      return;
    }

    const request = buildCompositionRequest();
    onCompositionValidate(request);
  };

  const handleCreate = () => {
    if (!validateForm()) {
      toast({
        title: "Formulário inválido",
        description: "Preencha todos os campos obrigatórios antes de criar",
        variant: "destructive"
      });
      return;
    }

    const request = buildCompositionRequest();
    onCompositionCreate(request, { name, description });
  };

  const selectedPallet = pallets?.find(p => p.id === selectedPalletId);

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Nome da Composição *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Composição Produtos A+B para Cliente X"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional da composição..."
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="pallet">Pallet *</Label>
            <Select 
              value={selectedPalletId?.toString() || ""} 
              onValueChange={(value) => setSelectedPalletId(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o pallet" />
              </SelectTrigger>
              <SelectContent>
                {palletsLoading ? (
                  <SelectItem value="" disabled>Carregando pallets...</SelectItem>
                ) : (
                  pallets?.map((pallet) => (
                    <SelectItem key={pallet.id} value={pallet.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{pallet.code}</span>
                        <Badge variant="outline" className="text-xs">
                          {pallet.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {pallet.width}×{pallet.length}×{pallet.height}cm
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedPallet && (
              <p className="text-xs text-muted-foreground mt-1">
                Capacidade: {selectedPallet.maxWeight}kg | 
                Dimensões: {selectedPallet.width}×{selectedPallet.length}×{selectedPallet.height}cm
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Products Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Produtos da Composição</CardTitle>
            <Button onClick={addProduct} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Produto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {products.map((productSelection, index) => (
            <ProductSelectionRow
              key={index}
              index={index}
              productSelection={productSelection}
              onProductSelect={(product) => handleProductSelect(index, product)}
              onQuantityChange={(quantity) => updateProduct(index, { quantity })}
              onPackagingSelect={(packagingId) => handlePackagingSelect(index, packagingId)}
              onRemove={() => removeProduct(index)}
              canRemove={products.length > 1}
            />
          ))}
          
          {products.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum produto adicionado</p>
              <Button onClick={addProduct} size="sm" className="mt-2">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar primeiro produto
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Constraints */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Restrições Avançadas</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedConstraints(!showAdvancedConstraints)}
            >
              {showAdvancedConstraints ? (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  Ocultar
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  Mostrar
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {showAdvancedConstraints && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="maxWeight">Peso Máximo (kg)</Label>
                <Input
                  id="maxWeight"
                  type="number"
                  step="0.1"
                  value={constraints.maxWeight || ""}
                  onChange={(e) => setConstraints({
                    ...constraints,
                    maxWeight: e.target.value ? parseFloat(e.target.value) : undefined
                  })}
                  placeholder="Ex: 500"
                />
              </div>
              
              <div>
                <Label htmlFor="maxHeight">Altura Máxima (cm)</Label>
                <Input
                  id="maxHeight"
                  type="number"
                  step="1"
                  value={constraints.maxHeight || ""}
                  onChange={(e) => setConstraints({
                    ...constraints,
                    maxHeight: e.target.value ? parseFloat(e.target.value) : undefined
                  })}
                  placeholder="Ex: 180"
                />
              </div>
              
              <div>
                <Label htmlFor="maxVolume">Volume Máximo (m³)</Label>
                <Input
                  id="maxVolume"
                  type="number"
                  step="0.01"
                  value={constraints.maxVolume || ""}
                  onChange={(e) => setConstraints({
                    ...constraints,
                    maxVolume: e.target.value ? parseFloat(e.target.value) : undefined
                  })}
                  placeholder="Ex: 1.5"
                />
              </div>
            </div>
            
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                As restrições avançadas sobrescrevem os limites padrão do pallet selecionado.
                Deixe em branco para usar os valores padrão.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          {products.filter(p => p.isValid).length} de {products.length} produtos válidos
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          
          <Button
            variant="outline"
            onClick={handleValidate}
            disabled={!validateForm() || isLoading}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Validar
          </Button>
          
          <Button
            onClick={handleCreate}
            disabled={!validateForm() || isLoading}
          >
            {isLoading ? "Criando..." : "Criar Composição"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Product Selection Row Component
interface ProductSelectionRowProps {
  index: number;
  productSelection: ProductSelection;
  onProductSelect: (product: Product | null) => void;
  onQuantityChange: (quantity: number) => void;
  onPackagingSelect: (packagingId: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function ProductSelectionRow({
  index,
  productSelection,
  onProductSelect,
  onQuantityChange,
  onPackagingSelect,
  onRemove,
  canRemove
}: ProductSelectionRowProps) {
  const { data: packagingData } = useProductPackaging(productSelection.productId || 0);
  
  const packagings = (packagingData as any)?.packagings || [];
  const hasErrors = productSelection.errors && productSelection.errors.length > 0;

  return (
    <div className={`border rounded-lg p-4 space-y-4 ${hasErrors ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Produto {index + 1}</span>
          {productSelection.isValid ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
        </div>
        
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <ProductSearchWithStock
            selectedProduct={productSelection.product || null}
            onProductSelect={onProductSelect}
            placeholder="Buscar produto para a composição..."
            showOnlyInStock={true}
          />
        </div>
        
        <div>
          <Label>Quantidade</Label>
          <Input
            type="number"
            min="1"
            step="1"
            value={productSelection.quantity}
            onChange={(e) => onQuantityChange(parseInt(e.target.value) || 1)}
            placeholder="1"
          />
        </div>
      </div>

      {productSelection.productId > 0 && packagings.length > 0 && (
        <div>
          <Label>Embalagem</Label>
          <Select
            value={productSelection.packagingTypeId?.toString() || "base"}
            onValueChange={onPackagingSelect}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">Unidade Base</SelectItem>
              {packagings.map((pkg: any) => (
                <SelectItem key={pkg.id} value={pkg.id.toString()}>
                  {pkg.name} ({pkg.baseUnitQuantity} un. base)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasErrors && (
        <Alert className="bg-red-100 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <ul className="list-disc list-inside space-y-1">
              {productSelection.errors?.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}