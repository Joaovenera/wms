import React, { useState, useMemo, useCallback, memo } from "react";
import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { InsertProduct, Product } from "@/types/api";
import { TouchOptimizedButton } from "@/components/mobile/TouchOptimizedControls";
import { Camera, RefreshCw } from "lucide-react";
import CameraCapture from "@/components/camera-capture";
import categoriesData from "@/data/categories.json";

interface MobileProductFormProps {
  form: UseFormReturn<InsertProduct>;
  onSubmit: (data: InsertProduct) => void;
  isLoading: boolean;
  editingProduct: Product | null;
}

const MobileProductForm = memo<MobileProductFormProps>(({
  form,
  onSubmit,
  isLoading,
  editingProduct
}) => {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Initialize category selection from existing product
  React.useEffect(() => {
    if (editingProduct?.category) {
      const categoryParts = editingProduct.category.split(" > ");
      setSelectedCategory(categoryParts[0] || "");
      setSelectedSubCategory(categoryParts.slice(1).join(" > ") || "");
    }
  }, [editingProduct]);

  // Memoize subcategories computation
  const subcategories = useMemo(() => {
    const category = categoriesData.find(cat => cat.name === selectedCategory);
    return category?.subcategories || [];
  }, [selectedCategory]);

  // Memoized category change handler
  const handleCategoryChange = useCallback((value: string) => {
    setSelectedCategory(value);
    setSelectedSubCategory(""); // Reset subcategory
    form.setValue("category", value);
  }, [form]);

  // Memoized subcategory change handler
  const handleSubCategoryChange = useCallback((value: string) => {
    setSelectedSubCategory(value);
    const fullCategory = value ? `${selectedCategory} > ${value}` : selectedCategory;
    form.setValue("category", fullCategory);
  }, [selectedCategory, form]);

  // Camera capture handler
  const handleCameraCapture = (imageData: string) => {
    if (imageData && imageData !== "data:,") {
      setPhotoPreview(imageData);
      form.setValue("photoUrl", imageData);
    }
    setIsCameraOpen(false);
  };

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

  return (
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Basic Information */}
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU/ID</FormLabel>
                <FormControl>
                  <div className="flex space-x-2">
                    <Input placeholder="PRD-001" {...field} className="flex-1" />
                    <TouchOptimizedButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateNextSku}
                      disabled={!!editingProduct}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </TouchOptimizedButton>
                  </div>
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
                <FormLabel>Nome do Produto</FormLabel>
                <FormControl>
                  <Input placeholder="Nome do produto" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Descrição detalhada do produto" 
                    {...field} 
                    value={field.value || ""} 
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Category and Brand */}
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="category"
            render={() => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <FormControl>
                  <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriesData.map((category) => (
                        <SelectItem key={category.name} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {selectedCategory && subcategories.length > 0 && (
            <div className="space-y-2">
              <FormLabel>Subcategoria</FormLabel>
              <Select value={selectedSubCategory} onValueChange={handleSubCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma subcategoria" />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((subcategory) => (
                    <div key={subcategory.name}>
                      <SelectItem value={subcategory.name}>
                        {subcategory.name}
                      </SelectItem>
                      {subcategory.subcategories?.map((subsubcategory: any) => (
                        <SelectItem 
                          key={subsubcategory.name} 
                          value={`${subcategory.name} > ${subsubcategory.name}`}
                        >
                          {subcategory.name} {'>'} {subsubcategory.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <FormField
            control={form.control}
            name="brand"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Marca</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Nome da marca" 
                    {...field} 
                    value={field.value || ""} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Unit and Quantity */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unidade</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unidade" />
                    </SelectTrigger>
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
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unitsPerPackage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Qtd/Unidade</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.001"
                    placeholder="1.000"
                    {...field} 
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.value || "1")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Weight and Barcode */}
        <div className="grid grid-cols-2 gap-3">
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
                  <Input 
                    placeholder="1234567890123" 
                    {...field} 
                    value={field.value || ""} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Dimensions */}
        <div className="space-y-2">
          <FormLabel>Dimensões (cm)</FormLabel>
          <div className="grid grid-cols-3 gap-2">
            <FormField
              control={form.control}
              name="dimensions.length"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Comp."
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
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Larg."
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
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Alt."
                      {...field}
                      value={field.value ?? 0}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Stock Information */}
        <div className="grid grid-cols-2 gap-3">
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

        {/* Photo Section */}
        <div className="space-y-3">
          <FormLabel>Foto do Produto</FormLabel>
          <TouchOptimizedButton
            type="button"
            variant="outline"
            onClick={() => setIsCameraOpen(true)}
            className="w-full h-12"
          >
            <Camera className="h-4 w-4 mr-2" />
            {photoPreview ? "Alterar Foto" : "Tirar Foto"}
          </TouchOptimizedButton>

          {photoPreview && (
            <div className="mt-3">
              <img
                src={photoPreview}
                alt="Preview"
                className="w-full h-32 object-cover rounded border"
              />
            </div>
          )}

          <FormField
            control={form.control}
            name="photoUrl"
            render={({ field }) => (
              <FormControl>
                <Input
                  type="hidden"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
            )}
          />
        </div>

        {/* Configuration Switches */}
        <div className="space-y-3">
          <FormLabel className="text-base font-medium">Configurações</FormLabel>
          
          <div className="space-y-3">
            <FormField
              control={form.control}
              name="requiresLot"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 space-y-0">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Requer Lote</FormLabel>
                    <div className="text-sm text-gray-600">
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
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 space-y-0">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Requer Validade</FormLabel>
                    <div className="text-sm text-gray-600">
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
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 space-y-0">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Ativo</FormLabel>
                    <div className="text-sm text-gray-600">
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

        {/* Submit Button */}
        <div className="pt-4 space-y-2">
          <TouchOptimizedButton
            type="submit"
            className="w-full h-12"
            disabled={isLoading}
          >
            {isLoading ? "Salvando..." : editingProduct ? "Atualizar Produto" : "Criar Produto"}
          </TouchOptimizedButton>
        </div>
      </form>

      {/* Camera Capture */}
      <CameraCapture
        isOpen={isCameraOpen}
        onCapture={handleCameraCapture}
        onClose={() => setIsCameraOpen(false)}
      />
    </>
  );
});

MobileProductForm.displayName = "MobileProductForm";

export default MobileProductForm;