import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLazyComponent } from '@/hooks/useLazyComponent';
import { globalComponentPreloader } from '@/utils/lazyComponentLoader';

/**
 * Example component showing how to use lazy loading within a page
 * This demonstrates conditional loading of heavy components
 */
export default function LazyComponentExample() {
  const [showWarehouseMap, setShowWarehouseMap] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);

  // Lazy load warehouse map only when needed
  const {
    Component: WarehouseMap,
    isLoading: isMapLoading,
    error: mapError,
    loadComponent: loadMap,
    resetError: resetMapError
  } = useLazyComponent(
    () => import('@/components/warehouse-map'),
    {
      onLoad: () => console.log('Warehouse map loaded successfully'),
      onError: (error) => console.error('Failed to load warehouse map:', error)
    }
  );

  // Lazy load QR scanner only when needed
  const {
    Component: QrScanner,
    isLoading: isScannerLoading,
    error: scannerError,
    loadComponent: loadScanner,
    resetError: resetScannerError
  } = useLazyComponent(
    () => import('@/components/qr-scanner'),
    {
      loadingDelay: 300, // Prevent loading flash for fast networks
      onLoad: () => console.log('QR Scanner loaded successfully')
    }
  );

  const handleShowMap = async () => {
    if (!WarehouseMap) {
      await loadMap();
    }
    setShowWarehouseMap(true);
  };

  const handleShowScanner = async () => {
    if (!QrScanner) {
      await loadScanner();
    }
    setShowQrScanner(true);
  };

  // Preload components on hover for better UX
  const handleMapHover = () => {
    if (!WarehouseMap && !isMapLoading) {
      globalComponentPreloader.preloadComponent(
        () => import('@/components/warehouse-map')
      );
    }
  };

  const handleScannerHover = () => {
    if (!QrScanner && !isScannerLoading) {
      globalComponentPreloader.preloadComponent(
        () => import('@/components/qr-scanner')
      );
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Lazy Loading Example</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button
              onClick={handleShowMap}
              onMouseEnter={handleMapHover}
              disabled={isMapLoading}
              variant={showWarehouseMap ? "secondary" : "default"}
            >
              {isMapLoading ? 'Loading Map...' : showWarehouseMap ? 'Hide Map' : 'Show Warehouse Map'}
            </Button>

            <Button
              onClick={handleShowScanner}
              onMouseEnter={handleScannerHover}
              disabled={isScannerLoading}
              variant={showQrScanner ? "secondary" : "default"}
            >
              {isScannerLoading ? 'Loading Scanner...' : showQrScanner ? 'Hide Scanner' : 'Show QR Scanner'}
            </Button>
          </div>

          {/* Error handling */}
          {mapError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-600">Failed to load warehouse map: {mapError.message}</p>
                <Button onClick={resetMapError} variant="outline" size="sm" className="mt-2">
                  Try Again
                </Button>
              </CardContent>
            </Card>
          )}

          {scannerError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-600">Failed to load QR scanner: {scannerError.message}</p>
                <Button onClick={resetScannerError} variant="outline" size="sm" className="mt-2">
                  Try Again
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Conditionally render lazy-loaded components */}
          {showWarehouseMap && WarehouseMap && (
            <Card>
              <CardHeader>
                <CardTitle>Warehouse Map</CardTitle>
              </CardHeader>
              <CardContent>
                <WarehouseMap />
              </CardContent>
            </Card>
          )}

          {showQrScanner && QrScanner && (
            <Card>
              <CardHeader>
                <CardTitle>QR Scanner</CardTitle>
              </CardHeader>
              <CardContent>
                <QrScanner
                  onScan={(code) => console.log('Scanned:', code)}
                  onClose={() => setShowQrScanner(false)}
                />
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}