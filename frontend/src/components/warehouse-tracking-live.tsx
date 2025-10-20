import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MapPin, 
  Activity, 
  TrendingUp, 
  AlertTriangle,
  RefreshCw,
  Thermometer,
  Droplets,
  Package,
  Clock,
  Eye,
  Filter,
  Maximize2,
  Users,
  BarChart3
} from "lucide-react";
import WarehouseMap from "./warehouse-map";

interface WarehouseMetrics {
  totalPositions: number;
  occupiedPositions: number;
  availablePositions: number;
  occupancyRate: number;
  totalUCPs: number;
  totalProducts: number;
  criticalAlerts: number;
  activeMovements: number;
}

interface PositionStatus {
  id: number;
  code: string;
  street: string;
  side: string;
  position: number;
  level: number;
  status: 'disponivel' | 'ocupada' | 'reservada' | 'manutencao' | 'bloqueada';
  ucpId?: number;
  ucpCode?: string;
  productCount?: number;
  lastActivity?: string;
  alertLevel?: 'none' | 'low' | 'medium' | 'high' | 'critical';
  temperature?: number;
  humidity?: number;
}

interface LiveMovement {
  id: number;
  type: 'reception' | 'shipment' | 'transfer' | 'adjustment';
  ucpId?: number;
  ucpCode?: string;
  fromPosition?: string;
  toPosition?: string;
  productName?: string;
  quantity?: number;
  operator?: string;
  startTime: string;
  estimatedCompletion?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  progress?: number;
}

interface WarehouseZone {
  id: string;
  name: string;
  type: 'receiving' | 'storage' | 'shipping' | 'staging' | 'returns';
  occupancyRate: number;
  temperature?: number;
  humidity?: number;
  alertCount: number;
  activeMovements: number;
}

export function WarehouseTrackingLive() {
  const [activeView, setActiveView] = useState<'overview' | 'map' | 'movements' | 'zones'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch warehouse metrics
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<WarehouseMetrics>({
    queryKey: ['/api/warehouse-tracking/metrics'],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Fetch live positions
  const { data: positionsData, isLoading: positionsLoading } = useQuery<{
    positions: PositionStatus[];
    lastUpdated: string;
  }>({
    queryKey: ['/api/warehouse-tracking/positions', selectedZone],
    refetchInterval: autoRefresh ? 15000 : false,
  });

  // Fetch live movements
  const { data: movementsData, isLoading: movementsLoading } = useQuery<{
    movements: LiveMovement[];
    lastUpdated: string;
  }>({
    queryKey: ['/api/warehouse-tracking/movements'],
    refetchInterval: autoRefresh ? 10000 : false,
  });

  // Fetch warehouse zones
  const { data: zonesData, isLoading: zonesLoading } = useQuery<{
    zones: WarehouseZone[];
    lastUpdated: string;
  }>({
    queryKey: ['/api/warehouse-tracking/zones'],
    refetchInterval: autoRefresh ? 60000 : false,
  });

  // WebSocket for real-time updates
  useEffect(() => {
    if (!autoRefresh) return;

    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Handle different types of real-time updates
      switch (data.type) {
        case 'position-status':
        case 'movement-update':
        case 'zone-alert':
          // Trigger a refresh of relevant queries
          refetchMetrics();
          break;
      }
    };

    return () => {
      ws.close();
    };
  }, [autoRefresh, refetchMetrics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchMetrics()]);
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'disponivel': return 'bg-green-100 text-green-800';
      case 'ocupada': return 'bg-red-100 text-red-800';
      case 'reservada': return 'bg-yellow-100 text-yellow-800';
      case 'manutencao': return 'bg-orange-100 text-orange-800';
      case 'bloqueada': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-blue-500 bg-blue-50';
      default: return 'border-gray-200 bg-white';
    }
  };

  const getMovementTypeIcon = (type: string) => {
    switch (type) {
      case 'reception': return <Package className="h-4 w-4 text-green-600" />;
      case 'shipment': return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'transfer': return <RefreshCw className="h-4 w-4 text-purple-600" />;
      case 'adjustment': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  if (metricsLoading && positionsLoading && movementsLoading && zonesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Warehouse Live Tracking</h1>
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
          <h1 className="text-3xl font-bold">Warehouse Live Tracking</h1>
          <p className="text-gray-600">Real-time warehouse monitoring and activity tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Eye className="h-4 w-4 mr-2" />
            {autoRefresh ? 'Live' : 'Paused'}
          </Button>
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
            <Maximize2 className="h-4 w-4 mr-2" />
            Fullscreen
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.occupancyRate || 0}%</div>
            <Progress value={metrics?.occupancyRate || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.occupiedPositions || 0} of {metrics?.totalPositions || 0} positions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active UCPs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalUCPs?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.totalProducts?.toLocaleString() || 0} unique products
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
              {metrics?.criticalAlerts || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requiring immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Live Movements</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {metrics?.activeMovements || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Operations in progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeView} onValueChange={(value: any) => setActiveView(value)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="map">Warehouse Map</TabsTrigger>
          <TabsTrigger value="movements">Live Movements</TabsTrigger>
          <TabsTrigger value="zones">Zones</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Critical Positions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
                  Critical Positions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {positionsData?.positions
                    .filter(p => p.alertLevel === 'critical' || p.alertLevel === 'high')
                    .slice(0, 5)
                    .map((position) => (
                      <div key={position.id} className={`p-3 rounded-lg border ${getAlertColor(position.alertLevel || 'none')}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{position.code}</div>
                            <div className="text-sm text-gray-600">
                              Street {position.street} • Level {position.level}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(position.status)}>
                              {position.status}
                            </Badge>
                            {position.temperature && (
                              <div className="flex items-center text-sm text-gray-500">
                                <Thermometer className="h-3 w-3 mr-1" />
                                {position.temperature}°C
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  
                  {(!positionsData?.positions || 
                    positionsData.positions.filter(p => p.alertLevel === 'critical' || p.alertLevel === 'high').length === 0) && (
                    <div className="text-center py-4 text-gray-500">
                      <AlertTriangle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <p>No critical alerts</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Zone Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-blue-600" />
                  Zone Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {zonesData?.zones.map((zone) => (
                    <div key={zone.id} className="p-3 rounded-lg border bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{zone.name}</div>
                        <Badge variant="outline" className="capitalize">
                          {zone.type}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-gray-500">Occupancy</div>
                          <div className="font-medium">{zone.occupancyRate}%</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Alerts</div>
                          <div className={`font-medium ${zone.alertCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {zone.alertCount}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Active</div>
                          <div className="font-medium text-blue-600">{zone.activeMovements}</div>
                        </div>
                      </div>
                      
                      <Progress value={zone.occupancyRate} className="mt-2 h-1" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2 text-purple-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {movementsData?.movements.slice(0, 8).map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      {getMovementTypeIcon(movement.type)}
                      <div>
                        <div className="font-medium">
                          {movement.type.charAt(0).toUpperCase() + movement.type.slice(1)}
                          {movement.ucpCode && ` - ${movement.ucpCode}`}
                        </div>
                        <div className="text-sm text-gray-600">
                          {movement.fromPosition && `From ${movement.fromPosition}`}
                          {movement.toPosition && ` To ${movement.toPosition}`}
                          {movement.operator && ` • ${movement.operator}`}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {movement.progress !== undefined && (
                        <div className="w-20">
                          <Progress value={movement.progress} className="h-2" />
                        </div>
                      )}
                      <Badge variant={
                        movement.status === 'completed' ? 'default' :
                        movement.status === 'in_progress' ? 'secondary' :
                        movement.status === 'cancelled' ? 'destructive' : 'outline'
                      }>
                        {movement.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
                
                {(!movementsData?.movements || movementsData.movements.length === 0) && (
                  <div className="text-center py-6 text-gray-500">
                    <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p>No recent activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warehouse Map Tab */}
        <TabsContent value="map">
          <WarehouseMap />
        </TabsContent>

        {/* Live Movements Tab */}
        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-blue-600" />
                  Live Movements
                </CardTitle>
                <div className="text-sm text-gray-500">
                  Last updated: {movementsData?.lastUpdated ? new Date(movementsData.lastUpdated).toLocaleTimeString() : 'Never'}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">UCP</th>
                      <th className="text-left p-2">From → To</th>
                      <th className="text-left p-2">Product</th>
                      <th className="text-left p-2">Operator</th>
                      <th className="text-left p-2">Progress</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementsData?.movements.map((movement) => (
                      <tr key={movement.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            {getMovementTypeIcon(movement.type)}
                            <span className="capitalize">{movement.type}</span>
                          </div>
                        </td>
                        <td className="p-2 font-mono">{movement.ucpCode || '-'}</td>
                        <td className="p-2">
                          <div className="text-xs">
                            {movement.fromPosition && <div>From: {movement.fromPosition}</div>}
                            {movement.toPosition && <div>To: {movement.toPosition}</div>}
                            {!movement.fromPosition && !movement.toPosition && '-'}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs">
                            {movement.productName && <div>{movement.productName}</div>}
                            {movement.quantity && <div>Qty: {movement.quantity}</div>}
                          </div>
                        </td>
                        <td className="p-2">{movement.operator || '-'}</td>
                        <td className="p-2">
                          {movement.progress !== undefined ? (
                            <div className="w-20">
                              <Progress value={movement.progress} className="h-2" />
                              <div className="text-xs text-center mt-1">{movement.progress}%</div>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="p-2">
                          <Badge variant={
                            movement.status === 'completed' ? 'default' :
                            movement.status === 'in_progress' ? 'secondary' :
                            movement.status === 'cancelled' ? 'destructive' : 'outline'
                          }>
                            {movement.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="p-2 text-xs">
                          {new Date(movement.startTime).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Zones Tab */}
        <TabsContent value="zones">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {zonesData?.zones.map((zone) => (
              <Card key={zone.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{zone.name}</CardTitle>
                    <Badge variant="outline" className="capitalize">
                      {zone.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Occupancy Rate</span>
                        <span className="font-medium">{zone.occupancyRate}%</span>
                      </div>
                      <Progress value={zone.occupancyRate} className="h-2" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Temperature</div>
                        <div className="flex items-center font-medium">
                          <Thermometer className="h-3 w-3 mr-1" />
                          {zone.temperature?.toFixed(1) || 'N/A'}°C
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Humidity</div>
                        <div className="flex items-center font-medium">
                          <Droplets className="h-3 w-3 mr-1" />
                          {zone.humidity || 'N/A'}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Alerts</div>
                        <div className={`font-medium ${zone.alertCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {zone.alertCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Active Movements</div>
                        <div className="font-medium text-blue-600">{zone.activeMovements}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default WarehouseTrackingLive;