import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  BarChart3,
  RefreshCw,
  Filter,
  Download,
  Clock,
  MapPin
} from "lucide-react";
import { useState } from "react";

interface StockAlert {
  productId: number;
  sku: string;
  name: string;
  currentStock: number;
  minStock: number;
  maxStock?: number;
  alertType: 'low_stock' | 'critical_stock' | 'overstock' | 'no_movement';
  severity: 'low' | 'medium' | 'high' | 'critical';
  daysUntilStockout?: number;
  location: string;
  lastMovement?: string;
}

interface InventoryStats {
  totalProducts: number;
  totalStockValue: number;
  lowStockCount: number;
  criticalStockCount: number;
  overstockCount: number;
  totalMovements: number;
  avgTurnoverRate: number;
}

interface ABCAnalysis {
  summary: {
    totalProducts: number;
    totalValue: number;
    classA: { count: number; percentage: number; valuePercentage: number };
    classB: { count: number; percentage: number; valuePercentage: number };
    classC: { count: number; percentage: number; valuePercentage: number };
  };
  products: Array<{
    productId: number;
    sku: string;
    name: string;
    classification: 'A' | 'B' | 'C';
    totalMovementValue: number;
    cumulativePercentage: number;
    rank: number;
  }>;
}

export function InventoryDashboard() {
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  // Fetch inventory statistics
  const { data: stats, isLoading: statsLoading } = useQuery<InventoryStats>({
    queryKey: ['/api/inventory/stats', selectedLocation],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch stock alerts
  const { data: alerts, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery<StockAlert[]>({
    queryKey: ['/api/inventory/alerts', selectedLocation],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch ABC analysis
  const { data: abcAnalysis, isLoading: abcLoading } = useQuery<ABCAnalysis>({
    queryKey: ['/api/inventory/abc-analysis', selectedLocation],
    refetchInterval: 24 * 60 * 60 * 1000, // Refresh daily
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchAlerts()]);
    setRefreshing(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'critical_stock': return <AlertTriangle className="h-4 w-4" />;
      case 'low_stock': return <TrendingDown className="h-4 w-4" />;
      case 'overstock': return <TrendingUp className="h-4 w-4" />;
      case 'no_movement': return <Clock className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  if (statsLoading && alertsLoading && abcLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Inventory Dashboard</h1>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Dashboard</h1>
          <p className="text-gray-600">Real-time inventory monitoring and alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProducts?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active products in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Value</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats?.totalStockValue?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Total inventory value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.criticalStockCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Products out of stock
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Turnover</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.avgTurnoverRate?.toFixed(1) || 0}x
            </div>
            <p className="text-xs text-muted-foreground">
              Annual inventory turns
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Stock Alerts</TabsTrigger>
          <TabsTrigger value="abc">ABC Analysis</TabsTrigger>
          <TabsTrigger value="movements">Recent Movements</TabsTrigger>
          <TabsTrigger value="aging">Inventory Aging</TabsTrigger>
        </TabsList>

        {/* Stock Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {alerts && alerts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {alerts.slice(0, 12).map((alert) => (
                <Alert key={`${alert.productId}-${alert.alertType}`} 
                       className={`${alert.severity === 'critical' ? 'border-red-500' : 
                                   alert.severity === 'high' ? 'border-orange-500' : 
                                   'border-yellow-500'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getAlertIcon(alert.alertType)}
                      <div>
                        <div className="font-medium text-sm">{alert.name}</div>
                        <div className="text-xs text-gray-600">SKU: {alert.sku}</div>
                      </div>
                    </div>
                    <Badge variant={getSeverityColor(alert.severity) as any}>
                      {alert.severity}
                    </Badge>
                  </div>
                  
                  <AlertDescription className="mt-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Current Stock:</span>
                        <span className="font-medium">{alert.currentStock}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Min Stock:</span>
                        <span className="font-medium">{alert.minStock}</span>
                      </div>
                      {alert.location && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" />
                          <span>{alert.location}</span>
                        </div>
                      )}
                      {alert.daysUntilStockout && (
                        <div className="text-xs text-red-600 font-medium">
                          Stockout in {alert.daysUntilStockout} days
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Alerts</h3>
                  <p className="text-gray-600">All products are within acceptable stock levels.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ABC Analysis Tab */}
        <TabsContent value="abc" className="space-y-4">
          {abcAnalysis && (
            <div className="space-y-6">
              {/* ABC Summary */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Class A Products</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Products:</span>
                        <span className="font-medium">
                          {abcAnalysis.summary.classA.count} ({abcAnalysis.summary.classA.percentage}%)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Value:</span>
                        <span className="font-medium">
                          {abcAnalysis.summary.classA.valuePercentage}%
                        </span>
                      </div>
                      <Progress value={abcAnalysis.summary.classA.valuePercentage} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Class B Products</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Products:</span>
                        <span className="font-medium">
                          {abcAnalysis.summary.classB.count} ({abcAnalysis.summary.classB.percentage}%)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Value:</span>
                        <span className="font-medium">
                          {abcAnalysis.summary.classB.valuePercentage}%
                        </span>
                      </div>
                      <Progress value={abcAnalysis.summary.classB.valuePercentage} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Class C Products</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Products:</span>
                        <span className="font-medium">
                          {abcAnalysis.summary.classC.count} ({abcAnalysis.summary.classC.percentage}%)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Value:</span>
                        <span className="font-medium">
                          {abcAnalysis.summary.classC.valuePercentage}%
                        </span>
                      </div>
                      <Progress value={abcAnalysis.summary.classC.valuePercentage} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Products Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Top 20 Products by Movement Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Rank</th>
                          <th className="text-left p-2">SKU</th>
                          <th className="text-left p-2">Product Name</th>
                          <th className="text-left p-2">Class</th>
                          <th className="text-right p-2">Movement Value</th>
                          <th className="text-right p-2">Cumulative %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {abcAnalysis.products.slice(0, 20).map((product) => (
                          <tr key={product.productId} className="border-b hover:bg-gray-50">
                            <td className="p-2">{product.rank}</td>
                            <td className="p-2 font-mono">{product.sku}</td>
                            <td className="p-2">{product.name}</td>
                            <td className="p-2">
                              <Badge 
                                variant={product.classification === 'A' ? 'default' : 
                                        product.classification === 'B' ? 'secondary' : 'outline'}
                              >
                                {product.classification}
                              </Badge>
                            </td>
                            <td className="p-2 text-right font-medium">
                              ${product.totalMovementValue.toLocaleString()}
                            </td>
                            <td className="p-2 text-right">
                              {product.cumulativePercentage.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Other tabs would be implemented similarly */}
        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle>Recent Stock Movements</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Stock movements content would go here...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aging">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Aging Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Inventory aging content would go here...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default InventoryDashboard;