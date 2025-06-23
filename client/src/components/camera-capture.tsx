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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Erro ao acessar a câmera:", error);
    }
  }, [facingMode]);

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

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (context) {
        context.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg", 0.8);
        setCapturedImage(imageData);
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
  useState(() => {
    if (isOpen && !stream && !capturedImage) {
      startCamera();
    }
  });

  // Cleanup on unmount or close
  useState(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  });

  // Restart camera when facing mode changes
  useState(() => {
    if (isOpen && stream) {
      stopCamera();
      setTimeout(startCamera, 100);
    }
  });

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