import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Check, 
  X, 
  Plus, 
  Minus, 
  MoreHorizontal,
  Trash2,
  Edit,
  Eye,
  ArrowRight
} from 'lucide-react';

interface TouchOptimizedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  onLongPress?: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'xl';
  disabled?: boolean;
  className?: string;
  hapticFeedback?: boolean;
  rippleEffect?: boolean;
}

export function TouchOptimizedButton({
  children,
  onClick,
  onLongPress,
  variant = 'default',
  size = 'default',
  disabled = false,
  className,
  hapticFeedback = true,
  rippleEffect = true,
  ...props
}: TouchOptimizedButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [showRipple, setShowRipple] = useState(false);
  const [ripplePosition, setRipplePosition] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const sizeClasses = {
    default: 'min-h-[44px] px-4 py-3 text-base',
    sm: 'min-h-[40px] px-3 py-2 text-sm',
    lg: 'min-h-[52px] px-6 py-4 text-lg',
    xl: 'min-h-[60px] px-8 py-5 text-xl'
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    
    setIsPressed(true);
    
    // Haptic feedback
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    
    // Ripple effect
    if (rippleEffect && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      setRipplePosition({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      });
      setShowRipple(true);
      setTimeout(() => setShowRipple(false), 300);
    }
    
    // Long press timer
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        if (hapticFeedback && 'vibrate' in navigator) {
          navigator.vibrate([20, 10, 20]);
        }
        onLongPress();
      }, 500);
    }
  };

  const handleTouchEnd = () => {
    setIsPressed(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
  };

  return (
    <Button
      ref={buttonRef}
      variant={variant}
      disabled={disabled}
      className={cn(
        sizeClasses[size],
        'relative overflow-hidden transition-all duration-150 select-none',
        'active:scale-95 active:brightness-95',
        isPressed && 'scale-95 brightness-95',
        // Enhanced touch targets for industrial gloves
        'touch-manipulation',
        // High contrast support
        'contrast-more:border-2 contrast-more:border-current',
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onClick={handleClick}
      {...props}
    >
      {children}
      
      {/* Ripple effect */}
      {showRipple && rippleEffect && (
        <span
          className="absolute bg-white/30 rounded-full animate-ping pointer-events-none"
          style={{
            left: ripplePosition.x - 10,
            top: ripplePosition.y - 10,
            width: 20,
            height: 20,
          }}
        />
      )}
    </Button>
  );
}

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: {
    icon: React.ReactNode;
    label: string;
    color: 'green' | 'red' | 'blue' | 'orange';
  };
  rightAction?: {
    icon: React.ReactNode;
    label: string;
    color: 'green' | 'red' | 'blue' | 'orange';
  };
  className?: string;
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  className
}: SwipeableCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const actionColors = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    orange: 'bg-orange-500'
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startX.current = e.touches[0].clientX;
    currentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    currentX.current = e.touches[0].clientX;
    const diffX = currentX.current - startX.current;
    
    // Limit swipe distance
    const maxSwipe = 120;
    const limitedDiff = Math.max(-maxSwipe, Math.min(maxSwipe, diffX));
    setSwipeOffset(limitedDiff);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    const diffX = currentX.current - startX.current;
    const threshold = 60;
    
    if (diffX > threshold && onSwipeRight) {
      onSwipeRight();
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(20);
      }
    } else if (diffX < -threshold && onSwipeLeft) {
      onSwipeLeft();
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(20);
      }
    }
    
    setSwipeOffset(0);
  };

  return (
    <div className={cn('relative overflow-hidden rounded-lg', className)}>
      {/* Left action background */}
      {rightAction && swipeOffset > 0 && (
        <div className={cn(
          'absolute left-0 top-0 bottom-0 flex items-center justify-start px-4',
          actionColors[rightAction.color],
          'text-white'
        )}>
          <div className="flex items-center gap-2">
            {rightAction.icon}
            <span className="font-medium">{rightAction.label}</span>
          </div>
        </div>
      )}
      
      {/* Right action background */}
      {leftAction && swipeOffset < 0 && (
        <div className={cn(
          'absolute right-0 top-0 bottom-0 flex items-center justify-end px-4',
          actionColors[leftAction.color],
          'text-white'
        )}>
          <div className="flex items-center gap-2">
            <span className="font-medium">{leftAction.label}</span>
            {leftAction.icon}
          </div>
        </div>
      )}
      
      {/* Main content */}
      <div
        ref={cardRef}
        className={cn(
          'bg-white transition-transform duration-200 touch-pan-x',
          isDragging ? 'duration-0' : 'duration-200'
        )}
        style={{
          transform: `translateX(${swipeOffset}px)`
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

interface QuantityControllerProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
}

export function QuantityController({
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 1,
  label,
  disabled = false
}: QuantityControllerProps) {
  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleDecrease = () => {
    const newValue = Math.max(min, value - step);
    onChange(newValue);
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  const handleIncrease = () => {
    const newValue = Math.min(max, value + step);
    onChange(newValue);
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    const numValue = parseFloat(newValue);
    if (!isNaN(numValue) && numValue >= min && numValue <= max) {
      onChange(numValue);
    }
  };

  const handleInputBlur = () => {
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) {
      setInputValue(value.toString());
    } else {
      const clampedValue = Math.max(min, Math.min(max, numValue));
      setInputValue(clampedValue.toString());
      onChange(clampedValue);
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="flex items-center bg-gray-50 rounded-lg p-1">
        <TouchOptimizedButton
          variant="ghost"
          size="lg"
          onClick={handleDecrease}
          disabled={disabled || value <= min}
          className="rounded-md"
        >
          <Minus className="h-5 w-5" />
        </TouchOptimizedButton>
        
        <div className="flex-1 px-2">
          <input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            disabled={disabled}
            className="w-full text-center text-lg font-semibold bg-transparent border-none outline-none"
            style={{ MozAppearance: 'textfield' }}
          />
        </div>
        
        <TouchOptimizedButton
          variant="ghost"
          size="lg"
          onClick={handleIncrease}
          disabled={disabled || value >= max}
          className="rounded-md"
        >
          <Plus className="h-5 w-5" />
        </TouchOptimizedButton>
      </div>
    </div>
  );
}

// Common action buttons for warehouse operations
export const ActionButtons = {
  Complete: ({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) => (
    <TouchOptimizedButton
      variant="default"
      size="lg"
      onClick={onClick}
      disabled={disabled}
      className="bg-green-600 hover:bg-green-700 text-white"
    >
      <Check className="h-5 w-5 mr-2" />
      Completar
    </TouchOptimizedButton>
  ),
  
  Cancel: ({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) => (
    <TouchOptimizedButton
      variant="destructive"
      size="lg"
      onClick={onClick}
      disabled={disabled}
    >
      <X className="h-5 w-5 mr-2" />
      Cancelar
    </TouchOptimizedButton>
  ),
  
  Edit: ({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) => (
    <TouchOptimizedButton
      variant="outline"
      size="lg"
      onClick={onClick}
      disabled={disabled}
    >
      <Edit className="h-4 w-4 mr-2" />
      Editar
    </TouchOptimizedButton>
  ),
  
  View: ({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) => (
    <TouchOptimizedButton
      variant="outline"
      size="lg"
      onClick={onClick}
      disabled={disabled}
    >
      <Eye className="h-4 w-4 mr-2" />
      Visualizar
    </TouchOptimizedButton>
  )
};

export default {
  TouchOptimizedButton,
  SwipeableCard,
  QuantityController,
  ActionButtons
};