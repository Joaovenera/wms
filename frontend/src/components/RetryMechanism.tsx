import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";

interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
  onSuccess?: (result: any, attempt: number) => void;
  onFailure?: (error: any, attempts: number) => void;
}

interface RetryState {
  isRetrying: boolean;
  currentAttempt: number;
  maxAttempts: number;
  lastError: any;
  nextRetryIn: number;
  hasExhaustedRetries: boolean;
}

class RetryManager {
  private timeoutId: NodeJS.Timeout | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
    onStateChange?: (state: RetryState) => void
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
      retryCondition = () => true,
      onRetry,
      onSuccess,
      onFailure,
    } = options;

    let currentAttempt = 0;
    let lastError: any;

    while (currentAttempt < maxAttempts) {
      try {
        const result = await operation();
        onSuccess?.(result, currentAttempt + 1);
        
        onStateChange?.({
          isRetrying: false,
          currentAttempt: currentAttempt + 1,
          maxAttempts,
          lastError: null,
          nextRetryIn: 0,
          hasExhaustedRetries: false,
        });

        return result;
      } catch (error) {
        currentAttempt++;
        lastError = error;

        const shouldRetry = currentAttempt < maxAttempts && retryCondition(error);
        
        if (!shouldRetry) {
          onFailure?.(error, currentAttempt);
          
          onStateChange?.({
            isRetrying: false,
            currentAttempt,
            maxAttempts,
            lastError: error,
            nextRetryIn: 0,
            hasExhaustedRetries: currentAttempt >= maxAttempts,
          });

          throw error;
        }

        onRetry?.(currentAttempt, error);

        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelay * Math.pow(backoffMultiplier, currentAttempt - 1),
          maxDelay
        );

        // Update state with countdown
        let remainingTime = delay;
        onStateChange?.({
          isRetrying: true,
          currentAttempt,
          maxAttempts,
          lastError: error,
          nextRetryIn: remainingTime,
          hasExhaustedRetries: false,
        });

        // Countdown timer
        this.intervalId = setInterval(() => {
          remainingTime -= 100;
          if (remainingTime <= 0) {
            if (this.intervalId) {
              clearInterval(this.intervalId);
            }
            return;
          }
          
          onStateChange?.({
            isRetrying: true,
            currentAttempt,
            maxAttempts,
            lastError: error,
            nextRetryIn: remainingTime,
            hasExhaustedRetries: false,
          });
        }, 100);

        // Wait for delay
        await new Promise((resolve) => {
          this.timeoutId = setTimeout(resolve, delay);
        });

        if (this.intervalId) {
          clearInterval(this.intervalId);
        }
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError;
  }

  cancel() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

interface RetryComponentProps {
  operation: () => Promise<any>;
  options?: RetryOptions;
  trigger?: React.ReactNode;
  showProgress?: boolean;
  autoStart?: boolean;
  onResult?: (result: any) => void;
  onError?: (error: any) => void;
}

export function RetryComponent({
  operation,
  options = {},
  trigger,
  showProgress = true,
  autoStart = false,
  onResult,
  onError,
}: RetryComponentProps) {
  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    currentAttempt: 0,
    maxAttempts: options.maxAttempts || 3,
    lastError: null,
    nextRetryIn: 0,
    hasExhaustedRetries: false,
  });

  const [result, setResult] = useState<any>(null);
  const retryManagerRef = useRef<RetryManager>();

  if (!retryManagerRef.current) {
    retryManagerRef.current = new RetryManager();
  }

  const executeOperation = useCallback(async () => {
    try {
      setResult(null);
      const operationResult = await retryManagerRef.current!.executeWithRetry(
        operation,
        {
          ...options,
          onSuccess: (result, attempt) => {
            setResult(result);
            onResult?.(result);
            options.onSuccess?.(result, attempt);
          },
          onFailure: (error, attempts) => {
            onError?.(error);
            options.onFailure?.(error, attempts);
          },
        },
        setState
      );
      setResult(operationResult);
    } catch (error) {
      console.error('Operation failed after all retries:', error);
    }
  }, [operation, options, onResult, onError]);

  const cancelOperation = useCallback(() => {
    retryManagerRef.current!.cancel();
    setState(prev => ({
      ...prev,
      isRetrying: false,
      nextRetryIn: 0,
    }));
  }, []);

  useEffect(() => {
    if (autoStart) {
      executeOperation();
    }
  }, [autoStart, executeOperation]);

  useEffect(() => {
    return () => {
      retryManagerRef.current?.cancel();
    };
  }, []);

  const getErrorType = (error: any): string => {
    if (!error) return 'unknown';
    if (error.name === 'NetworkError' || error.message?.includes('network')) return 'network';
    if (error.name === 'TimeoutError' || error.message?.includes('timeout')) return 'timeout';
    if (error.status >= 500) return 'server';
    if (error.status >= 400) return 'client';
    return 'unknown';
  };

  const getErrorMessage = (error: any): string => {
    const errorType = getErrorType(error);
    switch (errorType) {
      case 'network':
        return 'Problema de conexão. Verificando rede...';
      case 'timeout':
        return 'Operação demorou mais que o esperado. Tentando novamente...';
      case 'server':
        return 'Erro no servidor. Aguardando e tentando novamente...';
      case 'client':
        return 'Erro na requisição. Verificando dados...';
      default:
        return error.message || 'Erro desconhecido. Tentando novamente...';
    }
  };

  const progressPercentage = state.maxAttempts > 0 
    ? (state.currentAttempt / state.maxAttempts) * 100 
    : 0;

  const countdownPercentage = state.nextRetryIn > 0 
    ? ((options.initialDelay || 1000) - state.nextRetryIn) / (options.initialDelay || 1000) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* Trigger Button */}
      {trigger ? (
        <div onClick={executeOperation}>{trigger}</div>
      ) : (
        <Button
          onClick={executeOperation}
          disabled={state.isRetrying}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${state.isRetrying ? 'animate-spin' : ''}`} />
          {state.isRetrying ? 'Tentando...' : 'Executar'}
        </Button>
      )}

      {/* Progress and Status */}
      {showProgress && (state.isRetrying || state.hasExhaustedRetries || state.lastError) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                {state.isRetrying ? (
                  <>
                    <Clock className="w-4 h-4 animate-pulse" />
                    Tentativa {state.currentAttempt} de {state.maxAttempts}
                  </>
                ) : state.hasExhaustedRetries ? (
                  <>
                    <XCircle className="w-4 h-4 text-red-500" />
                    Tentativas Esgotadas
                  </>
                ) : result ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Sucesso
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    Aguardando
                  </>
                )}
              </CardTitle>
              
              {state.isRetrying && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelOperation}
                  className="h-6 px-2 text-xs"
                >
                  Cancelar
                </Button>
              )}
            </div>
            
            {state.lastError && (
              <CardDescription className="text-xs">
                {getErrorMessage(state.lastError)}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="pt-0">
            {/* Attempt Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Progresso das tentativas</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} className="h-1" />
            </div>

            {/* Countdown */}
            {state.nextRetryIn > 0 && (
              <div className="space-y-2 mt-3">
                <div className="flex justify-between text-xs">
                  <span>Próxima tentativa em</span>
                  <span>{(state.nextRetryIn / 1000).toFixed(1)}s</span>
                </div>
                <Progress value={countdownPercentage} className="h-1" />
              </div>
            )}

            {/* Error Details */}
            {state.lastError && (
              <Alert className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <div className="space-y-1">
                    <p><strong>Erro:</strong> {getErrorMessage(state.lastError)}</p>
                    {process.env.NODE_ENV === 'development' && (
                      <details>
                        <summary className="cursor-pointer">Detalhes técnicos</summary>
                        <pre className="text-xs mt-1 whitespace-pre-wrap">
                          {JSON.stringify(state.lastError, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Success Result */}
            {result && !state.isRetrying && (
              <Alert className="mt-3 border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-xs text-green-800">
                  Operação executada com sucesso após {state.currentAttempt} tentativa(s).
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Hook for using retry mechanism
export function useRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
) {
  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    currentAttempt: 0,
    maxAttempts: options.maxAttempts || 3,
    lastError: null,
    nextRetryIn: 0,
    hasExhaustedRetries: false,
  });

  const retryManagerRef = useRef<RetryManager>();

  if (!retryManagerRef.current) {
    retryManagerRef.current = new RetryManager();
  }

  const execute = useCallback(async (): Promise<T> => {
    return retryManagerRef.current!.executeWithRetry(operation, options, setState);
  }, [operation, options]);

  const cancel = useCallback(() => {
    retryManagerRef.current!.cancel();
    setState(prev => ({
      ...prev,
      isRetrying: false,
      nextRetryIn: 0,
    }));
  }, []);

  useEffect(() => {
    return () => {
      retryManagerRef.current?.cancel();
    };
  }, []);

  return {
    execute,
    cancel,
    state,
  };
}

// Utility function for common retry scenarios
export const retryPresets = {
  // Quick retries for UI operations
  ui: {
    maxAttempts: 2,
    initialDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
  },
  
  // Network operations
  network: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryCondition: (error: any) => {
      // Only retry on network errors or 5xx status codes
      return error.name === 'NetworkError' || 
             error.message?.includes('network') ||
             (error.status >= 500 && error.status < 600);
    },
  },
  
  // Background operations
  background: {
    maxAttempts: 5,
    initialDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  },
  
  // Critical operations
  critical: {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 60000,
    backoffMultiplier: 1.5,
  },
};

export default RetryComponent;