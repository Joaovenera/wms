#!/usr/bin/env node

/**
 * Bundle Analyzer for WMS Frontend
 * Comprehensive bundle size analysis and optimization recommendations
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BundleAnalyzer {
  constructor() {
    this.analysisDir = path.join(__dirname, '../bundle-analysis');
    this.ensureAnalysisDir();
  }

  ensureAnalysisDir() {
    if (!fs.existsSync(this.analysisDir)) {
      fs.mkdirSync(this.analysisDir, { recursive: true });
    }
  }

  async analyzeBundleSize() {
    console.log('📦 Analyzing Bundle Size...');
    
    try {
      // Build with source maps for analysis
      console.log('  🔨 Building with source maps...');
      execSync('npm run build', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
      
      const distDir = path.join(__dirname, '../dist');
      const assetsDir = path.join(distDir, 'assets');
      
      if (!fs.existsSync(assetsDir)) {
        throw new Error('Build assets not found');
      }
      
      const analysis = {
        timestamp: new Date().toISOString(),
        totalSize: 0,
        assets: {},
        recommendations: []
      };
      
      const assets = fs.readdirSync(assetsDir);
      
      for (const asset of assets) {
        const assetPath = path.join(assetsDir, asset);
        const stats = fs.statSync(assetPath);
        
        analysis.assets[asset] = {
          size: stats.size,
          sizeKB: Math.round(stats.size / 1024),
          sizeMB: Math.round(stats.size / 1024 / 1024 * 100) / 100,
          type: this.getAssetType(asset),
          gzipEstimate: Math.round(stats.size * 0.3), // Rough gzip estimate
          category: this.categorizeAsset(asset)
        };
        
        analysis.totalSize += stats.size;
      }
      
      analysis.totalSizeKB = Math.round(analysis.totalSize / 1024);
      analysis.totalSizeMB = Math.round(analysis.totalSize / 1024 / 1024 * 100) / 100;
      
      // Generate size breakdown
      analysis.breakdown = this.generateSizeBreakdown(analysis.assets);
      analysis.recommendations = this.generateSizeRecommendations(analysis);
      
      // Save analysis
      const analysisFile = path.join(this.analysisDir, 'bundle-analysis.json');
      fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
      
      console.log('✅ Bundle analysis completed');
      return analysis;
      
    } catch (error) {
      console.error('❌ Bundle analysis failed:', error.message);
      return { error: error.message };
    }
  }

  getAssetType(filename) {
    if (filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.css')) return 'stylesheet';
    if (filename.endsWith('.map')) return 'sourcemap';
    if (filename.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    if (filename.match(/\.(woff|woff2|ttf|eot)$/)) return 'font';
    return 'other';
  }

  categorizeAsset(filename) {
    if (filename.includes('vendor') || filename.includes('chunk')) return 'vendor';
    if (filename.includes('index')) return 'main';
    return 'chunk';
  }

  generateSizeBreakdown(assets) {
    const breakdown = {
      byType: {},
      byCategory: {},
      largest: []
    };
    
    // Group by type
    for (const [name, asset] of Object.entries(assets)) {
      if (!breakdown.byType[asset.type]) {
        breakdown.byType[asset.type] = { count: 0, size: 0, sizeKB: 0 };
      }
      breakdown.byType[asset.type].count++;
      breakdown.byType[asset.type].size += asset.size;
      breakdown.byType[asset.type].sizeKB += asset.sizeKB;
    }
    
    // Group by category
    for (const [name, asset] of Object.entries(assets)) {
      if (!breakdown.byCategory[asset.category]) {
        breakdown.byCategory[asset.category] = { count: 0, size: 0, sizeKB: 0 };
      }
      breakdown.byCategory[asset.category].count++;
      breakdown.byCategory[asset.category].size += asset.size;
      breakdown.byCategory[asset.category].sizeKB += asset.sizeKB;
    }
    
    // Find largest assets
    breakdown.largest = Object.entries(assets)
      .sort(([,a], [,b]) => b.size - a.size)
      .slice(0, 10)
      .map(([name, asset]) => ({ name, ...asset }));
    
    return breakdown;
  }

  generateSizeRecommendations(analysis) {
    const recommendations = [];
    
    // Check total bundle size
    if (analysis.totalSizeKB > 1000) {
      recommendations.push({
        priority: 'high',
        category: 'bundle-size',
        title: 'Large Bundle Size',
        description: `Total bundle size (${analysis.totalSizeKB}KB) exceeds recommended 1MB limit`,
        suggestion: 'Consider code splitting, lazy loading, and tree shaking optimization'
      });
    }
    
    // Check individual asset sizes
    for (const asset of analysis.breakdown.largest.slice(0, 3)) {
      if (asset.sizeKB > 500) {
        recommendations.push({
          priority: asset.sizeKB > 800 ? 'high' : 'medium',
          category: 'large-asset',
          title: 'Large Asset Detected',
          description: `${asset.name} is ${asset.sizeKB}KB`,
          suggestion: 'Consider splitting this asset or optimizing its content'
        });
      }
    }
    
    // Check JavaScript vs CSS ratio
    const jsSize = analysis.breakdown.byType.javascript?.sizeKB || 0;
    const cssSize = analysis.breakdown.byType.stylesheet?.sizeKB || 0;
    
    if (jsSize > cssSize * 10) {
      recommendations.push({
        priority: 'medium',
        category: 'js-css-ratio',
        title: 'High JavaScript to CSS Ratio',
        description: `JavaScript (${jsSize}KB) is much larger than CSS (${cssSize}KB)`,
        suggestion: 'Consider extracting CSS and optimizing JavaScript bundle'
      });
    }
    
    // Check source maps in production
    const sourceMaps = Object.keys(analysis.assets).filter(name => name.endsWith('.map'));
    if (sourceMaps.length > 0) {
      recommendations.push({
        priority: 'low',
        category: 'source-maps',
        title: 'Source Maps in Build',
        description: `${sourceMaps.length} source map files found`,
        suggestion: 'Consider excluding source maps from production build'
      });
    }
    
    return recommendations;
  }

  async analyzeDependencies() {
    console.log('📚 Analyzing Dependencies...');
    
    try {
      const packageJsonPath = path.join(__dirname, '../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      const analysis = {
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        analysis: {
          total: 0,
          heavy: [],
          ui: [],
          utility: [],
          development: []
        }
      };
      
      // Categorize dependencies
      for (const [name, version] of Object.entries(analysis.dependencies)) {
        analysis.analysis.total++;
        
        if (this.isHeavyDependency(name)) {
          analysis.analysis.heavy.push({ name, version, category: 'heavy' });
        }
        
        if (this.isUIDependency(name)) {
          analysis.analysis.ui.push({ name, version, category: 'ui' });
        }
        
        if (this.isUtilityDependency(name)) {
          analysis.analysis.utility.push({ name, version, category: 'utility' });
        }
      }
      
      // Analyze dev dependencies
      for (const [name, version] of Object.entries(analysis.devDependencies)) {
        analysis.analysis.development.push({ name, version, category: 'development' });
      }
      
      // Generate recommendations
      analysis.recommendations = this.generateDependencyRecommendations(analysis);
      
      // Save analysis
      const analysisFile = path.join(this.analysisDir, 'dependency-analysis.json');
      fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
      
      console.log('✅ Dependency analysis completed');
      return analysis;
      
    } catch (error) {
      console.error('❌ Dependency analysis failed:', error.message);
      return { error: error.message };
    }
  }

  isHeavyDependency(name) {
    const heavyDeps = ['react', 'react-dom', 'framer-motion', 'recharts', '@radix-ui'];
    return heavyDeps.some(heavy => name.includes(heavy));
  }

  isUIDependency(name) {
    const uiDeps = ['@radix-ui', 'lucide-react', 'class-variance-authority', 'tailwind'];
    return uiDeps.some(ui => name.includes(ui));
  }

  isUtilityDependency(name) {
    const utilityDeps = ['clsx', 'zod', 'date-fns', 'qrcode'];
    return utilityDeps.some(util => name.includes(util));
  }

  generateDependencyRecommendations(analysis) {
    const recommendations = [];
    
    // Too many dependencies
    if (analysis.analysis.total > 30) {
      recommendations.push({
        priority: 'medium',
        category: 'dependency-count',
        title: 'High Dependency Count',
        description: `${analysis.analysis.total} dependencies detected`,
        suggestion: 'Review dependencies and remove unused ones'
      });
    }
    
    // Heavy dependencies
    if (analysis.analysis.heavy.length > 5) {
      recommendations.push({
        priority: 'high',
        category: 'heavy-dependencies',
        title: 'Multiple Heavy Dependencies',
        description: `${analysis.analysis.heavy.length} heavy dependencies found`,
        suggestion: 'Consider lazy loading or finding lighter alternatives'
      });
    }
    
    // UI library consolidation
    if (analysis.analysis.ui.length > 10) {
      recommendations.push({
        priority: 'medium',
        category: 'ui-consolidation',
        title: 'Multiple UI Libraries',
        description: `${analysis.analysis.ui.length} UI-related dependencies`,
        suggestion: 'Consider consolidating UI components or using a single design system'
      });
    }
    
    return recommendations;
  }

  generateReport(bundleAnalysis, dependencyAnalysis) {
    console.log('\n📊 BUNDLE ANALYSIS REPORT');
    console.log('========================');
    
    if (!bundleAnalysis.error) {
      console.log('📦 Bundle Size Analysis:');
      console.log(`  Total Size: ${bundleAnalysis.totalSizeKB}KB (${bundleAnalysis.totalSizeMB}MB)`);
      console.log(`  Asset Count: ${Object.keys(bundleAnalysis.assets).length}`);
      
      console.log('\n📊 Size Breakdown by Type:');
      for (const [type, data] of Object.entries(bundleAnalysis.breakdown.byType)) {
        console.log(`  ${type}: ${data.sizeKB}KB (${data.count} files)`);
      }
      
      console.log('\n🏆 Largest Assets:');
      for (const asset of bundleAnalysis.breakdown.largest.slice(0, 5)) {
        console.log(`  ${asset.name}: ${asset.sizeKB}KB`);
      }
    }
    
    if (!dependencyAnalysis.error) {
      console.log('\n📚 Dependency Analysis:');
      console.log(`  Total Dependencies: ${dependencyAnalysis.analysis.total}`);
      console.log(`  Heavy Dependencies: ${dependencyAnalysis.analysis.heavy.length}`);
      console.log(`  UI Dependencies: ${dependencyAnalysis.analysis.ui.length}`);
    }
    
    // Combined recommendations
    const allRecommendations = [
      ...(bundleAnalysis.recommendations || []),
      ...(dependencyAnalysis.recommendations || [])
    ].sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    if (allRecommendations.length > 0) {
      console.log('\n💡 Optimization Recommendations:');
      for (const rec of allRecommendations.slice(0, 5)) {
        const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        console.log(`  ${icon} ${rec.title}: ${rec.suggestion}`);
      }
    }
    
    console.log(`\n📁 Detailed analysis saved to: ${this.analysisDir}`);
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new BundleAnalyzer();
  const command = process.argv[2];
  
  switch (command) {
    case 'bundle':
      const bundleResults = await analyzer.analyzeBundleSize();
      if (!bundleResults.error) {
        analyzer.generateReport(bundleResults, {});
      }
      break;
    case 'deps':
      const depResults = await analyzer.analyzeDependencies();
      if (!depResults.error) {
        analyzer.generateReport({}, depResults);
      }
      break;
    case 'full':
      const bundleAnalysis = await analyzer.analyzeBundleSize();
      const dependencyAnalysis = await analyzer.analyzeDependencies();
      analyzer.generateReport(bundleAnalysis, dependencyAnalysis);
      break;
    default:
      console.log(`
Usage: node bundle-analyzer.js <command>

Commands:
  bundle  - Analyze bundle size only
  deps    - Analyze dependencies only
  full    - Complete bundle and dependency analysis

Examples:
  node bundle-analyzer.js full
  node bundle-analyzer.js bundle
      `);
  }
}

export default BundleAnalyzer;