import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Progress } from "./ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Calculator, 
  Package, 
  Target, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp,
  Clock,
  Layers,
  ArrowRight
} from "lucide-react";
import { useOptimizePicking, useProductStockConsolidated } from "../hooks/usePackaging";
import { Product, OptimizedPickingPlan } from "../types/api";

interface PickingOptimizerProps {
  product: Product;
}

export function PickingOptimizer({ product }: PickingOptimizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [requestedQuantity, setRequestedQuantity] = useState<string>("");
  const [lastOptimization, setLastOptimization] = useState<OptimizedPickingPlan | null>(null);
  const { toast } = useToast();

  const { data: stockData } = useProductStockConsolidated(product.id);
  const optimizePicking = useOptimizePicking();

  const handleOptimize = async () => {
    const quantity = parseFloat(requestedQuantity);
    
    if (!quantity || quantity <= 0) {
      toast({
        title: "Erro",
        description: "Digite uma quantidade válida",
        variant: "destructive",
      });
      return;
    }

    if (!stockData?.consolidated || stockData.consolidated.totalBaseUnits < quantity) {
      toast({
        title: "Erro",
        description: "Quantidade solicitada maior que o estoque disponível",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await optimizePicking.mutateAsync({
        productId: product.id,
        requestedBaseUnits: quantity,
      });
      
      setLastOptimization(result);
      
      if (result.canFulfill) {
        toast({
          title: "Sucesso",
          description: "Plano de separação otimizado criado!",
        });
      } else {
        toast({
          title: "Aviso",
          description: `Separação parcial: ${result.remaining} unidades não podem ser atendidas`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao otimizar separação",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setRequestedQuantity("");
    setLastOptimization(null);
  };

  const totalAvailable = stockData?.consolidated.totalBaseUnits || 0;
  const requestedNum = parseFloat(requestedQuantity) || 0;
  const coveragePercentage = totalAvailable > 0 ? Math.min((requestedNum / totalAvailable) * 100, 100) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Calculator className="h-4 w-4 mr-2" />
          Otimizar Separação
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Otimização de Separação - {product.name}
          </DialogTitle>
          <DialogDescription>
            Calcule a melhor combinação de embalagens para separar a quantidade solicitada
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Estoque */}
          {stockData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Estoque Disponível</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {stockData.consolidated.totalBaseUnits}
                    </div>
                    <div className="text-xs text-muted-foreground">Unidades Base</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {stockData.consolidated.locationsCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Localizações</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {stockData.packagings.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Tipos de Embalagem</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Input da Quantidade */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quantidade para Separação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <div className="flex-1">
                  <Label htmlFor="quantity">Quantidade (unidades base)</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={requestedQuantity}
                    onChange={(e) => setRequestedQuantity(e.target.value)}
                    placeholder="Ex: 75"
                    min="1"
                    max={totalAvailable}
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <Button
                    onClick={handleOptimize}
                    disabled={optimizePicking.isPending || !requestedQuantity}
                  >
                    {optimizePicking.isPending ? "Calculando..." : "Otimizar"}
                  </Button>
                </div>
              </div>

              {/* Indicador de Cobertura */}
              {requestedNum > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Cobertura do estoque</span>
                    <span className={requestedNum > totalAvailable ? "text-red-600" : "text-green-600"}>
                      {coveragePercentage.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={coveragePercentage} 
                    className={`h-2 ${requestedNum > totalAvailable ? "bg-red-100" : ""}`}
                  />
                  {requestedNum > totalAvailable && (
                    <div className="flex items-center space-x-2 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Quantidade solicitada excede o estoque disponível</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resultado da Otimização */}
          {lastOptimization && (
            <Card className={lastOptimization.canFulfill ? "border-green-200" : "border-orange-200"}>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  {lastOptimization.canFulfill ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                  )}
                  Plano de Separação
                  {lastOptimization.canFulfill ? (
                    <Badge variant="default">Completo</Badge>
                  ) : (
                    <Badge variant="secondary">Parcial</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Estatísticas do Plano */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xl font-bold text-green-600">
                      {lastOptimization.totalPlanned}
                    </div>
                    <div className="text-xs text-muted-foreground">Unidades Planejadas</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-blue-600">
                      {lastOptimization.pickingPlan.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Tipos de Embalagem</div>
                  </div>
                  <div>
                    <div className={`text-xl font-bold ${lastOptimization.remaining > 0 ? "text-orange-600" : "text-green-600"}`}>
                      {lastOptimization.remaining}
                    </div>
                    <div className="text-xs text-muted-foreground">Restante</div>
                  </div>
                </div>

                <Separator />

                {/* Detalhes do Plano */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Instruções de Separação:</h4>
                  {lastOptimization.pickingPlan.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs font-bold">
                          {index + 1}
                        </div>
                        <Package className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{item.packaging.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.packaging.baseUnitQuantity} unidades por pacote
                          </div>
                          {item.packaging.barcode && (
                            <div className="text-xs text-muted-foreground">
                              Código: {item.packaging.barcode}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{item.quantity}x</div>
                        <div className="text-sm text-muted-foreground">
                          = {item.baseUnits} unidades
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resumo Final */}
                <div className="bg-primary/5 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="font-medium">Total a Separar:</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{lastOptimization.totalPlanned} unidades base</div>
                      {lastOptimization.remaining > 0 && (
                        <div className="text-sm text-orange-600">
                          + {lastOptimization.remaining} não atendidas
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Métricas de Eficiência */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    <span>Níveis utilizados:</span>
                    <Badge variant="outline">
                      {new Set(lastOptimization.pickingPlan.map(p => p.packaging.level)).size}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span>Eficiência:</span>
                    <Badge variant="outline">
                      {((lastOptimization.totalPlanned / requestedNum) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>

                {/* Alerta se há restante */}
                {lastOptimization.remaining > 0 && (
                  <div className="flex items-center space-x-2 p-3 bg-orange-50 rounded-lg text-orange-700">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">
                      Atenção: {lastOptimization.remaining} unidades não puderam ser atendidas com as embalagens disponíveis em estoque.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Ações */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleReset}>
              Limpar
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Fechar
            </Button>
            {lastOptimization && lastOptimization.canFulfill && (
              <Button>
                Confirmar Separação
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Componente compacto para uso em listas
export function QuickPickingOptimizer({ 
  product, 
  onOptimizationResult 
}: {
  product: Product;
  onOptimizationResult?: (plan: OptimizedPickingPlan) => void;
}) {
  const [quantity, setQuantity] = useState("");
  const { toast } = useToast();
  const optimizePicking = useOptimizePicking();

  const handleQuickOptimize = async () => {
    const requestedQuantity = parseFloat(quantity);
    
    if (!requestedQuantity || requestedQuantity <= 0) {
      toast({
        title: "Erro",
        description: "Digite uma quantidade válida",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await optimizePicking.mutateAsync({
        productId: product.id,
        requestedBaseUnits: requestedQuantity,
      });
      
      onOptimizationResult?.(result);
      setQuantity("");
      
      if (result.canFulfill) {
        toast({
          title: "Sucesso",
          description: `Separação otimizada: ${result.pickingPlan.length} tipo(s) de embalagem`,
        });
      } else {
        toast({
          title: "Aviso", 
          description: `Separação parcial: ${result.remaining} unidades restantes`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao otimizar",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex space-x-2">
      <Input
        type="number"
        placeholder="Quantidade"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        className="w-32"
      />
      <Button
        size="sm"
        onClick={handleQuickOptimize}
        disabled={optimizePicking.isPending || !quantity}
      >
        {optimizePicking.isPending ? "..." : <Calculator className="h-4 w-4" />}
      </Button>
    </div>
  );
}