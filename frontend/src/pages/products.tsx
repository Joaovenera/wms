import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Product, type InsertProduct } from "@/types/api";
import { insertProductSchema } from "@/types/schemas";
import { Plus, Search, Edit, Trash2, Package2, Barcode, ImageIcon, Eye } from "lucide-react";
import ProductPhotoManager from "@/components/product-photo-manager";
import ProductDetailsModal from "@/components/product-details-modal";

// Dados das categorias
const categoriesData = [
  {
    "name": "Alimentadores e Puxadores"
  },
  {
    "name": "Aparelhos"
  },
  {
    "name": "Aviamentos & Patchwork",
    "subcategories": [
      { "name": "Acessórios" },
      { "name": "Alicates e Aplicadores" },
      { "name": "Base de Corte" },
      { "name": "Cabides Manequim" },
      { "name": "Canetas" },
      { "name": "Colas" },
      { "name": "Cortadores" },
      { "name": "Crochê e Tricô" },
      { "name": "Enfeites" },
      { "name": "Ferramentas Couro" },
      { "name": "Quilting e Quiling" },
      { "name": "Réguas" },
      { "name": "Strass" },
      { "name": "Tesouras" }
    ]
  },
  {
    "name": "Divisão Digital"
  },
  {
    "name": "Kansai acessórios"
  },
  {
    "name": "Kansai máquinas"
  },
  {
    "name": "Lazer"
  },
  {
    "name": "Maquinas",
    "subcategories": [
      {
        "name": "Bordado",
        "subcategories": [
          { "name": "Bordado 1 Cabeça" },
          { "name": "Bordado 12 Cabeças" },
          { "name": "Bordado 2 Cabeças" },
          { "name": "Bordado 4 Cabeças" },
          { "name": "Bordado 6 Cabeças" },
          { "name": "Bordado 8 Cabeças" },
          { "name": "Produtos Bordado" }
        ]
      },
      { "name": "Dobradeiras" },
      {
        "name": "Máquinas de Corte",
        "subcategories": [
          { "name": "Corte a Laser" },
          { "name": "Corte Automático" },
          { "name": "Corte Disco" },
          { "name": "Corte Faca" },
          { "name": "Corte Manual" },
          { "name": "Enfestadeira" },
          { "name": "Enfesto" },
          { "name": "Furadora de Tecido" },
          { "name": "Plotters" },
          { "name": "Revisadeira de Tecido" }
        ]
      },
      {
        "name": "Máquinas de Costura",
        "subcategories": [
          { "name": "Automação" },
          { "name": "Bainha" },
          { "name": "Botoneira" },
          { "name": "Braço" },
          { "name": "Caseadeira" },
          { "name": "Coluna" },
          { "name": "Conicaleira" },
          { "name": "Elastiqueira" },
          { "name": "Fechadeira" },
          { "name": "Filigrana" },
          { "name": "Fusionadeira" },
          { "name": "Galoneira" },
          { "name": "Guilhotina" },
          { "name": "Interloque" },
          { "name": "Máquina de Cordão" },
          { "name": "Máquinas Domésticas" },
          { "name": "Máquinas Ultrassônicas" },
          { "name": "Overloque" },
          { "name": "Passantes" },
          { "name": "Peitilho" },
          { "name": "Pespontadeira" },
          { "name": "Ponto Corrente" },
          { "name": "Ponto Invisível" },
          { "name": "Reta" },
          { "name": "Travete" },
          { "name": "Zig Zag" }
        ]
      },
      { "name": "Para Bolso" },
      {
        "name": "Prensas Térmicas",
        "subcategories": [
          { "name": "Prensas Bandeja Móvel" },
          { "name": "Prensas Giratória 1 Bandeja" },
          {
            "name": "Prensas Manuais",
            "subcategories": [
              { "name": "1 Bandeja Manual" },
              { "name": "2 Bandejas Manual" }
            ]
          },
          { "name": "Prensas Multifuncionais" },
          {
            "name": "Prensas Pneumáticas",
            "subcategories": [
              { "name": "1 Bandeja" },
              { "name": "2 Bandejas" },
              { "name": "Prensas Pneumáticas Sublimáticas" }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Marcas",
    "subcategories": [
      { "name": "Eastman" },
      { "name": "H Strong" },
      { "name": "Kansai Especial" },
      { "name": "Kobest" },
      {
        "name": "Orange",
        "subcategories": [
          { "name": "10 Unidades" },
          { "name": "100 Unidades" },
          { "name": "500 Unidades" }
        ]
      },
      { "name": "Silter" },
      { "name": "Silverstar" },
      { "name": "We‑R" },
      { "name": "Westman" },
      {
        "name": "Westpress",
        "subcategories": [
          { "name": "Westpress Ferrinho" },
          { "name": "Westpress Máquinas" }
        ]
      }
    ]
  },
  {
    "name": "Miçanga"
  },
  {
    "name": "OpenTex acessórios"
  },
  {
    "name": "OpenTex fixação"
  },
  {
    "name": "Outlet"
  },
  {
    "name": "Passadoria e Embalo",
    "subcategories": [
      { "name": "Aplicadores de Tag" },
      { "name": "Calandras" },
      { "name": "Caldeiras" },
      { "name": "Dispensadores" },
      {
        "name": "Etiquetadoras e Acessórios",
        "subcategories": [
          { "name": "Peças Rolos E Catracas" }
        ]
      },
      { "name": "Ferros de Passar" },
      { "name": "Grampeadores" },
      { "name": "Lacra Sacola" },
      { "name": "Lavadora a Vapor" },
      { "name": "Mesas de Passar" },
      { "name": "Outros" },
      { "name": "Passadeira" },
      {
        "name": "Peças para Passadoria",
        "subcategories": [
          { "name": "Antena" },
          { "name": "Balancim" },
          { "name": "Bocal" },
          { "name": "Bóia" },
          { "name": "Cabo de Manuseio" },
          { "name": "Capacitador" },
          { "name": "Caracol" },
          { "name": "Dijuntor" },
          { "name": "Gatilho" },
          { "name": "Mangueira" },
          { "name": "Manometro" },
          { "name": "Micro Swift" },
          { "name": "Nippo" },
          { "name": "Pedal/Feltro e Capa" },
          { "name": "Preçostato" },
          { "name": "Reservatorio de Água" },
          { "name": "Resistencia" },
          { "name": "Sapatas" },
          { "name": "Tampa/Plugg" },
          { "name": "Termostato" },
          { "name": "Troller" },
          { "name": "Válvula de Solenoide" },
          { "name": "Ventuinha" }
        ]
      },
      { "name": "Peças Passadoria & Acessórios" },
      { "name": "Steamers - Vaporizador" },
      { "name": "Vincador" }
    ]
  },
  {
    "name": "Peças Bordadeiras"
  },
  {
    "name": "Peças Para Máquina de Costura"
  },
  {
    "name": "Peças, Motores e Mesas",
    "subcategories": [
      { "name": "Looper" },
      { "name": "Mesas" },
      { "name": "Motores" },
      { "name": "Peças Corte a Laser" },
      {
        "name": "Peças de Maquinas de Costura",
        "subcategories": [
          { "name": "Agulhas" },
          { "name": "Bitola" },
          { "name": "Bobina" },
          { "name": "Calcadores" },
          { "name": "Campo. Eletro" },
          { "name": "Carretilhas" },
          { "name": "Chapa" },
          { "name": "Dente" },
          { "name": "Disco de Corte" },
          { "name": "Faca" },
          { "name": "Lançadeir" },
          { "name": "Porta Cones" },
          { "name": "Rolamento" }
        ]
      },
      { "name": "Peças Sublimação e Prensas" },
      { "name": "Placas" }
    ]
  },
  { "name": "Silverstar automação" },
  { "name": "Silverstar corte" },
  { "name": "Silverstar costura" },
  { "name": "Silverstar fixação" },
  { "name": "Silverstar passadoria" },
  { "name": "Sublimação" },
  { "name": "Tampografia" },
  { "name": "Westman automação" },
  { "name": "Westman bordado" },
  { "name": "Westman corte" },
  { "name": "Westman costura" },
  { "name": "Westman doméstico" },
  { "name": "Westman Fixação" },
  { "name": "Westman laser" },
  { "name": "Westman passadoria" },
  { "name": "Westpress acessórios" },
  { "name": "Westpress alicate" },
  { "name": "Westpress base de corte" },
  { "name": "Westpress calcadores" },
  { "name": "Westpress colas" },
  { "name": "Westpress cortadores" },
  { "name": "Westpress crochê" },
  { "name": "Westpress quilting" },
  { "name": "Westpress réguas" },
  { "name": "Westpress tesouras" }
];

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [photoProduct, setPhotoProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  const { data: products, isLoading } = useQuery<any[]>({
    queryKey: ['/api/products?includeStock=true'],
  });

  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema.omit({ createdBy: true })),
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      category: "",
      brand: "",
      unit: "un",
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

  const filteredProducts = products?.filter(product =>
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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
      unit: product.unit,
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
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID</FormLabel>
                        <FormControl>
                          <Input placeholder="PRD-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do produto" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descrição detalhada do produto" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field: _ }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            setSelectedCategory(value);
                            setSelectedSubCategory("");
                            updateCategoryField(value, "");
                          }} 
                          value={selectedCategory}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categoriesData.map((category: any) => (
                              <SelectItem key={category.name} value={category.name}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <FormLabel>Sub Categoria</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        setSelectedSubCategory(value);
                        updateCategoryField(selectedCategory, value);
                      }} 
                      value={selectedSubCategory}
                      disabled={!selectedCategory}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma subcategoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {getSubCategories(selectedCategory).map((subcategory: any) => (
                          <div key={subcategory.name}>
                            <SelectItem value={subcategory.name}>
                              {subcategory.name}
                            </SelectItem>
                            {getSubSubCategories(selectedCategory, subcategory.name).map((subsubcategory: any) => (
                              <SelectItem key={subsubcategory.name} value={`${subcategory.name} {'>'} ${subsubcategory.name}`}>
                                {subcategory.name} {'>'} {subsubcategory.name}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marca</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome da marca" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidade</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a unidade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="un">Unidade</SelectItem>
                            <SelectItem value="kg">Quilograma</SelectItem>
                            <SelectItem value="g">Grama</SelectItem>
                            <SelectItem value="l">Litro</SelectItem>
                            <SelectItem value="ml">Mililitro</SelectItem>
                            <SelectItem value="m">Metro</SelectItem>
                            <SelectItem value="cm">Centímetro</SelectItem>
                            <SelectItem value="cx">Caixa</SelectItem>
                            <SelectItem value="pct">Pacote</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peso (kg)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.001"
                            placeholder="0.000"
                            {...field} 
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="barcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código de Barras</FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890123" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Dimensões da caixa */}
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="dimensions.length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comprimento (cm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            value={field.value ?? 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dimensions.width"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Largura (cm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            value={field.value ?? 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dimensions.height"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Altura (cm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            value={field.value ?? 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estoque Mínimo</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            value={field.value || ""}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estoque Máximo</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Configurações</h3>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="requiresLot"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Requer Lote</FormLabel>
                            <div className="text-xs text-gray-600">
                              Produto necessita controle de lote
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requiresExpiry"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Requer Validade</FormLabel>
                            <div className="text-xs text-gray-600">
                              Produto tem data de validade
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Ativo</FormLabel>
                            <div className="text-xs text-gray-600">
                              Produto está ativo no sistema
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

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
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="card-hover">
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
                    onClick={() => setDetailProduct(product)}
                    title="Ver detalhes"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPhotoProduct(product)}
                    title="Gerenciar fotos"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(product)}
                    title="Editar produto"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(product)}
                    disabled={deleteMutation.isPending}
                    title="Desativar produto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredProducts.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-12">
              <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum produto encontrado
              </h3>
              <p className="text-gray-600">
                {searchTerm ? "Tente ajustar os filtros de busca" : "Comece criando um novo produto"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Photo Manager Dialog */}
      {photoProduct && (
        <ProductPhotoManager
          isOpen={!!photoProduct}
          onClose={() => setPhotoProduct(null)}
          productId={photoProduct.id}
          productName={photoProduct.name}
        />
      )}

      {/* Product Details Modal */}
      {detailProduct && (
        <ProductDetailsModal
          isOpen={!!detailProduct}
          onClose={() => setDetailProduct(null)}
          productId={detailProduct.id}
          productName={detailProduct.name}
        />
      )}
    </div>
  );
}
