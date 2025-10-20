import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Product, type InsertProduct } from "@/types/api";
import { insertProductSchema } from "@/types/schemas";
import { 
  Plus, 
  Package2, 
  RefreshCw
} from "lucide-react";
import { useOptimizedProducts } from "@/hooks/useOptimizedProducts";
import { TouchOptimizedButton } from "@/components/mobile/TouchOptimizedControls";

// Mobile-optimized components
import MobileFallbackProductGrid from "@/components/mobile/MobileFallbackProductGrid";
import MobileVirtualizedProductGrid from "@/components/mobile/MobileVirtualizedProductGrid";
import { MobileProductSkeleton, InlineLoadingSkeleton } from "@/components/mobile/MobileProductSkeleton";
import MobileProductSearch, { type MobileSearchFilters } from "@/components/mobile/MobileProductSearch";
import QrCodeDisplayModal from "@/components/mobile/QrCodeDisplayModal"; // New import

// Lazy load heavy components for better performance
const ProductPhotoManager = lazy(() => import("@/components/product-photo-manager"));
const ProductDetailsModal = lazy(() => import("@/components/product-details-modal"));

// Mobile-optimized product form component
const MobileProductForm = lazy(() => import("@/components/mobile/MobileProductForm"));

export default function MobileProducts() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [photoProduct, setPhotoProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [qrCodeProduct, setQrCodeProduct] = useState<Product | null>(null); // New state
  const { toast } = useToast();

  // Mobile search filters state
  const [searchFilters, setSearchFilters] = useState<MobileSearchFilters>({
    category: "",
    brand: "",
    activeOnly: false,
    inStockOnly: false,
  });

  // Use optimized products hook with mobile-specific settings
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
    enableServerSearch: false, // Keep client-side for mobile responsiveness
    searchDebounceMs: 300,
    prefetchCount: 30 // Smaller prefetch for mobile
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

  // Apply mobile search filters to products
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    return products.filter((product) => {
      const matchesCategory = !searchFilters.category || product.category?.includes(searchFilters.category);
      const matchesBrand = !searchFilters.brand || product.brand?.toLowerCase().includes(searchFilters.brand.toLowerCase());
      const matchesActive = !searchFilters.activeOnly || product.isActive;
      const currentStock = (product as any).currentStock || 0;
      const matchesStock = !searchFilters.inStockOnly || currentStock > 0;
      const matchesMinStock = !searchFilters.minStock || currentStock >= searchFilters.minStock;
      const matchesMaxStock = !searchFilters.maxStock || currentStock <= searchFilters.maxStock;
      
      return matchesCategory && matchesBrand && matchesActive && matchesStock && matchesMinStock && matchesMaxStock;
    });
  }, [products, searchFilters]);

  const onSubmit = (data: InsertProduct) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = useCallback((product: Product) => {
    setEditingProduct(product);
    
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
      minStock: 0,
      maxStock: undefined,
      isActive: true,
    });
    setIsCreateOpen(true);
  }, [form]);

  const handleDelete = useCallback((product: Product) => {
    if (confirm(`Tem certeza que deseja desativar o produto ${product.name}?`)) {
      deleteMutation.mutate(product.id);
    }
  }, [deleteMutation]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['/api/products'] });
  }, [refetch]);

  // Generate next SKU
  const generateNextSku = async () => {
    if (!editingProduct) {
      try {
        const response = await fetch('/api/products/next-sku');
        if (response.ok) {
          const data = await response.json();
          form.setValue('sku', data.sku);
        }
      } catch (error) {
        console.error('Erro ao gerar próximo SKU:', error);
      }
    }
  };

  // Get unique categories and brands for mobile filters
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    products?.forEach(product => {
      if (product.category) {
        const mainCategory = product.category.split(' > ')[0];
        categories.add(mainCategory);
      }
    });
    return Array.from(categories).sort();
  }, [products]);

  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    products?.forEach(product => {
      if (product.brand) {
        brands.add(product.brand);
      }
    });
    return Array.from(brands).sort();
  }, [products]);

  // Handle barcode scanning
  const handleScanBarcode = useCallback(() => {
    // Implement barcode scanning logic here
    // This could open a camera/scanner modal
    console.log("Barcode scanning not implemented yet");
  }, []);

  const handleGenerateQrCode = useCallback((product: Product) => {
    console.log("QR Code button clicked for product:", product);
    setQrCodeProduct(product);
  }, []);

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque</h1>
          <p className="text-sm text-gray-600">
            {filteredProducts.length} produtos encontrados
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <TouchOptimizedButton
              size="sm"
              onClick={() => {
                setEditingProduct(null);
                form.reset();
                generateNextSku();
              }}
            >
              <Plus className="h-4 w-4" />
            </TouchOptimizedButton>
          </DialogTrigger>
          <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
            </DialogHeader>
            <Suspense fallback={<InlineLoadingSkeleton text="Carregando formulário..." />}>
              <MobileProductForm
                form={form}
                onSubmit={onSubmit}
                isLoading={createMutation.isPending || updateMutation.isPending}
                editingProduct={editingProduct}
              />
            </Suspense>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mobile Search */}
      <MobileProductSearch
        searchTerm={searchTerm}
        onSearchChange={updateSearch}
        filters={searchFilters}
        onFiltersChange={setSearchFilters}
        availableCategories={availableCategories}
        availableBrands={availableBrands}
        isSearching={isSearching}
        onScanBarcode={handleScanBarcode}
        resultsCount={filteredProducts.length}
      />

      {/* Pull to refresh indicator */}
      {isFetching && (
        <div className="px-4">
          <div className="flex items-center justify-center py-2">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm text-gray-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* Products Grid */}
      {isLoading ? (
        <MobileProductSkeleton count={6} />
      ) : filteredProducts.length > 0 ? (
        // Use virtualized grid for large datasets, fallback for smaller ones
        filteredProducts.length > 50 ? (
          <MobileVirtualizedProductGrid
            products={filteredProducts}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onViewDetails={(product) => setDetailProduct(product)}
            onManagePhotos={(product) => setPhotoProduct(product)}
            onGenerateQrCode={handleGenerateQrCode} // Pass new prop
            isDeletePending={deleteMutation.isPending}
          />
        ) : (
          <MobileFallbackProductGrid
            products={filteredProducts}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onViewDetails={(product) => setDetailProduct(product)}
            onManagePhotos={(product) => setPhotoProduct(product)}
            onGenerateQrCode={handleGenerateQrCode} // Pass new prop
            isDeletePending={deleteMutation.isPending}
          />
        )
      ) : (
        <div className="text-center py-12 px-4">
          <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhum produto encontrado
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm ? "Tente ajustar os filtros de busca" : "Comece criando um novo produto"}
          </p>
          <TouchOptimizedButton
            onClick={() => {
              setEditingProduct(null);
              form.reset();
              generateNextSku();
              setIsCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar Produto
          </TouchOptimizedButton>
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

      {/* QR Code Display Modal */}
      {qrCodeProduct && (
        <QrCodeDisplayModal
          isOpen={!!qrCodeProduct}
          onClose={() => setQrCodeProduct(null)}
          value={qrCodeProduct.sku} // Assuming SKU is what we want in the QR code
          title={`QR Code: ${qrCodeProduct.name}`}
          description={`Escaneie para ver detalhes de ${qrCodeProduct.sku}`}
        />
      )}
    </div>
  );
}
