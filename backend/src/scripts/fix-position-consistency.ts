#!/usr/bin/env tsx

/**
 * CRITICAL FIX SCRIPT: Position Consistency Repair
 * 
 * This script fixes the critical bug where positions are not marked as "ocupada" 
 * when they have active UCPs, which can lead to multiple UCPs occupying the same space.
 * 
 * What this script does:
 * 1. Identifies positions that should be "ocupada" but are marked as "disponivel"
 * 2. Identifies positions that are marked as "ocupada" but have no active UCPs
 * 3. Fixes these inconsistencies
 * 4. Provides detailed reporting of all changes made
 * 
 * SAFETY: This script only fixes obvious inconsistencies and logs all changes.
 */

import { db } from '../db';
import { positions, ucps } from '../db/schema.js';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';

interface InconsistencyReport {
  positionsToOccupy: Array<{
    positionId: number;
    positionCode: string;
    currentStatus: string;
    activeUcps: Array<{ id: number; code: string }>;
  }>;
  positionsToFree: Array<{
    positionId: number;
    positionCode: string;
    currentStatus: string;
  }>;
}

async function analyzePositionConsistency(): Promise<InconsistencyReport> {
  console.log('🔍 Analyzing position consistency...');

  // Get all positions with their current status
  const allPositions = await db.select().from(positions);
  
  const positionsToOccupy: InconsistencyReport['positionsToOccupy'] = [];
  const positionsToFree: InconsistencyReport['positionsToFree'] = [];

  for (const position of allPositions) {
    // Find active UCPs in this position
    const activeUcpsInPosition = await db
      .select({
        id: ucps.id,
        code: ucps.code,
        status: ucps.status
      })
      .from(ucps)
      .where(and(
        eq(ucps.positionId, position.id),
        eq(ucps.status, 'active')
      ));

    // Case 1: Position has active UCPs but is not marked as "ocupada"
    if (activeUcpsInPosition.length > 0 && position.status !== 'ocupada') {
      positionsToOccupy.push({
        positionId: position.id,
        positionCode: position.code,
        currentStatus: position.status,
        activeUcps: activeUcpsInPosition
      });
    }

    // Case 2: Position is marked as "ocupada" but has no active UCPs
    if (activeUcpsInPosition.length === 0 && position.status === 'ocupada') {
      positionsToFree.push({
        positionId: position.id,
        positionCode: position.code,
        currentStatus: position.status
      });
    }
  }

  return { positionsToOccupy, positionsToFree };
}

async function fixPositionConsistency(report: InconsistencyReport, dryRun: boolean = true): Promise<void> {
  console.log(`\n${dryRun ? '🧪 DRY RUN MODE' : '🔧 FIXING MODE'} - Position Consistency Fix`);

  let fixedCount = 0;

  // Fix positions that should be occupied
  for (const item of report.positionsToOccupy) {
    console.log(`\n🔴 CRITICAL: Position ${item.positionCode} (${item.currentStatus}) has ${item.activeUcps.length} active UCPs:`);
    item.activeUcps.forEach(ucp => {
      console.log(`   - UCP ${ucp.code} (ID: ${ucp.id})`);
    });

    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(positions)
          .set({ 
            status: 'ocupada', 
            updatedAt: new Date() 
          })
          .where(eq(positions.id, item.positionId));

        console.log(`   ✅ Fixed: Position ${item.positionCode} marked as "ocupada"`);
        fixedCount++;
      });
    } else {
      console.log(`   🧪 Would fix: Mark position ${item.positionCode} as "ocupada"`);
    }
  }

  // Fix positions that should be available
  for (const item of report.positionsToFree) {
    console.log(`\n🟡 Position ${item.positionCode} is marked as "ocupada" but has no active UCPs`);

    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(positions)
          .set({ 
            status: 'disponivel', 
            updatedAt: new Date() 
          })
          .where(eq(positions.id, item.positionId));

        console.log(`   ✅ Fixed: Position ${item.positionCode} marked as "disponivel"`);
        fixedCount++;
      });
    } else {
      console.log(`   🧪 Would fix: Mark position ${item.positionCode} as "disponivel"`);
    }
  }

  if (!dryRun && fixedCount > 0) {
    console.log(`\n✅ Fixed ${fixedCount} position inconsistencies`);
  }
}

async function detectDuplicateUcpsInSamePosition(): Promise<void> {
  console.log('\n🔍 Checking for multiple active UCPs in same position...');

  // Drizzle doesn't support db.raw here; simplify check by scanning and aggregating in memory
  const activeWithPositions = await db
    .select({ positionId: ucps.positionId })
    .from(ucps)
    .where(and(eq(ucps.status, 'active'), isNotNull(ucps.positionId)));

  const counts = new Map<number, number>();
  for (const row of activeWithPositions) {
    const pid = row.positionId as number;
    counts.set(pid, (counts.get(pid) || 0) + 1);
  }
  const duplicatePositions = Array.from(counts.entries())
    .filter(([, c]) => c > 1)
    .map(([positionId, count]) => ({ positionId, count }));

  if (duplicatePositions.length > 0) {
    console.log('\n🚨 CRITICAL ERROR: Multiple active UCPs found in same positions:');
    
    for (const dup of duplicatePositions) {
      const position = await db.select().from(positions).where(eq(positions.id, dup.positionId)).limit(1);
      const ucpsInPosition = await db
        .select()
        .from(ucps)
        .where(and(
          eq(ucps.positionId, dup.positionId),
          eq(ucps.status, 'active')
        ));

      console.log(`\n❌ Position ${position[0]?.code} (ID: ${dup.positionId}) has ${dup.count} active UCPs:`);
      ucpsInPosition.forEach(ucp => {
        console.log(`   - UCP ${ucp.code} (ID: ${ucp.id}) - Created: ${ucp.createdAt}`);
      });
    }

    console.log('\n⚠️  MANUAL INTERVENTION REQUIRED: These duplicates need manual resolution!');
  } else {
    console.log('✅ No duplicate UCPs found in same positions');
  }
}

async function main() {
  console.log('🚀 Position Consistency Repair Script');
  console.log('=====================================');

  try {
    // First, check for critical duplicate UCPs
    await detectDuplicateUcpsInSamePosition();

    // Analyze current inconsistencies
    const report = await analyzePositionConsistency();

    console.log('\n📊 ANALYSIS RESULTS:');
    console.log(`   - Positions to mark as "ocupada": ${report.positionsToOccupy.length}`);
    console.log(`   - Positions to mark as "disponivel": ${report.positionsToFree.length}`);

    if (report.positionsToOccupy.length === 0 && report.positionsToFree.length === 0) {
      console.log('\n✅ All positions are consistent! No fixes needed.');
      return;
    }

    // Run in dry-run mode first
    await fixPositionConsistency(report, true);

    console.log('\n❓ Do you want to apply these fixes? (Run with --apply to actually fix)');
    
    // Check command line arguments
    const args = process.argv.slice(2);
    if (args.includes('--apply')) {
      console.log('\n🔧 Applying fixes...');
      await fixPositionConsistency(report, false);
      console.log('\n✅ All fixes applied successfully!');
    } else {
      console.log('\n💡 To apply fixes, run: npm run script:fix-positions -- --apply');
    }

  } catch (error) {
    console.error('\n❌ Error during position consistency check:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(() => process.exit(0));
}