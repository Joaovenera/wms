import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { Progress } from "./ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { 
  Package, 
  Scale, 
  Ruler, 
  BarChart3, 
  Eye, 
  EyeOff,
  Grid3X3,
  Layers,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Info
} from "lucide-react";
import { PackagingComposition } from "../types/api";

interface CompositionVisualizationProps {
  composition: PackagingComposition;
  className?: string;
}

export function CompositionVisualization({ 
  composition, 
  className 
}: CompositionVisualizationProps) {
  const [selectedView, setSelectedView] = useState<'3d' | '2d' | 'metrics'>('3d');
  const [showLabels, setShowLabels] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState<number>(0);

  const { result, products } = composition;

  const getStatusColor = (isValid: boolean) => {
    return isValid ? "text-green-600" : "text-red-600";
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 0.8) return "text-green-600";
    if (efficiency >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization > 1) return "text-red-600";
    if (utilization > 0.9) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {composition.name}
            {result.isValid ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            )}
          </h3>
          <p className="text-sm text-muted-foreground">
            {products.length} produtos • Eficiência {(result.efficiency * 100).toFixed(1)}%
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={result.isValid ? "default" : "destructive"}>
            {result.isValid ? "Válida" : "Inválida"}
          </Badge>
          <Badge variant="outline">
            ID: {composition.id}
          </Badge>
        </div>
      </div>

      <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="3d">
            <Grid3X3 className="h-4 w-4 mr-2" />
            Layout 3D
          </TabsTrigger>
          <TabsTrigger value="2d">
            <Layers className="h-4 w-4 mr-2" />
            Camadas 2D
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Métricas
          </TabsTrigger>
        </TabsList>

        {/* 3D Layout View */}
        <TabsContent value="3d" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Layout Tridimensional</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLabels(!showLabels)}
                  >
                    {showLabels ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-1" />
                        Ocultar Labels
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-1" />
                        Mostrar Labels
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative bg-gray-50 rounded-lg p-4 min-h-96">
                {/* 3D Visualization Placeholder */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Grid3X3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Visualização 3D</p>
                    <p className="text-sm">
                      Layout com {result.layout.layers} camadas, {result.layout.totalItems} itens
                    </p>
                  </div>
                </div>
                
                {/* Layout Statistics Overlay */}
                <div className="absolute top-2 left-2 bg-white rounded-lg p-3 shadow-md">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      <span>{result.layout.layers} camadas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span>{result.layout.totalItems} itens</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Grid3X3 className="h-4 w-4" />
                      <span>{result.layout.itemsPerLayer} itens/camada</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2D Layer View */}
        <TabsContent value="2d" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Visualização por Camadas</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Camada:</span>
                  <select
                    value={selectedLayer}
                    onChange={(e) => setSelectedLayer(parseInt(e.target.value))}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    {Array.from({ length: result.layout.layers }, (_, i) => (
                      <option key={i} value={i}>
                        {i + 1} de {result.layout.layers}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4 min-h-80">
                <div className="grid grid-cols-4 gap-2 h-full">
                  {result.layout.arrangement
                    .filter(item => Math.floor(item.position.z / 50) === selectedLayer) // Assuming 50cm per layer
                    .map((item, idx) => {
                      const product = products.find(p => p.productId === item.productId);
                      return (
                        <div
                          key={idx}
                          className="border-2 border-blue-200 bg-blue-100 rounded p-2 text-xs text-center"
                          title={`Produto ${item.productId} - Quantidade: ${item.quantity}`}
                        >
                          <div className="font-medium">P{item.productId}</div>
                          <div className="text-gray-600">Qty: {item.quantity}</div>
                          {item.dimensions && 
                           item.dimensions.width > 0 && 
                           item.dimensions.length > 0 && (
                            <div className="text-gray-500">
                              {item.dimensions.width}×{item.dimensions.length}cm
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
                
                {result.layout.arrangement.filter(item => 
                  Math.floor(item.position.z / 50) === selectedLayer
                ).length === 0 && (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum item nesta camada</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics View */}
        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Weight Metrics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Peso
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Utilização</span>
                      <span className={getUtilizationColor(result.weight.utilization)}>
                        {(result.weight.utilization * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={result.weight.utilization * 100} className="h-2" />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Total: {result.weight.total.toFixed(1)} kg</div>
                    <div>Limite: {result.weight.limit.toFixed(1)} kg</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Volume Metrics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Utilização</span>
                      <span className={getUtilizationColor(result.volume.utilization)}>
                        {(result.volume.utilization * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={result.volume.utilization * 100} className="h-2" />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Total: {result.volume.total.toFixed(3)} m³</div>
                    <div>Limite: {result.volume.limit.toFixed(3)} m³</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Height Metrics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  Altura
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Utilização</span>
                      <span className={getUtilizationColor(result.height.utilization)}>
                        {(result.height.utilization * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={result.height.utilization * 100} className="h-2" />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Total: {result.height.total.toFixed(1)} cm</div>
                    <div>Limite: {result.height.limit.toFixed(1)} cm</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overall Efficiency */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Eficiência Geral
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getEfficiencyColor(result.efficiency)}`}>
                    {(result.efficiency * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {result.efficiency >= 0.8 ? "Excelente" :
                     result.efficiency >= 0.6 ? "Bom" :
                     result.efficiency >= 0.4 ? "Regular" : "Baixo"}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product Details */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Detalhes dos Produtos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {result.products.map((productResult, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Produto {productResult.productId}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          Qty: {productResult.quantity}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span>{productResult.totalWeight.toFixed(1)}kg</span>
                        <span>•</span>
                        <span>{productResult.totalVolume.toFixed(3)}m³</span>
                        <span>•</span>
                        <span className={getEfficiencyColor(productResult.efficiency)}>
                          {(productResult.efficiency * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations and Warnings */}
          {(result.recommendations.length > 0 || result.warnings.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Recomendações e Avisos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.recommendations.map((recommendation, index) => (
                    <Alert key={index} className="border-blue-200 bg-blue-50">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        <strong>Recomendação:</strong> {recommendation}
                      </AlertDescription>
                    </Alert>
                  ))}
                  
                  {result.warnings.map((warning, index) => (
                    <Alert key={index} className="border-yellow-200 bg-yellow-50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800">
                        <strong>Aviso:</strong> {warning}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}