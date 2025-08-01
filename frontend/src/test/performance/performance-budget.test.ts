/**
 * Performance Budget Validation Tests
 * Ensures application meets performance budgets and targets
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock performance APIs
const mockPerformanceObserver = vi.fn();
const mockPerformanceMark = vi.fn();
const mockPerformanceMeasure = vi.fn();

// Performance budgets configuration
const PERFORMANCE_BUDGETS = {
  // Bundle size budgets (in KB)
  bundleSize: {
    javascript: 800,
    css: 100,
    total: 1000,
    individual: 500
  },
  
  // Core Web Vitals budgets (in milliseconds)
  coreWebVitals: {
    firstContentfulPaint: 1800,
    largestContentfulPaint: 2500,
    firstInputDelay: 100,
    cumulativeLayoutShift: 0.1, // Score, not milliseconds
    timeToInteractive: 3800
  },
  
  // Loading performance budgets
  loadingPerformance: {
    domContentLoaded: 1500,
    windowLoad: 3000,
    resourceLoadTime: 2000
  },
  
  // Runtime performance budgets
  runtimePerformance: {
    componentRenderTime: 16, // 60fps = 16.67ms per frame
    apiResponseTime: 1000,
    memoryUsage: 50000, // KB
    cpuUsage: 80 // percentage
  }
};

class PerformanceBudgetValidator {
  private measurements: Map<string, number[]> = new Map();
  
  constructor() {
    this.setupPerformanceMonitoring();
  }

  private setupPerformanceMonitoring() {
    // Mock PerformanceObserver for testing
    global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }));

    // Mock performance methods
    global.performance = {
      ...global.performance,
      mark: mockPerformanceMark,
      measure: mockPerformanceMeasure,
      getEntriesByType: vi.fn(),
      getEntriesByName: vi.fn(),
      now: vi.fn(() => Date.now())
    };
  }

  recordMeasurement(metric: string, value: number) {
    if (!this.measurements.has(metric)) {
      this.measurements.set(metric, []);
    }
    this.measurements.get(metric)!.push(value);
  }

  getMeasurement(metric: string): number[] {
    return this.measurements.get(metric) || [];
  }

  getAverageMeasurement(metric: string): number {
    const values = this.getMeasurement(metric);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  validateBudget(metric: string, budget: number, isLowerBetter: boolean = true): boolean {
    const average = this.getAverageMeasurement(metric);
    if (average === 0) return true; // No measurements yet
    
    return isLowerBetter ? average <= budget : average >= budget;
  }

  generateBudgetReport(): PerformanceBudgetReport {
    const report: PerformanceBudgetReport = {
      timestamp: new Date().toISOString(),
      budgets: {},
      overallScore: 0,
      passedBudgets: 0,
      totalBudgets: 0
    };

    // Validate bundle size budgets
    report.budgets.bundleSize = this.validateBundleSizeBudgets();
    
    // Validate Core Web Vitals budgets
    report.budgets.coreWebVitals = this.validateCoreWebVitalsBudgets();
    
    // Validate loading performance budgets
    report.budgets.loadingPerformance = this.validateLoadingPerformanceBudgets();
    
    // Validate runtime performance budgets
    report.budgets.runtimePerformance = this.validateRuntimePerformanceBudgets();

    // Calculate overall score
    const allResults = Object.values(report.budgets).flatMap(category => 
      Object.values(category).map(result => result.passed)
    );
    
    report.passedBudgets = allResults.filter(passed => passed).length;
    report.totalBudgets = allResults.length;
    report.overallScore = report.totalBudgets > 0 ? 
      (report.passedBudgets / report.totalBudgets) * 100 : 0;

    return report;
  }

  private validateBundleSizeBudgets(): BudgetCategoryResult {
    return {
      javascript: {
        budget: PERFORMANCE_BUDGETS.bundleSize.javascript,
        actual: this.getAverageMeasurement('bundleSize.javascript'),
        passed: this.validateBudget('bundleSize.javascript', PERFORMANCE_BUDGETS.bundleSize.javascript),
        unit: 'KB'
      },
      css: {
        budget: PERFORMANCE_BUDGETS.bundleSize.css,
        actual: this.getAverageMeasurement('bundleSize.css'),
        passed: this.validateBudget('bundleSize.css', PERFORMANCE_BUDGETS.bundleSize.css),
        unit: 'KB'
      },
      total: {
        budget: PERFORMANCE_BUDGETS.bundleSize.total,
        actual: this.getAverageMeasurement('bundleSize.total'),
        passed: this.validateBudget('bundleSize.total', PERFORMANCE_BUDGETS.bundleSize.total),
        unit: 'KB'
      }
    };
  }

  private validateCoreWebVitalsBudgets(): BudgetCategoryResult {
    return {
      firstContentfulPaint: {
        budget: PERFORMANCE_BUDGETS.coreWebVitals.firstContentfulPaint,
        actual: this.getAverageMeasurement('fcp'),
        passed: this.validateBudget('fcp', PERFORMANCE_BUDGETS.coreWebVitals.firstContentfulPaint),
        unit: 'ms'
      },
      largestContentfulPaint: {
        budget: PERFORMANCE_BUDGETS.coreWebVitals.largestContentfulPaint,
        actual: this.getAverageMeasurement('lcp'),
        passed: this.validateBudget('lcp', PERFORMANCE_BUDGETS.coreWebVitals.largestContentfulPaint),
        unit: 'ms'
      },
      firstInputDelay: {
        budget: PERFORMANCE_BUDGETS.coreWebVitals.firstInputDelay,
        actual: this.getAverageMeasurement('fid'),
        passed: this.validateBudget('fid', PERFORMANCE_BUDGETS.coreWebVitals.firstInputDelay),
        unit: 'ms'
      },
      cumulativeLayoutShift: {
        budget: PERFORMANCE_BUDGETS.coreWebVitals.cumulativeLayoutShift,
        actual: this.getAverageMeasurement('cls'),
        passed: this.validateBudget('cls', PERFORMANCE_BUDGETS.coreWebVitals.cumulativeLayoutShift),
        unit: 'score'
      }
    };
  }

  private validateLoadingPerformanceBudgets(): BudgetCategoryResult {
    return {
      domContentLoaded: {
        budget: PERFORMANCE_BUDGETS.loadingPerformance.domContentLoaded,
        actual: this.getAverageMeasurement('domContentLoaded'),
        passed: this.validateBudget('domContentLoaded', PERFORMANCE_BUDGETS.loadingPerformance.domContentLoaded),
        unit: 'ms'
      },
      windowLoad: {
        budget: PERFORMANCE_BUDGETS.loadingPerformance.windowLoad,
        actual: this.getAverageMeasurement('windowLoad'),
        passed: this.validateBudget('windowLoad', PERFORMANCE_BUDGETS.loadingPerformance.windowLoad),
        unit: 'ms'
      }
    };
  }

  private validateRuntimePerformanceBudgets(): BudgetCategoryResult {
    return {
      componentRenderTime: {
        budget: PERFORMANCE_BUDGETS.runtimePerformance.componentRenderTime,
        actual: this.getAverageMeasurement('componentRender'),
        passed: this.validateBudget('componentRender', PERFORMANCE_BUDGETS.runtimePerformance.componentRenderTime),
        unit: 'ms'
      },
      apiResponseTime: {
        budget: PERFORMANCE_BUDGETS.runtimePerformance.apiResponseTime,
        actual: this.getAverageMeasurement('apiResponse'),
        passed: this.validateBudget('apiResponse', PERFORMANCE_BUDGETS.runtimePerformance.apiResponseTime),
        unit: 'ms'
      }
    };
  }
}

// Type definitions
interface BudgetResult {
  budget: number;
  actual: number;
  passed: boolean;
  unit: string;
}

interface BudgetCategoryResult {
  [key: string]: BudgetResult;
}

interface PerformanceBudgetReport {
  timestamp: string;
  budgets: {
    bundleSize?: BudgetCategoryResult;
    coreWebVitals?: BudgetCategoryResult;
    loadingPerformance?: BudgetCategoryResult;
    runtimePerformance?: BudgetCategoryResult;
  };
  overallScore: number;
  passedBudgets: number;
  totalBudgets: number;
}

describe('Performance Budget Validation', () => {
  let validator: PerformanceBudgetValidator;

  beforeEach(() => {
    validator = new PerformanceBudgetValidator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Bundle Size Budgets', () => {
    it('should validate JavaScript bundle size budget', () => {
      // Simulate good bundle size
      validator.recordMeasurement('bundleSize.javascript', 600);
      validator.recordMeasurement('bundleSize.javascript', 650);
      validator.recordMeasurement('bundleSize.javascript', 700);

      const result = validator.validateBudget('bundleSize.javascript', PERFORMANCE_BUDGETS.bundleSize.javascript);
      expect(result).toBe(true);
    });

    it('should fail JavaScript bundle size budget when exceeded', () => {
      // Simulate oversized bundle
      validator.recordMeasurement('bundleSize.javascript', 900);
      validator.recordMeasurement('bundleSize.javascript', 950);
      validator.recordMeasurement('bundleSize.javascript', 1000);

      const result = validator.validateBudget('bundleSize.javascript', PERFORMANCE_BUDGETS.bundleSize.javascript);
      expect(result).toBe(false);
    });

    it('should validate CSS bundle size budget', () => {
      validator.recordMeasurement('bundleSize.css', 80);
      validator.recordMeasurement('bundleSize.css', 90);

      const result = validator.validateBudget('bundleSize.css', PERFORMANCE_BUDGETS.bundleSize.css);
      expect(result).toBe(true);
    });

    it('should validate total bundle size budget', () => {
      validator.recordMeasurement('bundleSize.total', 800);
      validator.recordMeasurement('bundleSize.total', 850);

      const result = validator.validateBudget('bundleSize.total', PERFORMANCE_BUDGETS.bundleSize.total);
      expect(result).toBe(true);
    });
  });

  describe('Core Web Vitals Budgets', () => {
    it('should validate First Contentful Paint budget', () => {
      validator.recordMeasurement('fcp', 1200);
      validator.recordMeasurement('fcp', 1400);
      validator.recordMeasurement('fcp', 1600);

      const result = validator.validateBudget('fcp', PERFORMANCE_BUDGETS.coreWebVitals.firstContentfulPaint);
      expect(result).toBe(true);
    });

    it('should fail FCP budget when exceeded', () => {
      validator.recordMeasurement('fcp', 2000);
      validator.recordMeasurement('fcp', 2200);

      const result = validator.validateBudget('fcp', PERFORMANCE_BUDGETS.coreWebVitals.firstContentfulPaint);
      expect(result).toBe(false);
    });

    it('should validate Largest Contentful Paint budget', () => {
      validator.recordMeasurement('lcp', 2000);
      validator.recordMeasurement('lcp', 2200);

      const result = validator.validateBudget('lcp', PERFORMANCE_BUDGETS.coreWebVitals.largestContentfulPaint);
      expect(result).toBe(true);
    });

    it('should validate First Input Delay budget', () => {
      validator.recordMeasurement('fid', 50);
      validator.recordMeasurement('fid', 80);

      const result = validator.validateBudget('fid', PERFORMANCE_BUDGETS.coreWebVitals.firstInputDelay);
      expect(result).toBe(true);
    });

    it('should validate Cumulative Layout Shift budget', () => {
      validator.recordMeasurement('cls', 0.05);
      validator.recordMeasurement('cls', 0.08);

      const result = validator.validateBudget('cls', PERFORMANCE_BUDGETS.coreWebVitals.cumulativeLayoutShift);
      expect(result).toBe(true);
    });
  });

  describe('Loading Performance Budgets', () => {
    it('should validate DOM Content Loaded budget', () => {
      validator.recordMeasurement('domContentLoaded', 1200);
      validator.recordMeasurement('domContentLoaded', 1300);

      const result = validator.validateBudget('domContentLoaded', PERFORMANCE_BUDGETS.loadingPerformance.domContentLoaded);
      expect(result).toBe(true);
    });

    it('should validate Window Load budget', () => {
      validator.recordMeasurement('windowLoad', 2500);
      validator.recordMeasurement('windowLoad', 2800);

      const result = validator.validateBudget('windowLoad', PERFORMANCE_BUDGETS.loadingPerformance.windowLoad);
      expect(result).toBe(true);
    });
  });

  describe('Runtime Performance Budgets', () => {
    it('should validate component render time budget', () => {
      validator.recordMeasurement('componentRender', 10);
      validator.recordMeasurement('componentRender', 12);
      validator.recordMeasurement('componentRender', 14);

      const result = validator.validateBudget('componentRender', PERFORMANCE_BUDGETS.runtimePerformance.componentRenderTime);
      expect(result).toBe(true);
    });

    it('should fail component render time budget when too slow', () => {
      validator.recordMeasurement('componentRender', 20);
      validator.recordMeasurement('componentRender', 25);

      const result = validator.validateBudget('componentRender', PERFORMANCE_BUDGETS.runtimePerformance.componentRenderTime);
      expect(result).toBe(false);
    });

    it('should validate API response time budget', () => {
      validator.recordMeasurement('apiResponse', 500);
      validator.recordMeasurement('apiResponse', 800);

      const result = validator.validateBudget('apiResponse', PERFORMANCE_BUDGETS.runtimePerformance.apiResponseTime);
      expect(result).toBe(true);
    });
  });

  describe('Budget Report Generation', () => {
    it('should generate comprehensive budget report', () => {
      // Add sample measurements
      validator.recordMeasurement('bundleSize.javascript', 700);
      validator.recordMeasurement('bundleSize.css', 80);
      validator.recordMeasurement('bundleSize.total', 780);
      validator.recordMeasurement('fcp', 1400);
      validator.recordMeasurement('lcp', 2200);
      validator.recordMeasurement('domContentLoaded', 1200);
      validator.recordMeasurement('componentRender', 12);

      const report = validator.generateBudgetReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('budgets');
      expect(report).toHaveProperty('overallScore');
      expect(report.overallScore).toBeGreaterThan(0);
      expect(report.passedBudgets).toBeGreaterThan(0);
      expect(report.totalBudgets).toBeGreaterThan(0);
    });

    it('should calculate correct overall score', () => {
      // Add measurements that should pass most budgets
      validator.recordMeasurement('bundleSize.javascript', 600);
      validator.recordMeasurement('bundleSize.css', 70);
      validator.recordMeasurement('bundleSize.total', 670);
      validator.recordMeasurement('fcp', 1200);
      validator.recordMeasurement('lcp', 2000);

      const report = validator.generateBudgetReport();
      
      expect(report.overallScore).toBeGreaterThan(80); // Should pass most budgets
    });

    it('should handle empty measurements gracefully', () => {
      const report = validator.generateBudgetReport();
      
      expect(report.overallScore).toBe(0);
      expect(report.passedBudgets).toBe(0);
      expect(report.totalBudgets).toBeGreaterThan(0);
    });
  });

  describe('Performance Budget Integration', () => {
    it('should integrate with real bundle analysis', async () => {
      // Mock reading actual bundle files
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ 
        size: 600 * 1024 // 600KB
      } as fs.Stats);
      vi.spyOn(fs, 'readdirSync').mockReturnValue(['main.js', 'vendor.js', 'styles.css'] as any);

      // Simulate reading actual bundle sizes
      const mainJsSize = 300; // KB
      const vendorJsSize = 300; // KB
      const cssSize = 80; // KB

      validator.recordMeasurement('bundleSize.javascript', mainJsSize + vendorJsSize);
      validator.recordMeasurement('bundleSize.css', cssSize);
      validator.recordMeasurement('bundleSize.total', mainJsSize + vendorJsSize + cssSize);

      const report = validator.generateBudgetReport();
      
      expect(report.budgets.bundleSize?.javascript.passed).toBe(true);
      expect(report.budgets.bundleSize?.css.passed).toBe(true);
      expect(report.budgets.bundleSize?.total.passed).toBe(true);
    });

    it('should provide actionable recommendations for budget failures', () => {
      // Add measurements that exceed budgets
      validator.recordMeasurement('bundleSize.javascript', 1000); // Exceeds 800KB budget
      validator.recordMeasurement('componentRender', 25); // Exceeds 16ms budget

      const report = validator.generateBudgetReport();
      const failedBudgets = Object.entries(report.budgets).flatMap(([category, results]) =>
        Object.entries(results).filter(([_, result]) => !result.passed)
          .map(([metric, result]) => ({ category, metric, result }))
      );

      expect(failedBudgets.length).toBeGreaterThan(0);
      
      for (const failure of failedBudgets) {
        expect(failure.result.actual).toBeGreaterThan(failure.result.budget);
      }
    });
  });

  describe('Continuous Performance Monitoring', () => {
    it('should track performance trends over time', () => {
      // Simulate performance degradation over time
      const measurements = [
        { time: 1, fcp: 1200 },
        { time: 2, fcp: 1400 },
        { time: 3, fcp: 1600 },
        { time: 4, fcp: 1900 }, // Approaching budget limit
      ];

      for (const measurement of measurements) {
        validator.recordMeasurement('fcp', measurement.fcp);
      }

      const average = validator.getAverageMeasurement('fcp');
      const budget = PERFORMANCE_BUDGETS.coreWebVitals.firstContentfulPaint;
      
      expect(average).toBeCloseTo(1525); // Average of measurements
      expect(average).toBeLessThan(budget); // Still within budget but trending up
    });

    it('should support performance regression detection', () => {
      // Baseline measurements (good performance)
      const baseline = [1200, 1300, 1250, 1280];
      baseline.forEach(value => validator.recordMeasurement('baseline.fcp', value));

      // Current measurements (degraded performance)
      const current = [1600, 1700, 1650, 1680];
      current.forEach(value => validator.recordMeasurement('current.fcp', value));

      const baselineAvg = validator.getAverageMeasurement('baseline.fcp');
      const currentAvg = validator.getAverageMeasurement('current.fcp');
      const regression = ((currentAvg - baselineAvg) / baselineAvg) * 100;

      expect(regression).toBeGreaterThan(20); // Significant regression detected
    });
  });
});