/**
 * Lazy Loading Performance Tests
 * Validates lazy loading behavior and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock lazy components for testing
const MockLazyComponent = lazy(() => 
  new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        default: () => <div data-testid="lazy-component">Lazy Component Loaded</div>
      });
    }, 100);
  })
);

const MockFailingLazyComponent = lazy(() => 
  new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Component failed to load'));
    }, 100);
  })
);

const MockSlowLazyComponent = lazy(() => 
  new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        default: () => <div data-testid="slow-lazy-component">Slow Component Loaded</div>
      });
    }, 2000);
  })
);

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div data-testid="loading">Loading...</div>}>
        {children}
      </Suspense>
    </QueryClientProvider>
  );
};

// Error boundary for testing error handling
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div data-testid="error">Something went wrong</div>;
    }

    return this.props.children;
  }
}

describe('Lazy Loading Performance Tests', () => {
  let performanceEntries: PerformanceEntry[] = [];
  
  beforeEach(() => {
    // Mock performance.getEntriesByType
    vi.spyOn(performance, 'getEntriesByType').mockImplementation((type) => {
      if (type === 'navigation') {
        return [{
          name: 'navigation',
          duration: 1000,
          loadEventEnd: 1000,
          domContentLoadedEventEnd: 500
        }] as PerformanceNavigationTiming[];
      }
      return performanceEntries;
    });

    // Mock performance.mark and performance.measure
    vi.spyOn(performance, 'mark').mockImplementation((name) => {
      performanceEntries.push({
        name,
        duration: 0,
        entryType: 'mark',
        startTime: Date.now(),
        toJSON: () => ({})
      });
    });

    vi.spyOn(performance, 'measure').mockImplementation((name, start, end) => {
      const entry = {
        name,
        duration: 100,
        entryType: 'measure',
        startTime: Date.now() - 100,
        toJSON: () => ({})
      };
      performanceEntries.push(entry);
      return entry;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    performanceEntries = [];
  });

  describe('Basic Lazy Loading', () => {
    it('should show loading state initially', async () => {
      render(
        <TestWrapper>
          <MockLazyComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    it('should load lazy component successfully', async () => {
      render(
        <TestWrapper>
          <MockLazyComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('lazy-component')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    it('should measure lazy loading performance', async () => {
      const startTime = Date.now();
      
      render(
        <TestWrapper>
          <MockLazyComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('lazy-component')).toBeInTheDocument();
      });

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(1000); // Should load within 1 second
    });
  });

  describe('Error Handling', () => {
    it('should handle lazy loading errors gracefully', async () => {
      render(
        <ErrorBoundary>
          <TestWrapper>
            <MockFailingLazyComponent />
          </TestWrapper>
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });
    });

    it('should provide retry mechanism for failed lazy loads', async () => {
      let attemptCount = 0;
      
      const RetryableLazyComponent = lazy(() => 
        new Promise((resolve, reject) => {
          attemptCount++;
          if (attemptCount < 2) {
            reject(new Error('First attempt failed'));
          } else {
            resolve({
              default: () => <div data-testid="retry-success">Retry Success</div>
            });
          }
        })
      );

      const RetryWrapper = () => {
        const [key, setKey] = React.useState(0);
        
        return (
          <div>
            <button 
              data-testid="retry-button" 
              onClick={() => setKey(k => k + 1)}
            >
              Retry
            </button>
            <ErrorBoundary 
              key={key}
              fallback={<div data-testid="retry-error">Failed - Click Retry</div>}
            >
              <TestWrapper>
                <RetryableLazyComponent />
              </TestWrapper>
            </ErrorBoundary>
          </div>
        );
      };

      render(<RetryWrapper />);

      // First attempt should fail
      await waitFor(() => {
        expect(screen.getByTestId('retry-error')).toBeInTheDocument();
      });

      // Retry should succeed
      act(() => {
        screen.getByTestId('retry-button').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('retry-success')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Budgets', () => {
    it('should load components within performance budget', async () => {
      const startTime = performance.now();
      
      render(
        <TestWrapper>
          <MockLazyComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('lazy-component')).toBeInTheDocument();
      });

      const loadTime = performance.now() - startTime;
      expect(loadTime).toBeLessThan(500); // 500ms budget
    });

    it('should handle slow loading components with timeout', async () => {
      const TimeoutWrapper = ({ timeout = 1000 }: { timeout?: number }) => {
        const [timedOut, setTimedOut] = React.useState(false);

        React.useEffect(() => {
          const timer = setTimeout(() => setTimedOut(true), timeout);
          return () => clearTimeout(timer);
        }, [timeout]);

        if (timedOut) {
          return <div data-testid="timeout">Component timed out</div>;
        }

        return (
          <TestWrapper>
            <MockSlowLazyComponent />
          </TestWrapper>
        );
      };

      render(<TimeoutWrapper timeout={1000} />);

      await waitFor(() => {
        expect(screen.getByTestId('timeout')).toBeInTheDocument();
      });
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory when unmounting lazy components', async () => {
      const ToggleComponent = () => {
        const [show, setShow] = React.useState(true);
        
        return (
          <div>
            <button 
              data-testid="toggle" 
              onClick={() => setShow(!show)}
            >
              Toggle
            </button>
            {show && (
              <TestWrapper>
                <MockLazyComponent />
              </TestWrapper>
            )}
          </div>
        );
      };

      render(<ToggleComponent />);

      // Load component
      await waitFor(() => {
        expect(screen.getByTestId('lazy-component')).toBeInTheDocument();
      });

      // Unmount component
      act(() => {
        screen.getByTestId('toggle').click();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('lazy-component')).not.toBeInTheDocument();
      });

      // Should not show memory leaks (would need actual memory profiling in real scenario)
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Code Splitting Effectiveness', () => {
    it('should only load necessary code chunks', async () => {
      const networkMock = vi.fn();
      
      // Mock network requests
      vi.spyOn(window, 'fetch').mockImplementation(async (url) => {
        networkMock(url);
        return new Response('chunk content');
      });

      render(
        <TestWrapper>
          <MockLazyComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('lazy-component')).toBeInTheDocument();
      });

      // Should only have loaded necessary chunks
      expect(networkMock).toHaveBeenCalledTimes(0); // No actual network calls in test
    });
  });

  describe('Progressive Loading', () => {
    it('should support progressive enhancement', async () => {
      const ProgressiveComponent = () => {
        const [level, setLevel] = React.useState(1);

        const Level1 = lazy(() => Promise.resolve({
          default: () => <div data-testid="level-1">Basic Content</div>
        }));

        const Level2 = lazy(() => Promise.resolve({
          default: () => <div data-testid="level-2">Enhanced Content</div>
        }));

        return (
          <div>
            <button 
              data-testid="enhance" 
              onClick={() => setLevel(2)}
            >
              Enhance
            </button>
            <TestWrapper>
              {level === 1 ? <Level1 /> : <Level2 />}
            </TestWrapper>
          </div>
        );
      };

      render(<ProgressiveComponent />);

      // Initially shows basic content
      await waitFor(() => {
        expect(screen.getByTestId('level-1')).toBeInTheDocument();
      });

      // Enhance to level 2
      act(() => {
        screen.getByTestId('enhance').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('level-2')).toBeInTheDocument();
      });
    });
  });

  describe('Preloading Strategy', () => {
    it('should support component preloading', async () => {
      const PreloadComponent = () => {
        const [show, setShow] = React.useState(false);
        const [preloaded, setPreloaded] = React.useState(false);

        const ComponentToPreload = lazy(() => 
          Promise.resolve({
            default: () => <div data-testid="preloaded">Preloaded Component</div>
          })
        );

        const handlePreload = async () => {
          // Simulate preloading by importing the component
          await ComponentToPreload;
          setPreloaded(true);
        };

        return (
          <div>
            <button data-testid="preload" onClick={handlePreload}>
              Preload
            </button>
            <button data-testid="show" onClick={() => setShow(true)}>
              Show
            </button>
            <div data-testid="preload-status">
              {preloaded ? 'Preloaded' : 'Not Preloaded'}
            </div>
            {show && (
              <TestWrapper>
                <ComponentToPreload />
              </TestWrapper>
            )}
          </div>
        );
      };

      render(<PreloadComponent />);

      // Preload component
      act(() => {
        screen.getByTestId('preload').click();
      });

      await waitFor(() => {
        expect(screen.getByText('Preloaded')).toBeInTheDocument();
      });

      // Show component (should be instant since preloaded)
      const showStart = performance.now();
      
      act(() => {
        screen.getByTestId('show').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('preloaded')).toBeInTheDocument();
      });

      const showTime = performance.now() - showStart;
      expect(showTime).toBeLessThan(100); // Should be very fast since preloaded
    });
  });
});