/**
 * Tree-shaking Optimization Configuration
 * Advanced tree-shaking rules for optimal bundle size reduction
 */

export const treeShakingOptimizations = {
  // External library optimizations
  externalOptimizations: {
    // Lodash - use specific imports
    'lodash': {
      sideEffects: false,
      treeshake: true,
      importStrategy: 'named', // Use import { debounce } from 'lodash'
      alternative: 'lodash-es' // Recommend ES modules version
    },
    
    // Radix UI - optimize component imports
    '@radix-ui/react-*': {
      sideEffects: false,
      treeshake: true,
      importStrategy: 'named',
      manualChunks: (id) => {
        if (id.includes('@radix-ui/react-dialog')) return 'radix-core';
        if (id.includes('@radix-ui/react-dropdown-menu')) return 'radix-menu';
        if (id.includes('@radix-ui/react-form')) return 'radix-forms';
        return 'radix-layout';
      }
    },
    
    // Lucide React - tree-shakable icon imports
    'lucide-react': {
      sideEffects: false,
      treeshake: true,
      importStrategy: 'named', // import { Icon } from 'lucide-react'
      bundleAnalysis: {
        expectedReduction: '80%', // Should reduce from ~2MB to ~400KB
        optimizationLevel: 'high'
      }
    },
    
    // React Icons - alternative tree-shakable option
    'react-icons': {
      sideEffects: false,
      treeshake: true,
      importStrategy: 'subpath', // import { FaIcon } from 'react-icons/fa'
      bundleAnalysis: {
        expectedReduction: '90%',
        optimizationLevel: 'high'
      }
    },
    
    // Date handling
    'date-fns': {
      sideEffects: false,
      treeshake: true,
      importStrategy: 'named',
      alternative: 'date-fns/esm'
    },
    
    // Utility libraries
    'clsx': {
      sideEffects: false,
      treeshake: true,
      bundleAnalysis: {
        expectedReduction: '0%', // Already optimized
        optimizationLevel: 'optimal'
      }
    },
    
    'class-variance-authority': {
      sideEffects: false,
      treeshake: true,
      bundleAnalysis: {
        expectedReduction: '0%', // Already optimized
        optimizationLevel: 'optimal'
      }
    }
  },
  
  // Internal module optimizations
  internalOptimizations: {
    // UI components - ensure tree-shakable exports
    'src/components/ui': {
      exportStrategy: 'named', // export { Button, Input, Card }
      indexExports: false, // Avoid barrel exports that hurt tree-shaking
      recommendation: 'Direct imports: import { Button } from "@/components/ui/button"'
    },
    
    // Utility functions
    'src/lib': {
      exportStrategy: 'named',
      sideEffects: false,
      splitStrategy: 'feature-based' // Split utils by feature
    },
    
    // Hooks
    'src/hooks': {
      exportStrategy: 'named',
      sideEffects: false,
      lazyImports: true // Consider dynamic imports for heavy hooks
    },
    
    // Types - should not affect bundle size
    'src/types': {
      bundleImpact: 'none',
      buildTimeOptimization: true
    }
  },
  
  // Rollup-specific tree-shaking configuration
  rollupTreeShaking: {
    moduleSideEffects: (id) => {
      // CSS and style files have side effects
      if (id.includes('.css') || id.includes('.scss') || id.includes('.less')) {
        return true;
      }
      
      // Some libraries have side effects
      const sideEffectLibraries = [
        'react-dom/client', // Has initialization side effects
        'tailwindcss', // CSS generation
        'autoprefixer' // CSS processing
      ];
      
      return sideEffectLibraries.some(lib => id.includes(lib));
    },
    
    propertyReadSideEffects: false, // Assume property reads are pure
    unknownGlobalSideEffects: false, // Assume no unknown global side effects
    
    // Advanced tree-shaking options
    treeshake: {
      preset: 'recommended',
      mangleProps: {
        regex: /^_/, // Mangle properties starting with underscore
        reserved: ['__proto__', 'constructor', 'prototype']
      },
      propertyReadSideEffects: false,
      tryCatchDeoptimization: false
    }
  },
  
  // Bundle analysis and monitoring
  bundleAnalysis: {
    // Size thresholds for warnings
    sizeThresholds: {
      chunk: 200, // KB
      vendor: 300, // KB
      total: 800, // KB
      css: 100 // KB
    },
    
    // Tree-shaking effectiveness metrics
    effectivenessMetrics: {
      targetReduction: 40, // Target 40% reduction from tree-shaking
      namedImportRatio: 0.8, // 80% of imports should be named imports
      sideEffectRatio: 0.1 // Max 10% side-effect imports
    },
    
    // Monitoring and alerts
    monitoring: {
      trackChanges: true,
      alertThresholds: {
        sizeIncrease: 10, // Alert if bundle increases by 10%
        treeShakingRegression: 5 // Alert if tree-shaking effectiveness drops by 5%
      }
    }
  },
  
  // Development vs Production optimizations
  environmentOptimizations: {
    development: {
      treeShaking: 'minimal', // Faster builds
      sourceMaps: 'eval-source-map',
      bundleAnalysis: false
    },
    
    production: {
      treeShaking: 'aggressive',
      sourceMaps: 'hidden-source-map',
      bundleAnalysis: true,
      minification: {
        dropConsole: true,
        dropDebugger: true,
        pureFuncs: ['console.log', 'console.info', 'console.debug']
      }
    }
  },
  
  // Performance budget integration
  performanceBudgets: {
    // JavaScript budget breakdown
    javascript: {
      vendor: 300, // KB - External libraries
      app: 250,    // KB - Application code
      async: 200,  // KB - Lazy-loaded chunks
      total: 800   // KB - Total JavaScript
    },
    
    // CSS budget
    css: {
      critical: 50,  // KB - Above-the-fold CSS
      async: 50,     // KB - Lazy-loaded CSS
      total: 100     // KB - Total CSS
    },
    
    // Budget enforcement
    enforcement: {
      strict: true, // Fail build if budgets exceeded
      warnings: true, // Show warnings when approaching limits
      reporting: true // Generate budget compliance reports
    }
  }
};

// Export for use in Vite configuration
export default treeShakingOptimizations;