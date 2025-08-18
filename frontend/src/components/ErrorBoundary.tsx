import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isRetrying: boolean;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isRetrying: false,
    retryCount: 0,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      isRetrying: false,
      retryCount: 0,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Send error to monitoring service
    this.reportError(error, errorInfo);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    try {
      // In a real app, you would send this to your error reporting service
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        context: this.props.context,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      // Store in localStorage for debugging
      const existingErrors = JSON.parse(localStorage.getItem('error_logs') || '[]');
      existingErrors.push(errorData);
      localStorage.setItem('error_logs', JSON.stringify(existingErrors.slice(-10))); // Keep last 10 errors

      console.error('Error reported:', errorData);
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private handleRetry = () => {
    const { retryCount } = this.state;
    const maxRetries = 3;

    if (retryCount >= maxRetries) {
      return;
    }

    this.setState({ isRetrying: true });

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, retryCount) * 1000;

    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isRetrying: false,
        retryCount: retryCount + 1,
      });
    }, delay);
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private getErrorType = (error: Error): string => {
    if (error.name === 'ChunkLoadError') return 'network';
    if (error.message.includes('Network Error')) return 'network';
    if (error.message.includes('timeout')) return 'timeout';
    if (error.message.includes('API')) return 'api';
    return 'generic';
  };

  private getErrorSuggestions = (errorType: string): string[] => {
    switch (errorType) {
      case 'network':
        return [
          'Verifique sua conexão com a internet',
          'Tente recarregar a página',
          'Aguarde alguns minutos e tente novamente',
        ];
      case 'timeout':
        return [
          'A operação demorou mais que o esperado',
          'Verifique sua conexão',
          'Tente novamente em alguns segundos',
        ];
      case 'api':
        return [
          'Problema na comunicação com o servidor',
          'Tente novamente em alguns minutos',
          'Se o problema persistir, contate o suporte',
        ];
      default:
        return [
          'Ocorreu um erro inesperado',
          'Tente recarregar a página',
          'Se o problema persistir, contate o suporte',
        ];
    }
  };

  public componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  public render() {
    if (this.state.hasError) {
      const { error, isRetrying, retryCount } = this.state;
      const errorType = error ? this.getErrorType(error) : 'generic';
      const suggestions = this.getErrorSuggestions(errorType);
      const maxRetries = 3;
      const canRetry = retryCount < maxRetries;

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-xl font-semibold text-gray-900">
                Ops! Algo deu errado
              </CardTitle>
              <CardDescription>
                {this.props.context && `Erro em: ${this.props.context}`}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <Alert>
                <HelpCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Sugestões para resolver:</p>
                    <ul className="text-sm space-y-1">
                      {suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-gray-400">•</span>
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>

              {process.env.NODE_ENV === 'development' && error && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                    Detalhes técnicos (desenvolvimento)
                  </summary>
                  <div className="bg-gray-100 p-3 rounded text-xs font-mono">
                    <p><strong>Erro:</strong> {error.message}</p>
                    {error.stack && (
                      <pre className="mt-2 whitespace-pre-wrap">
                        {error.stack}
                      </pre>
                    )}
                  </div>
                </details>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {canRetry && (
                  <Button
                    variant="default"
                    onClick={this.handleRetry}
                    disabled={isRetrying}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                    {isRetrying ? 'Tentando...' : `Tentar Novamente${retryCount > 0 ? ` (${retryCount + 1}/${maxRetries})` : ''}`}
                  </Button>
                )}
                
                <Button variant="outline" onClick={this.handleReload} className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Recarregar Página
                </Button>
                
                <Button variant="outline" onClick={this.handleGoHome} className="flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  Ir para Início
                </Button>
              </div>

              {retryCount >= maxRetries && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Tentativas de recuperação esgotadas. Recarregue a página ou entre em contato com o suporte.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// Higher-order component for easy wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  context?: string
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary context={context}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// Hook for programmatic error handling
export function useErrorHandler() {
  return (error: Error, context?: string) => {
    // Force component to re-render with error
    throw new Error(`${context ? `[${context}] ` : ''}${error.message}`);
  };
}