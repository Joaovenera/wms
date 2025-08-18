import React, { useRef, useEffect, useCallback } from 'react';

interface GestureHandlerProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPinch?: (scale: number) => void;
  onTap?: (event: React.TouchEvent) => void;
  onDoubleTap?: (event: React.TouchEvent) => void;
  onLongPress?: (event: React.TouchEvent) => void;
  onPullToRefresh?: () => Promise<void>;
  enabled?: boolean;
  className?: string;
  swipeThreshold?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
}

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

export function GestureHandler({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onPinch,
  onTap,
  onDoubleTap,
  onLongPress,
  onPullToRefresh,
  enabled = true,
  className,
  swipeThreshold = 50,
  longPressDelay = 500,
  doubleTapDelay = 300
}: GestureHandlerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<TouchPoint | null>(null);
  const touchCurrent = useRef<TouchPoint | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastTap = useRef<TouchPoint | null>(null);
  const initialDistance = useRef<number>(0);
  const isPullToRefresh = useRef<boolean>(false);
  const refreshStartY = useRef<number>(0);

  // Calculate distance between two touch points
  const getDistance = useCallback((touch1: Touch, touch2: Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Calculate swipe direction and distance
  const getSwipeDirection = useCallback((start: TouchPoint, end: TouchPoint) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Check if movement is significant enough
    if (Math.max(absDx, absDy) < swipeThreshold) {
      return null;
    }

    // Determine primary direction
    if (absDx > absDy) {
      return dx > 0 ? 'right' : 'left';
    } else {
      return dy > 0 ? 'down' : 'up';
    }
  }, [swipeThreshold]);

  // Haptic feedback helper
  const triggerHaptic = useCallback((pattern?: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern || 10);
    }
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;

    const touch = e.touches[0];
    const touchPoint: TouchPoint = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };

    touchStart.current = touchPoint;
    touchCurrent.current = touchPoint;

    // Handle multi-touch for pinch
    if (e.touches.length === 2) {
      initialDistance.current = getDistance(e.touches[0], e.touches[1]);
    }

    // Start long press timer
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        if (touchCurrent.current && touchStart.current) {
          const distance = Math.sqrt(
            Math.pow(touchCurrent.current.x - touchStart.current.x, 2) +
            Math.pow(touchCurrent.current.y - touchStart.current.y, 2)
          );
          
          // Only trigger if finger hasn't moved much
          if (distance < 10) {
            triggerHaptic([20, 10, 20]);
            onLongPress(e);
          }
        }
      }, longPressDelay);
    }

    // Check for pull to refresh
    if (onPullToRefresh && window.scrollY === 0) {
      isPullToRefresh.current = true;
      refreshStartY.current = touch.clientY;
    }
  }, [enabled, onLongPress, longPressDelay, getDistance, triggerHaptic, onPullToRefresh]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !touchStart.current) return;

    const touch = e.touches[0];
    touchCurrent.current = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };

    // Clear long press timer on movement
    if (longPressTimer.current) {
      const distance = Math.sqrt(
        Math.pow(touchCurrent.current.x - touchStart.current.x, 2) +
        Math.pow(touchCurrent.current.y - touchStart.current.y, 2)
      );
      
      if (distance > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    // Handle pinch gesture
    if (e.touches.length === 2 && onPinch) {
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialDistance.current;
      onPinch(scale);
    }

    // Handle pull to refresh
    if (isPullToRefresh.current && onPullToRefresh) {
      const deltaY = touch.clientY - refreshStartY.current;
      
      if (deltaY > 100) {
        // Visual feedback could be added here
        document.body.style.overflow = 'hidden';
      }
    }
  }, [enabled, onPinch, getDistance, onPullToRefresh]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enabled || !touchStart.current || !touchCurrent.current) return;

    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const endPoint = touchCurrent.current;
    const startPoint = touchStart.current;

    // Handle pull to refresh
    if (isPullToRefresh.current && onPullToRefresh) {
      const deltaY = endPoint.y - refreshStartY.current;
      
      if (deltaY > 100) {
        triggerHaptic(20);
        onPullToRefresh().finally(() => {
          document.body.style.overflow = '';
        });
      } else {
        document.body.style.overflow = '';
      }
      
      isPullToRefresh.current = false;
    }

    // Check for swipe gestures
    const swipeDirection = getSwipeDirection(startPoint, endPoint);
    
    if (swipeDirection) {
      triggerHaptic();
      
      switch (swipeDirection) {
        case 'left':
          onSwipeLeft?.();
          break;
        case 'right':
          onSwipeRight?.();
          break;
        case 'up':
          onSwipeUp?.();
          break;
        case 'down':
          onSwipeDown?.();
          break;
      }
    } else {
      // Handle tap gestures
      const tapDuration = endPoint.timestamp - startPoint.timestamp;
      const tapDistance = Math.sqrt(
        Math.pow(endPoint.x - startPoint.x, 2) +
        Math.pow(endPoint.y - startPoint.y, 2)
      );

      // Only consider it a tap if finger didn't move much and was quick
      if (tapDuration < 300 && tapDistance < 10) {
        // Check for double tap
        if (onDoubleTap && lastTap.current) {
          const timeSinceLastTap = endPoint.timestamp - lastTap.current.timestamp;
          const distanceFromLastTap = Math.sqrt(
            Math.pow(endPoint.x - lastTap.current.x, 2) +
            Math.pow(endPoint.y - lastTap.current.y, 2)
          );

          if (timeSinceLastTap < doubleTapDelay && distanceFromLastTap < 50) {
            triggerHaptic([10, 5, 10]);
            onDoubleTap(e);
            lastTap.current = null;
            return;
          }
        }

        // Single tap
        if (onTap) {
          triggerHaptic();
          onTap(e);
        }

        lastTap.current = endPoint;
        
        // Clear last tap after delay
        setTimeout(() => {
          lastTap.current = null;
        }, doubleTapDelay);
      }
    }

    // Reset touch points
    touchStart.current = null;
    touchCurrent.current = null;
  }, [
    enabled,
    getSwipeDirection,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
    doubleTapDelay,
    triggerHaptic,
    onPullToRefresh
  ]);

  // Prevent context menu on long press
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (enabled && onLongPress) {
      e.preventDefault();
    }
  }, [enabled, onLongPress]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={handleContextMenu}
      style={{
        touchAction: enabled ? 'manipulation' : 'auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
    >
      {children}
    </div>
  );
}

// Hook for gesture handling
export function useGestures(options: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPullToRefresh?: () => Promise<void>;
  enabled?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current || !options.enabled) return;

    const element = ref.current;
    let touchStart: TouchPoint | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStart = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          timestamp: Date.now()
        };
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart || e.changedTouches.length !== 1) return;

      const touchEnd = {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY,
        timestamp: Date.now()
      };

      const dx = touchEnd.x - touchStart.x;
      const dy = touchEnd.y - touchStart.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) < 50) return;

      if (absDx > absDy) {
        if (dx > 0) {
          options.onSwipeRight?.();
        } else {
          options.onSwipeLeft?.();
        }
      } else {
        if (dy > 0) {
          options.onSwipeDown?.();
        } else {
          options.onSwipeUp?.();
        }
      }

      touchStart = null;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [options]);

  return ref;
}

export default GestureHandler;