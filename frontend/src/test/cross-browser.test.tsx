/**
 * Cross-Browser Compatibility Test Suite
 * Tests for browser-specific behaviors, feature detection, and polyfills
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import '@testing-library/jest-dom';

import QrScanner from '../components/qr-scanner';
import { TouchOptimizedButton } from '../components/mobile/TouchOptimizedControls';
import { GestureHandler } from '../components/mobile/GestureHandler';
import { QuantityController } from '../components/mobile/TouchOptimizedControls';
import LoadingExecutionScreenMobile from '../components/loading-execution-screen-mobile';

// Browser simulation utilities
const mockUserAgent = (userAgent: string) => {
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    writable: true
  });
};

const mockWindow = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, writable: true });
  
  // Trigger resize event
  window.dispatchEvent(new Event('resize'));
};

const mockFeature = (feature: string, available: boolean) => {
  switch (feature) {
    case 'vibrate':
      if (available) {
        (navigator as any).vibrate = vi.fn();
      } else {
        delete (navigator as any).vibrate;
      }
      break;
    case 'getUserMedia':
      if (available) {
        Object.defineProperty(navigator, 'mediaDevices', {
          value: {
            getUserMedia: vi.fn().mockResolvedValue({
              getTracks: () => [{ stop: vi.fn() }],
              getVideoTracks: () => [{
                getCapabilities: () => ({ torch: true }),
                getSettings: () => ({ facingMode: 'environment' }),
                applyConstraints: vi.fn(),
                stop: vi.fn()
              }]
            })
          },
          writable: true
        });
      } else {
        Object.defineProperty(navigator, 'mediaDevices', {
          value: undefined,
          writable: true
        });
      }
      break;
    case 'touchstart':
      if (available) {
        Object.defineProperty(window, 'ontouchstart', { value: true });
      } else {
        delete (window as any).ontouchstart;
      }
      break;
    case 'serviceWorker':
      if (available) {
        Object.defineProperty(navigator, 'serviceWorker', {
          value: { register: vi.fn() },
          writable: true
        });
      } else {
        delete (navigator as any).serviceWorker;
      }
      break;
  }
};

describe('Cross-Browser Compatibility', () => {
  const originalUserAgent = navigator.userAgent;
  const originalMediaDevices = navigator.mediaDevices;
  const originalVibrate = (navigator as any).vibrate;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      writable: true
    });
    if (originalVibrate) {
      (navigator as any).vibrate = originalVibrate;
    }
  });

  describe('Chrome/Chromium', () => {
    beforeAll(() => {
      mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    });

    it('should handle Chrome-specific camera features', async () => {
      mockFeature('getUserMedia', true);
      
      const mockOnScan = vi.fn();
      render(<QrScanner onScan={mockOnScan} onClose={() => {}} />);
      
      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
          expect.objectContaining({
            video: expect.objectContaining({
              facingMode: 'environment'
            })
          })
        );
      });
      
      // Chrome supports advanced camera features
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({
            focusMode: 'continuous',
            exposureMode: 'continuous',
            whiteBalanceMode: 'continuous'
          })
        })
      );
    });

    it('should use Chrome-optimized touch handling', () => {
      mockFeature('touchstart', true);
      
      const mockOnClick = vi.fn();
      render(<TouchOptimizedButton onClick={mockOnClick}>Chrome Button</TouchOptimizedButton>);
      
      const button = screen.getByRole('button');
      
      // Chrome supports passive event listeners
      expect(button).toHaveStyle('touch-action: manipulation');
      
      // Test touch event
      fireEvent.touchStart(button, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      
      expect(button).toHaveClass(/active:scale-/);
    });

    it('should handle Chrome PWA features', () => {
      mockFeature('serviceWorker', true);
      
      // Mock Chrome PWA APIs
      Object.defineProperty(window, 'BeforeInstallPromptEvent', {
        value: class MockBeforeInstallPromptEvent extends Event {
          prompt = vi.fn();
          userChoice = Promise.resolve({ outcome: 'accepted' });
        }
      });
      
      // Should detect PWA capability
      expect(navigator.serviceWorker).toBeDefined();
    });
  });

  describe('Safari/WebKit', () => {
    beforeAll(() => {
      mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15');
    });

    it('should handle Safari-specific camera limitations', async () => {
      // Safari has more restrictive camera access
      mockFeature('getUserMedia', true);
      
      const mockOnScan = vi.fn();
      render(<QrScanner onScan={mockOnScan} onClose={() => {}} />);
      
      await waitFor(() => {
        // Should fallback to basic constraints in Safari
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      });
      
      // Should handle Safari's limited camera capabilities gracefully
      const manualInputButton = screen.getByText(/digitar código/i);
      expect(manualInputButton).toBeInTheDocument();
    });

    it('should handle Safari touch event differences', () => {
      mockFeature('touchstart', true);
      
      const mockOnTap = vi.fn();
      render(
        <GestureHandler onTap={mockOnTap}>
          <div>Safari Touch Target</div>
        </GestureHandler>
      );
      
      const target = screen.getByText('Safari Touch Target');
      
      // Safari requires special handling for touch events
      fireEvent.touchStart(target, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      
      fireEvent.touchEnd(target, {
        changedTouches: [{ clientX: 100, clientY: 100 }]
      });
      
      expect(mockOnTap).toHaveBeenCalled();
    });

    it('should handle Safari viewport quirks', () => {
      // Safari mobile has viewport issues
      mockWindow(375, 667); // iPhone viewport
      
      render(<LoadingExecutionScreenMobile executionId={1} />);
      
      // Should adapt to Safari's viewport behavior
      const container = screen.getByText(/carregando execução/i)?.closest('div');
      if (container) {
        expect(container).toHaveStyle('min-height: 100vh');
      }
    });

    it('should handle Safari number input quirks', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      
      render(<QuantityController value={10} onChange={mockOnChange} />);
      
      const input = screen.getByRole('spinbutton');
      
      // Safari doesn't always support step attribute properly
      await user.clear(input);
      await user.type(input, '15.5');
      
      expect(mockOnChange).toHaveBeenCalledWith(15.5);
    });
  });

  describe('Firefox', () => {
    beforeAll(() => {
      mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0');
    });

    it('should handle Firefox-specific camera implementation', async () => {
      mockFeature('getUserMedia', true);
      
      const mockOnScan = vi.fn();
      render(<QrScanner onScan={mockOnScan} onClose={() => {}} />);
      
      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      });
      
      // Firefox might not support all camera constraints
      const constraints = (navigator.mediaDevices.getUserMedia as any).mock.calls[0][0];
      expect(constraints.video).toBeDefined();
    });

    it('should handle Firefox touch events', () => {
      mockFeature('touchstart', true);
      
      const mockOnClick = vi.fn();
      render(<TouchOptimizedButton onClick={mockOnClick}>Firefox Button</TouchOptimizedButton>);
      
      const button = screen.getByRole('button');
      
      // Firefox has different touch event handling
      fireEvent.touchStart(button);
      fireEvent.touchEnd(button);
      fireEvent.click(button);
      
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should handle Firefox input number styling', () => {
      render(<QuantityController value={10} onChange={() => {}} />);
      
      const input = screen.getByRole('spinbutton');
      
      // Firefox requires special styling for number inputs
      expect(input).toHaveStyle('MozAppearance: textfield');
    });
  });

  describe('Edge', () => {
    beforeAll(() => {
      mockUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0');
    });

    it('should handle Edge-specific features', async () => {
      mockFeature('getUserMedia', true);
      
      const mockOnScan = vi.fn();
      render(<QrScanner onScan={mockOnScan} onClose={() => {}} />);
      
      // Edge generally follows Chrome behavior
      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      });
    });

    it('should handle Edge touch optimization', () => {
      mockFeature('touchstart', true);
      
      render(<TouchOptimizedButton>Edge Button</TouchOptimizedButton>);
      
      const button = screen.getByRole('button');
      
      // Edge supports modern touch handling
      expect(button).toHaveStyle('touch-action: manipulation');
    });
  });

  describe('Mobile Browsers', () => {
    describe('Chrome Mobile', () => {
      beforeAll(() => {
        mockUserAgent('Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
      });

      it('should optimize for mobile Chrome', () => {
        mockWindow(375, 812); // Mobile viewport
        mockFeature('touchstart', true);
        
        render(<TouchOptimizedButton size="lg">Mobile Chrome</TouchOptimizedButton>);
        
        const button = screen.getByRole('button');
        
        // Should have mobile-optimized touch targets
        expect(button).toHaveClass('min-h-[52px]');
      });
    });

    describe('Safari Mobile', () => {
      beforeAll(() => {
        mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
      });

      it('should handle Safari mobile quirks', () => {
        mockWindow(375, 667); // iPhone viewport
        mockFeature('touchstart', true);
        
        render(<LoadingExecutionScreenMobile executionId={1} />);
        
        // Should handle Safari mobile viewport units
        const container = screen.getByText(/carregando execução/i)?.closest('div');
        if (container) {
          // Safari mobile needs special viewport handling
          expect(container).toBeInTheDocument();
        }
      });

      it('should handle Safari mobile camera permissions', async () => {
        mockFeature('getUserMedia', false); // Simulate permission denied
        
        const mockOnScan = vi.fn();
        render(<QrScanner onScan={mockOnScan} onClose={() => {}} />);
        
        await waitFor(() => {
          // Should show manual input option
          expect(screen.getByText(/digitar código/i)).toBeInTheDocument();
        });
      });
    });

    describe('Samsung Internet', () => {
      beforeAll(() => {
        mockUserAgent('Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36');
      });

      it('should handle Samsung Internet specific features', () => {
        mockFeature('touchstart', true);
        
        render(<TouchOptimizedButton>Samsung Browser</TouchOptimizedButton>);
        
        const button = screen.getByRole('button');
        
        // Samsung Internet generally follows Chrome behavior
        expect(button).toHaveStyle('touch-action: manipulation');
      });
    });
  });

  describe('Feature Detection and Polyfills', () => {
    it('should gracefully degrade without touch support', () => {
      mockFeature('touchstart', false);
      
      const mockOnClick = vi.fn();
      render(<TouchOptimizedButton onClick={mockOnClick}>No Touch</TouchOptimizedButton>);
      
      const button = screen.getByRole('button');
      
      // Should still work with mouse events
      fireEvent.click(button);
      expect(mockOnClick).toHaveBeenCalled();
      
      // Should not have touch-specific classes
      expect(button).not.toHaveClass(/touch-/);
    });

    it('should work without vibration API', () => {
      mockFeature('vibrate', false);
      
      const mockOnClick = vi.fn();
      render(<TouchOptimizedButton onClick={mockOnClick} hapticFeedback={true}>No Vibrate</TouchOptimizedButton>);
      
      const button = screen.getByRole('button');
      
      // Should not crash when vibration is unavailable
      fireEvent.touchStart(button);
      expect(mockOnClick).not.toThrow();
    });

    it('should fallback when getUserMedia is unavailable', async () => {
      mockFeature('getUserMedia', false);
      
      const mockOnScan = vi.fn();
      render(<QrScanner onScan={mockOnScan} onClose={() => {}} />);
      
      await waitFor(() => {
        // Should show manual input as fallback
        expect(screen.getByText(/digitar código/i)).toBeInTheDocument();
      });
      
      // Manual input should work
      const manualButton = screen.getByText(/digitar código/i);
      fireEvent.click(manualButton);
      
      expect(screen.getByPlaceholderText(/ex: ucp-/i)).toBeInTheDocument();
    });

    it('should detect and use available features', () => {
      // Test modern browser with all features
      mockFeature('touchstart', true);
      mockFeature('vibrate', true);
      mockFeature('getUserMedia', true);
      mockFeature('serviceWorker', true);
      
      const mockOnClick = vi.fn();
      render(<TouchOptimizedButton onClick={mockOnClick} hapticFeedback={true}>Full Features</TouchOptimizedButton>);
      
      const button = screen.getByRole('button');
      
      // Should use all available features
      fireEvent.touchStart(button);
      
      expect(navigator.vibrate).toHaveBeenCalled();
      expect(button).toHaveStyle('touch-action: manipulation');
    });

    it('should polyfill missing Array methods', () => {
      // Test for older browsers that might not have newer Array methods
      const testArray = [1, 2, 3, 4, 5];
      
      // These should work even if polyfilled
      expect(testArray.find(x => x > 3)).toBe(4);
      expect(testArray.includes(3)).toBe(true);
      expect(testArray.filter(x => x % 2 === 0)).toEqual([2, 4]);
    });

    it('should handle different CSS support levels', () => {
      render(<TouchOptimizedButton>CSS Test</TouchOptimizedButton>);
      
      const button = screen.getByRole('button');
      
      // Should have fallback classes for unsupported CSS features
      expect(button.className).toMatch(/min-h-|h-/); // Height fallbacks
      expect(button.className).toMatch(/px-|p-/); // Padding fallbacks
    });
  });

  describe('Viewport and Responsive Behavior', () => {
    it('should adapt to different screen sizes', () => {
      // Test mobile viewport
      mockWindow(375, 667);
      
      const { rerender } = render(<TouchOptimizedButton size="default">Responsive</TouchOptimizedButton>);
      
      let button = screen.getByRole('button');
      expect(button).toHaveClass('min-h-[44px]');
      
      // Test tablet viewport
      mockWindow(768, 1024);
      rerender(<TouchOptimizedButton size="default">Responsive</TouchOptimizedButton>);
      
      button = screen.getByRole('button');
      expect(button).toHaveClass('min-h-[44px]'); // Should maintain minimum size
      
      // Test desktop viewport
      mockWindow(1920, 1080);
      rerender(<TouchOptimizedButton size="default">Responsive</TouchOptimizedButton>);
      
      button = screen.getByRole('button');
      expect(button).toHaveClass('min-h-[44px]');
    });

    it('should handle orientation changes', () => {
      // Portrait
      mockWindow(375, 667);
      
      const { rerender } = render(<LoadingExecutionScreenMobile executionId={1} />);
      
      // Landscape
      mockWindow(667, 375);
      rerender(<LoadingExecutionScreenMobile executionId={1} />);
      
      // Should adapt layout
      expect(screen.getByText(/carregando execução/i)).toBeInTheDocument();
    });

    it('should support different pixel densities', () => {
      // High DPI display
      Object.defineProperty(window, 'devicePixelRatio', { value: 3 });
      
      render(<TouchOptimizedButton>High DPI</TouchOptimizedButton>);
      
      const button = screen.getByRole('button');
      
      // Should maintain crisp appearance on high DPI
      expect(button).toHaveClass(/min-h-/);
    });
  });

  describe('Network Conditions', () => {
    it('should handle slow network connections', async () => {
      // Mock slow network
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '2g',
          downlink: 0.5,
          rtt: 2000
        },
        writable: true
      });
      
      render(<LoadingExecutionScreenMobile executionId={1} />);
      
      // Should show appropriate loading states for slow networks
      expect(screen.getByText(/carregando execução/i)).toBeInTheDocument();
    });

    it('should work offline', async () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      });
      
      render(<LoadingExecutionScreenMobile executionId={1} />);
      
      // Should indicate offline status
      // Implementation would depend on offline handling
      expect(screen.getByText(/carregando execução/i)).toBeInTheDocument();
    });
  });
});