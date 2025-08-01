import React, { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, Barcode, Edit, Trash2, TreePine, Users, Settings } from "lucide-react";
import { 
  useProductPackaging, 
  useProductPackagingHierarchy, 
  useCreatePackaging, 
  useUpdatePackaging, 
  useDeletePackaging 
} from "../hooks/usePackaging";
import { useCompositions } from "../hooks/useComposition";
import { PackagingType, Product } from "../types/api";
import { insertPackagingTypeSchema } from "../types/schemas";
import { CompositionManager } from "./composition-manager";
import { z } from "zod";

interface PackagingManagerProps {
  product: Product;
}

interface PackagingFormData {
  name: string;
  barcode?: string;
  baseUnitQuantity: string;
  isBaseUnit: boolean;
  parentPackagingId?: number;
  level: number;
  dimensions?: string;
}

export function PackagingManager({ product }: PackagingManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPackaging, setEditingPackaging] = useState<PackagingType | null>(null);
  const [showHierarchy, setShowHierarchy] = useState(false);
  const [activeTab, setActiveTab] = useState("packaging");
  const { toast } = useToast();

  const { data: packagingData, isLoading } = useProductPackaging(product.id);
  const { data: hierarchyData } = useProductPackagingHierarchy(product.id);
  const { data: compositions, isLoading: compositionsLoading } = useCompositions();
  const createPackaging = useCreatePackaging();
  const updatePackaging = useUpdatePackaging();
  const deletePackaging = useDeletePackaging();

  const [formData, setFormData] = useState<PackagingFormData>({
    name: "",
    barcode: "",
    baseUnitQuantity: "1",
    isBaseUnit: false,
    level: 1,
    dimensions: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      barcode: "",
      baseUnitQuantity: "1",
      isBaseUnit: false,
      level: 1,
      dimensions: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const packagingData = {
        ...formData,
        productId: product.id,
        createdBy: 1, // TODO: Get from auth context
        dimensions: formData.dimensions ? JSON.parse(formData.dimensions) : undefined,
      };

      // Validate with Zod
      insertPackagingTypeSchema.parse(packagingData);

      if (editingPackaging) {
        await updatePackaging.mutateAsync({
          id: editingPackaging.id,
          updates: packagingData,
        });
        toast({
          title: "Sucesso",
          description: "Embalagem atualizada com sucesso!",
        });
        setIsEditDialogOpen(false);
        setEditingPackaging(null);
      } else {
        await createPackaging.mutateAsync(packagingData);
        toast({
          title: "Sucesso", 
          description: "Embalagem criada com sucesso!",
        });
        setIsCreateDialogOpen(false);
      }

      resetForm();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: error.message || "Erro ao salvar embalagem",
          variant: "destructive",
        });
      }
    }
  };

  const handleEdit = (packaging: PackagingType) => {
    setEditingPackaging(packaging);
    setFormData({
      name: packaging.name,
      barcode: packaging.barcode || "",
      baseUnitQuantity: packaging.baseUnitQuantity,
      isBaseUnit: packaging.isBaseUnit || false,
      parentPackagingId: packaging.parentPackagingId || undefined,
      level: packaging.level,
      dimensions: packaging.dimensions ? JSON.stringify(packaging.dimensions) : "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (packaging: PackagingType) => {
    if (!confirm(`Tem certeza que deseja excluir a embalagem "${packaging.name}"?`)) {
      return;
    }

    try {
      await deletePackaging.mutateAsync(packaging.id);
      toast({
        title: "Sucesso",
        description: "Embalagem excluída com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir embalagem",
        variant: "destructive",
      });
    }
  };

  const renderHierarchy = (items: any[], level = 0) => {
    return items.map((item) => (
      <div key={item.id} className={`ml-${level * 4} mb-2`}>
        <div className="flex items-center space-x-2 p-2 border rounded">
          <Package className="h-4 w-4" />
          <span className="font-medium">{item.name}</span>
          <Badge variant="outline">{item.baseUnitQuantity} un. base</Badge>
          {item.barcode && (
            <Badge variant="secondary">
              <Barcode className="h-3 w-3 mr-1" />
              {item.barcode}
            </Badge>
          )}
          <div className="ml-auto space-x-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEdit(item)}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDelete(item)}
              disabled={item.isBaseUnit}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {item.children && item.children.length > 0 && (
          <div className="ml-4 mt-2">
            {renderHierarchy(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  if (isLoading) {
    return <div>Carregando embalagens...</div>;
  }

  const packagings = (packagingData as any)?.packagings || [];
  const stock = (packagingData as any)?.stock || [];
  const consolidated = (packagingData as any)?.consolidated;
  
  // Filter compositions that include this product
  const productCompositions = compositions?.filter(comp => 
    comp.products.some(p => p.productId === product.id)
  ) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gerenciamento - {product.name}</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie embalagens e composições do produto
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="packaging" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Embalagens
          </TabsTrigger>
          <TabsTrigger value="compositions" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Composições
            {productCompositions.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {productCompositions.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="packaging" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowHierarchy(!showHierarchy)}
              >
                <TreePine className="h-4 w-4 mr-2" />
                {showHierarchy ? "Lista" : "Hierarquia"}
              </Button>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Embalagem
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Nova Embalagem</DialogTitle>
                <DialogDescription>
                  Adicione um novo tipo de embalagem para {product.name}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome da Embalagem</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Caixa 10 Unidades"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="barcode">Código de Barras</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Ex: 7891234567890"
                  />
                </div>

                <div>
                  <Label htmlFor="baseUnitQuantity">Quantidade em Unidades Base</Label>
                  <Input
                    id="baseUnitQuantity"
                    type="number"
                    step="0.001"
                    value={formData.baseUnitQuantity}
                    onChange={(e) => setFormData({ ...formData, baseUnitQuantity: e.target.value })}
                    placeholder="Ex: 10"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="parentPackaging">Embalagem Pai</Label>
                  <Select
                    value={formData.parentPackagingId?.toString() || "none"}
                    onValueChange={(value) => 
                      setFormData({ 
                        ...formData, 
                        parentPackagingId: value !== "none" ? parseInt(value) : undefined,
                        level: value !== "none" ? 
                          (packagings.find((p: any) => p.id === parseInt(value))?.level || 1) + 1 : 1
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a embalagem pai (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma (embalagem raiz)</SelectItem>
                      {packagings.map((pkg: any) => (
                        <SelectItem key={pkg.id} value={pkg.id.toString()}>
                          {pkg.name} ({pkg.baseUnitQuantity} un. base)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="level">Nível na Hierarquia</Label>
                  <Input
                    id="level"
                    type="number"
                    min="1"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="dimensions">Dimensões (JSON)</Label>
                  <Textarea
                    id="dimensions"
                    value={formData.dimensions}
                    onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                    placeholder='{"width": 10, "height": 5, "length": 15}'
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    id="isBaseUnit"
                    type="checkbox"
                    checked={formData.isBaseUnit}
                    onChange={(e) => setFormData({ ...formData, isBaseUnit: e.target.checked })}
                  />
                  <Label htmlFor="isBaseUnit">É unidade base</Label>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createPackaging.isPending}>
                    {createPackaging.isPending ? "Criando..." : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>

          {/* Estoque Consolidado */}
      {consolidated && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Estoque Consolidado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{consolidated.totalBaseUnits}</div>
                <div className="text-xs text-muted-foreground">Unidades Base</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{consolidated.locationsCount}</div>
                <div className="text-xs text-muted-foreground">Localizações</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{consolidated.itemsCount}</div>
                <div className="text-xs text-muted-foreground">Itens</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista ou Hierarquia de Embalagens */}
      {showHierarchy ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Hierarquia de Embalagens</CardTitle>
          </CardHeader>
          <CardContent>
            {(hierarchyData as any) && (hierarchyData as any).length > 0 ? (
              renderHierarchy(hierarchyData as any)
            ) : (
              <p className="text-muted-foreground">Nenhuma embalagem cadastrada</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {packagings.map((packaging: any) => {
            const stockInfo = stock.find((s: any) => s.packagingId === packaging.id);
            return (
              <Card key={packaging.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Package className="h-5 w-5" />
                      <div>
                        <div className="font-medium">{packaging.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {packaging.baseUnitQuantity} unidades base • Nível {packaging.level}
                        </div>
                      </div>
                      {packaging.isBaseUnit && (
                        <Badge variant="default">Base</Badge>
                      )}
                      {packaging.barcode && (
                        <Badge variant="outline">
                          <Barcode className="h-3 w-3 mr-1" />
                          {packaging.barcode}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center space-x-4">
                      {stockInfo && (
                        <div className="text-right text-sm">
                          <div className="font-medium">{stockInfo.availablePackages} pacotes</div>
                          <div className="text-muted-foreground">
                            {stockInfo.remainingBaseUnits} un. restantes
                          </div>
                        </div>
                      )}
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(packaging)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(packaging)}
                          disabled={packaging.isBaseUnit}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Embalagem</DialogTitle>
            <DialogDescription>
              Edite as informações da embalagem {editingPackaging?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mesmo formulário da criação, mas com dados preenchidos */}
            <div>
              <Label htmlFor="edit-name">Nome da Embalagem</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-barcode">Código de Barras</Label>
              <Input
                id="edit-barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-baseUnitQuantity">Quantidade em Unidades Base</Label>
              <Input
                id="edit-baseUnitQuantity"
                type="number"
                step="0.001"
                value={formData.baseUnitQuantity}
                onChange={(e) => setFormData({ ...formData, baseUnitQuantity: e.target.value })}
                required
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingPackaging(null);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updatePackaging.isPending}>
                {updatePackaging.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="compositions" className="space-y-4">
          {/* Product Compositions Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Composições com {product.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {compositionsLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Carregando composições...
                </div>
              ) : productCompositions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Nenhuma composição encontrada</p>
                  <p className="text-sm">
                    Este produto ainda não faz parte de nenhuma composição.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {productCompositions.map((composition) => {
                    const productInComposition = composition.products.find(p => p.productId === product.id);
                    return (
                      <div key={composition.id} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{composition.name}</span>
                              <Badge variant={composition.result.isValid ? "default" : "destructive"}>
                                {composition.result.isValid ? "Válida" : "Inválida"}
                              </Badge>
                              <Badge variant="outline">
                                {composition.status === 'draft' ? 'Rascunho' :
                                 composition.status === 'validated' ? 'Validado' :
                                 composition.status === 'approved' ? 'Aprovado' : 'Executado'}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Quantidade nesta composição: {productInComposition?.quantity} unidades
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Eficiência: {(composition.result.efficiency * 100).toFixed(1)}% • 
                              {composition.products.length} produtos • 
                              ID: {composition.id}
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="font-medium">
                              {(composition.result.weight.utilization * 100).toFixed(1)}% peso
                            </div>
                            <div className="text-muted-foreground">
                              {(composition.result.volume.utilization * 100).toFixed(1)}% volume
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Integration Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Ações de Composição
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-start gap-2"
                  onClick={() => setActiveTab("compositions")}
                >
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span className="font-medium">Nova Composição</span>
                  </div>
                  <span className="text-xs text-muted-foreground text-left">
                    Criar uma nova composição incluindo este produto
                  </span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-start gap-2"
                  disabled={productCompositions.length === 0}
                >
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span className="font-medium">Otimizar Existente</span>
                  </div>
                  <span className="text-xs text-muted-foreground text-left">
                    Otimizar composições existentes com este produto
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Full Composition Manager */}
          <CompositionManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}