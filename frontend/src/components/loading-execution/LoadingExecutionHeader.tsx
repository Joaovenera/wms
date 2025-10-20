
import { Play, CheckCircle } from 'lucide-react';

export const LoadingExecutionHeader = () => (
  <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border border-green-200 shadow-sm">
    <div className="flex items-center gap-4">
      <div className="p-3 bg-white rounded-full shadow-md">
        <Play className="h-8 w-8 text-green-600" />
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-800">Execução de Operações</h1>
        <p className="text-gray-600 mt-1">
          Execute planos aprovados: transferências, chegadas e retiradas com coleta de dados em tempo real.
        </p>
        <div className="flex items-center gap-2 mt-2 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" />
          <span>Fase de Execução - Operações Práticas</span>
        </div>
      </div>
    </div>
  </div>
);
