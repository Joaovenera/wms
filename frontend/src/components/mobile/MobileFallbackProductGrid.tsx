import React, { memo } from "react";
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

import { QrCode } from "lucide-react";

interface MobileFallbackProductGridProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  onManagePhotos: (product: Product) => void;
  onGenerateQrCode: (product: Product) => void; // New prop
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

export const MobileFallbackProductGrid = memo<MobileFallbackProductGridProps>(({
  products, 
  onEdit, 
  onDelete, 
  onViewDetails, 
  onManagePhotos, 
  onGenerateQrCode, 
  isDeletePending
}) => {
  return (
    <div className="space-y-3 pb-4">
      {products.map((product) => {
        const currentStock = (product as any).currentStock || 0;
        const stockStatus = getStockStatus(currentStock, product.minStock || 0);
        const StockIcon = stockStatus.icon;

        return (
          <SwipeableCard
            key={product.id}
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

                {/* Dimensions display */}
                {product.dimensions && (
                  <div className="mb-3">
                    <span className="text-xs text-gray-500">Dimensões (cm):</span>
                    <p className="text-sm font-medium">
                      {product.dimensions.length} × {product.dimensions.width} × {product.dimensions.height}
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
                    onClick={() => onGenerateQrCode(product)}
                    hapticFeedback={true}
                  >
                    <QrCode className="h-4 w-4" />
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
        );
      })}

      {/* Empty state */}
      {products.length === 0 && (
        <div className="text-center py-12">
          <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhum produto encontrado
          </h3>
          <p className="text-gray-600">
            Tente ajustar os filtros de busca
          </p>
        </div>
      )}
    </div>
  );
});

MobileFallbackProductGrid.displayName = "MobileFallbackProductGrid";

export default MobileFallbackProductGrid;