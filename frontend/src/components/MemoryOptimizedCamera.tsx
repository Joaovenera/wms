import React, { useRef, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, StopCircle, RotateCcw, Download, Trash2, AlertTriangle } from "lucide-react";

interface MemoryOptimizedCameraProps {
  onCapture?: (imageData: string, blob: Blob) => void;
  onError?: (error: string) => void;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  facingMode?: 'user' | 'environment';
  autoCleanup?: boolean;
  compressionThreshold?: number; // Compress images above this size (bytes)
  maxMemoryUsage?: number; // Maximum memory usage in bytes
}

interface CapturedImage {
  id: string;
  dataUrl: string;
  blob: Blob;
  timestamp: number;
  size: number;
}

export function MemoryOptimizedCamera({
  onCapture,
  onError,
  maxWidth = 1920,
  maxHeight = 1080,
  quality = 0.8,
  facingMode = 'environment',
  autoCleanup = true,
  compressionThreshold = 500 * 1024, // 500KB
  maxMemoryUsage = 50 * 1024 * 1024, // 50MB
}: MemoryOptimizedCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);

  // Memory monitoring
  const updateMemoryUsage = useCallback(() => {
    const totalSize = capturedImages.reduce((sum, img) => sum + img.size, 0);
    setMemoryUsage(totalSize);
  }, [capturedImages]);

  useEffect(() => {
    updateMemoryUsage();
  }, [capturedImages, updateMemoryUsage]);

  // Cleanup function to release memory and resources
  const cleanup = useCallback(() => {
    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Clean up captured images
    setCapturedImages(prev => {
      prev.forEach(img => {
        URL.revokeObjectURL(img.dataUrl);
      });
      return [];
    });

    setIsStreaming(false);
    setError(null);
    setMemoryUsage(0);
  }, []);

  // Auto cleanup when memory usage exceeds threshold
  useEffect(() => {
    if (autoCleanup && memoryUsage > maxMemoryUsage) {
      // Remove oldest images to free memory
      setCapturedImages(prev => {
        const sortedImages = [...prev].sort((a, b) => a.timestamp - b.timestamp);
        let currentSize = memoryUsage;
        const toKeep: CapturedImage[] = [];
        
        // Keep images from newest, removing oldest until under threshold
        for (let i = sortedImages.length - 1; i >= 0; i--) {
          const img = sortedImages[i];
          if (currentSize - img.size > maxMemoryUsage * 0.8) { // Keep 20% buffer
            URL.revokeObjectURL(img.dataUrl);
            currentSize -= img.size;
          } else {
            toKeep.unshift(img);
          }
        }
        
        return toKeep;
      });
    }
  }, [memoryUsage, maxMemoryUsage, autoCleanup]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: maxWidth },
          height: { ideal: maxHeight },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [facingMode, maxWidth, maxHeight, onError]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
  }, []);

  // Compress image if needed
  const compressImage = useCallback(async (
    canvas: HTMLCanvasElement,
    targetQuality: number = quality
  ): Promise<{ dataUrl: string; blob: Blob; compressed: boolean }> => {
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          resolve({ dataUrl: '', blob: new Blob(), compressed: false });
          return;
        }

        const dataUrl = canvas.toDataURL('image/jpeg', targetQuality);
        
        // If image is still too large and quality can be reduced further
        if (blob.size > compressionThreshold && targetQuality > 0.3) {
          // Recursively compress with lower quality
          const compressed = await compressImage(canvas, targetQuality * 0.8);
          resolve({ ...compressed, compressed: true });
        } else {
          resolve({ dataUrl, blob, compressed: blob.size > compressionThreshold });
        }
      }, 'image/jpeg', targetQuality);
    });
  }, [quality, compressionThreshold]);

  // Capture image
  const captureImage = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isStreaming || isCapturing) {
      return;
    }

    setIsCapturing(true);
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Unable to get canvas context');
      }

      // Set canvas size to video size (respecting max dimensions)
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      
      let canvasWidth = videoWidth;
      let canvasHeight = videoHeight;

      // Scale down if necessary
      if (canvasWidth > maxWidth) {
        const ratio = maxWidth / canvasWidth;
        canvasWidth = maxWidth;
        canvasHeight = canvasHeight * ratio;
      }

      if (canvasHeight > maxHeight) {
        const ratio = maxHeight / canvasHeight;
        canvasHeight = maxHeight;
        canvasWidth = canvasWidth * ratio;
      }

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvasWidth, canvasHeight);

      // Compress image if needed
      const { dataUrl, blob, compressed } = await compressImage(canvas);

      // Create captured image record
      const capturedImage: CapturedImage = {
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        dataUrl,
        blob,
        timestamp: Date.now(),
        size: blob.size,
      };

      // Add to captured images
      setCapturedImages(prev => [...prev, capturedImage]);

      // Call onCapture callback
      onCapture?.(dataUrl, blob);

      // Log compression info in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`Image captured: ${(blob.size / 1024).toFixed(1)}KB${compressed ? ' (compressed)' : ''}`);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to capture image';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsCapturing(false);
    }
  }, [isStreaming, isCapturing, maxWidth, maxHeight, compressImage, onCapture, onError]);

  // Download image
  const downloadImage = useCallback((image: CapturedImage) => {
    const link = document.createElement('a');
    link.href = image.dataUrl;
    link.download = `capture_${new Date(image.timestamp).toISOString().replace(/[:.]/g, '-')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Delete image
  const deleteImage = useCallback((imageId: string) => {
    setCapturedImages(prev => {
      const imageToDelete = prev.find(img => img.id === imageId);
      if (imageToDelete) {
        URL.revokeObjectURL(imageToDelete.dataUrl);
      }
      return prev.filter(img => img.id !== imageId);
    });
  }, []);

  // Clear all images
  const clearAllImages = useCallback(() => {
    setCapturedImages(prev => {
      prev.forEach(img => {
        URL.revokeObjectURL(img.dataUrl);
      });
      return [];
    });
  }, []);

  // Component cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const formatMemoryUsage = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getMemoryStatus = () => {
    const percentage = (memoryUsage / maxMemoryUsage) * 100;
    if (percentage > 90) return { color: 'text-red-600', status: 'Critical' };
    if (percentage > 70) return { color: 'text-yellow-600', status: 'High' };
    if (percentage > 50) return { color: 'text-blue-600', status: 'Medium' };
    return { color: 'text-green-600', status: 'Low' };
  };

  const memoryStatus = getMemoryStatus();

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Memory-Optimized Camera
            </CardTitle>
            <CardDescription>
              Capture images with automatic memory management
            </CardDescription>
          </div>
          <div className="text-right text-xs">
            <div className={`font-medium ${memoryStatus.color}`}>
              {formatMemoryUsage(memoryUsage)} / {formatMemoryUsage(maxMemoryUsage)}
            </div>
            <div className="text-gray-500">Memory: {memoryStatus.status}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Display */}
        {error && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Camera Controls */}
        <div className="flex gap-2">
          {!isStreaming ? (
            <Button onClick={startCamera} className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Start Camera
            </Button>
          ) : (
            <>
              <Button onClick={stopCamera} variant="outline" className="flex items-center gap-2">
                <StopCircle className="h-4 w-4" />
                Stop Camera
              </Button>
              <Button 
                onClick={captureImage} 
                disabled={isCapturing}
                className="flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                {isCapturing ? 'Capturing...' : 'Capture'}
              </Button>
            </>
          )}
          
          {capturedImages.length > 0 && (
            <Button onClick={clearAllImages} variant="destructive" className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Clear All ({capturedImages.length})
            </Button>
          )}
        </div>

        {/* Camera View */}
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-auto"
            style={{ maxHeight: '400px' }}
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="hidden"
          />
        </div>

        {/* Captured Images */}
        {capturedImages.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">
              Captured Images ({capturedImages.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {capturedImages.map((image) => (
                <div key={image.id} className="relative group">
                  <img
                    src={image.dataUrl}
                    alt={`Capture ${new Date(image.timestamp).toLocaleTimeString()}`}
                    className="w-full h-24 object-cover rounded border"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => downloadImage(image)}
                        className="h-6 w-6 p-0"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteImage(image.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1 rounded-b">
                    {formatMemoryUsage(image.size)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Memory Usage Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Memory Usage</span>
            <span>{((memoryUsage / maxMemoryUsage) * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                memoryStatus.color.includes('red') ? 'bg-red-500' :
                memoryStatus.color.includes('yellow') ? 'bg-yellow-500' :
                memoryStatus.color.includes('blue') ? 'bg-blue-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min((memoryUsage / maxMemoryUsage) * 100, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MemoryOptimizedCamera;