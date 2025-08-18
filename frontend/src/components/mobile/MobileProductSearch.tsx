import React, { useState, useCallback, memo, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TouchOptimizedButton } from "@/components/mobile/TouchOptimizedControls";
import { Search, Filter, X, ScanLine, Sliders } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export interface MobileSearchFilters {
  category: string;
  brand: string;
  activeOnly: boolean;
  inStockOnly: boolean;
  minStock?: number;
  maxStock?: number;
}

interface MobileProductSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filters: MobileSearchFilters;
  onFiltersChange: (filters: MobileSearchFilters) => void;
  availableCategories: string[];
  availableBrands: string[];
  isSearching?: boolean;
  onScanBarcode?: () => void;
  resultsCount?: number;
}

// Filter summary component
const FilterSummary = memo<{ filters: MobileSearchFilters }>(({ filters }) => {
  const activeFilters = useMemo(() => {
    const active = [];
    if (filters.category) active.push({ key: 'category', label: filters.category });
    if (filters.brand) active.push({ key: 'brand', label: filters.brand });
    if (filters.activeOnly) active.push({ key: 'active', label: 'Apenas ativos' });
    if (filters.inStockOnly) active.push({ key: 'stock', label: 'Com estoque' });
    return active;
  }, [filters]);

  if (activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2">
      {activeFilters.map((filter) => (
        <Badge key={filter.key} variant="secondary" className="text-xs">
          {filter.label}
        </Badge>
      ))}
    </div>
  );
});

FilterSummary.displayName = "FilterSummary";

// Advanced filters sheet content
const AdvancedFilters = memo<{
  filters: MobileSearchFilters;
  onFiltersChange: (filters: MobileSearchFilters) => void;
  availableCategories: string[];
  availableBrands: string[];
  onClose: () => void;
}>(({ filters, onFiltersChange, availableCategories, availableBrands, onClose }) => {
  const handleClearAll = useCallback(() => {
    onFiltersChange({
      category: "",
      brand: "",
      activeOnly: false,
      inStockOnly: false,
    });
  }, [onFiltersChange]);

  const updateFilter = useCallback((key: keyof MobileSearchFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  }, [filters, onFiltersChange]);

  return (
    <div className="space-y-6 p-1">
      {/* Category Filter */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Categoria</Label>
        <Select value={filters.category} onValueChange={(value) => updateFilter('category', value)}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as categorias</SelectItem>
            {availableCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Brand Filter */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Marca</Label>
        <Select value={filters.brand} onValueChange={(value) => updateFilter('brand', value)}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Todas as marcas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as marcas</SelectItem>
            {availableBrands.map((brand) => (
              <SelectItem key={brand} value={brand}>
                {brand}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Toggle Filters */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Opções</Label>
        
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label className="font-medium">Apenas produtos ativos</Label>
            <p className="text-sm text-gray-600">Mostrar apenas produtos ativos</p>
          </div>
          <Switch
            checked={filters.activeOnly}
            onCheckedChange={(checked) => updateFilter('activeOnly', checked)}
          />
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label className="font-medium">Apenas com estoque</Label>
            <p className="text-sm text-gray-600">Mostrar apenas produtos em estoque</p>
          </div>
          <Switch
            checked={filters.inStockOnly}
            onCheckedChange={(checked) => updateFilter('inStockOnly', checked)}
          />
        </div>
      </div>

      {/* Stock Range Filter */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Faixa de Estoque</Label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm">Mínimo</Label>
            <Input
              type="number"
              placeholder="0"
              value={filters.minStock || ""}
              onChange={(e) => updateFilter('minStock', e.target.value ? parseInt(e.target.value) : undefined)}
              className="h-12"
            />
          </div>
          <div>
            <Label className="text-sm">Máximo</Label>
            <Input
              type="number"
              placeholder="999"
              value={filters.maxStock || ""}
              onChange={(e) => updateFilter('maxStock', e.target.value ? parseInt(e.target.value) : undefined)}
              className="h-12"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-4">
        <TouchOptimizedButton
          variant="outline"
          className="w-full h-12"
          onClick={handleClearAll}
        >
          <X className="h-4 w-4 mr-2" />
          Limpar Filtros
        </TouchOptimizedButton>
        <TouchOptimizedButton
          className="w-full h-12"
          onClick={onClose}
        >
          Aplicar Filtros
        </TouchOptimizedButton>
      </div>
    </div>
  );
});

AdvancedFilters.displayName = "AdvancedFilters";

export const MobileProductSearch = memo<MobileProductSearchProps>(({
  searchTerm,
  onSearchChange,
  filters,
  onFiltersChange,
  availableCategories,
  availableBrands,
  isSearching = false,
  onScanBarcode,
  resultsCount
}) => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const hasActiveFilters = useMemo(() => {
    return filters.category || filters.brand || filters.activeOnly || filters.inStockOnly;
  }, [filters]);

  const handleScanBarcode = useCallback(() => {
    if (onScanBarcode) {
      onScanBarcode();
      // Haptic feedback for scanning
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 10, 50]);
      }
    }
  }, [onScanBarcode]);

  return (
    <div className="space-y-3">
      {/* Main search bar */}
      <div className="px-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar produtos, SKU, marca..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-20 h-12 text-base"
          />
          
          {/* Search actions */}
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1">
            {onScanBarcode && (
              <TouchOptimizedButton
                size="sm"
                variant="ghost"
                onClick={handleScanBarcode}
                className="h-8 w-8 p-0"
              >
                <ScanLine className="h-4 w-4" />
              </TouchOptimizedButton>
            )}
            
            <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
              <SheetTrigger asChild>
                <TouchOptimizedButton
                  size="sm"
                  variant="ghost"
                  className={`h-8 w-8 p-0 ${hasActiveFilters ? 'text-primary' : ''}`}
                >
                  <Sliders className={`h-4 w-4 ${hasActiveFilters ? 'text-primary' : ''}`} />
                </TouchOptimizedButton>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Filtros Avançados</SheetTitle>
                  <SheetDescription>
                    Refine sua busca com filtros específicos
                  </SheetDescription>
                </SheetHeader>
                <AdvancedFilters
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  availableCategories={availableCategories}
                  availableBrands={availableBrands}
                  onClose={() => setIsFiltersOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </div>
          
          {/* Loading indicator */}
          {isSearching && (
            <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            </div>
          )}
        </div>
      </div>

      {/* Quick filters */}
      <div className="px-4">
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
          <TouchOptimizedButton
            size="sm"
            variant={filters.inStockOnly ? "default" : "outline"}
            onClick={() => onFiltersChange({ ...filters, inStockOnly: !filters.inStockOnly })}
            className="whitespace-nowrap"
          >
            Com Estoque
          </TouchOptimizedButton>
          <TouchOptimizedButton
            size="sm"
            variant={filters.activeOnly ? "default" : "outline"}
            onClick={() => onFiltersChange({ ...filters, activeOnly: !filters.activeOnly })}
            className="whitespace-nowrap"
          >
            Apenas Ativos
          </TouchOptimizedButton>
          {availableCategories.slice(0, 3).map((category) => (
            <TouchOptimizedButton
              key={category}
              size="sm"
              variant={filters.category === category ? "default" : "outline"}
              onClick={() => onFiltersChange({ 
                ...filters, 
                category: filters.category === category ? "" : category 
              })}
              className="whitespace-nowrap"
            >
              {category}
            </TouchOptimizedButton>
          ))}
        </div>
      </div>

      {/* Active filters summary */}
      <FilterSummary filters={filters} />

      {/* Results count */}
      {resultsCount !== undefined && (
        <div className="px-4">
          <p className="text-sm text-gray-600">
            {resultsCount} produto{resultsCount !== 1 ? 's' : ''} encontrado{resultsCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
});

MobileProductSearch.displayName = "MobileProductSearch";

export default MobileProductSearch;