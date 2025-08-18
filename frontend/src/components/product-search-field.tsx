import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Package2, X, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

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

interface ProductSearchFieldProps {
  onProductSelect: (product: Product | null) => void;
  selectedProduct?: Product | null;
  placeholder?: string;
}

export function ProductSearchField({ 
  onProductSelect, 
  selectedProduct,
  placeholder = "Pesquisar produto por ID, SKU ou nome..."
}: ProductSearchFieldProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ['/api/products'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/products');
      return await res.json();
    }
  });

  // Filter products based on search term
  useEffect(() => {
    if (!products || !Array.isArray(products)) {
      setFilteredProducts([]);
      return;
    }

    if (!searchTerm.trim()) {
      setFilteredProducts(products.slice(0, 10)); // Show first 10 by default
      return;
    }

    const filtered = products.filter((product: Product) => {
      const term = searchTerm.toLowerCase().trim();
      
      // Search by ID (convert to string for comparison)
      const idMatch = product.id.toString().includes(term);
      
      // Search by SKU
      const skuMatch = product.sku.toLowerCase().includes(term);
      
      // Search by name
      const nameMatch = product.name.toLowerCase().includes(term);
      
      return idMatch || skuMatch || nameMatch;
    });

    setFilteredProducts(filtered.slice(0, 20)); // Limit to 20 results
  }, [products, searchTerm]);

  const handleProductSelect = (product: Product) => {
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

  return (
    <div className="space-y-2 relative">
      <Label>Produto</Label>
      
      {/* Display selected product */}
      {selectedProduct && !isOpen ? (
        <div className="border rounded-md p-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">{selectedProduct.name}</span>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  ID: {selectedProduct.id}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  SKU: {selectedProduct.sku}
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
            Pesquise por ID do sistema, SKU ou nome do produto
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
                {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
              </p>
              {searchTerm && (
                <p className="text-xs text-gray-400 mt-1">
                  Tente pesquisar por ID, SKU ou nome
                </p>
              )}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {filteredProducts.map((product: Product) => (
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
                      </div>
                      {product.dimensions && 
                       product.dimensions.length > 0 && 
                       product.dimensions.width > 0 && 
                       product.dimensions.height > 0 && (
                        <p className="text-xs text-gray-600 mt-1">
                          {product.dimensions.length}×{product.dimensions.width}×{product.dimensions.height}cm
                        </p>
                      )}
                    </div>
                    <Package2 className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              ))}
              
              {searchTerm && (
                <div className="p-2 border-t bg-gray-50">
                  <p className="text-xs text-gray-600 text-center">
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