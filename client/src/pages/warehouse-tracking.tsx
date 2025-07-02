import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MapPin, 
  Activity, 
  Package, 
  Navigation,
  BarChart3,
  Eye,
  Settings,
  RefreshCw,
  Zap
} from "lucide-react";
import WarehouseMapEnhanced from "@/components/warehouse-map-enhanced";
import { useAuth } from "@/hooks/useAuth";

export default function WarehouseTracking() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState("realtime");

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
              <p className="text-gray-600 mb-4">
                Faça login para acessar o sistema de rastreamento do armazém.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Rastreamento em Tempo Real
                  </h1>
                  <p className="text-sm text-gray-500">
                    Visualização e monitoramento de UCPs no armazém
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                Sistema Online
              </Badge>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Configurações
              </Button>
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Monitoramento</p>
                  <p className="text-2xl font-bold">Ativo</p>
                  <p className="text-blue-100 text-sm mt-1">
                    <Eye className="inline w-4 h-4 mr-1" />
                    Tempo real
                  </p>
                </div>
                <div className="bg-blue-400 p-3 rounded-full bg-opacity-30">
                  <Activity className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">UCPs Ativas</p>
                  <p className="text-2xl font-bold">--</p>
                  <p className="text-green-100 text-sm mt-1">
                    <Package className="inline w-4 h-4 mr-1" />
                    Em operação
                  </p>
                </div>
                <div className="bg-green-400 p-3 rounded-full bg-opacity-30">
                  <Package className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Movimentos</p>
                  <p className="text-2xl font-bold">--</p>
                  <p className="text-purple-100 text-sm mt-1">
                    <Navigation className="inline w-4 h-4 mr-1" />
                    Últimas 24h
                  </p>
                </div>
                <div className="bg-purple-400 p-3 rounded-full bg-opacity-30">
                  <Navigation className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Alertas</p>
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-orange-100 text-sm mt-1">
                    <Zap className="inline w-4 h-4 mr-1" />
                    Sem pendências
                  </p>
                </div>
                <div className="bg-orange-400 p-3 rounded-full bg-opacity-30">
                  <Zap className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View Selector */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Modo de Visualização</CardTitle>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Atualização automática ativa</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="realtime" className="flex items-center space-x-2">
                  <Activity className="w-4 h-4" />
                  <span>Tempo Real</span>
                </TabsTrigger>
                <TabsTrigger value="tracking" className="flex items-center space-x-2">
                  <Navigation className="w-4 h-4" />
                  <span>Rastreamento</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4" />
                  <span>Análise</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="realtime" className="mt-6">
                <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border-l-4 border-blue-500 mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Monitoramento Ativo</h3>
                      <p className="text-sm text-gray-600">
                        Visualização em tempo real das posições e movimentações de UCPs no armazém.
                        Dados atualizados automaticamente a cada 10 segundos.
                      </p>
                    </div>
                  </div>
                </div>
                <WarehouseMapEnhanced />
              </TabsContent>

              <TabsContent value="tracking" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Rastreamento de Movimentos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Navigation className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Rastreamento Avançado
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Funcionalidade em desenvolvimento - rastreamento detalhado de movimentos e histórico de posições.
                      </p>
                      <Badge variant="outline">Em breve</Badge>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Análise de Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Análise Avançada
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Funcionalidade em desenvolvimento - relatórios de performance, heatmaps e análise de fluxo.
                      </p>
                      <Badge variant="outline">Em breve</Badge>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}