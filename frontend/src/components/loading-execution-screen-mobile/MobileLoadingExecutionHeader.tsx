
import { Badge } from "@/components/ui/badge";

interface MobileLoadingExecutionHeaderProps {
  transferRequestCode: string;
  operatorName: string;
  status: string;
}

export const MobileLoadingExecutionHeader = ({ transferRequestCode, operatorName, status }: MobileLoadingExecutionHeaderProps) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <h2 className="text-lg font-semibold">{transferRequestCode}</h2>
      <Badge variant={status === 'em_andamento' ? 'default' : 'secondary'}>
        {status === 'em_andamento' ? 'Em Andamento' : 'Finalizado'}
      </Badge>
    </div>
    <p className="text-sm text-gray-600">Operador: {operatorName}</p>
  </div>
);
