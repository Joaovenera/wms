import React, { memo, useMemo, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { InsertProduct } from "@/types/api";
import categoriesData from "@/data/categories.json";

interface OptimizedProductFormProps {
  form: UseFormReturn<InsertProduct>;
  selectedCategory: string;
  selectedSubCategory: string;
  onCategoryChange: (category: string) => void;
  onSubCategoryChange: (subCategory: string) => void;
}

// Extracted components for better memoization
const CategorySelect = memo<{
  value: string;
  onValueChange: (value: string) => void;
  categories: typeof categoriesData;
}>(({ value, onValueChange, categories }) => (
  <Select onValueChange={onValueChange} value={value}>
    <SelectTrigger>
      <SelectValue placeholder="Selecione uma categoria" />
    </SelectTrigger>
    <SelectContent>
      {categories.map((category) => (
        <SelectItem key={category.name} value={category.name}>
          {category.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
));

CategorySelect.displayName = "CategorySelect";

const SubCategorySelect = memo<{
  value: string;
  onValueChange: (value: string) => void;
  subcategories: any[];
  disabled: boolean;
}>(({ value, onValueChange, subcategories, disabled }) => (
  <Select onValueChange={onValueChange} value={value} disabled={disabled}>
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
));

SubCategorySelect.displayName = "SubCategorySelect";

const UnitSelect = memo<{
  value: string;
  onValueChange: (value: string) => void;
}>(({ value, onValueChange }) => (
  <Select onValueChange={onValueChange} value={value}>
    <SelectTrigger>
      <SelectValue placeholder="Selecione a unidade" />
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
));

UnitSelect.displayName = "UnitSelect";

export const OptimizedProductForm = memo<OptimizedProductFormProps>(({
  form,
  selectedCategory,
  selectedSubCategory,
  onCategoryChange,
  onSubCategoryChange
}) => {
  // Memoize subcategories computation
  const subcategories = useMemo(() => {
    const category = categoriesData.find(cat => cat.name === selectedCategory);
    return category?.subcategories || [];
  }, [selectedCategory]);

  // Memoized category change handler
  const handleCategoryChange = useCallback((value: string) => {
    onCategoryChange(value);
    onSubCategoryChange(""); // Reset subcategory
    form.setValue("category", value);
  }, [onCategoryChange, onSubCategoryChange, form]);

  // Memoized subcategory change handler
  const handleSubCategoryChange = useCallback((value: string) => {
    onSubCategoryChange(value);
    const fullCategory = value ? `${selectedCategory} > ${value}` : selectedCategory;
    form.setValue("category", fullCategory);
  }, [onSubCategoryChange, selectedCategory, form]);

  return (
    <div className="space-y-4">
      {/* Basic Information */}
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

      {/* Description */}
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
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Category, SubCategory, and Brand */}
      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="category"
          render={() => (
            <FormItem>
              <FormLabel>Categoria</FormLabel>
              <FormControl>
                <CategorySelect
                  value={selectedCategory}
                  onValueChange={handleCategoryChange}
                  categories={categoriesData}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="space-y-2">
          <FormLabel>Sub Categoria</FormLabel>
          <SubCategorySelect
            value={selectedSubCategory}
            onValueChange={handleSubCategoryChange}
            subcategories={subcategories}
            disabled={!selectedCategory}
          />
        </div>
        
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
      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="unit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unidade</FormLabel>
              <FormControl>
                <UnitSelect
                  value={field.value || ""}
                  onValueChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ncm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>NCM</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Ex: 1905.90.90" 
                  {...field} 
                  value={(field.value as string) || ""} 
                />
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
              <FormLabel>Quantidade por Unidade</FormLabel>
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

      {/* Stock Information */}
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

      {/* Configuration Switches */}
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
    </div>
  );
});

OptimizedProductForm.displayName = "OptimizedProductForm";