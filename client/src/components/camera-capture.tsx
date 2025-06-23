import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, X, RotateCw, Check } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function CameraCapture({
  onCapture,
  isOpen,
  onClose,
}: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    // Para completamente todas as tracks antes de iniciar uma nova
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      setStream(null);
    }

    // Limpa o vídeo atual
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Pequeno delay para garantir que as tracks anteriores foram liberadas
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log("Iniciando câmera com facingMode:", facingMode);
      
      const constraints = {
        video: {
          facingMode: { exact: facingMode },
          width: { ideal: 800, max: 1920 },
          height: { ideal: 600, max: 1080 },
        },
      };

      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (exactError) {
        // Se falhar com exact, tenta sem exact
        console.log("Tentando sem exact facingMode");
        const fallbackConstraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 800, max: 1920 },
            height: { ideal: 600, max: 1080 },
          },
        };
        mediaStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }

      console.log("Stream obtido:", mediaStream);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              setIsLoading(false);
              console.log("Câmera pronta");
            }).catch(console.error);
          }
        };
      }
    } catch (error) {
      console.error("Erro ao acessar a câmera:", error);
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
      setIsLoading(false);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        alert("Aguarde a câmera carregar completamente.");
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (context) {
        // Se for câmera frontal, espelhar a imagem na captura
        if (facingMode === "user") {
          context.scale(-1, 1);
          context.drawImage(video, -video.videoWidth, 0);
        } else {
          context.drawImage(video, 0, 0);
        }

        // Reduzir qualidade para diminuir o tamanho do arquivo
        const imageData = canvas.toDataURL("image/jpeg", 0.9);

        console.log(`Foto capturada: ${Math.round(imageData.length / 1024)}KB`);

        if (imageData && imageData !== "data:," && imageData.length > 1000) {
          setCapturedImage(imageData);
          console.log("Foto capturada com sucesso!");
        } else {
          alert("Erro ao capturar foto. Tente novamente.");
        }
      }
    }
  }, [facingMode]);

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

  const switchCamera = useCallback(async () => {
    const currentMode = facingMode;
    const newMode = currentMode === "user" ? "environment" : "user";
    console.log("Alternando câmera de", currentMode, "para", newMode);
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Para completamente o stream atual
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        setStream(null);
      }

      // Limpa o vídeo
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Aguarda para garantir que o stream foi completamente liberado
      await new Promise(resolve => setTimeout(resolve, 300));

      // Função inline para iniciar a nova câmera
      const initNewCamera = async (mode: "user" | "environment") => {
        const constraints = {
          video: {
            facingMode: { exact: mode },
            width: { ideal: 800, max: 1920 },
            height: { ideal: 600, max: 1080 },
          },
        };

        let mediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (exactError) {
          console.log("Tentando sem exact facingMode");
          const fallbackConstraints = {
            video: {
              facingMode: mode,
              width: { ideal: 800, max: 1920 },
              height: { ideal: 600, max: 1080 },
            },
          };
          mediaStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        }

        return mediaStream;
      };

      const mediaStream = await initNewCamera(newMode);

      // Atualiza o estado apenas se tudo deu certo
      setFacingMode(newMode);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              setIsLoading(false);
              console.log("Câmera alternada com sucesso para:", newMode);
            }).catch((playError) => {
              console.error("Erro ao reproduzir vídeo:", playError);
              setIsLoading(false);
            });
          }
        };
      }
    } catch (error) {
      console.error("Erro ao alternar câmera:", error);
      setError("Não foi possível alternar a câmera. Tente novamente.");
      setIsLoading(false);
    }
  }, [facingMode, stream]);

  const handleClose = useCallback(() => {
    setCapturedImage(null);
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  // Iniciar câmera quando o diálogo abre
  const handleDialogOpen = useCallback(() => {
    if (isOpen && !capturedImage && !stream) {
      startCamera();
    }
  }, [isOpen, capturedImage, stream, startCamera]);

  // Chamar quando o diálogo abre
  if (isOpen && !stream && !capturedImage && !isLoading) {
    startCamera();
  }

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
                  className={`w-full h-full object-cover ${
                    facingMode === "user" ? "scale-x-[-1]" : ""
                  }`}
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={switchCamera}
                  className="h-12 w-12 rounded-full"
                  disabled={isLoading || !!error}
                >
                  <RotateCw className="h-5 w-5" />
                </Button>
                <Button
                  onClick={capturePhoto}
                  className="h-12 w-12 rounded-full bg-white border-4 border-gray-300 hover:bg-gray-100"
                  disabled={isLoading || !!error}
                >
                  <Camera className="h-6 w-6 text-black" />
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
              <div className="aspect-[4/3] bg-black rounded-lg overflow-hidden">
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={retakePhoto}>
                  Refazer
                </Button>
                <Button
                  onClick={confirmPhoto}
                  className="bg-green-600 hover:bg-green-700"
                >
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
