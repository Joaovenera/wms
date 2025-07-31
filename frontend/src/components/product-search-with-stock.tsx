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
  const { data: products, isLoading } = useQuery({
    queryKey: ['/api/products?includeStock=true'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/products?includeStock=true');
      return await res.json();
    }
  });

  // Filter products based on search term and stock availability
  useEffect(() => {
    if (!products || !Array.isArray(products)) {
      setFilteredProducts([]);
      return;
    }

    let filtered = products;

    // Filter by stock if required
    if (showOnlyInStock) {
      filtered = filtered.filter((product: ProductWithStock) => 
        (product.totalStock || 0) > 0
      );
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
    }

    setFilteredProducts(filtered.slice(0, 20)); // Limit to 20 results
  }, [products, searchTerm, showOnlyInStock]);

  const handleProductSelect = (product: ProductWithStock) => {
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
      <Label>Produto (com validação de estoque)</Label>
      
      {/* Display selected product */}
      {selectedProduct && !isOpen ? (
        <div className="border rounded-md p-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <span className="font-medium">{selectedProduct.name}</span>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  ID: {selectedProduct.id}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  SKU: {selectedProduct.sku}
                </Badge>
                <Badge variant={getStockStatus(selectedProduct.totalStock).variant} className="text-xs">
                  {formatStock(selectedProduct.totalStock, selectedProduct.unit)}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(true)}
              >
                Alterar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
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
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  onProductSelect(null);
                }}
                className="absolute right-8 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
            >
              {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
          
          <p className="text-xs text-gray-500">
            {showOnlyInStock ? 'Mostrando apenas produtos com estoque disponível' : 'Pesquise por ID, SKU ou nome do produto'}
          </p>
        </>
      )}

      {/* Dropdown Results */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-gray-500">
              Carregando produtos...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-4 text-center">
              <Package2 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {searchTerm ? 'Nenhum produto encontrado' : showOnlyInStock ? 'Nenhum produto com estoque disponível' : 'Nenhum produto disponível'}
              </p>
              {showOnlyInStock && !searchTerm && (
                <p className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Apenas produtos com estoque são exibidos
                </p>
              )}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {filteredProducts.map((product: ProductWithStock) => {
                const stockStatus = getStockStatus(product.totalStock);
                return (
                  <div
                    key={product.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    onClick={() => handleProductSelect(product)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{product.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            ID: {product.id}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            SKU: {product.sku}
                          </Badge>
                          <Badge variant={stockStatus.variant} className="text-xs">
                            {formatStock(product.totalStock, product.unit)}
                          </Badge>
                        </div>
                        {product.dimensions && (
                          <p className="text-xs text-gray-600 mt-1">
                            {product.dimensions.length}×{product.dimensions.width}×{product.dimensions.height}cm
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end">
                        <Package2 className="h-5 w-5 text-gray-400" />
                        {(product.totalStock || 0) === 0 && (
                          <AlertTriangle className="h-4 w-4 text-red-500 mt-1" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {searchTerm && (
                <div className="p-2 border-t bg-gray-50">
                  <p className="text-xs text-gray-600 text-center">
                    {filteredProducts.length} resultado{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
                    {showOnlyInStock && ' (com estoque)'}
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