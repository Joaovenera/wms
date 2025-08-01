import { Suspense, ComponentType, ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

interface LazyWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
}

function DefaultLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Carregando componente...</p>
      </div>
    </div>
  );
}

function DefaultErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <div className="text-red-500 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Erro ao carregar componente
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {error.message || 'Ocorreu um erro inesperado'}
        </p>
        <button
          onClick={resetErrorBoundary}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export function LazyWrapper({ 
  children, 
  fallback = <DefaultLoadingFallback />,
  errorFallback = DefaultErrorFallback 
}: LazyWrapperProps) {
  return (
    <ErrorBoundary FallbackComponent={errorFallback}>
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

// Higher-order component for wrapping lazy components
export function withLazyWrapper<P extends object>(
  Component: ComponentType<P>,
  options?: {
    fallback?: ReactNode;
    errorFallback?: ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
  }
) {
  return function LazyComponent(props: P) {
    return (
      <LazyWrapper 
        fallback={options?.fallback} 
        errorFallback={options?.errorFallback}
      >
        <Component {...props} />
      </LazyWrapper>
    );
  };
}