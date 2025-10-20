
import { Truck, User, Badge } from 'lucide-react';

interface LoadingExecutionScreenHeaderProps {
  transferRequestCode: string;
  operatorName: string;
  status: string;
}

export const LoadingExecutionScreenHeader = ({ transferRequestCode, operatorName, status }: LoadingExecutionScreenHeaderProps) => (
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Truck className="h-6 w-6" />
        Execução: {transferRequestCode}
      </h2>
      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
        <User className="h-4 w-4" />
        {operatorName}
      </p>
    </div>
    <Badge variant={status === 'em_andamento' ? 'default' : 'secondary'}>
      {status === 'em_andamento' ? 'Em Andamento' : 'Finalizado'}
    </Badge>
  </div>
);
