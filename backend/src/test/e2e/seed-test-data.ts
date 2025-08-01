import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { users, products, positions, pallets, ucps, transfers, vehicles } from '../../db/schema'
import { config } from '../../config'

const testDb = drizzle(postgres(config.database.url))

async function seedTestData() {
  console.log('🌱 Starting test data seeding...')
  
  try {
    // Seed test users
    await seedUsers()
    
    // Seed test products
    await seedProducts()
    
    // Seed warehouse positions
    await seedPositions()
    
    // Seed vehicles
    await seedVehicles()
    
    // Seed pallets
    await seedPallets()
    
    // Seed UCPs
    await seedUCPs()
    
    // Seed transfers
    await seedTransfers()
    
    console.log('✅ Test data seeding completed successfully')
  } catch (error) {
    console.error('❌ Test data seeding failed:', error)
    throw error
  }
}

async function seedUsers() {
  console.log('👥 Seeding test users...')
  
  const testUsers = [
    {
      id: 1,
      name: 'Admin User',
      email: 'admin@warehouse.com',
      password: '$2b$10$YourHashedPasswordHere', // admin123
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 2,
      name: 'Regular User',
      email: 'user@warehouse.com',
      password: '$2b$10$YourHashedPasswordHere', // user123
      role: 'user',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 3,
      name: 'Mobile User',
      email: 'mobile@warehouse.com',
      password: '$2b$10$YourHashedPasswordHere', // mobile123
      role: 'mobile',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 4,
      name: 'Test Operator',
      email: 'operator@warehouse.com',
      password: '$2b$10$YourHashedPasswordHere', // operator123
      role: 'operator',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]
  
  await testDb.insert(users).values(testUsers).onConflictDoNothing()
  console.log('✅ Test users seeded')
}

async function seedProducts() {
  console.log('📦 Seeding test products...')
  
  const testProducts = [
    {
      id: 1,
      sku: 'TEST-PROD-001',
      name: 'Test Product 1',
      description: 'First test product for E2E testing',
      weight: 2.5,
      dimensions: JSON.stringify({ length: 10, width: 8, height: 5 }),
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 2,
      sku: 'TEST-PROD-002',
      name: 'Test Product 2',
      description: 'Second test product for E2E testing',
      weight: 1.8,
      dimensions: JSON.stringify({ length: 15, width: 10, height: 3 }),
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 3,
      sku: 'TEST-PROD-003',
      name: 'Heavy Test Product',
      description: 'Heavy product for weight testing',
      weight: 25.0,
      dimensions: JSON.stringify({ length: 30, width: 20, height: 15 }),
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 4,
      sku: 'MOBILE-PROD-001',
      name: 'Mobile Test Product',
      description: 'Product specifically for mobile testing',
      weight: 0.5,
      dimensions: JSON.stringify({ length: 5, width: 5, height: 2 }),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]
  
  await testDb.insert(products).values(testProducts).onConflictDoNothing()
  console.log('✅ Test products seeded')
}

async function seedPositions() {
  console.log('📍 Seeding warehouse positions...')
  
  const testPositions = []
  
  // Generate positions for sections A-D, levels 01-03, positions 01-10
  for (const section of ['A', 'B', 'C', 'D']) {
    for (let level = 1; level <= 3; level++) {
      for (let position = 1; position <= 10; position++) {
        testPositions.push({
          id: testPositions.length + 1,
          code: `${section}-${level.toString().padStart(2, '0')}-${position.toString().padStart(2, '0')}`,
          section,
          level,
          position,
          maxWeight: 1000,
          maxHeight: 200,
          currentWeight: Math.random() * 500,
          isOccupied: Math.random() > 0.7,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }
    }
  }
  
  await testDb.insert(positions).values(testPositions).onConflictDoNothing()
  console.log('✅ Warehouse positions seeded')
}

async function seedVehicles() {
  console.log('🚛 Seeding test vehicles...')
  
  const testVehicles = [
    {
      id: 1,
      code: 'TRUCK-001',
      name: 'Test Truck 1',
      type: 'truck',
      maxWeight: 5000,
      maxVolume: 50,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 2,
      code: 'VAN-002',
      name: 'Test Van 2',
      type: 'van',
      maxWeight: 2000,
      maxVolume: 20,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 3,
      code: 'FORKLIFT-003',
      name: 'Test Forklift 3',
      type: 'forklift',
      maxWeight: 3000,
      maxVolume: 10,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]
  
  await testDb.insert(vehicles).values(testVehicles).onConflictDoNothing()
  console.log('✅ Test vehicles seeded')
}

async function seedPallets() {
  console.log('📦 Seeding test pallets...')
  
  const testPallets = [
    {
      id: 1,
      code: 'PAL-TEST-001',
      positionId: 1,
      maxWeight: 1000,
      maxHeight: 200,
      currentWeight: 250,
      currentHeight: 50,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 2,
      code: 'PAL-TEST-002',
      positionId: 2,
      maxWeight: 1000,
      maxHeight: 200,
      currentWeight: 180,
      currentHeight: 40,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 3,
      code: 'PAL-MOBILE-001',
      positionId: 3,
      maxWeight: 500,
      maxHeight: 150,
      currentWeight: 75,
      currentHeight: 25,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]
  
  await testDb.insert(pallets).values(testPallets).onConflictDoNothing()
  console.log('✅ Test pallets seeded')
}

async function seedUCPs() {
  console.log('📋 Seeding test UCPs...')
  
  const testUCPs = [
    {
      id: 1,
      code: 'UCP-TEST-001',
      palletId: 1,
      status: 'pending',
      createdBy: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 2,
      code: 'UCP-TEST-002',
      palletId: 2,
      status: 'in_progress',
      createdBy: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]
  
  await testDb.insert(ucps).values(testUCPs).onConflictDoNothing()
  console.log('✅ Test UCPs seeded')
}

async function seedTransfers() {
  console.log('🔄 Seeding test transfers...')
  
  const testTransfers = [
    {
      id: 1,
      code: 'TR-TEST-001',
      fromPositionId: 1,
      toPositionId: 5,
      status: 'pending',
      priority: 'high',
      createdBy: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 2,
      code: 'TR-TEST-002',
      fromPositionId: 2,
      toPositionId: 6,
      status: 'in_progress',
      priority: 'medium',
      createdBy: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 3,
      code: 'TR-MOBILE-001',
      fromPositionId: 3,
      toPositionId: 7,
      status: 'completed',
      priority: 'low',
      createdBy: 3,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]
  
  await testDb.insert(transfers).values(testTransfers).onConflictDoNothing()
  console.log('✅ Test transfers seeded')
}

// Run the seeding if this file is executed directly
if (require.main === module) {
  seedTestData()
    .then(() => {
      console.log('🎉 Test data seeding completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Test data seeding failed:', error)
      process.exit(1)
    })
}

export default seedTestData