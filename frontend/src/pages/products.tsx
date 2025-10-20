import { useState, lazy, Suspense } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Product, type InsertProduct } from "@/types/api";
import { insertProductSchema } from "@/types/schemas";
import { Plus, Search, Edit, Trash2, Package2, QrCode } from "lucide-react";
import { VirtualizedProductGrid } from "@/components/VirtualizedProductGrid";
import { FallbackProductGrid } from "@/components/FallbackProductGrid";
import { ProductSkeleton, SearchLoadingSkeleton, InlineLoadingSkeleton } from "@/components/ProductSkeleton";
import { useOptimizedProducts } from "@/hooks/useOptimizedProducts";
import { OptimizedProductForm } from "@/components/OptimizedProductForm";
import QrCodeDisplayModal from "@/components/mobile/QrCodeDisplayModal";
import categoriesData from "@/data/categories.json";

// Lazy load heavy components for better performance
const ProductPhotoManager = lazy(() => import("@/components/product-photo-manager"));
const ProductDetailsModal = lazy(() => import("@/components/product-details-modal"));

// Categories data now loaded from external JSON file for better performance

export default function Products() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [photoProduct, setPhotoProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  // Use optimized products hook with server-side search and caching
  const {
    products,
    isLoading,
    isFetching,
    isSearching,
    searchTerm,
    updateSearch,
    updateFilters,
    performanceMetrics,
    refetch
  } = useOptimizedProducts({
    enableServerSearch: false, // Start with client-side, can enable server-side later
    searchDebounceMs: 300,
    prefetchCount: 50
  });

  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema.omit({ createdBy: true })),
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      category: "",
      brand: "",
      ncm: "",
      unit: "un",
      unitsPerPackage: "1",
      weight: undefined,
      dimensions: { length: 0, width: 0, height: 0 },
      barcode: "",
      requiresLot: false,
      requiresExpiry: false,
      minStock: 0,
      maxStock: undefined,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      await apiRequest('POST', '/api/products', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Sucesso",
        description: "Produto criado com sucesso",
      });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertProduct> }) => {
      await apiRequest('PUT', `/api/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Sucesso",
        description: "Produto atualizado com sucesso",
      });
      setEditingProduct(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Sucesso",
        description: "Produto desativado com sucesso",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Products are now filtered by the optimized hook
  const filteredProducts = products || [];

  const onSubmit = (data: InsertProduct) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    
    // Extrair categoria e subcategoria do campo category
    const categoryParts = product.category?.split(" > ") || [];
    const mainCategory = categoryParts[0] || "";
    const subCategory = categoryParts.slice(1).join(" > ") || "";
    
    setSelectedCategory(mainCategory);
    setSelectedSubCategory(subCategory);
    
    form.reset({
      sku: product.sku,
      name: product.name,
      description: product.description || "",
      category: product.category || "",
      brand: product.brand || "",
      ncm: (product as any).ncm || "",
      unit: product.unit,
      unitsPerPackage: product.unitsPerPackage || "1",
      weight: product.weight || undefined,
      dimensions: product.dimensions || { length: 0, width: 0, height: 0 },
      barcode: product.barcode || "",
      requiresLot: product.requiresLot || false,
      requiresExpiry: product.requiresExpiry || false,
      minStock: product.minStock || 0,
      maxStock: product.maxStock || undefined,
      isActive: product.isActive ?? true,
    });
    setIsCreateOpen(true);
  };

  const handleDelete = (product: Product) => {
    if (confirm(`Tem certeza que deseja desativar o produto ${product.name}?`)) {
      deleteMutation.mutate(product.id);
    }
  };

  // Função para obter subcategorias da categoria selecionada
  const getSubCategories = (categoryName: string) => {
    const category = categoriesData.find(cat => cat.name === categoryName);
    return category?.subcategories || [];
  };

  // Função para obter sub-subcategorias
  const getSubSubCategories = (categoryName: string, subCategoryName: string) => {
    const category = categoriesData.find(cat => cat.name === categoryName);
    const subCategory = category?.subcategories?.find(sub => sub.name === subCategoryName);
    return subCategory?.subcategories || [];
  };

  // Função para atualizar categoria e subcategoria no formulário
  const updateCategoryField = (category: string, subCategory: string) => {
    const fullCategory = subCategory ? `${category} > ${subCategory}` : category;
    form.setValue("category", fullCategory);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Produtos</h1>
          <p className="text-gray-600">Gerenciamento de produtos/SKUs</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setEditingProduct(null);
                form.reset();
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <OptimizedProductForm
                  form={form}
                  selectedCategory={selectedCategory}
                  selectedSubCategory={selectedSubCategory}
                  onCategoryChange={setSelectedCategory}
                  onSubCategoryChange={setSelectedSubCategory}
                />

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingProduct ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(e) => updateSearch(e.target.value)}
            className="pl-10"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>
        
        {/* Performance metrics in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-500 ml-4">
            Cache: {performanceMetrics.hitRate}% | Queries: {performanceMetrics.cachedQueries}/{performanceMetrics.totalQueries}
          </div>
        )}
      </div>

      {/* Products Grid */}
      {isSearching && <SearchLoadingSkeleton />}
      
      {isLoading ? (
        <ProductSkeleton count={6} />
      ) : filteredProducts.length > 0 ? (
        // Use fallback grid for better layout control
        filteredProducts.length > 100 ? (
          <VirtualizedProductGrid
            products={filteredProducts}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onViewDetails={(product) => setDetailProduct(product)}
            onManagePhotos={(product) => setPhotoProduct(product)}
            onShowQr={(product) => setQrProduct(product)}
            isDeletePending={deleteMutation.isPending}
          />
        ) : (
          <FallbackProductGrid
            products={filteredProducts}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onViewDetails={(product) => setDetailProduct(product)}
            onManagePhotos={(product) => setPhotoProduct(product)}
            onShowQr={(product) => setQrProduct(product)}
            isDeletePending={deleteMutation.isPending}
          />
        )
      ) : (
        <div className="text-center py-12">
          <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhum produto encontrado
          </h3>
          <p className="text-gray-600">
            {searchTerm ? "Tente ajustar os filtros de busca" : "Comece criando um novo produto"}
          </p>
        </div>
      )}

      {/* Lazy-loaded Photo Manager Dialog */}
      {photoProduct && (
        <Suspense fallback={<InlineLoadingSkeleton text="Carregando gerenciador de fotos..." />}>
          <ProductPhotoManager
            isOpen={!!photoProduct}
            onClose={() => setPhotoProduct(null)}
            productId={photoProduct.id}
            productName={photoProduct.name}
          />
        </Suspense>
      )}

      {/* Lazy-loaded Product Details Modal */}
      {detailProduct && (
        <Suspense fallback={<InlineLoadingSkeleton text="Carregando detalhes do produto..." />}>
          <ProductDetailsModal
            isOpen={!!detailProduct}
            onClose={() => setDetailProduct(null)}
            productId={detailProduct.id}
            productName={detailProduct.name}
          />
        </Suspense>
      )}

      {qrProduct && (
        <QrCodeDisplayModal
          isOpen={!!qrProduct}
          onClose={() => setQrProduct(null)}
          value={JSON.stringify({ type: "PRODUCT", code: qrProduct.sku })}
          title={`QR Code - ${qrProduct.name}`}
          description={`Escaneie para localizar o SKU ${qrProduct.sku}`}
        />
      )}
    </div>
  );
}
