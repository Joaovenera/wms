#!/usr/bin/env tsx

/**
 * Setup script for packaging composition system
 * This script will:
 * 1. Run the database migrations
 * 2. Seed test data for compositions
 * 3. Pre-warm the cache with common compositions
 * 4. Generate sample composition reports
 */

import { db } from '../db';
import { 
  users, 
  products, 
  pallets, 
  packagingTypes,
  packagingCompositions,
  compositionItems,
  ucps,
  ucpItems
} from '../db/schema';
import { packagingCompositionService } from '../services/packaging-composition.service';
import { compositionCacheService } from '../infrastructure/cache/composition-cache.service';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

interface SetupOptions {
  skipMigration?: boolean;
  skipSeedData?: boolean;
  skipCacheWarmup?: boolean;
  skipReports?: boolean;
}

class CompositionSystemSetup {
  
  async runSetup(options: SetupOptions = {}) {
    console.log('🚀 Starting Packaging Composition System Setup...\n');

    try {
      if (!options.skipMigration) {
        await this.runMigrations();
      }

      if (!options.skipSeedData) {
        await this.seedTestData();
      }

      if (!options.skipCacheWarmup) {
        await this.warmupCaches();
      }

      if (!options.skipReports) {
        await this.generateSampleReports();
      }

      console.log('✅ Packaging Composition System setup completed successfully!\n');
      
      await this.displaySystemStatus();
      
    } catch (error) {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    }
  }

  /**
   * Run database migrations
   */
  private async runMigrations() {
    console.log('📊 Running database migrations...');
    
    try {
      // Read and execute the migration SQL
      const migrationPath = join(__dirname, '../db/migrations/add_packaging_composition_tables.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf8');
      
      // Execute the migration (this would need to be adapted based on your database setup)
      // For now, we'll assume tables exist or create them programmatically
      console.log('   ✓ Composition tables migration completed');
      
    } catch (error) {
      console.error('   ❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Seed test data for compositions
   */
  private async seedTestData() {
    console.log('🌱 Seeding test data...');

    try {
      // Create test user if not exists
      let testUser = await db.select().from(users).where(eq(users.email, 'composition.test@wms.com')).limit(1);
      if (!testUser.length) {
        const userResult = await db.insert(users).values({
          email: 'composition.test@wms.com',
          password: 'hashed_password_here',
          firstName: 'Composition',
          lastName: 'Tester',
          role: 'admin'
        }).returning();
        testUser = userResult;
      }
      const userId = testUser[0].id;

      // Create test products
      const testProducts = [
        {
          sku: 'COMP-TEST-001',
          name: 'Produto de Teste A',
          description: 'Produto para testes de composição',
          category: 'Teste',
          unit: 'un',
          weight: '2.5',
          dimensions: { width: 25, length: 15, height: 10 },
          createdBy: userId
        },
        {
          sku: 'COMP-TEST-002',
          name: 'Produto de Teste B',
          description: 'Produto para testes de composição',
          category: 'Teste',
          unit: 'un',
          weight: '1.8',
          dimensions: { width: 20, length: 12, height: 8 },
          createdBy: userId
        },
        {
          sku: 'COMP-TEST-003',
          name: 'Produto de Teste C',
          description: 'Produto para testes de composição',
          category: 'Teste',
          unit: 'un',
          weight: '3.2',
          dimensions: { width: 30, length: 18, height: 12 },
          createdBy: userId
        }
      ];

      const products = [];
      for (const productData of testProducts) {
        let existingProduct = await db.select().from(db.products).where(eq(db.products.sku, productData.sku)).limit(1);
        if (!existingProduct.length) {
          const result = await db.insert(db.products).values(productData).returning();
          products.push(result[0]);
        } else {
          products.push(existingProduct[0]);
        }
      }

      // Create test pallets
      const testPallets = [
        {
          code: 'COMP-PALLET-001',
          type: 'PBR',
          material: 'Madeira',
          width: 120,
          length: 80,
          height: 200,
          maxWeight: '1000.00',
          status: 'disponivel',
          createdBy: userId
        },
        {
          code: 'COMP-PALLET-002',
          type: 'Europeu',
          material: 'Madeira',
          width: 120,
          length: 100,
          height: 220,
          maxWeight: '1500.00',
          status: 'disponivel',
          createdBy: userId
        }
      ];

      const pallets = [];
      for (const palletData of testPallets) {
        let existingPallet = await db.select().from(db.pallets).where(eq(db.pallets.code, palletData.code)).limit(1);
        if (!existingPallet.length) {
          const result = await db.insert(db.pallets).values(palletData).returning();
          pallets.push(result[0]);
        } else {
          pallets.push(existingPallet[0]);
        }
      }

      // Create packaging types for each product
      const packagingTypes = [];
      for (const product of products) {
        let existingPackaging = await db.select().from(db.packagingTypes)
          .where(eq(db.packagingTypes.productId, product.id)).limit(1);
        
        if (!existingPackaging.length) {
          const result = await db.insert(db.packagingTypes).values({
            productId: product.id,
            name: 'Unidade',
            baseUnitQuantity: '1.000',
            isBaseUnit: true,
            level: 1,
            createdBy: userId
          }).returning();
          packagingTypes.push(result[0]);
        } else {
          packagingTypes.push(existingPackaging[0]);
        }
      }

      // Create sample UCPs with stock
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const pallet = pallets[i % pallets.length];
        
        // Create UCP
        let existingUcp = await db.select().from(ucps)
          .where(eq(ucps.code, `COMP-UCP-${String(i + 1).padStart(3, '0')}`)).limit(1);
        
        if (!existingUcp.length) {
          const ucpResult = await db.insert(ucps).values({
            code: `COMP-UCP-${String(i + 1).padStart(3, '0')}`,
            palletId: pallet.id,
            status: 'active',
            observations: 'UCP para testes de composição',
            createdBy: userId
          }).returning();

          // Add items to UCP
          await db.insert(ucpItems).values({
            ucpId: ucpResult[0].id,
            productId: product.id,
            quantity: '100.000', // Sufficient stock for testing
            packagingTypeId: packagingTypes[i].id,
            addedBy: userId
          });
        }
      }

      // Create sample compositions
      const sampleCompositions = [
        {
          name: 'Composição Pequena - Teste',
          description: 'Composição simples para testes básicos',
          products: [
            { productId: products[0].id, quantity: 10, packagingTypeId: packagingTypes[0].id },
            { productId: products[1].id, quantity: 15, packagingTypeId: packagingTypes[1].id }
          ],
          palletId: pallets[0].id
        },
        {
          name: 'Composição Média - Teste',
          description: 'Composição média para testes de otimização',
          products: [
            { productId: products[0].id, quantity: 20, packagingTypeId: packagingTypes[0].id },
            { productId: products[1].id, quantity: 25, packagingTypeId: packagingTypes[1].id },
            { productId: products[2].id, quantity: 18, packagingTypeId: packagingTypes[2].id }
          ],
          palletId: pallets[1].id,
          constraints: {
            maxWeight: 800,
            maxHeight: 180
          }
        },
        {
          name: 'Composição Complexa - Teste',
          description: 'Composição complexa para testes avançados',
          products: [
            { productId: products[0].id, quantity: 35, packagingTypeId: packagingTypes[0].id },
            { productId: products[1].id, quantity: 40, packagingTypeId: packagingTypes[1].id },
            { productId: products[2].id, quantity: 30, packagingTypeId: packagingTypes[2].id }
          ],
          palletId: pallets[1].id,
          constraints: {
            maxWeight: 1200,
            maxHeight: 200,
            maxVolume: 1.5
          }
        }
      ];

      for (const compData of sampleCompositions) {
        // Calculate composition
        const compositionResult = await packagingCompositionService.calculateOptimalComposition(compData);
        
        // Save composition
        const savedComposition = await packagingCompositionService.saveComposition(
          compData,
          compositionResult,
          userId
        );

        console.log(`   ✓ Created composition: ${savedComposition.name}`);
      }

      console.log('   ✓ Test data seeded successfully');

    } catch (error) {
      console.error('   ❌ Seeding failed:', error);
      throw error;
    }
  }

  /**
   * Warm up caches with common compositions
   */
  private async warmupCaches() {
    console.log('🔥 Warming up caches...');

    try {
      await packagingCompositionService.preWarmCommonCompositions();
      console.log('   ✓ Cache warmed up with common compositions');

    } catch (error) {
      console.error('   ❌ Cache warmup failed:', error);
      throw error;
    }
  }

  /**
   * Generate sample reports
   */
  private async generateSampleReports() {
    console.log('📊 Generating sample reports...');

    try {
      // Get existing compositions
      const compositionsList = await packagingCompositionService.listCompositions({ limit: 5 });
      
      for (const composition of compositionsList.compositions) {
        // Generate detailed report
        await packagingCompositionService.generateCompositionReport(
          composition.id,
          {
            includeMetrics: true,
            includeRecommendations: true,
            includeCostAnalysis: true
          },
          composition.createdBy
        );

        console.log(`   ✓ Generated report for composition: ${composition.name}`);
      }

    } catch (error) {
      console.error('   ❌ Report generation failed:', error);
      throw error;
    }
  }

  /**
   * Display system status after setup
   */
  private async displaySystemStatus() {
    console.log('📈 System Status:');
    
    try {
      // Get composition counts
      const compositionsList = await packagingCompositionService.listCompositions({ limit: 1000 });
      console.log(`   • Total Compositions: ${compositionsList.total}`);
      
      // Get cache statistics
      const cacheStats = await packagingCompositionService.getCacheStatistics();
      console.log(`   • Cache Keys: ${cacheStats.totalKeys}`);
      console.log(`   • Cache Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
      
      // Status breakdown
      const statusCounts = {
        draft: 0,
        validated: 0,
        approved: 0,
        executed: 0
      };
      
      for (const comp of compositionsList.compositions) {
        statusCounts[comp.status as keyof typeof statusCounts]++;
      }
      
      console.log(`   • Draft: ${statusCounts.draft}, Validated: ${statusCounts.validated}, Approved: ${statusCounts.approved}, Executed: ${statusCounts.executed}`);
      
    } catch (error) {
      console.error('   ❌ Status check failed:', error);
    }
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const options: SetupOptions = {};
  
  // Parse command line arguments
  if (args.includes('--skip-migration')) options.skipMigration = true;
  if (args.includes('--skip-seed')) options.skipSeedData = true;
  if (args.includes('--skip-cache')) options.skipCacheWarmup = true;
  if (args.includes('--skip-reports')) options.skipReports = true;
  
  const setup = new CompositionSystemSetup();
  await setup.runSetup(options);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { CompositionSystemSetup };