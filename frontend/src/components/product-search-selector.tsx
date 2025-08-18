import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Package2, X } from "lucide-react";
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

interface ProductSearchSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductSelect: (product: Product) => void;
  selectedProductId?: number;
}

export function ProductSearchSelector({ 
  open, 
  onOpenChange, 
  onProductSelect, 
  selectedProductId 
}: ProductSearchSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ['/api/products'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/products');
      return await res.json();
    },
    enabled: open
  });

  // Filter products based on search term
  useEffect(() => {
    if (!products || !Array.isArray(products)) {
      setFilteredProducts([]);
      return;
    }

    if (!searchTerm.trim()) {
      setFilteredProducts(products);
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

    setFilteredProducts(filtered);
  }, [products, searchTerm]);

  const handleProductSelect = (product: Product) => {
    onProductSelect(product);
    onOpenChange(false);
    setSearchTerm("");
  };

  const handleClose = () => {
    onOpenChange(false);
    setSearchTerm("");
  };

  const selectedProduct = products?.find((p: Product) => p.id === selectedProductId);

  return (
    <>
      {/* Trigger Button */}
      <div className="space-y-2">
        <Label>Produto</Label>
        <Button
          variant="outline"
          onClick={() => onOpenChange(true)}
          className="w-full justify-start text-left font-normal"
        >
          {selectedProduct ? (
            <div className="flex items-center justify-between w-full">
              <div>
                <span className="font-medium">{selectedProduct.name}</span>
                <span className="text-sm text-gray-500 ml-2">ID: {selectedProduct.id} • SKU: {selectedProduct.sku}</span>
              </div>
              <Package2 className="h-4 w-4" />
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-gray-500">Selecione um produto...</span>
              <Search className="h-4 w-4" />
            </div>
          )}
        </Button>
      </div>

      {/* Search Dialog */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Selecionar Produto
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search Input */}
            <div className="space-y-2">
              <Label>Pesquisar por ID, SKU ou Nome</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Digite o ID, SKU ou nome do produto..."
                  className="pl-10"
                  autoFocus
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Você pode pesquisar por ID do sistema (ex: 1, 2, 3), SKU ou nome do produto
              </p>
            </div>

            {/* Results */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="text-sm text-gray-500">Carregando produtos...</div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8">
                  <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
                  </p>
                  {searchTerm && (
                    <p className="text-sm text-gray-400 mt-2">
                      Tente pesquisar por ID, SKU ou nome do produto
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map((product: Product) => (
                    <Card 
                      key={product.id} 
                      className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                        selectedProductId === product.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => handleProductSelect(product)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-lg">{product.name}</h4>
                            <div className="flex items-center gap-4 mt-1">
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
                              <p className="text-sm text-gray-600 mt-2">
                                Dimensões: {product.dimensions.length}cm × {product.dimensions.width}cm × {product.dimensions.height}cm
                              </p>
                            )}
                          </div>
                          <Package2 className="h-6 w-6 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Results Count */}
            {!isLoading && (
              <div className="border-t pt-3">
                <p className="text-sm text-gray-600">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
                  {searchTerm && ` para "${searchTerm}"`}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}