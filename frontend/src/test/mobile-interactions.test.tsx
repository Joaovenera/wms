/**
 * Mobile Interactions Test Suite
 * Comprehensive testing for touch interactions, gestures, and mobile-specific behaviors
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

import { TouchOptimizedButton, SwipeableCard, QuantityController, ActionButtons } from '../components/mobile/TouchOptimizedControls';
import { GestureHandler, useGestures } from '../components/mobile/GestureHandler';
import LoadingExecutionScreenMobile from '../components/loading-execution-screen-mobile';

// Mock navigator APIs
Object.defineProperty(navigator, 'vibrate', {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true,
});

// Mock touch events
const createTouchEvent = (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as any;
  event.touches = touches;
  event.changedTouches = touches;
  return event;
};

describe('Mobile Touch Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TouchOptimizedButton', () => {
    it('should provide haptic feedback on touch', async () => {
      const mockOnClick = vi.fn();
      
      render(
        <TouchOptimizedButton onClick={mockOnClick} hapticFeedback={true}>
          Touch Me
        </TouchOptimizedButton>
      );
      
      const button = screen.getByRole('button', { name: /touch me/i });
      
      // Simulate touch start
      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      fireEvent(button, touchStartEvent);
      
      expect(navigator.vibrate).toHaveBeenCalledWith(10);
    });

    it('should handle long press gestures', async () => {
      const mockOnClick = vi.fn();
      const mockOnLongPress = vi.fn();
      
      render(
        <TouchOptimizedButton 
          onClick={mockOnClick} 
          onLongPress={mockOnLongPress}
          hapticFeedback={true}
        >
          Long Press Me
        </TouchOptimizedButton>
      );
      
      const button = screen.getByRole('button', { name: /long press me/i });
      
      // Start touch
      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      fireEvent(button, touchStartEvent);
      
      // Wait for long press delay (500ms)
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(mockOnLongPress).toHaveBeenCalled();
      expect(navigator.vibrate).toHaveBeenCalledWith([20, 10, 20]);
    });

    it('should show ripple effect on touch', () => {
      render(
        <TouchOptimizedButton rippleEffect={true}>
          Ripple Button
        </TouchOptimizedButton>
      );
      
      const button = screen.getByRole('button', { name: /ripple button/i });
      
      // Touch with specific coordinates
      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 150, clientY: 150 }]);
      fireEvent(button, touchStartEvent);
      
      // Should create ripple element
      const ripple = button.querySelector('.animate-ping');
      expect(ripple).toBeInTheDocument();
    });

    it('should support different sizes for touch targets', () => {
      const { rerender } = render(
        <TouchOptimizedButton size="default">Default</TouchOptimizedButton>
      );
      
      expect(screen.getByRole('button')).toHaveClass('min-h-[44px]');
      
      rerender(<TouchOptimizedButton size="lg">Large</TouchOptimizedButton>);
      expect(screen.getByRole('button')).toHaveClass('min-h-[52px]');
      
      rerender(<TouchOptimizedButton size="xl">Extra Large</TouchOptimizedButton>);
      expect(screen.getByRole('button')).toHaveClass('min-h-[60px]');
    });

    it('should handle disabled state properly', () => {
      const mockOnClick = vi.fn();
      
      render(
        <TouchOptimizedButton onClick={mockOnClick} disabled={true}>
          Disabled Button
        </TouchOptimizedButton>
      );
      
      const button = screen.getByRole('button', { name: /disabled button/i });
      
      expect(button).toBeDisabled();
      
      // Touch events should not trigger actions
      const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      fireEvent(button, touchStartEvent);
      
      expect(navigator.vibrate).not.toHaveBeenCalled();
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('SwipeableCard', () => {
    it('should detect swipe left gesture', async () => {
      const mockSwipeLeft = vi.fn();
      
      render(
        <SwipeableCard 
          onSwipeLeft={mockSwipeLeft}
          leftAction={{ icon: <div>Delete</div>, label: 'Delete', color: 'red' }}
        >
          <div>Swipeable Content</div>
        </SwipeableCard>
      );
      
      const card = screen.getByText('Swipeable Content').closest('div')!;
      
      // Start swipe
      const touchStart = createTouchEvent('touchstart', [{ clientX: 200, clientY: 100 }]);
      fireEvent(card, touchStart);
      
      // Move left
      const touchMove = createTouchEvent('touchmove', [{ clientX: 100, clientY: 100 }]);
      fireEvent(card, touchMove);
      
      // End swipe
      const touchEnd = createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]);
      fireEvent(card, touchEnd);
      
      expect(mockSwipeLeft).toHaveBeenCalled();
      expect(navigator.vibrate).toHaveBeenCalledWith(20);
    });

    it('should detect swipe right gesture', async () => {
      const mockSwipeRight = vi.fn();
      
      render(
        <SwipeableCard 
          onSwipeRight={mockSwipeRight}
          rightAction={{ icon: <div>Edit</div>, label: 'Edit', color: 'blue' }}
        >
          <div>Swipeable Content</div>
        </SwipeableCard>
      );
      
      const card = screen.getByText('Swipeable Content').closest('div')!;
      
      // Start swipe
      const touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      fireEvent(card, touchStart);
      
      // Move right
      const touchMove = createTouchEvent('touchmove', [{ clientX: 200, clientY: 100 }]);
      fireEvent(card, touchMove);
      
      // End swipe
      const touchEnd = createTouchEvent('touchend', [{ clientX: 200, clientY: 100 }]);
      fireEvent(card, touchEnd);
      
      expect(mockSwipeRight).toHaveBeenCalled();
      expect(navigator.vibrate).toHaveBeenCalledWith(20);
    });

    it('should show action backgrounds during swipe', () => {
      render(
        <SwipeableCard 
          onSwipeLeft={() => {}}
          onSwipeRight={() => {}}
          leftAction={{ icon: <div>Delete</div>, label: 'Delete', color: 'red' }}
          rightAction={{ icon: <div>Edit</div>, label: 'Edit', color: 'blue' }}
        >
          <div>Content</div>
        </SwipeableCard>
      );
      
      const card = screen.getByText('Content').closest('div')!.parentElement!;
      
      // Start swipe right
      const touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      fireEvent(card.querySelector('[data-swipeable]') || card, touchStart);
      
      // Move right (should show left action)
      const touchMove = createTouchEvent('touchmove', [{ clientX: 150, clientY: 100 }]);
      fireEvent(card.querySelector('[data-swipeable]') || card, touchMove);
      
      // Should show action background
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('should limit swipe distance', () => {
      render(
        <SwipeableCard onSwipeLeft={() => {}}>
          <div>Limited Swipe</div>
        </SwipeableCard>
      );
      
      const card = screen.getByText('Limited Swipe').closest('div')!;
      
      // Extreme swipe
      const touchStart = createTouchEvent('touchstart', [{ clientX: 300, clientY: 100 }]);
      fireEvent(card, touchStart);
      
      const touchMove = createTouchEvent('touchmove', [{ clientX: 0, clientY: 100 }]);
      fireEvent(card, touchMove);
      
      // Transform should be limited to maxSwipe (120px)
      const transform = card.style.transform;
      const translateX = transform.match(/translateX\((-?\d+)px\)/);
      if (translateX) {
        expect(Math.abs(parseInt(translateX[1]))).toBeLessThanOrEqual(120);
      }
    });
  });

  describe('QuantityController', () => {
    it('should handle touch increment/decrement', async () => {
      const mockOnChange = vi.fn();
      
      render(
        <QuantityController 
          value={10} 
          onChange={mockOnChange} 
          min={0} 
          max={100}
        />
      );
      
      const incrementButton = screen.getByRole('button', { name: '' }).parentElement?.querySelector('[aria-label*="plus"], .lucide-plus')?.closest('button');
      const decrementButton = screen.getByRole('button', { name: '' }).parentElement?.querySelector('[aria-label*="minus"], .lucide-minus')?.closest('button');
      
      // Test increment
      if (incrementButton) {
        const touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
        fireEvent(incrementButton, touchStart);
        
        const touchEnd = createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]);
        fireEvent(incrementButton, touchEnd);
        
        fireEvent.click(incrementButton);
        
        expect(mockOnChange).toHaveBeenCalledWith(11);
        expect(navigator.vibrate).toHaveBeenCalledWith(10);
      }
      
      // Test decrement
      if (decrementButton) {
        const touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
        fireEvent(decrementButton, touchStart);
        
        const touchEnd = createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]);
        fireEvent(decrementButton, touchEnd);
        
        fireEvent.click(decrementButton);
        
        expect(mockOnChange).toHaveBeenCalledWith(9);
      }
    });

    it('should validate input bounds', async () => {
      const mockOnChange = vi.fn();
      
      render(
        <QuantityController 
          value={10} 
          onChange={mockOnChange} 
          min={5} 
          max={15}
        />
      );
      
      const input = screen.getByRole('spinbutton');
      
      // Test valid input
      fireEvent.change(input, { target: { value: '12' } });
      expect(mockOnChange).toHaveBeenCalledWith(12);
      
      // Test invalid input (too high)
      fireEvent.change(input, { target: { value: '20' } });
      expect(mockOnChange).not.toHaveBeenCalledWith(20);
      
      // Test invalid input (too low)
      fireEvent.change(input, { target: { value: '2' } });
      expect(mockOnChange).not.toHaveBeenCalledWith(2);
    });

    it('should handle decimal values correctly', async () => {
      const mockOnChange = vi.fn();
      
      render(
        <QuantityController 
          value={10.5} 
          onChange={mockOnChange} 
          step={0.1}
        />
      );
      
      const input = screen.getByRole('spinbutton');
      
      fireEvent.change(input, { target: { value: '10.7' } });
      expect(mockOnChange).toHaveBeenCalledWith(10.7);
    });

    it('should disable buttons at limits', () => {
      render(
        <QuantityController 
          value={0} 
          onChange={() => {}} 
          min={0} 
          max={10}
        />
      );
      
      const decrementButton = screen.getByRole('button', { name: '' }).parentElement?.querySelector('[aria-label*="minus"], .lucide-minus')?.closest('button');
      
      // Decrement button should be disabled at minimum
      expect(decrementButton).toBeDisabled();
      
      // Test at maximum
      render(
        <QuantityController 
          value={10} 
          onChange={() => {}} 
          min={0} 
          max={10}
        />
      );
      
      const incrementButton = screen.getByRole('button', { name: '' }).parentElement?.querySelector('[aria-label*="plus"], .lucide-plus')?.closest('button');
      
      // Increment button should be disabled at maximum
      expect(incrementButton).toBeDisabled();
    });
  });

  describe('GestureHandler', () => {
    it('should detect tap gestures', async () => {
      const mockOnTap = vi.fn();
      
      render(
        <GestureHandler onTap={mockOnTap}>
          <div>Tap Target</div>
        </GestureHandler>
      );
      
      const target = screen.getByText('Tap Target');
      
      // Quick tap
      const touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      fireEvent(target, touchStart);
      
      const touchEnd = createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]);
      fireEvent(target, touchEnd);
      
      expect(mockOnTap).toHaveBeenCalled();
      expect(navigator.vibrate).toHaveBeenCalledWith(10);
    });

    it('should detect double tap gestures', async () => {
      const mockOnDoubleTap = vi.fn();
      
      render(
        <GestureHandler onDoubleTap={mockOnDoubleTap} doubleTapDelay={300}>
          <div>Double Tap Target</div>
        </GestureHandler>
      );
      
      const target = screen.getByText('Double Tap Target');
      
      // First tap
      let touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      fireEvent(target, touchStart);
      let touchEnd = createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]);
      fireEvent(target, touchEnd);
      
      // Second tap within delay
      setTimeout(() => {
        touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
        fireEvent(target, touchStart);
        touchEnd = createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]);
        fireEvent(target, touchEnd);
      }, 100);
      
      await waitFor(() => {
        expect(mockOnDoubleTap).toHaveBeenCalled();
      });
      
      expect(navigator.vibrate).toHaveBeenCalledWith([10, 5, 10]);
    });

    it('should detect swipe gestures in all directions', () => {
      const mockOnSwipeLeft = vi.fn();
      const mockOnSwipeRight = vi.fn();
      const mockOnSwipeUp = vi.fn();
      const mockOnSwipeDown = vi.fn();
      
      render(
        <GestureHandler 
          onSwipeLeft={mockOnSwipeLeft}
          onSwipeRight={mockOnSwipeRight}
          onSwipeUp={mockOnSwipeUp}
          onSwipeDown={mockOnSwipeDown}
          swipeThreshold={50}
        >
          <div>Swipe Target</div>
        </GestureHandler>
      );
      
      const target = screen.getByText('Swipe Target');
      
      // Test swipe left
      let touchStart = createTouchEvent('touchstart', [{ clientX: 200, clientY: 100 }]);
      fireEvent(target, touchStart);
      let touchEnd = createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]);
      fireEvent(target, touchEnd);
      
      expect(mockOnSwipeLeft).toHaveBeenCalled();
      
      // Test swipe right
      touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      fireEvent(target, touchStart);
      touchEnd = createTouchEvent('touchend', [{ clientX: 200, clientY: 100 }]);
      fireEvent(target, touchEnd);
      
      expect(mockOnSwipeRight).toHaveBeenCalled();
      
      // Test swipe up
      touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 200 }]);
      fireEvent(target, touchStart);
      touchEnd = createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]);
      fireEvent(target, touchEnd);
      
      expect(mockOnSwipeUp).toHaveBeenCalled();
      
      // Test swipe down
      touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      fireEvent(target, touchStart);
      touchEnd = createTouchEvent('touchend', [{ clientX: 100, clientY: 200 }]);
      fireEvent(target, touchEnd);
      
      expect(mockOnSwipeDown).toHaveBeenCalled();
    });

    it('should detect long press gestures', async () => {
      const mockOnLongPress = vi.fn();
      
      render(
        <GestureHandler onLongPress={mockOnLongPress} longPressDelay={500}>
          <div>Long Press Target</div>
        </GestureHandler>
      );
      
      const target = screen.getByText('Long Press Target');
      
      // Start touch
      const touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      fireEvent(target, touchStart);
      
      // Wait for long press delay
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(mockOnLongPress).toHaveBeenCalled();
      expect(navigator.vibrate).toHaveBeenCalledWith([20, 10, 20]);
    });

    it('should cancel long press on movement', async () => {
      const mockOnLongPress = vi.fn();
      
      render(
        <GestureHandler onLongPress={mockOnLongPress} longPressDelay={500}>
          <div>Long Press Target</div>
        </GestureHandler>
      );
      
      const target = screen.getByText('Long Press Target');
      
      // Start touch
      const touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      fireEvent(target, touchStart);
      
      // Move finger (should cancel long press)
      const touchMove = createTouchEvent('touchmove', [{ clientX: 120, clientY: 120 }]);
      fireEvent(target, touchMove);
      
      // Wait past long press delay
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(mockOnLongPress).not.toHaveBeenCalled();
    });

    it('should detect pinch gestures', () => {
      const mockOnPinch = vi.fn();
      
      render(
        <GestureHandler onPinch={mockOnPinch}>
          <div>Pinch Target</div>
        </GestureHandler>
      );
      
      const target = screen.getByText('Pinch Target');
      
      // Start with two fingers
      const touchStart = new Event('touchstart', { bubbles: true }) as any;
      touchStart.touches = [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 }
      ];
      fireEvent(target, touchStart);
      
      // Move fingers closer (pinch in)
      const touchMove = new Event('touchmove', { bubbles: true }) as any;
      touchMove.touches = [
        { clientX: 120, clientY: 100 },
        { clientX: 180, clientY: 100 }
      ];
      fireEvent(target, touchMove);
      
      expect(mockOnPinch).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should support pull to refresh', async () => {
      const mockOnPullToRefresh = vi.fn().mockResolvedValue(undefined);
      
      // Mock scroll position
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
      
      render(
        <GestureHandler onPullToRefresh={mockOnPullToRefresh}>
          <div>Pull to Refresh Target</div>
        </GestureHandler>
      );
      
      const target = screen.getByText('Pull to Refresh Target');
      
      // Start at top
      const touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 50 }]);
      fireEvent(target, touchStart);
      
      // Pull down
      const touchMove = createTouchEvent('touchmove', [{ clientX: 100, clientY: 200 }]);
      fireEvent(target, touchMove);
      
      // Release
      const touchEnd = createTouchEvent('touchend', [{ clientX: 100, clientY: 200 }]);
      fireEvent(target, touchEnd);
      
      expect(mockOnPullToRefresh).toHaveBeenCalled();
      expect(navigator.vibrate).toHaveBeenCalledWith(20);
    });

    it('should be disabled when enabled prop is false', () => {
      const mockOnTap = vi.fn();
      
      render(
        <GestureHandler onTap={mockOnTap} enabled={false}>
          <div>Disabled Target</div>
        </GestureHandler>
      );
      
      const target = screen.getByText('Disabled Target');
      
      // Try to tap
      const touchStart = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
      fireEvent(target, touchStart);
      const touchEnd = createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]);
      fireEvent(target, touchEnd);
      
      expect(mockOnTap).not.toHaveBeenCalled();
    });
  });

  describe('ActionButtons', () => {
    it('should provide touch-optimized action buttons', () => {
      const mockOnComplete = vi.fn();
      const mockOnCancel = vi.fn();
      
      render(
        <div>
          <ActionButtons.Complete onClick={mockOnComplete} />
          <ActionButtons.Cancel onClick={mockOnCancel} />
        </div>
      );
      
      expect(screen.getByRole('button', { name: /completar/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
      
      // Should have proper touch target sizes
      const completeButton = screen.getByRole('button', { name: /completar/i });
      expect(completeButton).toHaveClass('min-h-[52px]'); // lg size
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});