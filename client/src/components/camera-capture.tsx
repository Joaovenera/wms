import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X, RotateCw, Check } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, isOpen, onClose }: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Parar stream anterior se existir
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      console.log("Iniciando câmera...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        }
      });
      
      console.log("Stream obtido:", mediaStream);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Aguardar o vídeo carregar e estar pronto para reprodução
        const video = videoRef.current;
        
        const waitForVideoReady = () => {
          let attempts = 0;
          const maxAttempts = 50; // 5 segundos
          
          const checkVideo = () => {
            attempts++;
            console.log(`Verificando vídeo (tentativa ${attempts}):`, video.videoWidth, "x", video.videoHeight);
            
            if (video.videoWidth > 100 && video.videoHeight > 100) {
              video.play().then(() => {
                setIsLoading(false);
                console.log("Vídeo iniciado com sucesso:", video.videoWidth, "x", video.videoHeight);
              }).catch(err => {
                console.error("Erro ao iniciar vídeo:", err);
                setError("Erro ao iniciar o vídeo");
                setIsLoading(false);
              });
            } else if (attempts < maxAttempts) {
              setTimeout(checkVideo, 100);
            } else {
              console.error("Timeout aguardando vídeo estar pronto");
              setError("Timeout ao inicializar a câmera");
              setIsLoading(false);
            }
          };
          
          // Começar a verificar após um pequeno delay
          setTimeout(checkVideo, 100);
        };
        
        video.addEventListener('loadedmetadata', waitForVideoReady);
        
        // Fallback timeout
        setTimeout(() => {
          if (isLoading) {
            setIsLoading(false);
            video.removeEventListener('canplay', onCanPlay);
          }
        }, 5000);
      }
    } catch (error) {
      console.error("Erro ao acessar a câmera:", error);
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
      setIsLoading(false);
    }
  }, [facingMode, stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      // Aguardar o vídeo estar pronto com dimensões adequadas
      if (video.videoWidth === 0 || video.videoHeight === 0 || 
          video.videoWidth < 100 || video.videoHeight < 100) {
        console.error("Vídeo não está pronto para captura:", video.videoWidth, "x", video.videoHeight);
        alert("Aguarde o vídeo carregar completamente antes de capturar a foto.");
        return;
      }

      // Definir dimensões do canvas baseadas no vídeo
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (context) {
        // Limpar canvas
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Desenhar o frame atual do vídeo
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Converter para base64
        const imageData = canvas.toDataURL("image/jpeg", 0.9);
        
        console.log("Tentativa de captura:", {
          videoSize: `${video.videoWidth}x${video.videoHeight}`,
          canvasSize: `${canvas.width}x${canvas.height}`,
          dataLength: imageData.length,
          dataPrefix: imageData.substring(0, 50)
        });
        
        // Verificar se a imagem foi capturada corretamente
        if (imageData && imageData !== 'data:,' && imageData.length > 1000) {
          setCapturedImage(imageData);
          console.log("Foto capturada com sucesso!");
        } else {
          console.error("Falha na captura da foto - dados insuficientes");
          alert("Erro ao capturar foto. Tente novamente.");
        }
      }
    }
  }, []);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
  }, []);

  const confirmPhoto = useCallback(() => {
    if (capturedImage) {
      onCapture(capturedImage);
      setCapturedImage(null);
      stopCamera();
      onClose();
    }
  }, [capturedImage, onCapture, stopCamera, onClose]);

  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
    stopCamera();
  }, [stopCamera]);

  const handleClose = useCallback(() => {
    setCapturedImage(null);
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  // Start camera when dialog opens
  useEffect(() => {
    if (isOpen && !stream && !capturedImage) {
      startCamera();
    }
  }, [isOpen, stream, capturedImage, startCamera]);

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (isOpen && stream) {
      stopCamera();
      setTimeout(startCamera, 100);
    }
  }, [facingMode, isOpen, stream, stopCamera, startCamera]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Capturar Foto do Pallet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!capturedImage ? (
            <>
              <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                    <div className="text-white text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                      <p>Iniciando câmera...</p>
                    </div>
                  </div>
                )}
                
                {error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-900/50 z-10">
                    <div className="text-white text-center p-4">
                      <p className="mb-2">{error}</p>
                      <Button onClick={startCamera} variant="outline" size="sm">
                        Tentar novamente
                      </Button>
                    </div>
                  </div>
                )}

                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={switchCamera}
                  className="h-12 w-12 rounded-full"
                >
                  <RotateCw className="h-5 w-5" />
                </Button>
                
                <Button
                  onClick={capturePhoto}
                  size="icon"
                  className="h-16 w-16 rounded-full bg-white border-4 border-gray-300 hover:bg-gray-100"
                >
                  <div className="h-12 w-12 bg-white rounded-full border-2 border-gray-400" />
                </Button>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleClose}
                  className="h-12 w-12 rounded-full"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                <img
                  src={capturedImage}
                  alt="Foto capturada"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={retakePhoto}>
                  <X className="h-4 w-4 mr-2" />
                  Refazer
                </Button>
                <Button onClick={confirmPhoto}>
                  <Check className="h-4 w-4 mr-2" />
                  Confirmar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}