import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Progress } from "./ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Separator } from "./ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Minus,
  Package, 
  Search, 
  Trash2, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Settings,
  Layers,
  Scale,
  Ruler,
  Target,
  Zap,
  TrendingUp,
  Brain,
  Lightbulb,
  BarChart3,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  Shuffle,
  Filter,
  SortAsc,
  Info
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import {
  CompositionRequest,
  CompositionResult,
  CompositionProduct,
  CompositionConstraints,
  Product,
  Pallet,
  PackagingType,
  ValidationResult
} from "../types/api";
import { 
  useRealtimeCompositionValidation,
  useCompositionOptimization 
} from "../hooks/useComposition";

interface IntelligentCompositionBuilderProps {
  onCompositionUpdate?: (request: CompositionRequest, validation?: ValidationResult) => void;
  onOptimizationApply?: (request: CompositionRequest) => void;
  initialProducts?: CompositionProduct[];
  initialPalletId?: number;
  initialConstraints?: CompositionConstraints;
  className?: string;
}

interface SmartSuggestion {
  type: 'product' | 'quantity' | 'packaging' | 'pallet' | 'constraint';
  title: string;
  description: string;
  confidence: number;
  impact: string;
  action: () => void;
}

interface ProductWithAnalytics extends Product {
  packagingTypes?: PackagingType[];
  currentStock?: number;
  demandScore?: number;
  compatibilityScore?: number;
  efficiencyScore?: number;
  recommendedQuantity?: number;
}

export function IntelligentCompositionBuilder({
  onCompositionUpdate,
  onOptimizationApply,
  initialProducts = [],
  initialPalletId,
  initialConstraints = {},
  className
}: IntelligentCompositionBuilderProps) {
  const { toast } = useToast();
  
  // State management
  const [selectedProducts, setSelectedProducts] = useState<CompositionProduct[]>(initialProducts);
  const [selectedPalletId, setSelectedPalletId] = useState<number | undefined>(initialPalletId);
  const [constraints, setConstraints] = useState<CompositionConstraints>(initialConstraints);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'efficiency' | 'demand' | 'stock'>('efficiency');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [autoOptimize, setAutoOptimize] = useState(false);

  // Fetch enhanced product data with analytics
  const { data: productsData = [] } = useQuery<ProductWithAnalytics[]>({
    queryKey: ['/api/products/enhanced', searchTerm, selectedFilters, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedFilters.length > 0) params.append('filters', selectedFilters.join(','));
      params.append('sortBy', sortBy);
      params.append('includeAnalytics', 'true');
      params.append('includePackaging', 'true');
      params.append('includeStock', 'true');
      
      const res = await apiRequest('GET', `/api/products/enhanced?${params.toString()}`);
      return await res.json();
    },
    staleTime: 30000,
  });

  // Fetch available pallets with recommendations
  const { data: palletsData = [] } = useQuery<(Pallet & { recommendationScore?: number })[]>({
    queryKey: ['/api/pallets/recommended', selectedProducts],
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/pallets/recommended', {
        products: selectedProducts,
        constraints
      });
      return await res.json();
    },
    enabled: selectedProducts.length > 0,
  });

  // Create composition request for real-time validation
  const compositionRequest = useMemo((): CompositionRequest | null => {
    if (selectedProducts.length === 0 || !selectedPalletId) {
      return null;
    }

    return {
      products: selectedProducts,
      palletId: selectedPalletId,
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
    };
  }, [selectedProducts, selectedPalletId, constraints]);

  // Real-time validation with debouncing
  const { data: validationData, isLoading: isValidating } = useRealtimeCompositionValidation(
    compositionRequest,
    !!compositionRequest
  );

  // Smart optimization
  const optimizationMutation = useCompositionOptimization();

  // Generate smart suggestions based on current composition
  const smartSuggestions = useMemo((): SmartSuggestion[] => {
    const suggestions: SmartSuggestion[] = [];
    
    if (selectedProducts.length === 0) {
      suggestions.push({
        type: 'product',
        title: 'Adicionar produtos populares',
        description: 'Comece com os produtos mais demandados para essa categoria',
        confidence: 0.8,
        impact: 'Eficiência +15%',
        action: () => {
          const topProducts = productsData
            .filter(p => p.demandScore && p.demandScore > 0.7)
            .slice(0, 3);
          
          topProducts.forEach(product => {
            setSelectedProducts(prev => [
              ...prev,
              {
                productId: product.id,
                quantity: product.recommendedQuantity || 1,
                packagingTypeId: product.packagingTypes?.[0]?.id
              }
            ]);
          });
        }
      });
    }

    if (validationData && !validationData.isValid) {
      suggestions.push({
        type: 'constraint',
        title: 'Ajustar restrições automaticamente',
        description: 'Otimizar limites de peso e volume baseado nos produtos selecionados',
        confidence: 0.9,
        impact: 'Resolver violações',
        action: () => {
          const metrics = validationData.metrics;
          setConstraints(prev => ({
            ...prev,
            maxWeight: Math.ceil(metrics.totalWeight * 1.1),
            maxVolume: Math.ceil(metrics.totalVolume * 1.1 * 100) / 100,
            maxHeight: Math.ceil(metrics.totalHeight * 1.1)
          }));
        }
      });
    }

    if (validationData?.metrics.efficiency < 0.7) {
      suggestions.push({
        type: 'packaging',
        title: 'Otimizar embalagens',
        description: 'Sugerir embalagens mais eficientes para os produtos selecionados',
        confidence: 0.85,
        impact: 'Eficiência +20%',
        action: async () => {
          try {
            const optimization = await optimizationMutation.mutateAsync(compositionRequest!);
            onOptimizationApply?.(optimization.alternativeCompositions[0] as any);
          } catch (error) {
            console.error('Optimization failed:', error);
          }
        }
      });
    }

    if (!selectedPalletId && palletsData.length > 0) {
      const recommendedPallet = palletsData.reduce((best, current) => 
        (current.recommendationScore || 0) > (best.recommendationScore || 0) ? current : best
      );
      
      suggestions.push({
        type: 'pallet',
        title: 'Usar pallet recomendado',
        description: `Pallet ${recommendedPallet.code} otimizado para seus produtos`,
        confidence: recommendedPallet.recommendationScore || 0.5,
        impact: 'Melhor ajuste',
        action: () => setSelectedPalletId(recommendedPallet.id)
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }, [selectedProducts, validationData, productsData, palletsData, selectedPalletId, compositionRequest, optimizationMutation, onOptimizationApply]);

  // Notify parent of changes
  useEffect(() => {
    if (compositionRequest && onCompositionUpdate) {
      onCompositionUpdate(compositionRequest, validationData || undefined);
    }
  }, [compositionRequest, validationData, onCompositionUpdate]);

  // Auto-optimization when enabled
  useEffect(() => {
    if (autoOptimize && validationData && validationData.metrics.efficiency < 0.6) {
      handleAutoOptimize();
    }
  }, [autoOptimize, validationData]);

  const handleAutoOptimize = useCallback(async () => {
    if (!compositionRequest) return;

    try {
      const optimization = await optimizationMutation.mutateAsync(compositionRequest);
      
      if (optimization.alternativeCompositions.length > 0) {
        const bestAlternative = optimization.alternativeCompositions[0];
        
        // Apply the best alternative
        onOptimizationApply?.(bestAlternative as any);
        
        toast({
          title: "Auto-otimização aplicada",
          description: `Eficiência melhorada para ${(bestAlternative.efficiency * 100).toFixed(1)}%`,
        });
      }
    } catch (error: any) {
      console.error('Auto-optimization failed:', error);
    }
  }, [compositionRequest, optimizationMutation, onOptimizationApply, toast]);

  const addProduct = useCallback((product: ProductWithAnalytics) => {
    const existingIndex = selectedProducts.findIndex(p => p.productId === product.id);
    
    if (existingIndex >= 0) {
      // Increase quantity of existing product
      setSelectedProducts(prev => 
        prev.map((p, i) => 
          i === existingIndex 
            ? { ...p, quantity: p.quantity + (product.recommendedQuantity || 1) }
            : p
        )
      );
    } else {
      // Add new product
      setSelectedProducts(prev => [
        ...prev,
        {
          productId: product.id,
          quantity: product.recommendedQuantity || 1,
          packagingTypeId: product.packagingTypes?.[0]?.id
        }
      ]);
    }

    toast({
      title: "Produto adicionado",
      description: `${product.name} foi adicionado à composição`,
    });
  }, [selectedProducts, toast]);

  const removeProduct = useCallback((index: number) => {
    setSelectedProducts(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateProductQuantity = useCallback((index: number, quantity: number) => {
    if (quantity <= 0) {
      removeProduct(index);
      return;
    }

    setSelectedProducts(prev => 
      prev.map((p, i) => i === index ? { ...p, quantity } : p)
    );
  }, [removeProduct]);

  const updateProductPackaging = useCallback((index: number, packagingTypeId: number | undefined) => {
    setSelectedProducts(prev => 
      prev.map((p, i) => i === index ? { ...p, packagingTypeId } : p)
    );
  }, []);

  const applySuggestion = useCallback((suggestion: SmartSuggestion) => {
    suggestion.action();
    
    toast({
      title: "Sugestão aplicada",
      description: suggestion.title,
    });
  }, [toast]);

  const getEfficiencyColor = (efficiency: number): string => {
    if (efficiency >= 0.8) return "text-green-600";
    if (efficiency >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800";
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with intelligence controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <CardTitle>Construtor Inteligente de Composições</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoOptimize(!autoOptimize)}
                className={autoOptimize ? "bg-blue-50 text-blue-700" : ""}
              >
                <Zap className="h-4 w-4 mr-1" />
                Auto-otimizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSuggestions(!showSuggestions)}
              >
                {showSuggestions ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{selectedProducts.length}</div>
              <div className="text-xs text-muted-foreground">Produtos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {selectedProducts.reduce((sum, p) => sum + p.quantity, 0)}
              </div>
              <div className="text-xs text-muted-foreground">Itens</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${validationData ? getEfficiencyColor(validationData.metrics.efficiency) : 'text-gray-400'}`}>
                {validationData ? `${(validationData.metrics.efficiency * 100).toFixed(1)}%` : '--'}
              </div>
              <div className="text-xs text-muted-foreground">Eficiência</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${validationData?.isValid ? 'text-green-600' : selectedProducts.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {validationData?.isValid ? 'Válida' : selectedProducts.length > 0 ? 'Inválida' : '--'}
              </div>
              <div className="text-xs text-muted-foreground">Status</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Smart suggestions */}
      {showSuggestions && smartSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Sugestões Inteligentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {smartSuggestions.slice(0, 3).map((suggestion, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{suggestion.title}</span>
                      <Badge className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}>
                        {Math.round(suggestion.confidence * 100)}% confiança
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {suggestion.impact}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => applySuggestion(suggestion)}
                    className="ml-3"
                  >
                    Aplicar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products">
            <Package className="h-4 w-4 mr-2" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="pallet">
            <Layers className="h-4 w-4 mr-2" />
            Pallet
          </TabsTrigger>
          <TabsTrigger value="constraints">
            <Settings className="h-4 w-4 mr-2" />
            Restrições
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          {/* Search and filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar produtos inteligentemente..."
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efficiency">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Eficiência
                        </div>
                      </SelectItem>
                      <SelectItem value="demand">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Demanda
                        </div>
                      </SelectItem>
                      <SelectItem value="stock">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Estoque
                        </div>
                      </SelectItem>
                      <SelectItem value="name">
                        <div className="flex items-center gap-2">
                          <SortAsc className="h-4 w-4" />
                          Nome
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Produtos Recomendados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {productsData.slice(0, 6).map((product) => (
                  <div key={product.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{product.name}</div>
                        <div className="text-xs text-muted-foreground">SKU: {product.sku}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addProduct(product)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className={`font-bold ${getEfficiencyColor(product.efficiencyScore || 0)}`}>
                          {Math.round((product.efficiencyScore || 0) * 100)}%
                        </div>
                        <div className="text-muted-foreground">Eficiência</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-blue-600">
                          {Math.round((product.demandScore || 0) * 100)}%
                        </div>
                        <div className="text-muted-foreground">Demanda</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-green-600">{product.currentStock || 0}</div>
                        <div className="text-muted-foreground">Estoque</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Selected products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Produtos Selecionados</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum produto selecionado</p>
                  <p className="text-sm">Use as recomendações acima ou busque produtos</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedProducts.map((product, index) => {
                    const productData = productsData.find(p => p.id === product.productId);
                    
                    return (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Package className="h-5 w-5 text-blue-600" />
                          <div>
                            <div className="font-medium text-sm">
                              {productData?.name || `Produto ${product.productId}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              SKU: {productData?.sku || 'N/A'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateProductQuantity(index, product.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="font-medium min-w-8 text-center text-sm">
                              {product.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateProductQuantity(index, product.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeProduct(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pallet Tab */}
        <TabsContent value="pallet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Seleção Inteligente de Pallet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {palletsData.map((pallet) => (
                  <div
                    key={pallet.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedPalletId === pallet.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedPalletId(pallet.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{pallet.code}</div>
                      {pallet.recommendationScore && (
                        <Badge className={getConfidenceColor(pallet.recommendationScore)}>
                          {Math.round(pallet.recommendationScore * 100)}%
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-sm text-muted-foreground mb-3">
                      {pallet.type} • {pallet.width}×{pallet.length}×{pallet.height}cm
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      Capacidade: {pallet.maxWeight}kg
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Constraints Tab */}
        <TabsContent value="constraints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Restrições Inteligentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="max-weight" className="flex items-center gap-2">
                    <Scale className="h-4 w-4" />
                    Peso Máximo (kg)
                  </Label>
                  <Input
                    id="max-weight"
                    type="number"
                    step="0.1"
                    value={constraints.maxWeight || ""}
                    onChange={(e) => setConstraints(prev => ({
                      ...prev,
                      maxWeight: e.target.value ? parseFloat(e.target.value) : undefined
                    }))}
                    placeholder="Auto-detectar"
                  />
                </div>
                
                <div>
                  <Label htmlFor="max-height" className="flex items-center gap-2">
                    <Ruler className="h-4 w-4" />
                    Altura Máxima (cm)
                  </Label>
                  <Input
                    id="max-height"
                    type="number"
                    step="1"
                    value={constraints.maxHeight || ""}
                    onChange={(e) => setConstraints(prev => ({
                      ...prev,
                      maxHeight: e.target.value ? parseFloat(e.target.value) : undefined
                    }))}
                    placeholder="Auto-detectar"
                  />
                </div>
                
                <div>
                  <Label htmlFor="max-volume" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Volume Máximo (m³)
                  </Label>
                  <Input
                    id="max-volume"
                    type="number"
                    step="0.001"
                    value={constraints.maxVolume || ""}
                    onChange={(e) => setConstraints(prev => ({
                      ...prev,
                      maxVolume: e.target.value ? parseFloat(e.target.value) : undefined
                    }))}
                    placeholder="Auto-detectar"
                  />
                </div>
              </div>
              
              <Button
                variant="outline"
                onClick={() => {
                  if (validationData) {
                    const metrics = validationData.metrics;
                    setConstraints({
                      maxWeight: Math.ceil(metrics.totalWeight * 1.2),
                      maxVolume: Math.ceil(metrics.totalVolume * 1.2 * 100) / 100,
                      maxHeight: Math.ceil(metrics.totalHeight * 1.2)
                    });
                  }
                }}
                disabled={!validationData}
                className="w-full"
              >
                <Target className="h-4 w-4 mr-2" />
                Auto-configurar restrições
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Real-time validation display */}
      {isValidating && (
        <Card>
          <CardContent className="p-4 text-center">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Validando composição em tempo real...</p>
          </CardContent>
        </Card>
      )}

      {validationData && !isValidating && (
        <Card>
          <CardContent className="p-4">
            <div className={`flex items-center gap-3 p-3 rounded-lg ${
              validationData.isValid ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {validationData.isValid ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
              <div className="flex-1">
                <div className="font-medium">
                  {validationData.isValid ? 'Composição Válida' : 'Composição Inválida'}
                </div>
                <div className="text-sm opacity-90">
                  {validationData.isValid 
                    ? `Eficiência: ${(validationData.metrics.efficiency * 100).toFixed(1)}%`
                    : `${validationData.violations.filter(v => v.severity === 'error').length} erro(s) encontrado(s)`
                  }
                </div>
              </div>
              {validationData.isValid && (
                <div className="text-right text-sm">
                  <div>Peso: {(validationData.metrics.totalWeight).toFixed(1)}kg</div>
                  <div>Volume: {(validationData.metrics.totalVolume).toFixed(3)}m³</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}