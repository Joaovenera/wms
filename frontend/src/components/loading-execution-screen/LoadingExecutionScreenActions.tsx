
import { Button } from "@/components/ui/button";
import { Camera, CheckSquare, Package } from "lucide-react";

interface LoadingExecutionScreenActionsProps {
  onScan: () => void;
  onFinish: () => void;
  onRefresh: () => void;
  canFinish: boolean;
  isFinishing: boolean;
}

export const LoadingExecutionScreenActions = ({ onScan, onFinish, onRefresh, canFinish, isFinishing }: LoadingExecutionScreenActionsProps) => (
  <div className="flex gap-3">
    <Button onClick={onScan} className="flex-1 flex items-center gap-2">
      <Camera className="h-4 w-4" />
      Scanner
    </Button>
    <Button onClick={onRefresh} variant="outline" className="flex-1 flex items-center gap-2">
      <Package className="h-4 w-4" />
      Atualizar
    </Button>
    <Button
      onClick={onFinish}
      variant="destructive"
      disabled={!canFinish || isFinishing}
      className="flex-1 flex items-center gap-2"
    >
      <CheckSquare className="h-4 w-4" />
      Finalizar
    </Button>
  </div>
);
