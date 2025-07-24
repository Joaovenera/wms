import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { 
  Package, 
  BarChart3, 
  Target, 
  Layers, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";
import { useProductStockConsolidated } from "../hooks/usePackaging";
import { Product, ProductStockByPackaging } from "../types/api";

interface StockConsolidationViewProps {
  product: Product;
}

export function StockConsolidationView({ product }: StockConsolidationViewProps) {
  const { data, isLoading } = useProductStockConsolidated(product.id);
  const [selectedPackaging, setSelectedPackaging] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>Carregando estoque consolidado...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Nenhum dado de estoque disponível
          </div>
        </CardContent>
      </Card>
    );
  }

  const { packagings, stock, consolidated } = data;

  // Calcular métricas
  const activePackagingTypes = packagings.filter(p => p.isActive).length;
  const packagingsWithStock = stock.filter(s => s.totalBaseUnits > 0).length;
  
  // Encontrar embalagem com maior estoque
  const topPackaging = stock.reduce((max, current) => 
    current.totalBaseUnits > max.totalBaseUnits ? current : max, 
    stock[0] || {} as ProductStockByPackaging
  );

  // Calcular distribuição de estoque por nível
  const stockByLevel = stock.reduce((acc, s) => {
    const level = packagings.find(p => p.id === s.packagingId)?.level || 1;
    acc[level] = (acc[level] || 0) + Number(s.totalBaseUnits);
    return acc;
  }, {} as Record<number, number>);

  return (
    <div className="space-y-6">
      {/* Header com métricas principais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Estoque Consolidado - {product.name}
          </CardTitle>
          <CardDescription>
            Visão unificada do estoque em todas as configurações de embalagem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{consolidated.totalBaseUnits}</div>
              <div className="text-sm text-muted-foreground">Unidades Base Total</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{consolidated.locationsCount}</div>
              <div className="text-sm text-muted-foreground">Localizações</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{consolidated.itemsCount}</div>
              <div className="text-sm text-muted-foreground">Itens Distintos</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{packagingsWithStock}</div>
              <div className="text-sm text-muted-foreground">Embalagens com Estoque</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="by-packaging" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="by-packaging">Por Embalagem</TabsTrigger>
          <TabsTrigger value="by-level">Por Nível</TabsTrigger>
          <TabsTrigger value="analytics">Análise</TabsTrigger>
        </TabsList>

        {/* Estoque por Embalagem */}
        <TabsContent value="by-packaging" className="space-y-4">
          {stock.length > 0 ? (
            <div className="grid gap-4">
              {stock.map((stockItem) => {
                const packaging = packagings.find(p => p.id === stockItem.packagingId);
                if (!packaging) return null;

                const stockPercentage = consolidated.totalBaseUnits > 0 
                  ? (Number(stockItem.totalBaseUnits) / Number(consolidated.totalBaseUnits)) * 100 
                  : 0;

                return (
                  <Card 
                    key={stockItem.packagingId}
                    className={selectedPackaging === stockItem.packagingId ? "ring-2 ring-primary" : ""}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <Package className="h-5 w-5" />
                          <div>
                            <div className="font-medium">{stockItem.packagingName}</div>
                            <div className="text-sm text-muted-foreground">
                              {stockItem.baseUnitQuantity} unidades base por pacote
                            </div>
                          </div>
                          {packaging.isBaseUnit && (
                            <Badge variant="default">Base</Badge>
                          )}
                          <Badge variant="outline">Nível {stockItem.level}</Badge>
                          {stockItem.barcode && (
                            <Badge variant="secondary" className="text-xs">
                              {stockItem.barcode}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPackaging(
                            selectedPackaging === stockItem.packagingId ? null : stockItem.packagingId
                          )}
                        >
                          {selectedPackaging === stockItem.packagingId ? "Ocultar" : "Detalhes"}
                        </Button>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {stockItem.availablePackages}
                          </div>
                          <div className="text-xs text-muted-foreground">Pacotes Completos</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {stockItem.remainingBaseUnits}
                          </div>
                          <div className="text-xs text-muted-foreground">Unidades Restantes</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {stockItem.totalBaseUnits}
                          </div>
                          <div className="text-xs text-muted-foreground">Total Base</div>
                        </div>
                      </div>

                      {/* Barra de progresso do estoque */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Participação no estoque total</span>
                          <span>{stockPercentage.toFixed(1)}%</span>
                        </div>
                        <Progress value={stockPercentage} className="h-2" />
                      </div>

                      {/* Detalhes expandidos */}
                      {selectedPackaging === stockItem.packagingId && (
                        <div className="mt-4 pt-4 border-t space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Capacidade por pacote:</span>
                              <div className="font-medium">{stockItem.baseUnitQuantity} unidades</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Eficiência do estoque:</span>
                              <div className="font-medium">
                                {stockItem.remainingBaseUnits > 0 
                                  ? `${((Number(stockItem.totalBaseUnits) - stockItem.remainingBaseUnits) / Number(stockItem.totalBaseUnits) * 100).toFixed(1)}%`
                                  : "100%"
                                }
                              </div>
                            </div>
                          </div>
                          
                          {stockItem.remainingBaseUnits > 0 && (
                            <div className="flex items-center space-x-2 text-sm text-orange-600">
                              <AlertTriangle className="h-4 w-4" />
                              <span>
                                Há {stockItem.remainingBaseUnits} unidades que não formam um pacote completo
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Nenhum estoque encontrado para este produto
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Estoque por Nível */}
        <TabsContent value="by-level" className="space-y-4">
          <div className="grid gap-4">
            {Object.entries(stockByLevel).map(([level, totalUnits]) => {
              const levelNum = parseInt(level);
              const percentage = consolidated.totalBaseUnits > 0 
                ? (totalUnits / Number(consolidated.totalBaseUnits)) * 100 
                : 0;

              const packagingsInLevel = packagings.filter(p => p.level === levelNum);
              
              return (
                <Card key={level}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Layers className="h-5 w-5" />
                        <div>
                          <div className="font-medium">Nível {level}</div>
                          <div className="text-sm text-muted-foreground">
                            {packagingsInLevel.length} tipo(s) de embalagem
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{totalUnits}</div>
                        <div className="text-sm text-muted-foreground">unidades base</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Participação no estoque</span>
                        <span>{percentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>

                    <div className="mt-3 text-sm text-muted-foreground">
                      Embalagens: {packagingsInLevel.map(p => p.name).join(", ")}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Análise e Insights */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4">
            {/* Resumo Geral */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Resumo do Estoque</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  {consolidated.totalBaseUnits > 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                  )}
                  <span className="text-sm">
                    {consolidated.totalBaseUnits > 0 
                      ? `Produto em estoque com ${consolidated.totalBaseUnits} unidades disponíveis`
                      : "Produto sem estoque disponível"
                    }
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">
                    Distribuído em {consolidated.locationsCount} localização(ões) diferentes
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">
                    {activePackagingTypes} configuração(ões) de embalagem ativas
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Embalagem com Maior Estoque */}
            {topPackaging.packagingName && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Maior Concentração de Estoque
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="font-medium">{topPackaging.packagingName}</div>
                    <div className="text-sm text-muted-foreground">
                      {topPackaging.totalBaseUnits} unidades base 
                      ({((Number(topPackaging.totalBaseUnits) / Number(consolidated.totalBaseUnits)) * 100).toFixed(1)}% do total)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {topPackaging.availablePackages} pacotes completos + {topPackaging.remainingBaseUnits} unidades restantes
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Alertas e Recomendações */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recomendações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stock.some(s => s.remainingBaseUnits > 0) && (
                  <div className="flex items-start space-x-2">
                    <Clock className="h-4 w-4 text-orange-600 mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium text-orange-600">Unidades Fragmentadas</div>
                      <div className="text-muted-foreground">
                        Considere consolidar unidades restantes em embalagens menores para otimizar o picking
                      </div>
                    </div>
                  </div>
                )}

                {packagingsWithStock < activePackagingTypes && (
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium text-blue-600">Embalagens Não Utilizadas</div>
                      <div className="text-muted-foreground">
                        {activePackagingTypes - packagingsWithStock} tipo(s) de embalagem não possuem estoque
                      </div>
                    </div>
                  </div>
                )}

                {consolidated.locationsCount > 5 && (
                  <div className="flex items-start space-x-2">
                    <Target className="h-4 w-4 text-purple-600 mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium text-purple-600">Estoque Disperso</div>
                      <div className="text-muted-foreground">
                        Produto distribuído em muitas localizações. Considere consolidação para facilitar picking
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}