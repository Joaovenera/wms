#!/usr/bin/env node

/**
 * Build with Bundle Strategy Validation
 * Enhanced build process with comprehensive bundle analysis and optimization
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EnhancedBuildProcess {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.buildMetrics = {
      startTime: Date.now(),
      phases: {},
      warnings: [],
      errors: []
    };
  }

  async executeBuild() {
    console.log('🚀 Enhanced Build Process Starting...');
    console.log('=====================================');
    
    try {
      // Phase 1: Pre-build Analysis
      await this.runPreBuildAnalysis();
      
      // Phase 2: Clean Build
      await this.cleanBuild();
      
      // Phase 3: Optimized Build
      await this.runOptimizedBuild();
      
      // Phase 4: Post-build Validation
      await this.runPostBuildValidation();
      
      // Phase 5: Performance Testing
      await this.runPerformanceValidation();
      
      // Phase 6: Generate Reports
      await this.generateBuildReport();
      
      console.log('\n✅ Enhanced build process completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Build process failed:', error.message);
      this.buildMetrics.errors.push(error.message);
      process.exit(1);
    }
  }

  async runPreBuildAnalysis() {
    console.log('\n📋 Phase 1: Pre-build Analysis');
    console.log('------------------------------');
    
    const phaseStart = Date.now();
    
    try {
      // Check TypeScript compilation
      console.log('  🔍 TypeScript compilation check...');
      execSync('npx tsc --noEmit', { 
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      console.log('  ✅ TypeScript compilation passed');
      
      // Check code quality
      console.log('  🧹 Code quality analysis...');
      try {
        execSync('npm run lint', { 
          cwd: this.projectRoot,
          stdio: 'pipe'
        });
        console.log('  ✅ Code quality checks passed');
      } catch (lintError) {
        console.log('  ⚠️  Linting warnings detected');
        this.buildMetrics.warnings.push('Linting issues detected');
      }
      
      // Analyze current bundle composition
      console.log('  📊 Analyzing dependency composition...');
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8')
      );
      
      const depCount = Object.keys(packageJson.dependencies || {}).length;
      const devDepCount = Object.keys(packageJson.devDependencies || {}).length;
      
      console.log(`  📦 Dependencies: ${depCount} production, ${devDepCount} development`);
      
      // Check for heavy dependencies
      const heavyDeps = Object.keys(packageJson.dependencies || {}).filter(dep => 
        ['react', 'react-dom', '@radix-ui', 'framer-motion', 'recharts'].some(heavy => dep.includes(heavy))
      );
      
      if (heavyDeps.length > 0) {
        console.log(`  ⚠️  Heavy dependencies detected: ${heavyDeps.length}`);
        this.buildMetrics.warnings.push(`${heavyDeps.length} heavy dependencies`);
      }
      
    } catch (error) {
      throw new Error(`Pre-build analysis failed: ${error.message}`);
    }
    
    this.buildMetrics.phases.preBuildAnalysis = Date.now() - phaseStart;
  }

  async cleanBuild() {
    console.log('\n🧹 Phase 2: Clean Build Environment');
    console.log('-----------------------------------');
    
    const phaseStart = Date.now();
    
    try {
      // Clean previous build artifacts
      const distPath = path.join(this.projectRoot, 'dist');
      if (fs.existsSync(distPath)) {
        console.log('  🗑️  Cleaning previous build...');
        execSync(`rm -rf "${distPath}"`, { cwd: this.projectRoot });
      }
      
      // Clean bundle analysis results
      const analysisPath = path.join(this.projectRoot, 'bundle-analysis');
      if (fs.existsSync(analysisPath)) {
        console.log('  🗑️  Cleaning analysis cache...');
        execSync(`rm -rf "${analysisPath}"`, { cwd: this.projectRoot });
      }
      
      // Create fresh directories
      fs.mkdirSync(distPath, { recursive: true });
      fs.mkdirSync(analysisPath, { recursive: true });
      
      console.log('  ✅ Build environment cleaned');
      
    } catch (error) {
      throw new Error(`Clean build failed: ${error.message}`);
    }
    
    this.buildMetrics.phases.cleanBuild = Date.now() - phaseStart;
  }

  async runOptimizedBuild() {
    console.log('\n⚡ Phase 3: Optimized Production Build');
    console.log('-------------------------------------');
    
    const phaseStart = Date.now();
    
    try {
      console.log('  🔨 Building with optimized configuration...');
      
      // Set production environment with optimization flags
      const buildEnv = {
        ...process.env,
        NODE_ENV: 'production',
        VITE_BUILD_ANALYZE: 'true',
        BUILD_OPTIMIZATION: 'true'
      };
      
      // Run the build with timeout
      const buildResult = execSync('npm run build', {
        cwd: this.projectRoot,
        stdio: 'pipe',
        env: buildEnv,
        timeout: 300000 // 5 minutes timeout
      });
      
      console.log('  ✅ Production build completed');
      
      // Check build output
      const distDir = path.join(this.projectRoot, 'dist');
      const assetsDir = path.join(distDir, 'assets');
      
      if (!fs.existsSync(assetsDir)) {
        throw new Error('Build assets directory not found');
      }
      
      const assets = fs.readdirSync(assetsDir);
      const jsFiles = assets.filter(f => f.endsWith('.js') && !f.endsWith('.map'));
      const cssFiles = assets.filter(f => f.endsWith('.css'));
      
      console.log(`  📊 Build output: ${jsFiles.length} JS files, ${cssFiles.length} CSS files`);
      
      // Calculate total sizes
      let totalJSSize = 0;
      let totalCSSSize = 0;
      
      for (const file of assets) {
        const filePath = path.join(assetsDir, file);
        const size = fs.statSync(filePath).size;
        
        if (file.endsWith('.js') && !file.endsWith('.map')) {
          totalJSSize += size;
        } else if (file.endsWith('.css')) {
          totalCSSSize += size;
        }
      }
      
      console.log(`  📏 Total JS: ${Math.round(totalJSSize / 1024)}KB, CSS: ${Math.round(totalCSSSize / 1024)}KB`);
      
      this.buildMetrics.buildOutput = {
        jsFiles: jsFiles.length,
        cssFiles: cssFiles.length,
        totalJSSize: Math.round(totalJSSize / 1024),
        totalCSSSize: Math.round(totalCSSSize / 1024)
      };
      
    } catch (error) {
      throw new Error(`Optimized build failed: ${error.message}`);
    }
    
    this.buildMetrics.phases.optimizedBuild = Date.now() - phaseStart;
  }

  async runPostBuildValidation() {
    console.log('\n🎯 Phase 4: Post-build Validation');
    console.log('---------------------------------');
    
    const phaseStart = Date.now();
    
    try {
      // Run bundle strategy validation
      console.log('  📊 Running bundle strategy validation...');
      
      const validatorPath = path.join(__dirname, 'bundle-strategy-validator.js');
      const validationResult = execSync(`node "${validatorPath}"`, {
        cwd: this.projectRoot,
        stdio: 'pipe',
        encoding: 'utf8'
      });
      
      console.log('  ✅ Bundle strategy validation completed');
      
      // Check for validation warnings/errors in output
      if (validationResult.includes('❌') || validationResult.includes('Budget Violations')) {
        this.buildMetrics.warnings.push('Bundle validation issues detected');
        console.log('  ⚠️  Bundle validation warnings detected');
      }
      
      // Run bundle size analysis
      console.log('  📈 Running comprehensive bundle analysis...');
      
      try {
        execSync('npm run bundle:analyze', {
          cwd: this.projectRoot,
          stdio: 'pipe'
        });
        console.log('  ✅ Bundle analysis completed');
      } catch (analysisError) {
        console.log('  ⚠️  Bundle analysis had issues');
        this.buildMetrics.warnings.push('Bundle analysis issues');
      }
      
    } catch (error) {
      throw new Error(`Post-build validation failed: ${error.message}`);
    }
    
    this.buildMetrics.phases.postBuildValidation = Date.now() - phaseStart;
  }

  async runPerformanceValidation() {
    console.log('\n⚡ Phase 5: Performance Validation');
    console.log('----------------------------------');
    
    const phaseStart = Date.now();
    
    try {
      // Run performance validation suite
      console.log('  🏃 Running performance tests...');
      
      try {
        execSync('npm run performance:current', {
          cwd: this.projectRoot,
          stdio: 'pipe',
          timeout: 120000 // 2 minutes timeout
        });
        console.log('  ✅ Performance validation completed');
      } catch (perfError) {
        console.log('  ⚠️  Performance validation had issues');
        this.buildMetrics.warnings.push('Performance validation issues');
      }
      
      // Validate against performance budgets
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8')
      );
      
      if (packageJson.performanceBudgets) {
        console.log('  🎯 Checking performance budgets...');
        
        const budgets = packageJson.performanceBudgets.bundleSize;
        const actualJS = this.buildMetrics.buildOutput?.totalJSSize || 0;
        const actualCSS = this.buildMetrics.buildOutput?.totalCSSSize || 0;
        
        if (actualJS > budgets.javascript) {
          this.buildMetrics.warnings.push(`JS bundle exceeds budget: ${actualJS}KB > ${budgets.javascript}KB`);
          console.log(`  ⚠️  JS bundle exceeds budget: ${actualJS}KB > ${budgets.javascript}KB`);
        }
        
        if (actualCSS > budgets.css) {
          this.buildMetrics.warnings.push(`CSS bundle exceeds budget: ${actualCSS}KB > ${budgets.css}KB`);
          console.log(`  ⚠️  CSS bundle exceeds budget: ${actualCSS}KB > ${budgets.css}KB`);
        }
        
        const total = actualJS + actualCSS;
        if (total > budgets.total) {
          this.buildMetrics.warnings.push(`Total bundle exceeds budget: ${total}KB > ${budgets.total}KB`);
          console.log(`  ⚠️  Total bundle exceeds budget: ${total}KB > ${budgets.total}KB`);
        } else {
          console.log(`  ✅ Performance budgets: ${total}KB / ${budgets.total}KB`);
        }
      }
      
    } catch (error) {
      throw new Error(`Performance validation failed: ${error.message}`);
    }
    
    this.buildMetrics.phases.performanceValidation = Date.now() - phaseStart;
  }

  async generateBuildReport() {
    console.log('\n📊 Phase 6: Build Report Generation');
    console.log('-----------------------------------');
    
    const phaseStart = Date.now();
    
    try {
      const totalTime = Date.now() - this.buildMetrics.startTime;
      
      // Create comprehensive build report
      const buildReport = {
        timestamp: new Date().toISOString(),
        totalBuildTime: totalTime,
        phases: this.buildMetrics.phases,
        buildOutput: this.buildMetrics.buildOutput,
        warnings: this.buildMetrics.warnings,
        errors: this.buildMetrics.errors,
        status: this.buildMetrics.errors.length === 0 ? 'success' : 'failed',
        performanceGrade: this.calculatePerformanceGrade()
      };
      
      // Save build report
      const reportsDir = path.join(this.projectRoot, 'build-reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const reportFile = path.join(reportsDir, `build-report-${Date.now()}.json`);
      fs.writeFileSync(reportFile, JSON.stringify(buildReport, null, 2));
      
      // Save latest report
      const latestReportFile = path.join(reportsDir, 'latest-build-report.json');
      fs.writeFileSync(latestReportFile, JSON.stringify(buildReport, null, 2));
      
      console.log(`  📄 Build report saved: ${reportFile}`);
      console.log(`  ✅ Report generation completed`);
      
      // Display summary
      this.displayBuildSummary(buildReport);
      
    } catch (error) {
      throw new Error(`Build report generation failed: ${error.message}`);
    }
    
    this.buildMetrics.phases.reportGeneration = Date.now() - phaseStart;
  }

  calculatePerformanceGrade() {
    const warnings = this.buildMetrics.warnings.length;
    const errors = this.buildMetrics.errors.length;
    
    if (errors > 0) return 'F';
    if (warnings === 0) return 'A';
    if (warnings <= 2) return 'B';
    if (warnings <= 5) return 'C';
    return 'D';
  }

  displayBuildSummary(report) {
    console.log('\n📋 BUILD SUMMARY');
    console.log('================');
    
    const minutes = Math.floor(report.totalBuildTime / 60000);
    const seconds = Math.floor((report.totalBuildTime % 60000) / 1000);
    console.log(`⏱️  Total Build Time: ${minutes}m ${seconds}s`);
    
    console.log(`📦 Build Output:`);
    if (report.buildOutput) {
      console.log(`   JS Files: ${report.buildOutput.jsFiles} (${report.buildOutput.totalJSSize}KB)`);
      console.log(`   CSS Files: ${report.buildOutput.cssFiles} (${report.buildOutput.totalCSSSize}KB)`);
      console.log(`   Total Size: ${report.buildOutput.totalJSSize + report.buildOutput.totalCSSSize}KB`);
    }
    
    const statusIcon = report.status === 'success' ? '✅' : '❌';
    console.log(`${statusIcon} Build Status: ${report.status.toUpperCase()}`);
    
    const gradeIcon = report.performanceGrade === 'A' ? '🟢' : 
                     report.performanceGrade === 'B' ? '🟡' : '🔴';
    console.log(`${gradeIcon} Performance Grade: ${report.performanceGrade}`);
    
    if (report.warnings.length > 0) {
      console.log(`⚠️  Warnings: ${report.warnings.length}`);
      for (const warning of report.warnings.slice(0, 3)) {
        console.log(`   • ${warning}`);
      }
    }
    
    if (report.errors.length > 0) {
      console.log(`❌ Errors: ${report.errors.length}`);
      for (const error of report.errors) {
        console.log(`   • ${error}`);
      }
    }
    
    console.log(`\n📁 Detailed reports available in: build-reports/`);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const buildProcess = new EnhancedBuildProcess();
  await buildProcess.executeBuild();
}

export default EnhancedBuildProcess;