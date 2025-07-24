import 'dotenv/config';
import { db } from '../db.js';
import { 
  vehicles, 
  products, 
  users
} from '../db/schema.js';
import { eq } from 'drizzle-orm';

async function seedTransferSystem() {
  console.log('🌱 Iniciando inserção de dados para sistema de transferências...');

  try {
    // 1. Verificar se já existe um usuário admin
    let adminUser = await db.select().from(users).where(eq(users.email, 'admin@wms.com')).limit(1);
    
    if (adminUser.length === 0) {
      console.log('📝 Criando usuário administrador...');
      const [newAdmin] = await db.insert(users).values({
        email: 'admin@wms.com',
        password: '$2b$10$example', // Em produção, usar hash real
        firstName: 'Administrator',
        lastName: 'System',
        role: 'admin'
      }).returning();
      adminUser = [newAdmin];
    }

    const adminId = adminUser[0].id;

    // 2. Inserir veículos da frota
    console.log('🚛 Inserindo veículos da frota...');
    
    const vehicleData = [
      {
        code: 'CAM-001',
        name: 'Caminhão Mercedes Accelo 815',
        type: 'Caminhão Pequeno',
        cubicCapacity: '15.5',
        weightCapacity: '3500',
        status: 'disponivel',
        observations: 'Ideal para entregas urbanas',
        createdBy: adminId
      },
      {
        code: 'CAM-002', 
        name: 'Caminhão Volvo FH540',
        type: 'Caminhão Grande',
        cubicCapacity: '45.0',
        weightCapacity: '12000',
        status: 'disponivel',
        observations: 'Para transferências de longa distância',
        createdBy: adminId
      },
      {
        code: 'VAN-001',
        name: 'Van Iveco Daily 70C16',
        type: 'Van',
        cubicCapacity: '8.2',
        weightCapacity: '2800',
        status: 'disponivel',
        observations: 'Para entregas rápidas',
        createdBy: adminId
      },
      {
        code: 'CAM-003',
        name: 'Caminhão Ford Cargo 816',
        type: 'Caminhão Médio',
        cubicCapacity: '25.0',
        weightCapacity: '6000',
        status: 'disponivel',
        observations: 'Versátil para diferentes cargas',
        createdBy: adminId
      }
    ];

    for (const vehicle of vehicleData) {
      const existing = await db.select().from(vehicles).where(eq(vehicles.code, vehicle.code)).limit(1);
      if (existing.length === 0) {
        await db.insert(vehicles).values(vehicle);
        console.log(`  ✅ Veículo ${vehicle.code} inserido`);
      } else {
        console.log(`  ⏭️  Veículo ${vehicle.code} já existe`);
      }
    }

    // 3. Inserir produtos com dimensões para teste de cubagem
    console.log('📦 Inserindo produtos com dimensões...');
    
    const productData = [
      {
        sku: 'PROD-001',
        name: 'Caixa de Papelão Pequena',
        description: 'Caixa padrão para produtos pequenos',
        category: 'Embalagens',
        brand: 'Papelcorp',
        unit: 'un',
        weight: '0.5',
        dimensions: {
          length: 30,  // cm
          width: 20,   // cm  
          height: 15   // cm
        },
        barcode: '7891234567890',
        isActive: true,
        createdBy: adminId
      },
      {
        sku: 'PROD-002',
        name: 'Caixa de Papelão Média',
        description: 'Caixa padrão para produtos médios',
        category: 'Embalagens',
        brand: 'Papelcorp',
        unit: 'un',
        weight: '1.2',
        dimensions: {
          length: 40,
          width: 30,
          height: 25
        },
        barcode: '7891234567891',
        isActive: true,
        createdBy: adminId
      },
      {
        sku: 'PROD-003',
        name: 'Caixa de Papelão Grande',
        description: 'Caixa padrão para produtos grandes',
        category: 'Embalagens',
        brand: 'Papelcorp',
        unit: 'un',
        weight: '2.5',
        dimensions: {
          length: 60,
          width: 40,
          height: 35
        },
        barcode: '7891234567892',
        isActive: true,
        createdBy: adminId
      },
      {
        sku: 'PROD-004',
        name: 'Palete de Madeira PBR',
        description: 'Palete padrão brasileiro',
        category: 'Paletes',
        brand: 'MadeiraTech',
        unit: 'un',
        weight: '25.0',
        dimensions: {
          length: 120,
          width: 100,
          height: 15
        },
        barcode: '7891234567893',
        isActive: true,
        createdBy: adminId
      },
      {
        sku: 'PROD-005',
        name: 'Saco de Ração 25kg',
        description: 'Ração para cães adultos',
        category: 'Pet Shop',
        brand: 'PetFood',
        unit: 'saco',
        weight: '25.0',
        dimensions: {
          length: 70,
          width: 45,
          height: 12
        },
        barcode: '7891234567894',
        isActive: true,
        createdBy: adminId
      }
    ];

    for (const product of productData) {
      const existing = await db.select().from(products).where(eq(products.sku, product.sku)).limit(1);
      if (existing.length === 0) {
        await db.insert(products).values(product);
        console.log(`  ✅ Produto ${product.sku} inserido`);
      } else {
        console.log(`  ⏭️  Produto ${product.sku} já existe`);
      }
    }

    console.log('🎉 Dados de exemplo inseridos com sucesso!');
    console.log('\n📋 Resumo:');
    console.log(`  • ${vehicleData.length} veículos disponíveis`);
    console.log(`  • ${productData.length} produtos com dimensões`);
    console.log(`  • 1 usuário administrador`);
    console.log('\n🚀 Sistema pronto para testar transferências!');
    
  } catch (error) {
    console.error('❌ Erro ao inserir dados de exemplo:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTransferSystem()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedTransferSystem };