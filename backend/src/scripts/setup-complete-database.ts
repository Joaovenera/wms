import { db } from '../db/index.js';
import { 
  users, suppliers, waveTemplates, inspectionTemplates, 
  stockAlertRules, qualityGates, orders, vehicles,
  laborSchedule, equipmentSchedule, packagingCompositions
} from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import bcrypt from 'bcrypt';

interface SetupResult {
  success: boolean;
  itemsCreated: {
    suppliers: number;
    waveTemplates: number;
    inspectionTemplates: number;
    stockAlertRules: number;
    qualityGates: number;
    orders: number;
    laborSchedules: number;
    equipmentSchedules: number;
    packagingCompositions: number;
  };
  errors: string[];
  timeElapsed: number;
}

/**
 * Check if setup is needed by analyzing existing data
 */
async function isSetupNeeded(): Promise<{ needed: boolean; reason: string; existingData: any }> {
  try {
    // Check for existing data in key tables
    const checks = await Promise.all([
      db.select().from(users).where(eq(users.role, 'admin')).limit(1),
      db.select().from(suppliers).limit(1).catch(() => []),
      db.select().from(waveTemplates).limit(1).catch(() => []),
      db.select().from(inspectionTemplates).limit(1).catch(() => []),
      db.select().from(stockAlertRules).limit(1).catch(() => []),
      db.select().from(qualityGates).limit(1).catch(() => [])
    ]);
    
    const [adminUsers, existingSuppliers, existingWaveTemplates, existingInspectionTemplates, existingStockAlertRules, existingQualityGates] = checks;
    
    const hasAdminUser = adminUsers.length > 0;
    const hasSuppliers = existingSuppliers.length > 0;
    const hasWaveTemplates = existingWaveTemplates.length > 0;
    const hasInspectionTemplates = existingInspectionTemplates.length > 0;
    const hasStockAlertRules = existingStockAlertRules.length > 0;
    const hasQualityGates = existingQualityGates.length > 0;
    
    const existingItems = {
      adminUsers: adminUsers.length,
      suppliers: existingSuppliers.length,
      waveTemplates: existingWaveTemplates.length,
      inspectionTemplates: existingInspectionTemplates.length,
      stockAlertRules: existingStockAlertRules.length,
      qualityGates: existingQualityGates.length
    };
    
    if (hasAdminUser && hasSuppliers && hasWaveTemplates && hasInspectionTemplates) {
      return {
        needed: false,
        reason: `Database already has initial data: ${JSON.stringify(existingItems)}`,
        existingData: existingItems
      };
    } else {
      return {
        needed: true,
        reason: `Missing initial data - setting up: ${JSON.stringify(existingItems)}`,
        existingData: existingItems
      };
    }
    
  } catch (error: any) {
    logger.warn('⚠️ Could not check existing data, assuming setup needed:', error.message);
    return {
      needed: true,
      reason: 'Could not verify existing data - assuming setup needed',
      existingData: {}
    };
  }
}

/**
 * Setup essential data for complete WMS functionality
 */
export async function setupCompleteDatabase(): Promise<SetupResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const itemsCreated = {
    suppliers: 0,
    waveTemplates: 0,
    inspectionTemplates: 0,
    stockAlertRules: 0,
    qualityGates: 0,
    orders: 0,
    laborSchedules: 0,
    equipmentSchedules: 0,
    packagingCompositions: 0
  };

  logger.info('🎯 Starting complete database setup...');
  
  // Check if setup is actually needed
  const setupCheck = await isSetupNeeded();
  if (!setupCheck.needed) {
    logger.info(`✅ ${setupCheck.reason}`);
    logger.info('🎉 Database setup skipped - system already has initial data!');
    
    return {
      success: true,
      itemsCreated: setupCheck.existingData,
      errors: [],
      timeElapsed: Date.now() - startTime
    };
  }
  
  logger.info(`🔄 Setup needed: ${setupCheck.reason}`);

  try {
    // Get admin user for references
    const [adminUser] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
    
    if (!adminUser) {
      // Create admin user if doesn't exist
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const [newAdminUser] = await db.insert(users).values({
        email: 'admin@wms.local',
        password: hashedPassword,
        firstName: 'WMS',
        lastName: 'Administrator',
        role: 'admin'
      }).returning();
      logger.info('✅ Created admin user: admin@wms.local');
    }

    const adminUserId = adminUser?.id || 1;

    // 1. Setup Suppliers
    logger.info('📦 Setting up suppliers...');
    try {
      const suppliersData = [
        {
          code: 'SUP-001',
          name: 'Fornecedor Exemplo A',
          businessName: 'Fornecedor A Ltda',
          email: 'contato@fornecedora.com',
          phone: '+55 11 1234-5678',
          supplierType: 'manufacturer',
          address: JSON.stringify({
            street: 'Rua das Industrias, 123',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01234-567',
            country: 'Brasil'
          }),
          contactPerson: 'João Silva',
          qualityRating: '4.5',
          status: 'active',
          createdBy: adminUserId
        },
        {
          code: 'SUP-002', 
          name: 'Fornecedor Exemplo B',
          businessName: 'Fornecedor B S.A.',
          email: 'vendas@fornecedorb.com',
          phone: '+55 11 8765-4321',
          supplierType: 'distributor',
          address: JSON.stringify({
            street: 'Av. Comercial, 456', 
            city: 'Rio de Janeiro',
            state: 'RJ',
            zipCode: '20000-000',
            country: 'Brasil'
          }),
          contactPerson: 'Maria Santos',
          qualityRating: '4.2',
          status: 'active',
          createdBy: adminUserId
        },
        {
          code: 'SUP-003',
          name: 'Fornecedor Internacional C',
          businessName: 'Global Supplier Inc.',
          email: 'exports@globalsupplier.com',
          phone: '+1 555 123-4567',
          supplierType: 'manufacturer',
          address: JSON.stringify({
            street: '123 Industrial Ave',
            city: 'Miami',
            state: 'FL',
            zipCode: '33101',
            country: 'USA'
          }),
          contactPerson: 'John Smith',
          qualityRating: '4.8',
          status: 'active',
          createdBy: adminUserId
        }
      ];

      for (const supplier of suppliersData) {
        await db.insert(suppliers).values(supplier).onConflictDoNothing();
        itemsCreated.suppliers++;
      }
      logger.info(`✅ Created ${itemsCreated.suppliers} suppliers`);
    } catch (error: any) {
      errors.push(`Suppliers setup error: ${error.message}`);
      logger.error('❌ Suppliers setup failed:', error);
    }

    // 2. Setup Wave Templates
    logger.info('🌊 Setting up wave templates...');
    try {
      const waveTemplatesData = [
        {
          name: 'Standard Wave',
          description: 'Template padrão para ondas de picking regulares',
          templateType: 'standard',
          maxOrders: 50,
          maxLines: 200,
          maxWeight: '1000',
          maxVolume: '50',
          sortingStrategy: 'zone_product',
          batchingStrategy: 'order_based',
          routeOptimization: true,
          maxPickers: 5,
          cutoffTime: '14:00',
          isActive: true,
          createdBy: adminUserId
        },
        {
          name: 'Express Wave',
          description: 'Template para pedidos urgentes e expressos',
          templateType: 'express',
          maxOrders: 20,
          maxLines: 80,
          maxWeight: '500',
          maxVolume: '25',
          sortingStrategy: 'shortest_path',
          batchingStrategy: 'zone_based',
          routeOptimization: true,
          maxPickers: 3,
          cutoffTime: '16:00',
          isActive: true,
          createdBy: adminUserId
        },
        {
          name: 'Bulk Wave',
          description: 'Template para pedidos grandes em volume',
          templateType: 'bulk',
          maxOrders: 10,
          maxLines: 500,
          maxWeight: '5000',
          maxVolume: '200',
          sortingStrategy: 'product_zone',
          batchingStrategy: 'product_based',
          routeOptimization: true,
          maxPickers: 8,
          cutoffTime: '10:00',
          isActive: true,
          createdBy: adminUserId
        },
        {
          name: 'Replenishment Wave',
          description: 'Template para reposição de picking locations',
          templateType: 'replenishment',
          maxOrders: 100,
          maxLines: 300,
          maxWeight: '2000',
          maxVolume: '100',
          sortingStrategy: 'zone_product',
          batchingStrategy: 'zone_based',
          routeOptimization: true,
          maxPickers: 4,
          cutoffTime: '08:00',
          isActive: true,
          createdBy: adminUserId
        },
        {
          name: 'Emergency Wave',
          description: 'Template para situações de emergência',
          templateType: 'express',
          maxOrders: 5,
          maxLines: 20,
          maxWeight: '200',
          maxVolume: '10',
          sortingStrategy: 'shortest_path',
          batchingStrategy: 'order_based',
          routeOptimization: true,
          maxPickers: 2,
          cutoffTime: '18:00',
          isActive: true,
          createdBy: adminUserId
        }
      ];

      for (const template of waveTemplatesData) {
        await db.insert(waveTemplates).values(template).onConflictDoNothing();
        itemsCreated.waveTemplates++;
      }
      logger.info(`✅ Created ${itemsCreated.waveTemplates} wave templates`);
    } catch (error: any) {
      errors.push(`Wave templates setup error: ${error.message}`);
      logger.error('❌ Wave templates setup failed:', error);
    }

    // 3. Setup Inspection Templates
    logger.info('🔍 Setting up inspection templates...');
    try {
      const inspectionTemplatesData = [
        {
          name: 'Inspeção de Recebimento de Container',
          description: 'Checklist completo para recebimento de containers',
          category: 'receiving',
          checklistItems: JSON.stringify([
            { item: 'Verificar número do container', required: true, type: 'text' },
            { item: 'Conferir lacre/selo', required: true, type: 'text' },
            { item: 'Verificar condições externas do container', required: true, type: 'options', options: ['Excelente', 'Bom', 'Regular', 'Ruim'] },
            { item: 'Documentação completa', required: true, type: 'boolean' },
            { item: 'Temperature logs (se aplicável)', required: false, type: 'number' }
          ]),
          requiredPhotos: 3,
          isActive: true,
          version: '1.0',
          createdBy: adminUserId
        },
        {
          name: 'Inspeção de Qualidade de Produtos',
          description: 'Avaliação de qualidade de produtos recebidos',
          category: 'receiving',
          checklistItems: JSON.stringify([
            { item: 'Estado da embalagem', required: true, type: 'options', options: ['Perfeito', 'Pequenos danos', 'Danos médios', 'Danos severos'] },
            { item: 'Prazo de validade', required: true, type: 'date' },
            { item: 'Quantidade confere', required: true, type: 'boolean' },
            { item: 'Lote/série identificado', required: true, type: 'text' },
            { item: 'Especificações técnicas', required: true, type: 'boolean' }
          ]),
          requiredPhotos: 2,
          isActive: true,
          version: '1.0',
          createdBy: adminUserId
        },
        {
          name: 'Auditoria de Fornecedor',
          description: 'Avaliação completa de fornecedores',
          category: 'supplier_audit',
          checklistItems: JSON.stringify([
            { item: 'Documentação fiscal em ordem', required: true, type: 'boolean' },
            { item: 'Certificações de qualidade válidas', required: true, type: 'boolean' },
            { item: 'Histórico de entregas pontuais', required: true, type: 'options', options: ['Excelente', 'Bom', 'Regular', 'Ruim'] },
            { item: 'Atendimento ao cliente', required: true, type: 'rating', scale: 5 },
            { item: 'Capacidade de produção adequada', required: true, type: 'boolean' }
          ]),
          requiredPhotos: 1,
          isActive: true,
          version: '1.0',
          createdBy: adminUserId
        }
      ];

      for (const template of inspectionTemplatesData) {
        await db.insert(inspectionTemplates).values(template).onConflictDoNothing();
        itemsCreated.inspectionTemplates++;
      }
      logger.info(`✅ Created ${itemsCreated.inspectionTemplates} inspection templates`);
    } catch (error: any) {
      errors.push(`Inspection templates setup error: ${error.message}`);
      logger.error('❌ Inspection templates setup failed:', error);
    }

    // 4. Setup Stock Alert Rules
    logger.info('📊 Setting up stock alert rules...');
    try {
      const stockAlertRulesData = [
        {
          name: 'Estoque Baixo Geral',
          description: 'Alerta quando estoque fica abaixo do mínimo',
          minStockThreshold: 10,
          criticalStockThreshold: 5,
          alertTypes: JSON.stringify(['low_stock', 'critical_stock']),
          severity: 'medium',
          notificationMethods: JSON.stringify(['email']),
          isActive: true,
          createdBy: adminUserId
        },
        {
          name: 'Sem Movimentação 30 dias',
          description: 'Produtos sem movimentação há 30 dias',
          agingThreshold: 30,
          alertTypes: JSON.stringify(['no_movement']),
          severity: 'low',
          notificationMethods: JSON.stringify(['email']),
          isActive: true,
          createdBy: adminUserId
        },
        {
          name: 'Excesso de Estoque',
          description: 'Produtos com estoque acima do máximo',
          alertTypes: JSON.stringify(['overstock']),
          severity: 'medium',
          notificationMethods: JSON.stringify(['email']),
          isActive: true,
          createdBy: adminUserId
        },
        {
          name: 'Queda de Velocidade',
          description: 'Redução significativa na velocidade de giro',
          velocityThreshold: '0.5',
          alertTypes: JSON.stringify(['velocity_drop']),
          severity: 'high',
          notificationMethods: JSON.stringify(['email', 'push']),
          isActive: true,
          createdBy: adminUserId
        }
      ];

      for (const rule of stockAlertRulesData) {
        await db.insert(stockAlertRules).values(rule).onConflictDoNothing();
        itemsCreated.stockAlertRules++;
      }
      logger.info(`✅ Created ${itemsCreated.stockAlertRules} stock alert rules`);
    } catch (error: any) {
      errors.push(`Stock alert rules setup error: ${error.message}`);
      logger.error('❌ Stock alert rules setup failed:', error);
    }

    // 5. Setup Quality Gates
    logger.info('🚪 Setting up quality gates...');
    try {
      const qualityGatesData = [
        {
          name: 'Gate de Recebimento',
          description: 'Controle de qualidade obrigatório no recebimento',
          processType: 'receiving',
          gateType: 'mandatory',
          triggerConditions: JSON.stringify({
            conditions: ['new_arrival', 'high_value_items']
          }),
          passingCriteria: JSON.stringify({
            minimumScore: 80,
            requiredInspections: ['receiving_inspection'],
            criticalIssues: 0
          }),
          blocksProcess: true,
          allowOverride: false,
          isActive: true,
          createdBy: adminUserId
        },
        {
          name: 'Gate de Expedição',
          description: 'Verificação final antes da expedição',
          processType: 'shipping',
          gateType: 'mandatory',
          triggerConditions: JSON.stringify({
            conditions: ['before_shipping']
          }),
          passingCriteria: JSON.stringify({
            minimumScore: 85,
            requiredInspections: ['shipping_inspection'],
            criticalIssues: 0
          }),
          blocksProcess: true,
          allowOverride: true,
          overrideRequiredRole: 'manager',
          isActive: true,
          createdBy: adminUserId
        }
      ];

      for (const gate of qualityGatesData) {
        await db.insert(qualityGates).values(gate).onConflictDoNothing();
        itemsCreated.qualityGates++;
      }
      logger.info(`✅ Created ${itemsCreated.qualityGates} quality gates`);
    } catch (error: any) {
      errors.push(`Quality gates setup error: ${error.message}`);
      logger.error('❌ Quality gates setup failed:', error);
    }

    // 6. Setup Sample Orders
    logger.info('📋 Setting up sample orders...');
    try {
      const ordersData = [
        {
          orderNumber: 'ORD-2025-001',
          customerName: 'Cliente Exemplo A',
          priority: 'normal',
          orderType: 'standard',
          status: 'pending',
          totalLines: 3,
          totalQuantity: '150',
          shippingAddress: JSON.stringify({
            street: 'Rua do Cliente, 123',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01000-000'
          }),
          createdBy: adminUserId
        },
        {
          orderNumber: 'ORD-2025-002',
          customerName: 'Cliente Express B',
          priority: 'high',
          orderType: 'express',
          status: 'pending',
          totalLines: 1,
          totalQuantity: '50',
          shippingAddress: JSON.stringify({
            street: 'Av. Urgente, 456',
            city: 'Rio de Janeiro', 
            state: 'RJ',
            zipCode: '20000-000'
          }),
          createdBy: adminUserId
        }
      ];

      for (const order of ordersData) {
        await db.insert(orders).values(order).onConflictDoNothing();
        itemsCreated.orders++;
      }
      logger.info(`✅ Created ${itemsCreated.orders} sample orders`);
    } catch (error: any) {
      errors.push(`Sample orders setup error: ${error.message}`);
      logger.error('❌ Sample orders setup failed:', error);
    }

    // Success summary
    const totalItemsCreated = Object.values(itemsCreated).reduce((a, b) => a + b, 0);
    const timeElapsed = Date.now() - startTime;
    
    logger.info(`🎉 Database setup completed in ${timeElapsed}ms`);
    logger.info(`📈 Created ${totalItemsCreated} total items across all categories`);
    
    if (errors.length > 0) {
      logger.warn(`⚠️ Setup completed with ${errors.length} errors`);
      errors.forEach(error => logger.warn(`   - ${error}`));
    }

    return {
      success: errors.length === 0,
      itemsCreated,
      errors,
      timeElapsed
    };

  } catch (error: any) {
    const timeElapsed = Date.now() - startTime;
    logger.error('💥 Database setup failed:', error);
    
    return {
      success: false,
      itemsCreated,
      errors: [error.message],
      timeElapsed
    };
  }
}

/**
 * Main execution when run directly (ES modules)
 */
const __filename = fileURLToPath(import.meta.url);

if (import.meta.url === `file://${process.argv[1]}`) {
  setupCompleteDatabase()
    .then((result) => {
      if (result.success) {
        logger.info('🎊 Database setup completed successfully!');
        process.exit(0);
      } else {
        logger.error('💔 Database setup failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error('💥 Database setup crashed:', error);
      process.exit(1);
    });
}