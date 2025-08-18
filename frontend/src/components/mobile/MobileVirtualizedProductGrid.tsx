import React, { memo, useMemo, useCallback, useState, useEffect, useRef } from "react";
import { FixedSizeList as List } from "react-window";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TouchOptimizedButton, SwipeableCard } from "@/components/mobile/TouchOptimizedControls";
import { Product } from "@/types/api";
import { 
  Edit, 
  Trash2, 
  Camera, 
  Eye,
  Package2,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";

interface MobileVirtualizedProductGridProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  onManagePhotos: (product: Product) => void;
  isDeletePending: boolean;
}

// Mobile-optimized stock status
const getStockStatus = (currentStock: number, minStock: number) => {
  if (currentStock === 0) {
    return {
      label: "Sem Estoque",
      icon: AlertTriangle,
      color: "bg-red-100 text-red-800 border-red-200",
      iconColor: "text-red-600",
    };
  }
  if (currentStock <= minStock) {
    return {
      label: "Estoque Baixo", 
      icon: AlertTriangle,
      color: "bg-yellow-100 text-yellow-800 border-yellow-200",
      iconColor: "text-yellow-600",
    };
  }
  return {
    label: "Em Estoque",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800 border-green-200",
    iconColor: "text-green-600",
  };
};

// Individual product row component
const ProductRow = memo<{
  index: number;
  style: React.CSSProperties;
  data: {
    products: Product[];
    onEdit: (product: Product) => void;
    onDelete: (product: Product) => void;
    onViewDetails: (product: Product) => void;
    onManagePhotos: (product: Product) => void;
  };
}>(({ index, style, data }) => {
  const { products, onEdit, onDelete, onViewDetails, onManagePhotos } = data;
  const product = products[index];
  
  if (!product) return null;

  const currentStock = (product as any).currentStock || 0;
  const stockStatus = getStockStatus(currentStock, product.minStock || 0);
  const StockIcon = stockStatus.icon;

  return (
    <div style={style}>
      <div className="px-4 pb-3">
        <SwipeableCard
          leftAction={{
            icon: <Trash2 className="h-5 w-5" />,
            label: "Excluir",
            color: "red"
          }}
          rightAction={{
            icon: <Edit className="h-5 w-5" />,
            label: "Editar", 
            color: "blue"
          }}
          onSwipeLeft={() => onDelete(product)}
          onSwipeRight={() => onEdit(product)}
        >
          <Card className="hover:shadow-md transition-shadow touch-manipulation">
            <CardContent className="p-4">
              {/* Header with product name and stock status */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg leading-tight truncate">
                    {product.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    SKU: {product.sku}
                  </p>
                  {product.category && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {product.category}
                    </p>
                  )}
                </div>
                <Badge className={`${stockStatus.color} border text-xs px-2 py-1 ml-2 shrink-0`}>
                  <StockIcon className={`h-3 w-3 mr-1 ${stockStatus.iconColor}`} />
                  {stockStatus.label}
                </Badge>
              </div>

              {/* Product details grid */}
              <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                <div>
                  <span className="text-gray-500 text-xs">Estoque:</span>
                  <p className="font-medium">
                    {currentStock} {product.unit}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Marca:</span>
                  <p className="font-medium truncate">
                    {product.brand || "N/A"}
                  </p>
                </div>
                {product.weight && (
                  <div>
                    <span className="text-gray-500 text-xs">Peso:</span>
                    <p className="font-medium">
                      {product.weight}kg
                    </p>
                  </div>
                )}
                {product.minStock && (
                  <div>
                    <span className="text-gray-500 text-xs">Mín. Estoque:</span>
                    <p className="font-medium">
                      {product.minStock}
                    </p>
                  </div>
                )}
              </div>

              {/* Barcode display */}
              {product.barcode && (
                <div className="mb-3">
                  <span className="text-xs text-gray-500">Código de Barras:</span>
                  <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1 truncate">
                    {product.barcode}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-end space-x-2 pt-2">
                <TouchOptimizedButton
                  size="sm"
                  variant="outline"
                  onClick={() => onViewDetails(product)}
                  hapticFeedback={true}
                >
                  <Eye className="h-4 w-4" />
                </TouchOptimizedButton>
                <TouchOptimizedButton
                  size="sm"
                  variant="outline"
                  onClick={() => onManagePhotos(product)}
                  hapticFeedback={true}
                >
                  <Camera className="h-4 w-4" />
                </TouchOptimizedButton>
                <TouchOptimizedButton
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(product)}
                  hapticFeedback={true}
                >
                  <Edit className="h-4 w-4" />
                </TouchOptimizedButton>
              </div>
            </CardContent>
          </Card>
        </SwipeableCard>
      </div>
    </div>
  );
});

ProductRow.displayName = "ProductRow";

export const MobileVirtualizedProductGrid = memo<MobileVirtualizedProductGridProps>(({
  products, 
  onEdit, 
  onDelete, 
  onViewDetails, 
  onManagePhotos, 
  isDeletePending
}) => {
  const isMobile = useMobile();
  const [containerHeight, setContainerHeight] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate optimal item height for mobile
  const itemHeight = useMemo(() => {
    // Base height for product card + spacing
    return 220; // Approximately 200px card + 20px spacing
  }, []);

  // Calculate container height based on viewport
  useEffect(() => {
    const calculateHeight = () => {
      if (typeof window !== 'undefined') {
        // Use available viewport height minus header, navigation, etc.
        const viewportHeight = window.innerHeight;
        const headerHeight = 120; // Approximate header + search height
        const bottomNavHeight = 80; // Mobile bottom navigation
        const availableHeight = viewportHeight - headerHeight - bottomNavHeight;
        setContainerHeight(Math.max(400, availableHeight));
      }
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    window.addEventListener('orientationchange', calculateHeight);

    return () => {
      window.removeEventListener('resize', calculateHeight);
      window.removeEventListener('orientationchange', calculateHeight);
    };
  }, []);

  // Memoize item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    products,
    onEdit,
    onDelete,
    onViewDetails,
    onManagePhotos,
  }), [products, onEdit, onDelete, onViewDetails, onManagePhotos]);

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Nenhum produto encontrado
        </h3>
        <p className="text-gray-600">
          Tente ajustar os filtros de busca
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full"
      style={{ height: containerHeight }}
    >
      <List
        height={containerHeight}
        itemCount={products.length}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={5} // Render 5 extra items for smoother scrolling
        width="100%"
      >
        {ProductRow}
      </List>
    </div>
  );
});

MobileVirtualizedProductGrid.displayName = "MobileVirtualizedProductGrid";

export default MobileVirtualizedProductGrid;