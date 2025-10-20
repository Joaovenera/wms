import { useLocation } from "wouter";
import { LoadingExecutionScreenMobile } from "@/components/loading-execution-screen-mobile";

export default function MobileLoadingExecutionPage() {
  const [, setLocation] = useLocation();
  const match = window.location.pathname.match(/\/loading-execution\/(\d+)/);
  const executionId = match ? parseInt(match[1]) : NaN;

  if (!executionId) {
    setLocation("/");
    return null;
  }

  return (
    <div className="p-4">
      <LoadingExecutionScreenMobile 
        executionId={executionId} 
        onExecutionComplete={() => setLocation("/")}
      />
    </div>
  );
}









