import React, { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface MobileProductSkeletonProps {
  count?: number;
}

// Individual product card skeleton for mobile
const ProductCardSkeleton = memo(() => (
  <Card className="animate-pulse">
    <CardContent className="p-4">
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2 mb-1" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-6 w-20 ml-2" />
      </div>

      {/* Details grid skeleton */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <Skeleton className="h-3 w-12 mb-1" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div>
          <Skeleton className="h-3 w-10 mb-1" />
          <Skeleton className="h-4 w-14" />
        </div>
      </div>

      {/* Barcode skeleton */}
      <div className="mb-3">
        <Skeleton className="h-3 w-24 mb-1" />
        <Skeleton className="h-8 w-full" />
      </div>

      {/* Action buttons skeleton */}
      <div className="flex justify-end space-x-2">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
      </div>
    </CardContent>
  </Card>
));

ProductCardSkeleton.displayName = "ProductCardSkeleton";

// Loading skeleton for search state
export const SearchLoadingSkeleton = memo(() => (
  <div className="px-4">
    <div className="flex items-center justify-center py-4">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
      <span className="text-sm text-gray-600">Buscando produtos...</span>
    </div>
  </div>
));

SearchLoadingSkeleton.displayName = "SearchLoadingSkeleton";

// Inline loading skeleton for modals/forms
export const InlineLoadingSkeleton = memo<{ text?: string }>(({ text = "Carregando..." }) => (
  <div className="flex items-center justify-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
    <span className="text-gray-600">{text}</span>
  </div>
));

InlineLoadingSkeleton.displayName = "InlineLoadingSkeleton";

// Grid loading skeleton for empty states
export const GridLoadingSkeleton = memo(() => (
  <div className="px-4">
    <div className="grid gap-4">
      {/* Simulate mobile grid layout */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="w-full">
          <ProductCardSkeleton />
        </div>
      ))}
    </div>
  </div>
));

GridLoadingSkeleton.displayName = "GridLoadingSkeleton";

// Optimized skeleton for form loading
export const FormLoadingSkeleton = memo(() => (
  <div className="space-y-4">
    {/* Form header */}
    <div className="space-y-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-10 w-full" />
    </div>
    
    {/* Form fields */}
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
    ))}

    {/* Form grid */}
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>

    {/* Form button */}
    <Skeleton className="h-12 w-full" />
  </div>
));

FormLoadingSkeleton.displayName = "FormLoadingSkeleton";

// Main mobile product skeleton component
export const MobileProductSkeleton = memo<MobileProductSkeletonProps>(({ count = 6 }) => (
  <div className="space-y-3 px-4 pb-4">
    {Array.from({ length: count }).map((_, i) => (
      <ProductCardSkeleton key={i} />
    ))}
  </div>
));

MobileProductSkeleton.displayName = "MobileProductSkeleton";

export default MobileProductSkeleton;