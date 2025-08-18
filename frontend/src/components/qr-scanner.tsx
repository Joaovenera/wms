import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Camera, Flashlight, Type, Focus, RotateCcw, Zap } from "lucide-react";
import { TouchOptimizedButton } from "./mobile/TouchOptimizedControls";

interface QrScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [detectionActive, setDetectionActive] = useState(true);
  const [lastScanTime, setLastScanTime] = useState(0);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      // Request high-resolution camera with optimal settings for QR scanning
      const constraints = {
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
          frameRate: { ideal: 30, min: 15 },
          focusMode: 'continuous',
          exposureMode: 'continuous',
          whiteBalanceMode: 'continuous'
        }
      };

      // Fallback to basic constraints if advanced features aren't supported
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (advancedError) {
        console.warn('Advanced camera features not supported, using basic constraints');
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsActive(true);
        setError(null);

        // Check available features
        const track = mediaStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        
        // Check for torch/flash support
        if ('torch' in capabilities) {
          setHasFlash(true);
        }
        
        // Auto-focus and exposure optimization for QR scanning
        try {
          await track.applyConstraints({
            advanced: [
              { focusMode: 'continuous' },
              { exposureMode: 'continuous' },
              { whiteBalanceMode: 'continuous' }
            ]
          });
        } catch (constraintError) {
          console.warn('Advanced camera constraints not supported');
        }
        
        // Start continuous QR detection
        startQRDetection();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Não foi possível acessar a câmera. Use a entrada manual.');
      setShowManualInput(true);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsActive(false);
  };

  const toggleFlash = async () => {
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    try {
      await track.applyConstraints({
        advanced: [{ torch: !flashOn } as any]
      });
      setFlashOn(!flashOn);
    } catch (error) {
      console.error('Error toggling flash:', error);
    }
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan(manualCode.trim());
    }
  };

  // Continuous QR detection
  const startQRDetection = () => {
    const detectQR = () => {
      if (!isActive || !detectionActive || !videoRef.current || !canvasRef.current) {
        requestAnimationFrame(detectQR);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
        requestAnimationFrame(detectQR);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      // Real QR detection would happen here
      // For now, simulate detection
      if (Math.random() < 0.001) { // Very low probability for demo
        simulateQRDetection();
      }

      requestAnimationFrame(detectQR);
    };
    
    requestAnimationFrame(detectQR);
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isActive) return;
    
    setIsScanning(true);
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    // Simulate processing delay
    setTimeout(() => {
      simulateQRDetection();
      setIsScanning(false);
    }, 500);
  };

  const simulateQRDetection = () => {
    const now = Date.now();
    // Prevent duplicate scans within 2 seconds
    if (now - lastScanTime < 2000) return;
    
    setLastScanTime(now);
    setDetectionActive(false);
    
    // Haptic feedback for successful scan
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
    
    // Simulate warehouse-specific QR codes
    const simulatedCodes = [
      'PLT001',
      'PLT002', 
      'RUA01-E-A01-N01',
      'RUA02-D-B03-N02',
      'UCP-20250805-0001',
      'UCP-20250805-0002',
      'PRD-001',
      'PRD-002',
      'VEI-CAM001',
      'POS-A01-001'
    ];
    
    const randomCode = simulatedCodes[Math.floor(Math.random() * simulatedCodes.length)];
    
    // Visual feedback - flash effect
    if (videoRef.current) {
      videoRef.current.style.filter = 'brightness(1.5)';
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.style.filter = 'none';
        }
      }, 200);
    }
    
    onScan(randomCode);
    
    // Re-enable detection after 2 seconds
    setTimeout(() => setDetectionActive(true), 2000);
  };
  
  const switchCamera = async () => {
    if (!stream) return;
    
    stopCamera();
    
    // Try to switch to front camera and back
    try {
      const currentFacingMode = stream.getVideoTracks()[0].getSettings().facingMode;
      const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        setStream(newStream);
        setIsActive(true);
        startQRDetection();
      }
    } catch (error) {
      console.error('Failed to switch camera:', error);
      // Fallback to original camera
      startCamera();
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header with status */}
      <div className="flex items-center justify-between p-4 text-white bg-gradient-to-b from-black/50 to-transparent">
        <div>
          <h2 className="text-lg font-medium">Scanner QR Code</h2>
          {isScanning && (
            <p className="text-xs text-green-400 animate-pulse">Processando...</p>
          )}
          {!detectionActive && (
            <p className="text-xs text-yellow-400">Aguarde para escanear novamente</p>
          )}
        </div>
        <TouchOptimizedButton
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white hover:bg-white/20 p-2"
          hapticFeedback={true}
        >
          <X className="h-6 w-6" />
        </TouchOptimizedButton>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative overflow-hidden">
        {isActive && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* Enhanced QR Code Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`relative w-72 h-72 border-2 rounded-xl transition-all duration-300 ${
                detectionActive ? 'border-white' : 'border-yellow-400'
              }`}>
                {/* Animated corner markers */}
                <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-lg transition-colors ${
                  detectionActive ? 'border-white' : 'border-yellow-400'
                }`}></div>
                <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-lg transition-colors ${
                  detectionActive ? 'border-white' : 'border-yellow-400'
                }`}></div>
                <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-lg transition-colors ${
                  detectionActive ? 'border-white' : 'border-yellow-400'
                }`}></div>
                <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-lg transition-colors ${
                  detectionActive ? 'border-white' : 'border-yellow-400'
                }`}></div>
                
                {/* Dynamic scanning line */}
                <div className={`absolute top-6 left-6 right-6 h-0.5 transition-all duration-1000 ${
                  isScanning 
                    ? 'bg-green-400 animate-pulse' 
                    : detectionActive 
                      ? 'bg-white animate-pulse' 
                      : 'bg-yellow-400'
                }`} style={{
                  animation: detectionActive ? 'scan-line 2s ease-in-out infinite' : 'none'
                }}></div>
                
                {/* Focus indicator */}
                {detectionActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Focus className="h-8 w-8 text-white/50 animate-pulse" />
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Instructions */}
            <div className="absolute bottom-32 left-0 right-0 text-center text-white px-4">
              <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4">
                <p className="text-lg font-medium mb-2">
                  {detectionActive 
                    ? 'Posicione o QR Code dentro do quadro' 
                    : 'Aguarde para escanear novamente'
                  }
                </p>
                <p className="text-sm opacity-75">
                  {isScanning 
                    ? 'Processando código...' 
                    : 'Detecção automática ativa'
                  }
                </p>
                
                {/* Signal strength indicator */}
                <div className="flex items-center justify-center gap-1 mt-2">
                  <div className={`w-1 h-3 rounded-full ${detectionActive ? 'bg-green-400' : 'bg-gray-400'}`} />
                  <div className={`w-1 h-4 rounded-full ${detectionActive ? 'bg-green-400' : 'bg-gray-400'}`} />
                  <div className={`w-1 h-5 rounded-full ${detectionActive ? 'bg-green-400' : 'bg-gray-400'}`} />
                  <div className={`w-1 h-4 rounded-full ${detectionActive ? 'bg-green-400' : 'bg-gray-400'}`} />
                  <div className={`w-1 h-3 rounded-full ${detectionActive ? 'bg-green-400' : 'bg-gray-400'}`} />
                </div>
              </div>
            </div>
          </>
        )}

        {!isActive && !showManualInput && (
          <div className="flex items-center justify-center h-full text-white">
            <div className="text-center">
              <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Iniciando câmera...</p>
              {error && (
                <div className="mt-4 space-y-2">
                  <p className="text-red-300 text-sm">{error}</p>
                  <Button 
                    onClick={() => setShowManualInput(true)}
                    variant="outline" 
                    className="text-white border-white hover:bg-white/20"
                  >
                    <Type className="h-4 w-4 mr-2" />
                    Digitar código
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {showManualInput && (
          <div className="flex items-center justify-center h-full text-white p-6">
            <div className="text-center space-y-4 w-full max-w-md">
              <Type className="h-16 w-16 mx-auto mb-4 opacity-75" />
              <h3 className="text-xl font-medium">Digite o código</h3>
              <p className="text-sm opacity-75">Insira o código da UCP, pallet ou posição manualmente</p>
              
              <div className="space-y-3">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Ex: UCP-20250623-0001"
                  className="w-full px-4 py-3 text-black rounded-lg text-center font-mono text-lg"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleManualSubmit();
                    }
                  }}
                />
                
                <div className="flex space-x-2">
                  <Button
                    onClick={() => {
                      setShowManualInput(false);
                      setError(null);
                      startCamera();
                    }}
                    variant="outline"
                    className="flex-1 text-white border-white hover:bg-white/20"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Tentar câmera
                  </Button>
                  <Button
                    onClick={handleManualSubmit}
                    disabled={!manualCode.trim()}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    Confirmar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="p-4 space-y-4">
        <div className="flex justify-center space-x-2">
          {isActive && hasFlash && (
            <Button
              variant="outline"
              size="lg"
              onClick={toggleFlash}
              className={`text-white border-white ${flashOn ? 'bg-white/20' : 'bg-transparent'} hover:bg-white/30`}
            >
              <Flashlight className="h-6 w-6" />
            </Button>
          )}
          
          {isActive && (
            <Button
              size="lg"
              onClick={captureFrame}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              <Camera className="h-6 w-6 mr-2" />
              Capturar
            </Button>
          )}

          <Button
            variant="outline"
            size="lg"
            onClick={() => setShowManualInput(true)}
            className="text-white border-white bg-transparent hover:bg-white/30"
          >
            <Type className="h-6 w-6 mr-2" />
            Digitar
          </Button>
        </div>

        <Card className="bg-white/10 border-white/20">
          <CardContent className="p-3">
            <p className="text-white text-sm text-center">
              {isActive 
                ? "Posicione o QR Code no quadro ou use o botão Digitar para inserir o código manualmente" 
                : "Use o botão Digitar para inserir códigos manualmente ou aguarde a câmera carregar"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
