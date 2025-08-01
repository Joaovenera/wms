import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { users, products, positions, pallets, ucps, transfers, vehicles } from '../../db/schema'
import { config } from '../../config'
import { eq, like } from 'drizzle-orm'

const testDb = drizzle(postgres(config.database.url))

async function cleanTestData() {
  console.log('🧹 Starting test data cleanup...')
  
  try {
    // Clean in reverse dependency order
    await cleanTransfers()
    await cleanUCPs()
    await cleanPallets()
    await cleanVehicles()
    await cleanPositions()
    await cleanProducts()
    await cleanUsers()
    
    console.log('✅ Test data cleanup completed successfully')
  } catch (error) {
    console.error('❌ Test data cleanup failed:', error)
    throw error
  }
}

async function cleanTransfers() {
  console.log('🔄 Cleaning test transfers...')
  
  await testDb.delete(transfers).where(like(transfers.code, 'TR-TEST-%'))
  await testDb.delete(transfers).where(like(transfers.code, 'TR-MOBILE-%'))
  await testDb.delete(transfers).where(like(transfers.code, 'TR-E2E-%'))
  
  console.log('✅ Test transfers cleaned')
}

async function cleanUCPs() {
  console.log('📋 Cleaning test UCPs...')
  
  await testDb.delete(ucps).where(like(ucps.code, 'UCP-TEST-%'))
  await testDb.delete(ucps).where(like(ucps.code, 'UCP-MOBILE-%'))
  await testDb.delete(ucps).where(like(ucps.code, 'UCP-E2E-%'))
  
  console.log('✅ Test UCPs cleaned')
}

async function cleanPallets() {
  console.log('📦 Cleaning test pallets...')
  
  await testDb.delete(pallets).where(like(pallets.code, 'PAL-TEST-%'))
  await testDb.delete(pallets).where(like(pallets.code, 'PAL-MOBILE-%'))
  await testDb.delete(pallets).where(like(pallets.code, 'PAL-E2E-%'))
  await testDb.delete(pallets).where(like(pallets.code, 'MOB-%'))
  await testDb.delete(pallets).where(like(pallets.code, 'OFFLINE-%'))
  
  console.log('✅ Test pallets cleaned')
}

async function cleanVehicles() {
  console.log('🚛 Cleaning test vehicles...')
  
  await testDb.delete(vehicles).where(like(vehicles.code, 'TRUCK-%'))
  await testDb.delete(vehicles).where(like(vehicles.code, 'VAN-%'))
  await testDb.delete(vehicles).where(like(vehicles.code, 'FORKLIFT-%'))
  
  console.log('✅ Test vehicles cleaned')
}

async function cleanPositions() {
  console.log('📍 Cleaning test positions...')
  
  // Clean positions that match test patterns (A-01-01 through D-03-10)
  await testDb.delete(positions).where(like(positions.code, 'A-%'))
  await testDb.delete(positions).where(like(positions.code, 'B-%'))
  await testDb.delete(positions).where(like(positions.code, 'C-%'))
  await testDb.delete(positions).where(like(positions.code, 'D-%'))
  
  console.log('✅ Test positions cleaned')
}

async function cleanProducts() {
  console.log('📦 Cleaning test products...')
  
  await testDb.delete(products).where(like(products.sku, 'TEST-PROD-%'))
  await testDb.delete(products).where(like(products.sku, 'MOBILE-PROD-%'))
  await testDb.delete(products).where(like(products.sku, 'E2E-%'))
  await testDb.delete(products).where(like(products.sku, 'PKG-E2E-%'))
  await testDb.delete(products).where(like(products.sku, 'MOBILE-%'))
  
  console.log('✅ Test products cleaned')
}

async function cleanUsers() {
  console.log('👥 Cleaning test users...')
  
  await testDb.delete(users).where(like(users.email, '%@warehouse.com'))
  await testDb.delete(users).where(eq(users.email, 'test@warehouse.com'))
  await testDb.delete(users).where(eq(users.email, 'mobile@warehouse.com'))
  await testDb.delete(users).where(eq(users.email, 'admin@warehouse.com'))
  await testDb.delete(users).where(eq(users.email, 'user@warehouse.com'))
  await testDb.delete(users).where(eq(users.email, 'operator@warehouse.com'))
  
  console.log('✅ Test users cleaned')
}

// Run the cleanup if this file is executed directly
if (require.main === module) {
  cleanTestData()
    .then(() => {
      console.log('🎉 Test data cleanup completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Test data cleanup failed:', error)
      process.exit(1)
    })
}

export default cleanTestData