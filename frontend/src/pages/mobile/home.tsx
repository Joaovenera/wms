import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, History, Clock, TrendingUp, Package, Package2 } from "lucide-react";
import { Link } from "wouter";

interface DashboardStats {
  totalPallets: number;
  activeUcps: number;
  occupancyRate: number;
  dailyMovements: number;
}

interface LoadingExecutionSummary {
  id: number;
  status: string;
  startedAt: string;
  transferRequestId: number;
  transferRequestCode: string;
  operatorName?: string;
}

interface MovementRecord {
  id: number;
  type: string;
  ucpId?: number;
  productId?: number;
  fromPositionId?: number;
  toPositionId?: number;
  quantity?: string;
  lot?: string;
  reason?: string;
  performedBy: number;
  createdAt: string;
}

export default function MobileHome() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  const { data: pendingExecutions } = useQuery<LoadingExecutionSummary[]>({
    queryKey: ['/api/loading-executions/pending'],
  });

  const { data: recentMovements } = useQuery<MovementRecord[]>({
    queryKey: ['/api/movements?limit=5'],
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
          
          {/* Paletes */}
          <Link href="/pallets">
            <div className="bg-white rounded-xl p-6 shadow-md border text-center cursor-pointer">
              <Package className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-medium text-gray-800">Paletes</h3>
              <p className="text-sm text-gray-600">Consultar e gerenciar</p>
            </div>
          </Link>

          {/* Produtos */}
          <Link href="/products">
            <div className="bg-white rounded-xl p-6 shadow-md border text-center cursor-pointer">
              <Package2 className="h-8 w-8 text-secondary mx-auto mb-3" />
              <h3 className="font-medium text-gray-800">Produtos</h3>
              <p className="text-sm text-gray-600">Catálogo e busca</p>
            </div>
          </Link>

          {/* Atividade Recente */}
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
          <Badge variant="secondary">{pendingExecutions?.length ?? 0}</Badge>
        </div>
        
        <div className="space-y-3">
          {(pendingExecutions ?? []).map((exe) => (
            <Card key={exe.id} onClick={() => (window.location.href = `/loading-execution/${exe.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800">Carregamento {exe.transferRequestCode}</h3>
                    <p className="text-sm text-gray-600 mt-1">Operador: {exe.operatorName || '—'}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge variant="outline" className="text-success border-success">
                        {exe.status === 'em_andamento' ? 'Em andamento' : exe.status}
                      </Badge>
                      <span className="text-xs text-gray-500 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(exe.startedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!pendingExecutions?.length && (
            <Card>
              <CardContent className="p-4 text-sm text-gray-600">Sem execuções pendentes</CardContent>
            </Card>
          )}
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
              {(recentMovements ?? []).map((m) => (
                <div key={m.id} className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-success/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-4 w-4 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{m.type}</p>
                    <p className="text-xs text-gray-600">UCP {m.ucpId ?? '—'} • Prod {m.productId ?? '—'}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {!recentMovements?.length && (
                <div className="text-sm text-gray-600">Sem movimentos recentes</div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
