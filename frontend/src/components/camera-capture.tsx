import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Camera, RefreshCcw, AlertTriangle, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => void;
  facingMode?: "user" | "environment";
}

export function CameraCapture({ isOpen, onClose, onCapture, facingMode = "environment" }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<"user" | "environment">(facingMode);
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const stopEvent = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

    const handleKeyCapture = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }, [onClose]);

  const startCamera = useCallback(async () => {
    setError(null);
    setIsCameraReady(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 16 / 9 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        const markReady = () => setIsCameraReady(true);
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
          markReady();
        };
        videoRef.current.oncanplay = markReady;
      }
    } catch (e) {
      console.error("Failed to access camera:", e);
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
      setIsCameraReady(false);
    }
  }, [mode]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setIsCameraReady(false);
      setError(null);
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen, startCamera]);

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isCameraReady) return;

    setIsCapturing(true);
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Always draw as-is to avoid mirrored result
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );
    let finalBlob = blob;
    if (!finalBlob) {
      try {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        finalBlob = await fetch(dataUrl).then(r => r.blob());
      } catch {}
    }
    if (finalBlob) {
      onCapture(finalBlob);
      if ("vibrate" in navigator) {
        navigator.vibrate(50);
      }
    }
    setIsCapturing(false);
    onClose();
  }, [videoRef, canvasRef, isCameraReady, onCapture, onClose]);

  const handleSwitch = useCallback(() => {
    setMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[2147483647] pointer-events-auto"
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          onKeyDownCapture={handleKeyCapture}
        >
          {/* Shield layer to block interactions behind the camera */}
          <div
            className="absolute inset-0 bg-black/90 pointer-events-auto"
            onPointerDown={stopEvent}
            onMouseDown={stopEvent}
            onTouchStart={stopEvent}
            onWheel={stopEvent}
            onClick={stopEvent}
          />

          {/* Camera UI layer */}
          <div
            className="relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none"
            onPointerDown={stopEvent}
            onMouseDown={stopEvent}
            onTouchStart={stopEvent}
          >
            {/* Video Feed */}
            {!isCameraReady && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white">
                <Loader2 className="h-10 w-10 animate-spin text-blue-400 mb-4" />
                <p className="text-lg">Iniciando câmera...</p>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/80 text-white p-4 text-center">
                <AlertTriangle className="h-12 w-12 text-red-300 mb-4" />
                <p className="text-xl font-semibold mb-2">Erro na Câmera</p>
                <p className="text-sm">{error}</p>
                <Button onClick={startCamera} className="mt-4 bg-red-600 hover:bg-red-700">
                  <RefreshCcw className="h-4 w-4 mr-2" /> Tentar Novamente
                </Button>
              </div>
            )}
            <video
              ref={videoRef}
              className={`w-full h-full object-contain bg-black border-2 border-gray-400 rounded-lg ${isCameraReady ? "" : "hidden"}`}
              style={{ transform: 'none' }}
              playsInline
              autoPlay
              onPointerDown={stopEvent}
              onMouseDown={stopEvent}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Capture Animation Overlay */}
            {isCapturing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="absolute inset-0 bg-white"
              />
            )}

            {/* Controls */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent flex justify-around items-center backdrop-blur-sm pointer-events-auto"
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20 active:scale-95 transition-transform"
                aria-label="Fechar Câmera"
              >
                <X className="h-8 w-8" />
              </Button>

              <motion.button
                type="button"
                onClick={handleCapture}
                disabled={!isCameraReady || isCapturing}
                className="w-20 h-20 rounded-full border-4 border-white bg-white/30 hover:bg-white/50 transition-all duration-200 flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
                aria-label="Capturar Foto"
              >
                <Camera className="h-10 w-10 text-white" />
              </motion.button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwitch}
                disabled={!isCameraReady}
                className="text-white hover:bg-white/20 active:scale-95 transition-transform"
                aria-label="Alternar Câmera"
              >
                <RefreshCcw className="h-8 w-8" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
