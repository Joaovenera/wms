import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Package2, X, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
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

interface ProductSearchWithStockProps {
  onProductSelect: (product: ProductWithStock | null) => void;
  selectedProduct?: ProductWithStock | null;
  placeholder?: string;
  showOnlyInStock?: boolean;
}

export function ProductSearchWithStock({ 
  onProductSelect, 
  selectedProduct,
  placeholder = "Pesquisar produto com estoque...",
  showOnlyInStock = true
}: ProductSearchWithStockProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<ProductWithStock[]>([]);

  // Fetch products with stock information
  const { data: products, isLoading, error } = useQuery({
    queryKey: ['/api/products?includeStock=true'],
    queryFn: async () => {
      console.log('🔍 ProductSearchWithStock: Fetching products with stock...');
      const res = await apiRequest('GET', '/api/products?includeStock=true');
      const data = await res.json();
      console.log('🔍 ProductSearchWithStock: Products received:', data);
      console.log('🔍 ProductSearchWithStock: Products count:', data?.length || 0);
      return data;
    }
  });

  // Debug logs
  useEffect(() => {
    console.log('🔍 ProductSearchWithStock: Component state:', {
      products,
      isLoading,
      error,
      showOnlyInStock,
      searchTerm
    });
  }, [products, isLoading, error, showOnlyInStock, searchTerm]);

  // Filter products based on search term and stock availability
  useEffect(() => {
    if (!products || !Array.isArray(products)) {
      console.log('🔍 ProductSearchWithStock: No products or invalid data');
      setFilteredProducts([]);
      return;
    }

    let filtered = products;
    console.log('🔍 ProductSearchWithStock: Initial products count:', filtered.length);

    // Filter by stock if required
    if (showOnlyInStock) {
      filtered = filtered.filter((product: ProductWithStock) => {
        const hasStock = (product.totalStock || 0) > 0;
        if (!hasStock) {
          console.log('🔍 ProductSearchWithStock: Filtering out product without stock:', product.name, 'stock:', product.totalStock);
        }
        return hasStock;
      });
      console.log('🔍 ProductSearchWithStock: Products with stock count:', filtered.length);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((product: ProductWithStock) => {
        const idMatch = product.id.toString().includes(term);
        const skuMatch = product.sku.toLowerCase().includes(term);
        const nameMatch = product.name.toLowerCase().includes(term);
        return idMatch || skuMatch || nameMatch;
      });
      console.log('🔍 ProductSearchWithStock: Products after search filter:', filtered.length);
    }

    setFilteredProducts(filtered.slice(0, 50)); // Limit to 50 results for better visibility
  }, [products, searchTerm, showOnlyInStock]);

  const handleProductSelect = (product: ProductWithStock) => {
    console.log('🔍 ProductSearchWithStock: Product selected:', product);
    onProductSelect(product);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleClearSelection = () => {
    onProductSelect(null);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputChange = (value: string) => {
    setSearchTerm(value);
    setIsOpen(true);
    if (!value.trim()) {
      onProductSelect(null);
    }
  };

  const formatStock = (stock?: number, unit?: string) => {
    if (stock === undefined || stock === null) return "0";
    return `${stock} ${unit || ''}`.trim();
  };

  const getStockStatus = (stock?: number) => {
    if (!stock || stock === 0) return { variant: 'destructive' as const, label: 'Sem estoque' };
    if (stock < 10) return { variant: 'outline' as const, label: 'Estoque baixo' };
    return { variant: 'default' as const, label: 'Em estoque' };
  };

  return (
    <div className="space-y-2 relative">
      <Label className="text-base font-medium">Produto (com validação de estoque)</Label>
      
      {/* Display selected product */}
      {selectedProduct && !isOpen ? (
        <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Package2 className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-blue-900 text-lg">{selectedProduct.name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-sm font-medium">
                  ID: {selectedProduct.id}
                </Badge>
                <Badge variant="outline" className="text-sm font-medium">
                  SKU: {selectedProduct.sku}
                </Badge>
                <Badge variant={getStockStatus(selectedProduct.totalStock).variant} className="text-sm font-medium">
                  {formatStock(selectedProduct.totalStock, selectedProduct.unit)}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(true)}
                className="text-blue-700 border-blue-300 hover:bg-blue-100"
              >
                Alterar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="text-gray-500 hover:text-red-600 hover:bg-red-50"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={handleInputFocus}
              placeholder={placeholder}
              className="pl-10 pr-10 h-12 text-base"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  onProductSelect(null);
                }}
                className="absolute right-8 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            >
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
          
          <p className="text-sm text-gray-500">
            {showOnlyInStock
              ? "Apenas produtos com estoque disponível são exibidos"
              : "Todos os produtos são exibidos"}
          </p>
        </>
      )}

      {/* Dropdown Results */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white border rounded-lg shadow-xl max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-3"></div>
              Carregando produtos...
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <p className="text-sm text-red-700 font-medium mb-2">
                Erro ao carregar produtos
              </p>
              <p className="text-xs text-gray-600">
                {error.message || 'Tente novamente mais tarde'}
              </p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-6 text-center">
              <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-700 font-medium mb-2">
                {searchTerm ? 'Nenhum produto encontrado' : showOnlyInStock ? 'Nenhum produto com estoque disponível' : 'Nenhum produto disponível'}
              </p>
              {showOnlyInStock && !searchTerm && (
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Apenas produtos com estoque são exibidos
                </p>
              )}
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {filteredProducts.map((product: ProductWithStock) => {
                const stockStatus = getStockStatus(product.totalStock);
                return (
                  <div
                    key={product.id}
                    className="p-4 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors duration-150 hover:shadow-sm"
                    onClick={() => handleProductSelect(product)}
                  >
                    <div className="space-y-3">
                      {/* Product Name and Main Info */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 text-base leading-tight truncate">
                            {product.name}
                          </h4>
                        </div>
                        <div className="flex items-center ml-3">
                          <Package2 className="h-5 w-5 text-blue-500" />
                          {(product.totalStock || 0) === 0 && (
                            <AlertTriangle className="h-4 w-4 text-red-500 ml-1" />
                          )}
                        </div>
                      </div>

                      {/* Product Details */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-medium px-2 py-1">
                          ID: {product.id}
                        </Badge>
                        <Badge variant="outline" className="text-xs font-medium px-2 py-1">
                          SKU: {product.sku}
                        </Badge>
                        <Badge variant={stockStatus.variant} className="text-xs font-medium px-2 py-1">
                          {formatStock(product.totalStock, product.unit)}
                        </Badge>
                      </div>

                      {/* Dimensions */}
                      {product.dimensions && 
                       product.dimensions.length > 0 && 
                       product.dimensions.width > 0 && 
                       product.dimensions.height > 0 && (
                        <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                          <span className="font-medium">Dimensões:</span> {product.dimensions.length}×{product.dimensions.width}×{product.dimensions.height}cm
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {searchTerm && (
                <div className="px-4 py-3 border-t bg-gray-50">
                  <p className="text-xs text-gray-600 text-center font-medium">
                    {filteredProducts.length} resultado{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Overlay to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}