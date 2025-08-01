#!/usr/bin/env node

/**
 * Bundle Strategy Validator
 * Advanced bundle optimization validation with performance budget enforcement
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BundleStrategyValidator {
  constructor() {
    this.resultsDir = path.join(__dirname, '../bundle-strategy-results');
    this.ensureResultsDir();
    
    // Performance budgets from package.json
    this.budgets = {
      mainChunk: 250, // KB
      vendorChunk: 300, // KB
      totalJS: 800, // KB
      totalCSS: 100, // KB
      asyncChunk: 200, // KB
      gzipRatio: 0.3, // Expected gzip compression ratio
      chunkCount: 15 // Maximum number of chunks
    };
  }

  ensureResultsDir() {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  async validateBundleStrategy() {
    console.log('🎯 Validating Bundle Strategy...');
    
    try {
      // Build the project with bundle analysis
      console.log('  🔨 Building with optimized configuration...');
      const buildStart = Date.now();
      
      execSync('npm run build', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'production' }
      });
      
      const buildTime = Date.now() - buildStart;
      
      const validation = {
        timestamp: new Date().toISOString(),
        buildTime,
        budgetValidation: await this.validatePerformanceBudgets(),
        chunkAnalysis: await this.analyzeChunkStrategy(),
        compressionAnalysis: await this.analyzeCompression(),
        treeShakingEffectiveness: await this.analyzeTreeShaking(),
        cacheOptimization: await this.analyzeCacheStrategy(),
        loadingStrategy: await this.analyzeLoadingStrategy(),
        recommendations: []
      };
      
      // Generate comprehensive recommendations
      validation.recommendations = this.generateOptimizationRecommendations(validation);
      
      // Save validation results
      const validationFile = path.join(this.resultsDir, 'bundle-strategy-validation.json');
      fs.writeFileSync(validationFile, JSON.stringify(validation, null, 2));
      
      console.log('✅ Bundle strategy validation completed');
      return validation;
      
    } catch (error) {
      console.error('❌ Bundle strategy validation failed:', error.message);
      return { error: error.message };
    }
  }

  async validatePerformanceBudgets() {
    console.log('  📊 Validating performance budgets...');
    
    const distDir = path.join(__dirname, '../dist');
    const assetsDir = path.join(distDir, 'assets');
    
    if (!fs.existsSync(assetsDir)) {
      throw new Error('Build assets not found');
    }
    
    const assets = fs.readdirSync(assetsDir);
    const budgetResults = {
      totalJS: 0,
      totalCSS: 0,
      chunkCount: 0,
      violations: [],
      compliance: {}
    };
    
    for (const asset of assets) {
      const assetPath = path.join(assetsDir, asset);
      const stats = fs.statSync(assetPath);
      const sizeKB = Math.round(stats.size / 1024);
      
      if (asset.endsWith('.js') && !asset.endsWith('.map')) {
        budgetResults.totalJS += sizeKB;
        budgetResults.chunkCount++;
        
        // Check individual chunk budgets
        if (asset.includes('vendor') && sizeKB > this.budgets.vendorChunk) {
          budgetResults.violations.push({
            type: 'vendor-chunk-size',
            file: asset,
            size: sizeKB,
            limit: this.budgets.vendorChunk,
            excess: sizeKB - this.budgets.vendorChunk
          });
        } else if (asset.includes('main') && sizeKB > this.budgets.mainChunk) {
          budgetResults.violations.push({
            type: 'main-chunk-size',
            file: asset,
            size: sizeKB,
            limit: this.budgets.mainChunk,
            excess: sizeKB - this.budgets.mainChunk
          });
        } else if (sizeKB > this.budgets.asyncChunk) {
          budgetResults.violations.push({
            type: 'async-chunk-size',
            file: asset,
            size: sizeKB,
            limit: this.budgets.asyncChunk,
            excess: sizeKB - this.budgets.asyncChunk
          });
        }
      } else if (asset.endsWith('.css')) {
        budgetResults.totalCSS += sizeKB;
      }
    }
    
    // Validate overall budgets
    budgetResults.compliance = {
      totalJS: {
        actual: budgetResults.totalJS,
        limit: this.budgets.totalJS,
        compliant: budgetResults.totalJS <= this.budgets.totalJS,
        utilizationPercent: (budgetResults.totalJS / this.budgets.totalJS * 100).toFixed(1)
      },
      totalCSS: {
        actual: budgetResults.totalCSS,
        limit: this.budgets.totalCSS,
        compliant: budgetResults.totalCSS <= this.budgets.totalCSS,
        utilizationPercent: (budgetResults.totalCSS / this.budgets.totalCSS * 100).toFixed(1)
      },
      chunkCount: {
        actual: budgetResults.chunkCount,
        limit: this.budgets.chunkCount,
        compliant: budgetResults.chunkCount <= this.budgets.chunkCount,
        utilizationPercent: (budgetResults.chunkCount / this.budgets.chunkCount * 100).toFixed(1)
      }
    };
    
    return budgetResults;
  }

  async analyzeChunkStrategy() {
    console.log('  🧩 Analyzing chunk strategy effectiveness...');
    
    const distDir = path.join(__dirname, '../dist');
    const assetsDir = path.join(distDir, 'assets');
    const assets = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js') && !f.endsWith('.map'));
    
    const chunkAnalysis = {
      totalChunks: assets.length,
      chunkDistribution: {},
      vendorChunks: [],
      appChunks: [],
      lazyChunks: [],
      sizeDistribution: {
        small: 0,   // < 50KB
        medium: 0,  // 50-200KB
        large: 0,   // 200-500KB
        xlarge: 0   // > 500KB
      }
    };
    
    for (const asset of assets) {
      const assetPath = path.join(assetsDir, asset);
      const stats = fs.statSync(assetPath);
      const sizeKB = Math.round(stats.size / 1024);
      
      const chunkInfo = {
        name: asset,
        sizeKB,
        type: this.classifyChunk(asset),
        cacheability: this.assessCacheability(asset)
      };
      
      // Categorize by type
      if (chunkInfo.type.includes('vendor')) {
        chunkAnalysis.vendorChunks.push(chunkInfo);
      } else if (chunkInfo.type.includes('features') || chunkInfo.type.includes('pages')) {
        chunkAnalysis.lazyChunks.push(chunkInfo);
      } else {
        chunkAnalysis.appChunks.push(chunkInfo);
      }
      
      // Size distribution
      if (sizeKB < 50) chunkAnalysis.sizeDistribution.small++;
      else if (sizeKB < 200) chunkAnalysis.sizeDistribution.medium++;
      else if (sizeKB < 500) chunkAnalysis.sizeDistribution.large++;
      else chunkAnalysis.sizeDistribution.xlarge++;
    }
    
    return chunkAnalysis;
  }

  classifyChunk(filename) {
    if (filename.includes('react-core')) return 'vendor-react';
    if (filename.includes('radix')) return 'vendor-ui';
    if (filename.includes('vendor')) return 'vendor-misc';
    if (filename.includes('features')) return 'features-lazy';
    if (filename.includes('pages')) return 'pages-lazy';
    if (filename.includes('ui-')) return 'ui-components';
    return 'app-core';
  }

  assessCacheability(filename) {
    // Vendor chunks have high cacheability
    if (filename.includes('vendor') || filename.includes('react')) return 'high';
    // Feature chunks have medium cacheability
    if (filename.includes('features') || filename.includes('pages')) return 'medium';
    // App core has low cacheability due to frequent changes
    return 'low';
  }

  async analyzeCompression() {
    console.log('  🗜️  Analyzing compression effectiveness...');
    
    const distDir = path.join(__dirname, '../dist');
    const assetsDir = path.join(distDir, 'assets');
    const assets = fs.readdirSync(assetsDir);
    
    const compressionAnalysis = {
      gzipFiles: [],
      brotliFiles: [],
      compressionRatios: {
        gzip: [],
        brotli: []
      },
      totalSavings: {
        gzip: 0,
        brotli: 0
      }
    };
    
    for (const asset of assets) {
      const assetPath = path.join(assetsDir, asset);
      const originalSize = fs.statSync(assetPath).size;
      
      // Check for compressed versions
      const gzipPath = assetPath + '.gz';
      const brotliPath = assetPath + '.br';
      
      if (fs.existsSync(gzipPath)) {
        const compressedSize = fs.statSync(gzipPath).size;
        const ratio = compressedSize / originalSize;
        const savings = originalSize - compressedSize;
        
        compressionAnalysis.gzipFiles.push({
          file: asset,
          originalSize,
          compressedSize,
          ratio,
          savings
        });
        
        compressionAnalysis.compressionRatios.gzip.push(ratio);
        compressionAnalysis.totalSavings.gzip += savings;
      }
      
      if (fs.existsSync(brotliPath)) {
        const compressedSize = fs.statSync(brotliPath).size;
        const ratio = compressedSize / originalSize;
        const savings = originalSize - compressedSize;
        
        compressionAnalysis.brotliFiles.push({
          file: asset,
          originalSize,
          compressedSize,
          ratio,
          savings
        });
        
        compressionAnalysis.compressionRatios.brotli.push(ratio);
        compressionAnalysis.totalSavings.brotli += savings;
      }
    }
    
    // Calculate average compression ratios
    if (compressionAnalysis.compressionRatios.gzip.length > 0) {
      compressionAnalysis.averageGzipRatio = 
        compressionAnalysis.compressionRatios.gzip.reduce((a, b) => a + b, 0) / 
        compressionAnalysis.compressionRatios.gzip.length;
    }
    
    if (compressionAnalysis.compressionRatios.brotli.length > 0) {
      compressionAnalysis.averageBrotliRatio = 
        compressionAnalysis.compressionRatios.brotli.reduce((a, b) => a + b, 0) / 
        compressionAnalysis.compressionRatios.brotli.length;
    }
    
    return compressionAnalysis;
  }

  async analyzeTreeShaking() {
    console.log('  🌳 Analyzing tree-shaking effectiveness...');
    
    // Analyze source files for import patterns
    const srcDir = path.join(__dirname, '../src');
    const sourceFiles = this.getAllSourceFiles(srcDir);
    
    const treeShakingAnalysis = {
      totalImports: 0,
      namedImports: 0,
      defaultImports: 0,
      namespaceImports: 0,
      sideEffectImports: 0,
      libraryImports: {},
      treeshakingScore: 0,
      recommendations: []
    };
    
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const imports = this.extractImports(content);
      
      for (const imp of imports) {
        treeShakingAnalysis.totalImports++;
        
        if (imp.type === 'named') {
          treeShakingAnalysis.namedImports++;
        } else if (imp.type === 'default') {
          treeShakingAnalysis.defaultImports++;
        } else if (imp.type === 'namespace') {
          treeShakingAnalysis.namespaceImports++;
        } else if (imp.type === 'side-effect') {
          treeShakingAnalysis.sideEffectImports++;
        }
        
        // Track library imports
        if (imp.source) {
          if (!treeShakingAnalysis.libraryImports[imp.source]) {
            treeShakingAnalysis.libraryImports[imp.source] = 0;
          }
          treeShakingAnalysis.libraryImports[imp.source]++;
        }
      }
    }
    
    // Calculate tree-shaking score
    treeShakingAnalysis.treeshakingScore = 
      treeShakingAnalysis.namedImports / treeShakingAnalysis.totalImports;
    
    // Generate tree-shaking recommendations
    if (treeShakingAnalysis.treeshakingScore < 0.7) {
      treeShakingAnalysis.recommendations.push({
        type: 'improve-named-imports',
        description: 'Increase usage of named imports for better tree-shaking',
        impact: 'high'
      });
    }
    
    // Check for problematic imports
    const problematicLibraries = ['lodash', 'moment', 'rxjs'];
    for (const [lib, count] of Object.entries(treeShakingAnalysis.libraryImports)) {
      if (problematicLibraries.some(prob => lib.includes(prob)) && count > 5) {
        treeShakingAnalysis.recommendations.push({
          type: 'optimize-library-imports',
          description: `High usage of ${lib} - consider using tree-shakable alternatives`,
          impact: 'medium',
          library: lib,
          usage: count
        });
      }
    }
    
    return treeShakingAnalysis;
  }

  extractImports(content) {
    const imports = [];
    const importRegex = /import\s+(?:(?:(?:\{[^}]*\})|(?:[^,\s]+(?:\s*,\s*\{[^}]*\})?)|(?:\*\s+as\s+[^,\s]+))\s+from\s+)?['"]([^'"]+)['"];?/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const fullImport = match[0];
      const source = match[1];
      
      let type = 'side-effect';
      if (fullImport.includes('{') && fullImport.includes('}')) {
        type = 'named';
      } else if (fullImport.includes('* as ')) {
        type = 'namespace';
      } else if (fullImport.includes('import ') && !fullImport.includes('{')) {
        type = 'default';
      }
      
      imports.push({ type, source, raw: fullImport });
    }
    
    return imports;
  }

  getAllSourceFiles(dir) {
    const files = [];
    
    const walk = (currentDir) => {
      const items = fs.readdirSync(currentDir);
      for (const item of items) {
        const itemPath = path.join(currentDir, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          walk(itemPath);
        } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
          files.push(itemPath);
        }
      }
    };
    
    walk(dir);
    return files;
  }

  async analyzeCacheStrategy() {
    console.log('  🎯 Analyzing cache strategy...');
    
    const distDir = path.join(__dirname, '../dist');
    const assetsDir = path.join(distDir, 'assets');
    const assets = fs.readdirSync(assetsDir).filter(f => !f.endsWith('.map'));
    
    const cacheAnalysis = {
      hashingStrategy: 'content-based',
      immutableAssets: 0,
      mutableAssets: 0,
      cacheGroups: {
        'vendor-high': [],
        'vendor-medium': [],
        'app-low': [],
        'features-medium': []
      }
    };
    
    for (const asset of assets) {
      const cacheability = this.assessCacheability(asset);
      const group = `${this.classifyChunk(asset)}-${cacheability}`;
      
      if (cacheability === 'high') {
        cacheAnalysis.immutableAssets++;
        cacheAnalysis.cacheGroups['vendor-high'].push(asset);
      } else if (cacheability === 'medium') {
        cacheAnalysis.cacheGroups['features-medium'].push(asset);
      } else {
        cacheAnalysis.mutableAssets++;
        cacheAnalysis.cacheGroups['app-low'].push(asset);
      }
    }
    
    return cacheAnalysis;
  }

  async analyzeLoadingStrategy() {
    console.log('  ⚡ Analyzing loading strategy...');
    
    const srcDir = path.join(__dirname, '../src');
    const sourceFiles = this.getAllSourceFiles(srcDir);
    
    const loadingAnalysis = {
      lazyImports: 0,
      eagerImports: 0,
      dynamicImports: [],
      criticalPath: [],
      preloadCandidates: []
    };
    
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Count dynamic imports (lazy loading)
      const dynamicImportMatches = content.match(/import\s*\(/g) || [];
      loadingAnalysis.lazyImports += dynamicImportMatches.length;
      
      // Extract dynamic import details
      const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      let match;
      while ((match = dynamicImportRegex.exec(content)) !== null) {
        const importPath = match[1];
        loadingAnalysis.dynamicImports.push({
          file: path.relative(srcDir, file),
          import: importPath,
          type: this.classifyDynamicImport(importPath)
        });
      }
      
      // Count static imports
      const staticImportMatches = content.match(/^import\s+/gm) || [];
      loadingAnalysis.eagerImports += staticImportMatches.length;
    }
    
    // Identify critical path components
    const mainFile = path.join(srcDir, 'main.tsx');
    const appFile = path.join(srcDir, 'App.tsx');
    
    if (fs.existsSync(mainFile)) {
      loadingAnalysis.criticalPath.push('main.tsx');
    }
    if (fs.existsSync(appFile)) {
      loadingAnalysis.criticalPath.push('App.tsx');
    }
    
    // Calculate lazy loading ratio
    const totalImports = loadingAnalysis.lazyImports + loadingAnalysis.eagerImports;
    loadingAnalysis.lazyLoadingRatio = loadingAnalysis.lazyImports / totalImports;
    
    return loadingAnalysis;
  }

  classifyDynamicImport(importPath) {
    if (importPath.includes('/pages/')) return 'page';
    if (importPath.includes('/components/')) return 'component';
    if (importPath.includes('/features/')) return 'feature';
    return 'module';
  }

  generateOptimizationRecommendations(validation) {
    const recommendations = [];
    
    // Budget violations
    if (validation.budgetValidation.violations.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'budget-violation',
        title: 'Performance Budget Violations',
        description: `${validation.budgetValidation.violations.length} budget violations detected`,
        details: validation.budgetValidation.violations,
        action: 'Optimize or split the violating chunks'
      });
    }
    
    // Chunk strategy optimization
    if (validation.chunkAnalysis.sizeDistribution.xlarge > 2) {
      recommendations.push({
        priority: 'high',
        category: 'chunk-size',
        title: 'Large Chunks Detected',
        description: `${validation.chunkAnalysis.sizeDistribution.xlarge} chunks larger than 500KB`,
        action: 'Further split large chunks or implement more aggressive lazy loading'
      });
    }
    
    // Tree-shaking optimization
    if (validation.treeShakingEffectiveness.treeshakingScore < 0.7) {
      recommendations.push({
        priority: 'medium',
        category: 'tree-shaking',
        title: 'Poor Tree-shaking Score',
        description: `Tree-shaking score: ${(validation.treeShakingEffectiveness.treeshakingScore * 100).toFixed(1)}%`,
        action: 'Increase usage of named imports and avoid namespace imports'
      });
    }
    
    // Compression optimization
    if (validation.compressionAnalysis.averageGzipRatio > 0.4) {
      recommendations.push({
        priority: 'low',
        category: 'compression',
        title: 'Compression Efficiency',
        description: `Average gzip ratio: ${(validation.compressionAnalysis.averageGzipRatio * 100).toFixed(1)}%`,
        action: 'Optimize asset content for better compression'
      });
    }
    
    // Loading strategy
    if (validation.loadingStrategy.lazyLoadingRatio < 0.3) {
      recommendations.push({
        priority: 'medium',
        category: 'lazy-loading',
        title: 'Low Lazy Loading Usage',
        description: `Only ${(validation.loadingStrategy.lazyLoadingRatio * 100).toFixed(1)}% lazy loading ratio`,
        action: 'Implement more lazy loading for non-critical features'
      });
    }
    
    return recommendations;
  }

  generateReport(validation) {
    console.log('\n🎯 BUNDLE STRATEGY VALIDATION REPORT');
    console.log('=====================================');
    
    if (validation.error) {
      console.log(`❌ Validation failed: ${validation.error}`);
      return;
    }
    
    console.log(`⏱️  Build Time: ${validation.buildTime}ms`);
    console.log('');
    
    // Performance Budget Status
    console.log('📊 Performance Budget Compliance:');
    const budgets = validation.budgetValidation.compliance;
    for (const [metric, data] of Object.entries(budgets)) {
      const status = data.compliant ? '✅' : '❌';
      console.log(`  ${status} ${metric}: ${data.actual}/${data.limit} (${data.utilizationPercent}%)`);
    }
    
    if (validation.budgetValidation.violations.length > 0) {
      console.log('\n⚠️  Budget Violations:');
      for (const violation of validation.budgetValidation.violations.slice(0, 3)) {
        console.log(`  🔴 ${violation.file}: ${violation.size}KB (${violation.excess}KB over limit)`);
      }
    }
    
    // Chunk Analysis
    console.log('\n🧩 Chunk Strategy Analysis:');
    console.log(`  Total Chunks: ${validation.chunkAnalysis.totalChunks}`);
    console.log(`  Vendor Chunks: ${validation.chunkAnalysis.vendorChunks.length}`);
    console.log(`  App Chunks: ${validation.chunkAnalysis.appChunks.length}`);
    console.log(`  Lazy Chunks: ${validation.chunkAnalysis.lazyChunks.length}`);
    
    // Tree-shaking
    console.log('\n🌳 Tree-shaking Effectiveness:');
    const tsScore = (validation.treeShakingEffectiveness.treeshakingScore * 100).toFixed(1);
    const tsGrade = tsScore > 80 ? '🟢 A' : tsScore > 60 ? '🟡 B' : '🔴 C';
    console.log(`  Score: ${tsGrade} ${tsScore}%`);
    console.log(`  Named Imports: ${validation.treeShakingEffectiveness.namedImports}/${validation.treeShakingEffectiveness.totalImports}`);
    
    // Compression
    if (validation.compressionAnalysis.averageGzipRatio) {
      console.log('\n🗜️  Compression Analysis:');
      console.log(`  Gzip Ratio: ${(validation.compressionAnalysis.averageGzipRatio * 100).toFixed(1)}%`);
      console.log(`  Total Savings: ${Math.round(validation.compressionAnalysis.totalSavings.gzip / 1024)}KB`);
    }
    
    // Loading Strategy
    console.log('\n⚡ Loading Strategy:');
    console.log(`  Lazy Loading Ratio: ${(validation.loadingStrategy.lazyLoadingRatio * 100).toFixed(1)}%`);
    console.log(`  Dynamic Imports: ${validation.loadingStrategy.lazyImports}`);
    console.log(`  Critical Path: ${validation.loadingStrategy.criticalPath.join(', ')}`);
    
    // Recommendations
    if (validation.recommendations.length > 0) {
      console.log('\n💡 Optimization Recommendations:');
      for (const rec of validation.recommendations.slice(0, 5)) {
        const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        console.log(`  ${icon} ${rec.title}: ${rec.action}`);
      }
    }
    
    console.log(`\n📁 Detailed results saved to: ${this.resultsDir}`);
    
    return validation;
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new BundleStrategyValidator();
  
  try {
    const validation = await validator.validateBundleStrategy();
    validator.generateReport(validation);
    
    // Exit with appropriate code
    if (validation.error || (validation.budgetValidation?.violations.length > 0)) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

export default BundleStrategyValidator;