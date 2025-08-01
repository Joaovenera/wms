#!/usr/bin/env node

/**
 * Lighthouse Performance Audit
 * Automated Lighthouse CI integration for WMS Frontend
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LighthouseAuditor {
  constructor() {
    this.resultsDir = path.join(__dirname, '../lighthouse-results');
    this.configFile = path.join(__dirname, '../lighthouserc.js');
    this.ensureResultsDir();
    this.setupConfig();
  }

  ensureResultsDir() {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  setupConfig() {
    const config = `
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 10000,
      url: [
        'http://localhost:4173',
        'http://localhost:4173/dashboard',
        'http://localhost:4173/pallets',
        'http://localhost:4173/products'
      ],
      numberOfRuns: 3
    },
    assert: {
      assertions: {
        'categories:performance': ['error', {minScore: 0.7}],
        'categories:accessibility': ['error', {minScore: 0.9}],
        'categories:best-practices': ['error', {minScore: 0.8}],
        'categories:seo': ['error', {minScore: 0.8}],
        'categories:pwa': ['error', {minScore: 0.6}]
      }
    },
    upload: {
      target: 'filesystem',
      outputDir: '${this.resultsDir.replace(/\\/g, '/')}'
    }
  }
};
`;
    
    if (!fs.existsSync(this.configFile)) {
      fs.writeFileSync(this.configFile, config);
    }
  }

  async installLighthouseCi() {
    try {
      console.log('📦 Installing Lighthouse CI...');
      execSync('npm install -g @lhci/cli', { stdio: 'pipe' });
      console.log('✅ Lighthouse CI installed');
    } catch (error) {
      console.log('⚠️  Lighthouse CI may already be installed or installation failed');
      console.log('    Continuing with existing installation...');
    }
  }

  async runAudit() {
    console.log('🔍 Running Lighthouse Performance Audit...');
    
    try {
      // Build the project first
      console.log('  📦 Building project...');
      execSync('npm run build', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
      
      // Run Lighthouse CI
      console.log('  🚀 Running Lighthouse audit...');
      const result = execSync('lhci autorun', {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
        encoding: 'utf8'
      });
      
      console.log('✅ Lighthouse audit completed');
      return this.parseResults();
      
    } catch (error) {
      console.error('❌ Lighthouse audit failed:', error.message);
      return { error: error.message };
    }
  }

  parseResults() {
    try {
      const manifestFile = path.join(this.resultsDir, 'manifest.json');
      
      if (!fs.existsSync(manifestFile)) {
        throw new Error('Lighthouse results not found');
      }
      
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      const results = [];
      
      for (const result of manifest) {
        const reportFile = path.join(this.resultsDir, result.jsonPath);
        const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
        
        results.push({
          url: report.finalUrl,
          timestamp: report.fetchTime,
          scores: {
            performance: report.categories.performance.score,
            accessibility: report.categories.accessibility.score,
            bestPractices: report.categories['best-practices'].score,
            seo: report.categories.seo.score,
            pwa: report.categories.pwa.score
          },
          metrics: {
            firstContentfulPaint: report.audits['first-contentful-paint'].numericValue,
            largestContentfulPaint: report.audits['largest-contentful-paint'].numericValue,
            cumulativeLayoutShift: report.audits['cumulative-layout-shift'].numericValue,
            totalBlockingTime: report.audits['total-blocking-time'].numericValue,
            speedIndex: report.audits['speed-index'].numericValue
          },
          opportunities: report.audits['opportunities'] ? 
            Object.keys(report.audits).filter(key => 
              report.audits[key].details && 
              report.audits[key].details.type === 'opportunity'
            ).map(key => ({
              audit: key,
              title: report.audits[key].title,
              description: report.audits[key].description,
              score: report.audits[key].score,
              numericValue: report.audits[key].numericValue
            })) : []
        });
      }
      
      return results;
    } catch (error) {
      console.error('❌ Failed to parse Lighthouse results:', error.message);
      return { error: error.message };
    }
  }

  generateReport(results) {
    if (results.error) {
      console.log('❌ Cannot generate report due to audit failure');
      return;
    }

    console.log('\n🏆 LIGHTHOUSE PERFORMANCE REPORT');
    console.log('================================');
    
    const avgScores = {
      performance: 0,
      accessibility: 0,
      bestPractices: 0,
      seo: 0,
      pwa: 0
    };
    
    // Calculate averages
    for (const result of results) {
      for (const [key, score] of Object.entries(result.scores)) {
        avgScores[key] += score || 0;
      }
    }
    
    for (const key of Object.keys(avgScores)) {
      avgScores[key] = avgScores[key] / results.length;
    }
    
    // Display scores
    console.log('📊 Average Scores:');
    for (const [category, score] of Object.entries(avgScores)) {
      const percentage = Math.round(score * 100);
      const status = percentage >= 90 ? '🟢' : percentage >= 70 ? '🟡' : '🔴';
      console.log(`  ${status} ${category}: ${percentage}%`);
    }
    
    console.log('\n⚡ Core Web Vitals (Average):');
    const avgMetrics = {
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      cumulativeLayoutShift: 0,
      totalBlockingTime: 0,
      speedIndex: 0
    };
    
    for (const result of results) {
      for (const [key, value] of Object.entries(result.metrics)) {
        avgMetrics[key] += value || 0;
      }
    }
    
    for (const key of Object.keys(avgMetrics)) {
      avgMetrics[key) = avgMetrics[key] / results.length;
    }
    
    console.log(`  📈 First Contentful Paint: ${Math.round(avgMetrics.firstContentfulPaint)}ms`);
    console.log(`  📈 Largest Contentful Paint: ${Math.round(avgMetrics.largestContentfulPaint)}ms`);
    console.log(`  📈 Cumulative Layout Shift: ${avgMetrics.cumulativeLayoutShift.toFixed(3)}`);
    console.log(`  📈 Total Blocking Time: ${Math.round(avgMetrics.totalBlockingTime)}ms`);
    console.log(`  📈 Speed Index: ${Math.round(avgMetrics.speedIndex)}ms`);
    
    // Save detailed report
    const reportFile = path.join(this.resultsDir, 'summary-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      averageScores: avgScores,
      averageMetrics: avgMetrics,
      results: results,
      recommendations: this.generateRecommendations(results)
    };
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📁 Detailed report saved to: ${reportFile}`);
    
    return report;
  }

  generateRecommendations(results) {
    const recommendations = [];
    
    // Analyze common opportunities across all results
    const opportunityCount = {};
    
    for (const result of results) {
      for (const opportunity of result.opportunities) {
        if (!opportunityCount[opportunity.audit]) {
          opportunityCount[opportunity.audit] = 0;
        }
        opportunityCount[opportunity.audit]++;
      }
    }
    
    // Top opportunities
    const topOpportunities = Object.entries(opportunityCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    for (const [audit, count] of topOpportunities) {
      const example = results[0].opportunities.find(o => o.audit === audit);
      if (example) {
        recommendations.push({
          priority: count >= results.length ? 'high' : count >= results.length / 2 ? 'medium' : 'low',
          audit,
          title: example.title,
          description: example.description,
          frequency: `${count}/${results.length} pages affected`
        });
      }
    }
    
    return recommendations;
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const auditor = new LighthouseAuditor();
  const command = process.argv[2];
  
  switch (command) {
    case 'install':
      await auditor.installLighthouseCi();
      break;
    case 'audit':
      await auditor.installLighthouseCi();
      const results = await auditor.runAudit();
      if (!results.error) {
        auditor.generateReport(results);
      }
      break;
    case 'report':
      const existingResults = auditor.parseResults();
      if (!existingResults.error) {
        auditor.generateReport(existingResults);
      }
      break;
    default:
      console.log(`
Usage: node lighthouse-audit.js <command>

Commands:
  install  - Install Lighthouse CI
  audit    - Run complete Lighthouse audit
  report   - Generate report from existing results

Examples:
  node lighthouse-audit.js audit
  node lighthouse-audit.js report
      `);
  }
}

export default LighthouseAuditor;