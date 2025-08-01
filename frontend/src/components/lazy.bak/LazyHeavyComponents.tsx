import { lazy } from 'react';
import { withLazyWrapper } from './LazyWrapper';

// Lazy load heavy components that are conditionally rendered
export const LazyWarehouseMap = withLazyWrapper(
  lazy(() => import('@/components/warehouse-map')),
  {
    fallback: (
      <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando mapa do armazém...</p>
        </div>
      </div>
    )
  }
);

export const LazyWarehouseMapEnhanced = withLazyWrapper(
  lazy(() => import('@/components/warehouse-map-enhanced')),
  {
    fallback: (
      <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando mapa avançado...</p>
        </div>
      </div>
    )
  }
);

export const LazyQrScanner = withLazyWrapper(
  lazy(() => import('@/components/qr-scanner')),
  {
    fallback: (
      <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Inicializando scanner QR...</p>
        </div>
      </div>
    )
  }
);

export const LazyTransferPlanningWizard = withLazyWrapper(
  lazy(() => import('@/components/transfer-planning-wizard')),
  {
    fallback: (
      <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando assistente de planejamento...</p>
        </div>
      </div>
    )
  }
);

export const LazyUcpCreationWizard = withLazyWrapper(
  lazy(() => import('@/components/ucp-creation-wizard')),
  {
    fallback: (
      <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando assistente UCP...</p>
        </div>
      </div>
    )
  }
);

export const LazyLoadingExecutionScreen = withLazyWrapper(
  lazy(() => import('@/components/loading-execution-screen')),
  {
    fallback: (
      <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando execução de carregamento...</p>
        </div>
      </div>
    )
  }
);

export const LazyPackagingManager = withLazyWrapper(
  lazy(() => import('@/components/packaging-manager')),
  {
    fallback: (
      <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando gerenciador de embalagem...</p>
        </div>
      </div>
    )
  }
);

export const LazyProductPhotoManager = withLazyWrapper(
  lazy(() => import('@/components/product-photo-manager')),
  {
    fallback: (
      <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando gerenciador de fotos...</p>
        </div>
      </div>
    )
  }
);

export const LazyCameraCapture = withLazyWrapper(
  lazy(() => import('@/components/camera-capture')),
  {
    fallback: (
      <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Inicializando câmera...</p>
        </div>
      </div>
    )
  }
);

export const LazyPickingOptimizer = withLazyWrapper(
  lazy(() => import('@/components/picking-optimizer')),
  {
    fallback: (
      <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando otimizador de picking...</p>
        </div>
      </div>
    )
  }
);

export const LazyTransferReportViewer = withLazyWrapper(
  lazy(() => import('@/components/transfer-report-viewer')),
  {
    fallback: (
      <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando visualizador de relatórios...</p>
        </div>
      </div>
    )
  }
);