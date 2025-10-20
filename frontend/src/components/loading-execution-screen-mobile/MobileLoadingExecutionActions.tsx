
import { TouchOptimizedButton } from "@/components/mobile/TouchOptimizedControls";
import { Camera, CheckSquare } from "lucide-react";

interface MobileLoadingExecutionActionsProps {
  onScan: () => void;
  onFinish: () => void;
  canFinish: boolean;
  isFinishing: boolean;
}

export const MobileLoadingExecutionActions = ({ onScan, onFinish, canFinish, isFinishing }: MobileLoadingExecutionActionsProps) => (
  <div className="grid grid-cols-2 gap-3">
    <TouchOptimizedButton onClick={onScan} className="bg-primary hover:bg-primary/90 text-white" size="lg">
      <Camera className="h-5 w-5 mr-2" />
      Scanner
    </TouchOptimizedButton>
    <TouchOptimizedButton
      variant="destructive"
      onClick={onFinish}
      disabled={!canFinish || isFinishing}
      size="lg"
    >
      <CheckSquare className="h-5 w-5 mr-2" />
      Finalizar
    </TouchOptimizedButton>
  </div>
);
