
interface LoadingExecutionScreenStatsProps {
  completed: number;
  total: number;
  percentage: number;
}

export const LoadingExecutionScreenStats = ({ completed, total, percentage }: LoadingExecutionScreenStatsProps) => (
  <div>
    <div className="flex justify-between text-sm mb-1">
      <span>Progresso</span>
      <span className="font-semibold">{percentage.toFixed(0)}%</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
    </div>
    <p className="text-xs text-gray-500 text-center mt-1">
      {completed} de {total} itens processados
    </p>
  </div>
);
