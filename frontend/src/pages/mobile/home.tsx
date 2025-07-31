import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, History, Clock, TrendingUp } from "lucide-react";
import { Link } from "wouter";

interface DashboardStats {
  totalPallets: number;
  activeUcps: number;
  occupancyRate: number;
  dailyMovements: number;
}

export default function MobileHome() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <section>
        <h2 className="text-lg font-medium text-gray-800 mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-2 gap-4">
          {/* QR Scanner */}
          <Link href="/scanner">
            <div className="qr-scanner rounded-xl p-6 text-white text-center cursor-pointer">
              <QrCode className="h-8 w-8 mx-auto mb-3" />
              <h3 className="font-medium">Escanear QR</h3>
              <p className="text-sm opacity-90">Código ou Posição</p>
            </div>
          </Link>
          
          {/* Recent Activity */}
          <div className="bg-white rounded-xl p-6 shadow-md border text-center">
            <History className="h-8 w-8 text-gray-600 mx-auto mb-3" />
            <h3 className="font-medium text-gray-800">Recentes</h3>
            <p className="text-sm text-gray-600">Últimas ações</p>
          </div>
        </div>
      </section>

      {/* Current Tasks */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-800">Tarefas Pendentes</h2>
          <Badge variant="secondary">3</Badge>
        </div>
        
        <div className="space-y-3">
          {/* Task Item */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800">Recebimento - Nota 12345</h3>
                  <p className="text-sm text-gray-600 mt-1">15 itens para conferir</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="outline" className="text-warning border-warning">
                      Pendente
                    </Badge>
                    <span className="text-xs text-gray-500 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      há 2h
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Item */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800">Separação - Pedido 67890</h3>
                  <p className="text-sm text-gray-600 mt-1">8 itens para separar</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="outline" className="text-success border-success">
                      Em andamento
                    </Badge>
                    <span className="text-xs text-gray-500 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      há 30min
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Item */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800">Inventário - Setor A</h3>
                  <p className="text-sm text-gray-600 mt-1">25 posições para conferir</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="outline" className="text-primary border-primary">
                      Agendado
                    </Badge>
                    <span className="text-xs text-gray-500 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      há 1h
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Quick Stats */}
      <section>
        <h2 className="text-lg font-medium text-gray-800 mb-4">Status do Estoque</h2>
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-success">{stats?.occupancyRate || 0}%</div>
              <div className="text-xs text-gray-600 mt-1">Ocupação</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{stats?.activeUcps?.toLocaleString() || 0}</div>
              <div className="text-xs text-gray-600 mt-1">UCPs Ativas</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-secondary">{stats?.dailyMovements || 0}</div>
              <div className="text-xs text-gray-600 mt-1">Movimentações</div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="text-lg font-medium text-gray-800 mb-4">Atividade Recente</h2>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-success/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-4 w-4 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">Recebimento concluído</p>
                  <p className="text-xs text-gray-600">UCP-20250623-0045 em RUA02-E-A03-N01</p>
                  <p className="text-xs text-gray-500 mt-1">há 5 minutos</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <QrCode className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">QR Code escaneado</p>
                  <p className="text-xs text-gray-600">Posição RUA01-D-A12-N02 verificada</p>
                  <p className="text-xs text-gray-500 mt-1">há 12 minutos</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
