import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Camera, Flashlight, Type } from "lucide-react";

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

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsActive(true);
        setError(null);

        // Check if flash is available
        const track = mediaStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        if ('torch' in capabilities) {
          setHasFlash(true);
        }
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

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    // In a real implementation, you would use a QR code detection library here
    // For now, we'll simulate QR code detection
    simulateQRDetection();
  };

  const simulateQRDetection = () => {
    // This is a simulation - in a real app you'd use a library like jsQR
    // or integrate with a native QR scanner
    const simulatedCodes = [
      'PLT001',
      'RUA01-E-A01-N01',
      'UCP-20250623-0001',
      'PRD-001'
    ];
    
    const randomCode = simulatedCodes[Math.floor(Math.random() * simulatedCodes.length)];
    onScan(randomCode);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <h2 className="text-lg font-medium">Scanner QR Code</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="h-6 w-6" />
        </Button>
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
            
            {/* QR Code Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-64 h-64 border-2 border-white rounded-lg">
                {/* Corner markers */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white"></div>
                
                {/* Scanning line animation */}
                <div className="absolute top-4 left-4 right-4 h-0.5 bg-white opacity-75 animate-pulse"></div>
              </div>
            </div>

            {/* Instructions */}
            <div className="absolute bottom-32 left-0 right-0 text-center text-white px-4">
              <p className="text-lg font-medium mb-2">Posicione o QR Code dentro do quadro</p>
              <p className="text-sm opacity-75">O código será detectado automaticamente</p>
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
