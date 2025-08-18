import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TransferListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="border-l-4 border-l-gray-200">
          <CardContent className="p-6">
            {/* Header Section */}
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </div>

            {/* Separator */}
            <Skeleton className="h-px w-full mb-4" />

            {/* Details Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>

            {/* Capacity Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>

            {/* Action Button */}
            <div className="mt-4 flex justify-end">
              <Skeleton className="h-8 w-28" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}