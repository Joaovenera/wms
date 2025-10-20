import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Package, 
  Search, 
  Plus, 
  Edit, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  History,
  Download,
  Upload,
  RefreshCw
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import InventoryDashboard from "@/components/inventory-dashboard";

interface Product {
  id: number;
  sku: string;
  name: string;
  currentStock: number;
  availableStock: number;
  reservedStock: number;
  minStock: number;
  maxStock: number;
  stockStatus: 'ok' | 'low' | 'critical' | 'overstock';
  locations: string;
  lastMovement?: string;
  unit: string;
}

interface StockMovement {
  id: number;
  productId: number;
  type: 'in' | 'out' | 'transfer' | 'adjustment';
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  reference: string;
  reason: string;
  performedBy: string;
  createdAt: string;
}

interface InventoryAdjustment {
  productId: number;
  currentQuantity: number;
  adjustedQuantity: number;
  reason: string;
  notes?: string;
  locationId?: number;
}

export default function Inventory() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustmentData, setAdjustmentData] = useState<InventoryAdjustment>({
    productId: 0,
    currentQuantity: 0,
    adjustedQuantity: 0,
    reason: "",
    notes: ""
  });

  const queryClient = useQueryClient();

  // Fetch stock levels
  const { data: stockLevels, isLoading: stockLoading } = useQuery<{
    items: Product[];
    pagination: { total: number; page: number; limit: number };
  }>({
    queryKey: ['/api/inventory/stock-levels', { search: searchTerm, status: statusFilter }],
    enabled: activeTab === "stock-levels",
  });

  // Fetch stock movements
  const { data: movements, isLoading: movementsLoading } = useQuery<{
    items: StockMovement[];
    pagination: { total: number; page: number; limit: number };
  }>({
    queryKey: ['/api/inventory/movements'],
    enabled: activeTab === "movements",
  });

  // Create inventory adjustment mutation
  const adjustmentMutation = useMutation({
    mutationFn: async (adjustment: InventoryAdjustment) => {
      const response = await fetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustment)
      });
      if (!response.ok) throw new Error('Failed to create adjustment');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Inventory adjustment created successfully",
      });
      setShowAdjustmentDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/stock-levels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/movements'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleAdjustment = (product: Product) => {
    setSelectedProduct(product);
    setAdjustmentData({
      productId: product.id,
      currentQuantity: product.currentStock,
      adjustedQuantity: product.currentStock,
      reason: "",
      notes: ""
    });
    setShowAdjustmentDialog(true);
  };

  const submitAdjustment = () => {
    if (adjustmentData.adjustedQuantity === adjustmentData.currentQuantity) {
      toast({
        title: "No Changes",
        description: "No adjustment needed - quantities are the same",
        variant: "destructive",
      });
      return;
    }

    if (!adjustmentData.reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for the adjustment",
        variant: "destructive",
      });
      return;
    }

    adjustmentMutation.mutate(adjustmentData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'destructive';
      case 'low': return 'destructive';
      case 'overstock': return 'secondary';
      case 'ok': return 'default';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'low': return <TrendingDown className="h-4 w-4 text-orange-500" />;
      case 'overstock': return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'ok': return <Package className="h-4 w-4 text-green-500" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const filteredStockLevels = stockLevels?.items.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || product.stockStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-gray-600">Monitor stock levels, manage adjustments, and track movements</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="stock-levels">Stock Levels</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
        </Tabs>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard">
          <InventoryDashboard />
        </TabsContent>

        {/* Stock Levels Tab */}
        <TabsContent value="stock-levels" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-sm">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ok">Normal</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="overstock">Overstock</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Stock Levels Table */}
          {stockLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredStockLevels?.map((product) => (
                <Card key={product.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(product.stockStatus)}
                        <div>
                          <CardTitle className="text-base">{product.name}</CardTitle>
                          <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                        </div>
                      </div>
                      <Badge variant={getStatusColor(product.stockStatus) as any}>
                        {product.stockStatus}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Current Stock</p>
                          <p className="font-semibold text-lg">{product.currentStock} {product.unit}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Available</p>
                          <p className="font-semibold text-lg text-green-600">{product.availableStock} {product.unit}</p>
                        </div>
                      </div>
                      
                      {product.reservedStock > 0 && (
                        <div className="text-sm">
                          <p className="text-gray-500">Reserved: <span className="font-medium text-orange-600">{product.reservedStock} {product.unit}</span></p>
                        </div>
                      )}
                      
                      <div className="text-sm border-t pt-2">
                        <p className="text-gray-500">Min: {product.minStock} | Max: {product.maxStock || 'N/A'}</p>
                        {product.locations && (
                          <p className="text-gray-500">Locations: {product.locations}</p>
                        )}
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAdjustment(product)}
                          className="flex-1"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Adjust
                        </Button>
                        <Button variant="outline" size="sm">
                          <History className="h-3 w-3 mr-1" />
                          History
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Movements Tab */}
        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Stock Movements</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {movementsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Product</th>
                        <th className="text-right p-2">Quantity</th>
                        <th className="text-left p-2">From</th>
                        <th className="text-left p-2">To</th>
                        <th className="text-left p-2">Reference</th>
                        <th className="text-left p-2">Reason</th>
                        <th className="text-left p-2">User</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements?.items.map((movement) => (
                        <tr key={movement.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">{new Date(movement.createdAt).toLocaleDateString()}</td>
                          <td className="p-2">
                            <Badge variant={
                              movement.type === 'in' ? 'default' :
                              movement.type === 'out' ? 'destructive' :
                              movement.type === 'transfer' ? 'secondary' : 'outline'
                            }>
                              {movement.type}
                            </Badge>
                          </td>
                          <td className="p-2">Product #{movement.productId}</td>
                          <td className="p-2 text-right font-medium">{movement.quantity}</td>
                          <td className="p-2">{movement.fromLocation || '-'}</td>
                          <td className="p-2">{movement.toLocation || '-'}</td>
                          <td className="p-2 font-mono">{movement.reference}</td>
                          <td className="p-2">{movement.reason}</td>
                          <td className="p-2">{movement.performedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Adjustments Tab */}
        <TabsContent value="adjustments">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Adjustments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Adjustment history and management would go here...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjustment Dialog */}
      <Dialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inventory Adjustment</DialogTitle>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-medium">{selectedProduct.name}</h4>
                <p className="text-sm text-gray-600">SKU: {selectedProduct.sku}</p>
                <p className="text-sm">Current Stock: <strong>{selectedProduct.currentStock} {selectedProduct.unit}</strong></p>
              </div>

              <div className="space-y-2">
                <Label>New Quantity</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={adjustmentData.adjustedQuantity}
                  onChange={(e) => setAdjustmentData(prev => ({
                    ...prev,
                    adjustedQuantity: parseFloat(e.target.value) || 0
                  }))}
                />
                <div className="text-sm text-gray-600">
                  Difference: {(adjustmentData.adjustedQuantity - adjustmentData.currentQuantity).toFixed(3)} {selectedProduct.unit}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={adjustmentData.reason} onValueChange={(value) => 
                  setAdjustmentData(prev => ({ ...prev, reason: value }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cycle_count">Cycle Count</SelectItem>
                    <SelectItem value="physical_inventory">Physical Inventory</SelectItem>
                    <SelectItem value="damage">Damaged Goods</SelectItem>
                    <SelectItem value="expiry">Expired Products</SelectItem>
                    <SelectItem value="shrinkage">Shrinkage</SelectItem>
                    <SelectItem value="found_stock">Found Stock</SelectItem>
                    <SelectItem value="system_error">System Error Correction</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={adjustmentData.notes}
                  onChange={(e) => setAdjustmentData(prev => ({
                    ...prev,
                    notes: e.target.value
                  }))}
                  placeholder="Additional details about the adjustment..."
                  rows={3}
                />
              </div>

              {Math.abs(adjustmentData.adjustedQuantity - adjustmentData.currentQuantity) > selectedProduct.currentStock * 0.2 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Large adjustment detected (>20% change). Please verify the quantities are correct.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAdjustmentDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={submitAdjustment}
              disabled={adjustmentMutation.isPending}
            >
              {adjustmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Create Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}