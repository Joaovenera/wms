import React, { useState, useMemo, useEffect, useCallback, memo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Package, 
  Truck, 
  Warehouse, 
  AlertTriangle, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  RefreshCw,
  Eye,
  EyeOff,
  Settings,
  Info,
  MapPin
} from "lucide-react";
import { Position, PalletStructure } from "@/types/api";

interface PositionStats {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  blocked: number;
  occupancyRate: number;
  utilizationTrend: 'up' | 'down' | 'stable';
}

interface EnhancedPalletStructureSimulatorProps {
  structure: PalletStructure;
  positions: Position[];
  realTimeUpdates?: boolean;
  interactive?: boolean;
  showStats?: boolean;
  className?: string;
}

// Professional 3D Camera Controller
class CameraController {
  private rotationX: number = 25;
  private rotationY: number = -20;
  private zoomLevel: number = 1;
  private isDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private sensitivity: number = 0.5;
  private zoomSensitivity: number = 0.001;
  private minZoom: number = 0.3;
  private maxZoom: number = 2.5;
  private minRotationX: number = -60;
  private maxRotationX: number = 60;
  private autoRotate: boolean = false;
  private autoRotateSpeed: number = 0.5;
  private animationFrame: number | null = null;

  // Callbacks
  private onUpdate: ((camera: CameraState) => void) | null = null;

  constructor(onUpdate?: (camera: CameraState) => void) {
    this.onUpdate = onUpdate || null;
    this.startAutoRotate();
  }

  public getState(): CameraState {
    return {
      rotationX: this.rotationX,
      rotationY: this.rotationY,
      zoom: this.zoomLevel,
      isDragging: this.isDragging,
      autoRotate: this.autoRotate
    };
  }

  public startDrag(x: number, y: number): void {
    this.isDragging = true;
    this.lastMouseX = x;
    this.lastMouseY = y;
    this.autoRotate = false;
  }

  public drag(x: number, y: number): void {
    if (!this.isDragging) return;

    const deltaX = x - this.lastMouseX;
    const deltaY = y - this.lastMouseY;

    this.rotationY -= deltaX * this.sensitivity;
    this.rotationX = Math.max(
      this.minRotationX, 
      Math.min(this.maxRotationX, this.rotationX - deltaY * this.sensitivity)
    );

    this.lastMouseX = x;
    this.lastMouseY = y;
    this.update();
  }

  public endDrag(): void {
    this.isDragging = false;
  }

  public zoom(delta: number): void {
    this.zoomLevel = Math.max(
      this.minZoom, 
      Math.min(this.maxZoom, this.zoomLevel - delta * this.zoomSensitivity * Math.abs(delta))
    );
    this.update();
  }

  public setZoom(value: number): void {
    this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, value));
    this.update();
  }

  public rotateX(delta: number): void {
    this.rotationX = Math.max(
      this.minRotationX, 
      Math.min(this.maxRotationX, this.rotationX + delta)
    );
    this.update();
  }

  public rotateY(delta: number): void {
    this.rotationY += delta;
    this.update();
  }

  public toggleAutoRotate(): void {
    this.autoRotate = !this.autoRotate;
    if (this.autoRotate) {
      this.startAutoRotate();
    }
    this.update();
  }

  public reset(): void {
    this.rotationX = 25;
    this.rotationY = -20;
    this.zoomLevel = 1;
    this.autoRotate = false;
    this.update();
  }

  private startAutoRotate(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    const animate = () => {
      if (this.autoRotate) {
        this.rotationY -= this.autoRotateSpeed;
        this.update();
        this.animationFrame = requestAnimationFrame(animate);
      }
    };

    if (this.autoRotate) {
      this.animationFrame = requestAnimationFrame(animate);
    }
  }

  private update(): void {
    if (this.onUpdate) {
      this.onUpdate(this.getState());
    }
  }

  public destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}

interface CameraState {
  rotationX: number;
  rotationY: number;
  zoom: number;
  isDragging: boolean;
  autoRotate: boolean;
}

// Enhanced position configuration with better visual feedback
const getPositionConfig = (position: Position | null, colorScheme: string = 'default') => {
  if (!position) {
    return {
      color: 'bg-gray-100 border-gray-200',
      textColor: 'text-gray-500',
      icon: <Package className="h-3 w-3" />,
      description: 'Posição vazia',
      label: 'Vazio'
    };
  }

  const baseConfig = {
    ocupada: {
      color: 'bg-red-500 border-red-600 shadow-lg shadow-red-500/25',
      textColor: 'text-white',
      icon: <Package className="h-3 w-3" />,
      description: 'Ocupada',
      label: 'Ocupada'
    },
    disponivel: {
      color: 'bg-green-500 border-green-600 shadow-lg shadow-green-500/25',
      textColor: 'text-white',
      icon: <Package className="h-3 w-3" />,
      description: 'Disponível',
      label: 'Disponível'
    },
    reservada: {
      color: 'bg-yellow-500 border-yellow-600 shadow-lg shadow-yellow-500/25',
      textColor: 'text-white',
      icon: <Package className="h-3 w-3" />,
      description: 'Reservada',
      label: 'Reservada'
    },
    manutencao: {
      color: 'bg-blue-500 border-blue-600 shadow-lg shadow-blue-500/25',
      textColor: 'text-white',
      icon: <Package className="h-3 w-3" />,
      description: 'Manutenção',
      label: 'Manutenção'
    },
    bloqueada: {
      color: 'bg-gray-500 border-gray-600 shadow-lg shadow-gray-500/25',
      textColor: 'text-white',
      icon: <Package className="h-3 w-3" />,
      description: 'Bloqueada',
      label: 'Bloqueada'
    }
  };

  return baseConfig[position.status as keyof typeof baseConfig] || baseConfig.disponivel;
};

const EnhancedPalletStructureSimulator: React.FC<EnhancedPalletStructureSimulatorProps> = ({
  structure,
  positions,
  realTimeUpdates = false,
  interactive = true,
  showStats = true,
  className = ""
}) => {
  const [viewMode, setViewMode] = useState<'2D' | '3D' | 'list'>('2D');
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showPositionDialog, setShowPositionDialog] = useState(false);
  const [highlightedLevels, setHighlightedLevels] = useState<number[]>([]);
  const [animationSpeed, setAnimationSpeed] = useState('normal');
  const [colorScheme, setColorScheme] = useState('default');
  const [showControls, setShowControls] = useState(true);
  
  // Advanced 3D Camera State
  const [cameraState, setCameraState] = useState<CameraState>({
    rotationX: 25,
    rotationY: -20,
    zoom: 1,
    isDragging: false,
    autoRotate: false
  });

  // Camera controller ref
  const cameraControllerRef = useRef<CameraController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Real-time position updates with error handling
  const { 
    data: livePositions, 
    refetch: refetchPositions, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: [`/api/positions/${structure.id}/live`],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/positions?structureId=${structure.id}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching positions:', error);
        throw error;
      }
    },
    enabled: realTimeUpdates,
    refetchInterval: realTimeUpdates ? 5000 : false,
    retry: 3,
    retryDelay: 1000,
  });

  const currentPositions = realTimeUpdates && livePositions ? livePositions : positions;

  // Organize positions by level and position
  const organizedPositions = useMemo(() => 
    Array.from({ length: structure.maxLevels + 1 }, (_, level) =>
      Array.from({ length: structure.maxPositions }, (_, pos) => {
        const position = currentPositions.find((p: Position) => 
          p.structureId === structure.id && 
          p.level === level && 
          p.position === pos + 1
        );
        return position || null;
      })
    ), [currentPositions, structure.maxLevels, structure.maxPositions, structure.id]
  );

  // Calculate comprehensive statistics
  const stats = useMemo((): PositionStats => {
    const totalPositions = currentPositions.filter((p: Position) => p.structureId === structure.id);
    const available = totalPositions.filter((p: Position) => p.status === 'disponivel').length;
    const occupied = totalPositions.filter((p: Position) => p.status === 'ocupada' || p.currentPalletId).length;
    const reserved = totalPositions.filter((p: Position) => p.status === 'reservada').length;
    const maintenance = totalPositions.filter((p: Position) => p.status === 'manutencao').length;
    const blocked = totalPositions.filter((p: Position) => p.status === 'bloqueada').length;
    const total = totalPositions.length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return {
      total,
      available,
      occupied,
      reserved,
      maintenance,
      blocked,
      occupancyRate,
      utilizationTrend: occupancyRate > 70 ? 'up' : occupancyRate < 30 ? 'down' : 'stable'
    };
  }, [currentPositions, structure.id]);

  // Initialize camera controller
  useEffect(() => {
    if (viewMode === '3D' && !cameraControllerRef.current) {
      cameraControllerRef.current = new CameraController(setCameraState);
    }

    return () => {
      if (cameraControllerRef.current) {
        cameraControllerRef.current.destroy();
        cameraControllerRef.current = null;
      }
    };
  }, [viewMode]);

  // Handle position click
  const handlePositionClick = useCallback((position: Position | null) => {
    if (interactive && position) {
      setSelectedPosition(position);
      setShowPositionDialog(true);
    }
  }, [interactive]);

  // Auto-refresh functionality
  useEffect(() => {
    if (realTimeUpdates) {
      const interval = setInterval(() => {
        refetchPositions();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [realTimeUpdates, refetchPositions]);

  // Enhanced mouse controls for 3D
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (viewMode === '3D' && interactive && cameraControllerRef.current) {
      e.preventDefault();
      cameraControllerRef.current.startDrag(e.clientX, e.clientY);
    }
  }, [viewMode, interactive]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (viewMode === '3D' && cameraControllerRef.current) {
      e.preventDefault();
      cameraControllerRef.current.drag(e.clientX, e.clientY);
    }
  }, [viewMode]);

  const handleMouseUp = useCallback(() => {
    if (viewMode === '3D' && cameraControllerRef.current) {
      cameraControllerRef.current.endDrag();
    }
  }, [viewMode]);

  // Enhanced wheel zoom for 3D
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (viewMode === '3D' && cameraControllerRef.current) {
      e.preventDefault();
      cameraControllerRef.current.zoom(e.deltaY);
    }
  }, [viewMode]);

  // Camera control functions
  const resetCamera = useCallback(() => {
    if (cameraControllerRef.current) {
      cameraControllerRef.current.reset();
    }
  }, []);

  const toggleAutoRotate = useCallback(() => {
    if (cameraControllerRef.current) {
      cameraControllerRef.current.toggleAutoRotate();
    }
  }, []);

  const zoomIn = useCallback(() => {
    if (cameraControllerRef.current) {
      cameraControllerRef.current.setZoom(cameraState.zoom + 0.1);
    }
  }, [cameraState.zoom]);

  const zoomOut = useCallback(() => {
    if (cameraControllerRef.current) {
      cameraControllerRef.current.setZoom(cameraState.zoom - 0.1);
    }
  }, [cameraState.zoom]);

  const rotateUp = useCallback(() => {
    if (cameraControllerRef.current) {
      cameraControllerRef.current.rotateX(-10);
    }
  }, []);

  const rotateDown = useCallback(() => {
    if (cameraControllerRef.current) {
      cameraControllerRef.current.rotateX(10);
    }
  }, []);

  const rotateLeft = useCallback(() => {
    if (cameraControllerRef.current) {
      cameraControllerRef.current.rotateY(-10);
    }
  }, []);

  const rotateRight = useCallback(() => {
    if (cameraControllerRef.current) {
      cameraControllerRef.current.rotateY(10);
    }
  }, []);

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="text-center">
            <Skeleton className="h-8 w-16 mx-auto mb-2" />
            <Skeleton className="h-4 w-20 mx-auto" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, level) => (
          <div key={level} className="flex items-center gap-3">
            <Skeleton className="h-4 w-20" />
            <div className="flex gap-2">
              {Array.from({ length: 5 }, (_, pos) => (
                <Skeleton key={pos} className="w-12 h-12 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Error component
  const ErrorDisplay = () => (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        Erro ao carregar dados das posições. 
        <Button 
          variant="link" 
          className="p-0 h-auto ml-2" 
          onClick={() => refetchPositions()}
        >
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  );

  // Professional 3D View Component
  const ThreeDView = () => (
    <div 
      ref={containerRef}
      className="relative overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-8 min-h-[600px] cursor-grab active:cursor-grabbing select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{ 
        background: `
          radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.3) 0%, transparent 50%),
          linear-gradient(135deg, #1e293b 0%, #1e40af 50%, #3730a3 100%)
        `
      }}
    >
      {/* 3D Scene Container */}
      <div className="relative w-full h-full" style={{ perspective: '1500px' }}>
        <div 
          className="relative w-full h-full transform-gpu"
          style={{ 
            transformStyle: 'preserve-3d',
            transform: `
              rotateX(${cameraState.rotationX}deg) 
              rotateY(${cameraState.rotationY}deg) 
              scale(${cameraState.zoom})
              translateZ(-300px)
            `,
            transition: cameraState.isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {/* Enhanced Ground Plane */}
          <div 
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full h-4 bg-gradient-to-r from-gray-600 via-gray-500 to-gray-600 rounded-lg opacity-80"
            style={{
              transform: 'translateZ(-100px) rotateX(90deg)',
              width: `${structure.maxPositions * 100 + 200}px`,
              filter: 'blur(2px)',
            }}
          />
          
          {/* Professional Grid System */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `
                linear-gradient(rgba(59, 130, 246, 0.4) 1px, transparent 1px),
                linear-gradient(90deg, rgba(59, 130, 246, 0.4) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px',
              width: `${structure.maxPositions * 100 + 300}px`,
              height: `${(structure.maxLevels + 1) * 150 + 300}px`,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%) translateZ(-150px) rotateX(90deg)',
            }}
          />

          {/* Enhanced Level System */}
          {organizedPositions.map((levelPositions, level) => (
            <motion.div
              key={level}
              className="absolute left-1/2 transform -translate-x-1/2"
              initial={{ y: level * 120, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ 
                delay: level * 0.1, 
                duration: 0.6,
                ease: "easeOut"
              }}
              style={{
                transform: `translateZ(${(structure.maxLevels - level) * 80}px)`,
                zIndex: structure.maxLevels - level,
                bottom: `${level * 100}px`,
              }}
            >
              {/* Enhanced Level Platform */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 rounded-xl shadow-2xl opacity-90"
                style={{
                  width: `${structure.maxPositions * 80 + 60}px`,
                  height: '80px',
                  transform: 'translateZ(-20px)',
                  filter: 'blur(1px)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                }}
              />
              
              {/* Enhanced Level Label */}
              <div 
                className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-md px-6 py-3 rounded-full text-sm font-bold shadow-xl border border-gray-200"
                style={{
                  transform: 'translateZ(30px)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                }}
              >
                {level === 0 ? 'Térreo' : `Nível ${level}`}
                <Badge variant="secondary" className="ml-3 text-xs">
                  {levelPositions.filter(p => p?.status === 'ocupada').length}/{levelPositions.length}
                </Badge>
              </div>
              
              {/* Enhanced Positions Container */}
              <div 
                className="flex gap-5 justify-center items-center"
                style={{
                  transform: 'translateZ(20px)',
                }}
              >
                {levelPositions.map((position, posIndex) => {
                  const isHighlighted = highlightedLevels.includes(level);
                  const config = getPositionConfig(position, colorScheme);
                  
                  return (
                    <motion.div
                      key={`${level}-${posIndex}`}
                      className="relative"
                      initial={{ scale: 0, rotateY: -90 }}
                      animate={{ scale: 1, rotateY: 0 }}
                      transition={{ 
                        delay: level * 0.1 + posIndex * 0.05, 
                        duration: 0.5,
                        ease: "easeOut"
                      }}
                      style={{
                        transform: `translateZ(${posIndex * 8}px)`,
                      }}
                    >
                      {/* Enhanced Position Shadow */}
                      <div 
                        className="absolute inset-0 bg-black/30 rounded-xl blur-md"
                        style={{
                          transform: 'translateZ(-8px) translateY(8px)',
                          width: '100%',
                          height: '100%',
                        }}
                      />
                      
                      {/* Enhanced Position Container */}
                      <motion.div
                        className={`
                          relative w-20 h-24 rounded-xl border-2 flex flex-col items-center justify-center
                          ${config.color} ${config.textColor} cursor-pointer
                          ${isHighlighted ? 'ring-4 ring-blue-400 ring-opacity-60 scale-110' : ''}
                          hover:scale-125 hover:shadow-2xl transform-gpu
                          focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-60
                          transition-all duration-300 ease-out
                        `}
                        style={{
                          transform: `translateZ(${level * 15 + posIndex * 3}px)`,
                          boxShadow: `
                            0 15px 35px rgba(0,0,0,0.2),
                            0 8px 15px rgba(0,0,0,0.15),
                            inset 0 1px 0 rgba(255,255,255,0.4)
                          `,
                        }}
                        whileHover={{ 
                          scale: interactive ? 1.25 : 1,
                          rotateY: interactive ? 8 : 0,
                          z: 60,
                          transition: { duration: 0.2 }
                        }}
                        whileTap={{ 
                          scale: interactive ? 0.95 : 1,
                          transition: { duration: 0.1 }
                        }}
                        onClick={() => handlePositionClick(position)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handlePositionClick(position);
                          }
                        }}
                        tabIndex={interactive ? 0 : -1}
                        role={interactive ? "button" : undefined}
                        aria-label={position ? `${position.code} - ${config.description}` : 'Posição vazia'}
                        title={position ? `${position.code} - ${config.description}` : 'Posição vazia'}
                      >
                        {/* Enhanced Position Content */}
                        {position && (
                          <AnimatePresence>
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              className="flex flex-col items-center"
                            >
                              <div className="flex items-center gap-1 mb-2">
                                {config.icon}
                                <span className="text-sm font-bold">
                                  {posIndex + 1}
                                </span>
                              </div>
                              <div className="text-xs opacity-90 text-center leading-tight font-medium">
                                {position.code.split('-').pop()}
                              </div>
                            </motion.div>
                          </AnimatePresence>
                        )}
                        
                        {/* Enhanced Status Indicator */}
                        {position && (
                          <motion.div
                            className="absolute -top-3 -right-3 w-5 h-5 rounded-full border-2 border-white shadow-xl"
                            style={{
                              backgroundColor: position.status === 'ocupada' ? '#ef4444' :
                                             position.status === 'disponivel' ? '#22c55e' :
                                             position.status === 'reservada' ? '#eab308' :
                                             position.status === 'manutencao' ? '#3b82f6' : '#6b7280',
                              transform: 'translateZ(8px)',
                            }}
                            animate={{
                              scale: position.status === 'ocupada' ? [1, 1.3, 1] : 1,
                              boxShadow: position.status === 'ocupada' 
                                ? ['0 0 0 rgba(239, 68, 68, 0.4)', '0 0 25px rgba(239, 68, 68, 0.7)', '0 0 0 rgba(239, 68, 68, 0.4)']
                                : '0 4px 8px rgba(0,0,0,0.3)'
                            }}
                            transition={{
                              duration: 2.5,
                              repeat: position.status === 'ocupada' ? Infinity : 0,
                              ease: "easeInOut"
                            }}
                          />
                        )}
                        
                        {/* Enhanced Pulse Animation */}
                        {position?.status === 'ocupada' && (
                          <motion.div
                            className="absolute inset-0 rounded-xl border-2"
                            style={{
                              borderColor: 'rgba(239, 68, 68, 0.6)',
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              transform: 'translateZ(3px)',
                            }}
                            animate={{
                              scale: [1, 1.25, 1],
                              opacity: [0.4, 0.7, 0.4]
                            }}
                            transition={{
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          />
                        )}
                      </motion.div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))}
          
          {/* Enhanced Ambient Lighting */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.2) 0%, transparent 60%),
                radial-gradient(circle at 75% 75%, rgba(147, 51, 234, 0.2) 0%, transparent 60%),
                radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.05) 0%, transparent 100%)
              `,
              transform: 'translateZ(120px)',
            }}
          />
        </div>
      </div>
      
      {/* Professional 3D Controls Overlay */}
      {showControls && (
        <div className="absolute top-6 right-6 flex flex-col gap-3">
          {/* Main Controls Panel */}
          <div className="bg-white/95 backdrop-blur-md rounded-xl p-4 shadow-2xl border border-gray-200">
            <div className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Controles 3D
            </div>
            
            {/* Camera Controls */}
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-10 h-10 p-0 text-sm font-bold"
                  onClick={rotateUp}
                  aria-label="Rotacionar para cima"
                >
                  ↑
                </Button>
              </div>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-10 h-10 p-0 text-sm font-bold"
                  onClick={rotateLeft}
                  aria-label="Rotacionar esquerda"
                >
                  ←
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-10 h-10 p-0 text-sm font-bold"
                  onClick={rotateRight}
                  aria-label="Rotacionar direita"
                >
                  →
                </Button>
              </div>
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-10 h-10 p-0 text-sm font-bold"
                  onClick={rotateDown}
                  aria-label="Rotacionar para baixo"
                >
                  ↓
                </Button>
              </div>
            </div>
            
            {/* Zoom Controls */}
            <div className="flex gap-2 mb-3 justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="w-10 h-10 p-0"
                onClick={zoomOut}
                disabled={cameraState.zoom <= 0.3}
                aria-label="Diminuir zoom 3D"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-10 h-10 p-0"
                onClick={zoomIn}
                disabled={cameraState.zoom >= 2.5}
                aria-label="Aumentar zoom 3D"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Auto-rotate and Reset */}
            <div className="flex gap-2 justify-center">
              <Button
                variant={cameraState.autoRotate ? "default" : "ghost"}
                size="sm"
                className="w-10 h-10 p-0"
                onClick={toggleAutoRotate}
                aria-label="Auto-rotação"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-10 h-10 p-0"
                onClick={resetCamera}
                aria-label="Resetar câmera"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Instructions Panel */}
          <div className="bg-white/95 backdrop-blur-md rounded-xl p-3 shadow-2xl border border-gray-200">
            <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Como usar:
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <div>• Arraste para rotacionar</div>
              <div>• Scroll para zoom</div>
              <div>• Clique nas posições</div>
              <div>• Use os controles para precisão</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Toggle Controls Button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-6 left-6 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg border"
        onClick={() => setShowControls(!showControls)}
        aria-label="Alternar controles"
      >
        {showControls ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );

  // 2D View Component
  const TwoDView = () => (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-8 rounded-lg border shadow-lg overflow-x-auto">
      <div className="space-y-6" style={{ transform: `scale(${cameraState.zoom})`, transformOrigin: 'top left' }}>
        {organizedPositions.map((levelPositions, level) => (
          <motion.div 
            key={level} 
            className="relative"
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: level * 0.15, duration: 0.6 }}
          >
            {/* Level background */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-blue-50/50 rounded-xl border border-gray-200/50 -z-10" />
            
            <div className="flex items-center gap-6 p-4">
              {/* Level label with enhanced styling */}
              <div className="flex flex-col items-center min-w-[80px]">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                  {level === 0 ? 'Térreo' : `Nível ${level}`}
                </div>
                <div className="mt-2 text-xs text-gray-600 font-medium">
                  {levelPositions.length} posições
                </div>
              </div>
              
              {/* Positions grid */}
              <div className="flex gap-3 flex-wrap">
                {levelPositions.map((position, posIndex) => {
                  const isHighlighted = highlightedLevels.includes(level);
                  const config = getPositionConfig(position, colorScheme);
                  
                  return (
                    <motion.div
                      key={`${level}-${posIndex}`}
                      className="relative group"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ 
                        delay: level * 0.15 + posIndex * 0.05, 
                        duration: 0.5,
                        ease: "easeOut"
                      }}
                      whileHover={{ 
                        scale: interactive ? 1.1 : 1,
                        y: interactive ? -5 : 0
                      }}
                    >
                      {/* Position shadow */}
                      <div className="absolute inset-0 bg-black/10 rounded-lg blur-sm transform translate-y-1" />
                      
                      {/* Position container */}
                      <motion.div
                        className={`
                          relative w-14 h-14 rounded-lg border-2 flex flex-col items-center justify-center
                          ${config.color} ${config.textColor} cursor-pointer transition-all duration-300
                          ${isHighlighted ? 'ring-4 ring-blue-400 ring-opacity-60 scale-110' : ''}
                          hover:scale-110 hover:shadow-xl transform-gpu
                          focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-60
                          group-hover:shadow-2xl
                        `}
                        style={{
                          boxShadow: `
                            0 4px 12px rgba(0,0,0,0.1),
                            0 2px 4px rgba(0,0,0,0.05),
                            inset 0 1px 0 rgba(255,255,255,0.3)
                          `,
                        }}
                        onClick={() => handlePositionClick(position)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handlePositionClick(position);
                          }
                        }}
                        tabIndex={interactive ? 0 : -1}
                        role={interactive ? "button" : undefined}
                        aria-label={position ? `${position.code} - ${config.description}` : 'Posição vazia'}
                        title={position ? `${position.code} - ${config.description}` : 'Posição vazia'}
                      >
                        {position && (
                          <AnimatePresence>
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              className="flex flex-col items-center"
                            >
                              <div className="flex items-center gap-1">
                                {config.icon}
                                <span className="text-xs font-bold">
                                  {posIndex + 1}
                                </span>
                              </div>
                            </motion.div>
                          </AnimatePresence>
                        )}
                        
                        {/* Status indicator */}
                        {position && (
                          <motion.div
                            className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-lg"
                            style={{
                              backgroundColor: position.status === 'ocupada' ? '#ef4444' :
                                             position.status === 'disponivel' ? '#22c55e' :
                                             position.status === 'reservada' ? '#eab308' :
                                             position.status === 'manutencao' ? '#3b82f6' : '#6b7280'
                            }}
                            animate={{
                              scale: position.status === 'ocupada' ? [1, 1.3, 1] : 1,
                              boxShadow: position.status === 'ocupada' 
                                ? ['0 0 0 rgba(239, 68, 68, 0.4)', '0 0 8px rgba(239, 68, 68, 0.6)', '0 0 0 rgba(239, 68, 68, 0.4)']
                                : '0 1px 3px rgba(0,0,0,0.2)'
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: position.status === 'ocupada' ? Infinity : 0,
                              ease: "easeInOut"
                            }}
                          />
                        )}
                        
                        {/* Pulse animation for occupied positions */}
                        {position?.status === 'ocupada' && (
                          <motion.div
                            className="absolute inset-0 rounded-lg border-2"
                            style={{
                              borderColor: 'rgba(239, 68, 68, 0.5)',
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            }}
                            animate={{
                              scale: [1, 1.15, 1],
                              opacity: [0.3, 0.6, 0.3]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          />
                        )}
                      </motion.div>
                      
                      {/* Tooltip */}
                      {position && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                          {position.code}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
              
              {/* Enhanced level statistics */}
              <div className="flex flex-col gap-1 text-xs text-gray-600 ml-4 min-w-[120px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span>{levelPositions.filter(p => p?.status === 'ocupada').length} ocupadas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span>{levelPositions.filter(p => p?.status === 'disponivel').length} livres</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                  <span>{levelPositions.filter(p => p?.status === 'reservada').length} reservadas</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-blue-600" />
              {structure.name}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-600">
              <Badge variant="secondary" className="text-xs">
                Rua {structure.street} - {structure.side === 'E' ? 'Esquerdo' : 'Direito'}
              </Badge>
              <Badge 
                variant={stats.occupancyRate > 80 ? 'destructive' : stats.occupancyRate > 60 ? 'secondary' : 'default'}
                className="text-xs"
              >
                {stats.occupancyRate}% ocupado
              </Badge>
              {realTimeUpdates && (
                <Badge variant="outline" className="text-xs">
                  <Truck className="h-3 w-3 mr-1" />
                  Tempo Real
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border p-1">
              <Button
                variant={viewMode === '2D' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('2D')}
                className="px-2 py-1 text-xs"
                aria-label="Visualização 2D"
              >
                2D
              </Button>
              <Button
                variant={viewMode === '3D' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('3D')}
                className="px-2 py-1 text-xs"
                aria-label="Visualização 3D"
              >
                3D
              </Button>
            </div>
            
            {/* Zoom Controls */}
            <div className="flex rounded-lg border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cameraState.zoom = Math.max(0.5, cameraState.zoom - 0.1)}
                disabled={cameraState.zoom <= 0.5}
                aria-label="Diminuir zoom"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cameraState.zoom = Math.min(2, cameraState.zoom + 0.1)}
                disabled={cameraState.zoom >= 2}
                aria-label="Aumentar zoom"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Settings */}
            <Button variant="outline" size="sm" aria-label="Configurações">
              <Settings className="h-4 w-4" />
            </Button>
            
            {realTimeUpdates && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetchPositions()}
                disabled={isLoading}
                aria-label="Atualizar dados"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Statistics Overview */}
        {showStats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-600">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.available}</div>
              <div className="text-xs text-gray-600">Disponível</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.occupied}</div>
              <div className="text-xs text-gray-600">Ocupada</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.reserved}</div>
              <div className="text-xs text-gray-600">Reservada</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.maintenance}</div>
              <div className="text-xs text-gray-600">Manutenção</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.blocked}</div>
              <div className="text-xs text-gray-600">Bloqueada</div>
            </div>
          </div>
        )}

        <Separator />

        {/* 3D/2D Visualization */}
        <div className="min-h-[400px]">
          {isLoading && <LoadingSkeleton />}
          {error && <ErrorDisplay />}
          {!isLoading && !error && (viewMode === '3D' ? <ThreeDView /> : <TwoDView />)}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-sm p-4 bg-gray-50 rounded-lg">
          <span className="font-medium">Legenda:</span>
          {[
            { status: 'disponivel', config: getPositionConfig({ status: 'disponivel' } as Position, colorScheme) },
            { status: 'ocupada', config: getPositionConfig({ status: 'ocupada' } as Position, colorScheme) },
            { status: 'reservada', config: getPositionConfig({ status: 'reservada' } as Position, colorScheme) },
            { status: 'manutencao', config: getPositionConfig({ status: 'manutencao' } as Position, colorScheme) },
            { status: 'bloqueada', config: getPositionConfig({ status: 'bloqueada' } as Position, colorScheme) }
          ].map(({ status, config }) => (
            <div key={status} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded border-2 ${config.color} flex items-center justify-center`}>
                {config.icon}
              </div>
              <span>{config.label}</span>
            </div>
          ))}
        </div>

        {/* Level Highlight Controls */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Destacar níveis:</span>
          <div className="flex gap-1">
            {Array.from({ length: structure.maxLevels + 1 }, (_, level) => (
              <Button
                key={level}
                variant={highlightedLevels.includes(level) ? 'default' : 'outline'}
                size="sm"
                className="w-8 h-8 p-0 text-xs"
                onClick={() => {
                  setHighlightedLevels(prev => 
                    prev.includes(level) 
                      ? prev.filter(l => l !== level)
                      : [...prev, level]
                  );
                }}
                aria-label={`Destacar nível ${level === 0 ? 'térreo' : level}`}
              >
                {level === 0 ? 'T' : level}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHighlightedLevels([])}
              className="text-xs"
              aria-label="Limpar destaque"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Position Details Dialog */}
      <Dialog open={showPositionDialog} onOpenChange={setShowPositionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Detalhes da Posição
            </DialogTitle>
          </DialogHeader>
          
          {selectedPosition && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Código:</span>
                  <p className="mt-1 font-mono">{selectedPosition.code}</p>
                </div>
                <div>
                  <span className="font-medium">Status:</span>
                  <div className="mt-1">
                    <Badge className={getPositionConfig(selectedPosition, colorScheme).color}>
                      {getPositionConfig(selectedPosition, colorScheme).label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="font-medium">Nível:</span>
                  <p className="mt-1">{selectedPosition.level === 0 ? 'Térreo' : `Nível ${selectedPosition.level}`}</p>
                </div>
                <div>
                  <span className="font-medium">Posição:</span>
                  <p className="mt-1">{selectedPosition.position}</p>
                </div>
              </div>
              
              {selectedPosition.currentPalletId && (
                <div>
                  <span className="font-medium">Pallet Atual:</span>
                  <p className="mt-1">ID: {selectedPosition.currentPalletId}</p>
                </div>
              )}
              
              {selectedPosition.observations && (
                <div>
                  <span className="font-medium">Observações:</span>
                  <p className="mt-1 text-sm text-gray-600">{selectedPosition.observations}</p>
                </div>
              )}
              
              <div className="text-xs text-gray-500">
                <p>Atualizado em: {selectedPosition.updatedAt ? new Date(selectedPosition.updatedAt).toLocaleString() : 'N/A'}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default EnhancedPalletStructureSimulator;