import React, { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package2, Barcode, ImageIcon, Eye, Edit, Trash2, QrCode } from "lucide-react";
import { Product } from "@/types/api";

interface FallbackProductGridProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  onManagePhotos: (product: Product) => void;
  onShowQr: (product: Product) => void;
  isDeletePending?: boolean;
}

/**
 * Fallback grid component using traditional CSS Grid
 * Used when virtual scrolling is not needed or as a fallback
 */
export const FallbackProductGrid = memo<FallbackProductGridProps>(({ 
  products, 
  onEdit, 
  onDelete, 
  onViewDetails, 
  onManagePhotos, 
  onShowQr,
  isDeletePending 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <Card key={product.id} className="card-hover">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <Package2 className="h-5 w-5 mr-2" />
                <span className="truncate">{product.name}</span>
              </CardTitle>
              <Badge variant={product.isActive ? "default" : "secondary"}>
                {product.isActive ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">ID:</span>
                <span className="font-medium font-mono">{product.sku}</span>
              </div>
              
              {product.category && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Categoria:</span>
                  <span className="font-medium truncate ml-2">{product.category}</span>
                </div>
              )}
              
              {product.brand && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Marca:</span>
                  <span className="font-medium">{product.brand}</span>
                </div>
              )}
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Unidade:</span>
                <span className="font-medium">{product.unit}</span>
              </div>
              
              {product.weight && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Peso:</span>
                  <span className="font-medium">{product.weight}kg</span>
                </div>
              )}

              {product.barcode && (
                <div className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                  <div className="flex items-center">
                    <Barcode className="h-4 w-4 mr-2" />
                    <span className="text-gray-600">Código:</span>
                  </div>
                  <span className="font-mono text-xs truncate ml-2">{product.barcode}</span>
                </div>
              )}

              <div className="flex items-center space-x-3 mt-3">
                {product.requiresLot && (
                  <Badge variant="outline" className="text-xs">
                    Lote
                  </Badge>
                )}
                {product.requiresExpiry && (
                  <Badge variant="outline" className="text-xs">
                    Validade
                  </Badge>
                )}
              </div>

              {product.description && (
                <div className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                  <p className="line-clamp-2">{product.description}</p>
                </div>
              )}

              {/* Stock Information */}
              <div className="mt-4">
                <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                  <span className="text-sm font-medium text-blue-800">Estoque Total:</span>
                  <span className="text-lg font-bold text-blue-900">
                    {product.totalStock || 0} {product.unit}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onShowQr(product)}
                title="Mostrar QR"
              >
                <QrCode className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onViewDetails(product)}
                title="Ver detalhes"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onManagePhotos(product)}
                title="Gerenciar fotos"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(product)}
                title="Editar produto"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(product)}
                disabled={isDeletePending}
                title="Desativar produto"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {products.length === 0 && (
        <div className="col-span-full text-center py-12">
          <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhum produto encontrado
          </h3>
          <p className="text-gray-600">
            Comece criando um novo produto
          </p>
        </div>
      )}
    </div>
  );
});

FallbackProductGrid.displayName = "FallbackProductGrid";