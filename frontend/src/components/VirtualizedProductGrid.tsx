import React, { memo, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package2, Barcode, ImageIcon, Eye, Edit, Trash2 } from "lucide-react";
import { Product } from "@/types/api";

interface VirtualizedProductGridProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  onManagePhotos: (product: Product) => void;
  isDeletePending?: boolean;
}

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  onManagePhotos: (product: Product) => void;
  isDeletePending?: boolean;
}

const ProductCard = memo<ProductCardProps>(({ 
  product, 
  onEdit, 
  onDelete, 
  onViewDetails, 
  onManagePhotos, 
  isDeletePending 
}) => (
  <Card className="card-hover h-full">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center">
          <Package2 className="h-5 w-5 mr-2" />
          {product.name}
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
            <span className="font-medium">{product.category}</span>
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
            <span className="font-mono text-xs">{product.barcode}</span>
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
            {product.description}
          </div>
        )}

        {/* Stock Information - Only Total */}
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
));

ProductCard.displayName = "ProductCard";

export const VirtualizedProductGrid = memo<VirtualizedProductGridProps>(({ 
  products, 
  onEdit, 
  onDelete, 
  onViewDetails, 
  onManagePhotos, 
  isDeletePending 
}) => {
  // Fixed card dimensions and spacing
  const CARD_WIDTH = 380;
  const CARD_HEIGHT = 350;
  const GAP = 24;
  const CONTAINER_PADDING = 48; // 3rem total padding
  
  // Calculate responsive columns
  const getColumnsCount = () => {
    if (typeof window === 'undefined') return 3;
    const availableWidth = window.innerWidth - CONTAINER_PADDING;
    const minColumns = 1;
    const maxColumns = 4;
    const calculatedColumns = Math.floor(availableWidth / (CARD_WIDTH + GAP));
    return Math.max(minColumns, Math.min(maxColumns, calculatedColumns));
  };
  
  const [columnsCount, setColumnsCount] = React.useState(getColumnsCount);
  const rowCount = Math.ceil(products.length / columnsCount);

  // Handle window resize
  React.useEffect(() => {
    const handleResize = () => {
      setColumnsCount(getColumnsCount());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const Row = memo<{ index: number; style: React.CSSProperties }>(({ index, style }) => {
    const startIndex = index * columnsCount;
    const items = [];
    
    for (let i = 0; i < columnsCount; i++) {
      const productIndex = startIndex + i;
      const product = products[productIndex];
      
      if (product) {
        items.push(
          <div 
            key={product.id} 
            style={{ 
              width: CARD_WIDTH,
              minWidth: CARD_WIDTH,
              marginRight: i < columnsCount - 1 ? GAP : 0,
              flexShrink: 0
            }}
          >
            <ProductCard
              product={product}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewDetails={onViewDetails}
              onManagePhotos={onManagePhotos}
              isDeletePending={isDeletePending}
            />
          </div>
        );
      } else {
        // Add empty placeholder to maintain grid structure
        items.push(
          <div 
            key={`empty-${i}`} 
            style={{ 
              width: CARD_WIDTH,
              minWidth: CARD_WIDTH,
              marginRight: i < columnsCount - 1 ? GAP : 0,
              flexShrink: 0,
              visibility: 'hidden'
            }}
          />
        );
      }
    }
    
    return (
      <div 
        style={{ 
          ...style, 
          display: 'flex', 
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          paddingLeft: GAP / 2,
          paddingRight: GAP / 2,
          boxSizing: 'border-box'
        }}
      >
        {items}
      </div>
    );
  });

  Row.displayName = "VirtualizedRow";

  const memoizedList = useMemo(() => (
    <div className="w-full">
      <List
        height={600}
        itemCount={rowCount}
        itemSize={CARD_HEIGHT + GAP}
        width="100%"
        style={{
          overflowX: 'hidden',
          overflowY: 'auto'
        }}
      >
        {Row}
      </List>
    </div>
  ), [rowCount, Row, columnsCount]);

  if (products.length === 0) {
    return (
      <div className="w-full text-center py-12">
        <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Nenhum produto encontrado
        </h3>
        <p className="text-gray-600">
          Comece criando um novo produto
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {memoizedList}
    </div>
  );
});

VirtualizedProductGrid.displayName = "VirtualizedProductGrid";