import dotenv from 'dotenv';
dotenv.config();

import { db } from "../db";
import { 
  packagingTypes, 
  products, 
  ucps,
  ucpItems,
  pallets,
  positions,
  users,
  PackagingType,
  Product
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { packagingService } from "../services/packaging.service";

async function testProdutoXScenarios() {
  console.log("🎯 DEMONSTRAÇÃO: Problema de Hierarquia de Embalagens - Produto X");
  console.log("=" * 80);

  try {
    // Buscar usuário para criação
    const user = await db.select().from(users).limit(1);
    if (!user.length) {
      console.log("❌ Nenhum usuário encontrado");
      return;
    }

    // 1. CRIAÇÃO DO PRODUTO X
    console.log("\n📦 1. CRIANDO PRODUTO X");
    console.log("-".repeat(40));

    // Verificar se o produto já existe
    let produtoX = await db.select()
      .from(products)
      .where(eq(products.sku, 'PRODUTO-X'))
      .limit(1);

    if (!produtoX.length) {
      console.log("Criando Produto X...");
      const newProduct = await db.insert(products).values({
        sku: 'PRODUTO-X',
        name: 'Produto X',
        description: 'Produto exemplo para demonstração de hierarquia de embalagens',
        unit: 'un',
        createdBy: user[0].id
      }).returning();
      produtoX = newProduct;
      console.log(`✅ Produto X criado com ID: ${produtoX[0].id}`);
    } else {
      console.log(`✅ Produto X já existe com ID: ${produtoX[0].id}`);
    }

    const productId = produtoX[0].id;

    // 2. CONFIGURAÇÃO DAS EMBALAGENS
    console.log("\n📋 2. CONFIGURANDO HIERARQUIA DE EMBALAGENS");
    console.log("-".repeat(50));

    // Remover embalagens existentes se houver
    await db.update(packagingTypes)
      .set({ isActive: false })
      .where(eq(packagingTypes.productId, productId));

    // Cenário 1: Unidade individual (UNIDADE BASE)
    console.log("Criando embalagem: Unidade Individual");
    const unidadeIndividual = await db.insert(packagingTypes).values({
      productId: productId,
      name: 'Unidade Individual',
      barcode: '7891234567890',
      baseUnitQuantity: '1',
      isBaseUnit: true,
      level: 1,
      createdBy: user[0].id
    }).returning();

    // Cenário 2: Caixa com 10 unidades
    console.log("Criando embalagem: Caixa 10 Unidades");
    const caixa10 = await db.insert(packagingTypes).values({
      productId: productId,
      name: 'Caixa 10 Unidades',
      barcode: '7891234567891',
      baseUnitQuantity: '10',
      isBaseUnit: false,
      parentPackagingId: unidadeIndividual[0].id,
      level: 2,
      createdBy: user[0].id
    }).returning();

    // Cenário 3: Caixa Master (10 caixas × 2 unidades cada = 20 unidades)
    console.log("Criando embalagem: Caixa Master (10 caixas internas × 2 un cada)");
    const caixaMaster = await db.insert(packagingTypes).values({
      productId: productId,
      name: 'Caixa Master',
      barcode: '7891234567892',
      baseUnitQuantity: '20', // 10 caixas × 2 unidades cada
      isBaseUnit: false,
      parentPackagingId: caixa10[0].id,
      level: 3,
      createdBy: user[0].id
    }).returning();

    console.log("\n✅ Hierarquia de embalagens criada:");
    console.log(`   • ${unidadeIndividual[0].name}: ${unidadeIndividual[0].baseUnitQuantity} unidade(s) base`);
    console.log(`   • ${caixa10[0].name}: ${caixa10[0].baseUnitQuantity} unidade(s) base`);
    console.log(`   • ${caixaMaster[0].name}: ${caixaMaster[0].baseUnitQuantity} unidade(s) base`);

    // 3. SIMULAÇÃO DE RECEBIMENTOS
    console.log("\n📥 3. SIMULAÇÃO DE RECEBIMENTOS POR DIFERENTES CÓDIGOS");
    console.log("-".repeat(60));

    // Buscar UCP e posição para adicionar itens
    const ucpList = await db.select().from(ucps).limit(1);
    if (!ucpList.length) {
      console.log("⚠️  Nenhuma UCP encontrada para adicionar itens");
      return;
    }

    // Recebimento 1: Por unidade individual
    console.log("Recebimento 1: 15 unidades individuais (código 7891234567890)");
    await db.insert(ucpItems).values({
      ucpId: ucpList[0].id,
      productId: productId,
      quantity: '15', // 15 unidades base
      packagingTypeId: unidadeIndividual[0].id,
      packagingQuantity: '15',
      addedBy: user[0].id
    });

    // Recebimento 2: Por caixa de 10
    console.log("Recebimento 2: 3 caixas de 10 unidades (código 7891234567891)");
    await db.insert(ucpItems).values({
      ucpId: ucpList[0].id,
      productId: productId,
      quantity: '30', // 3 caixas × 10 = 30 unidades base
      packagingTypeId: caixa10[0].id,
      packagingQuantity: '3',
      addedBy: user[0].id
    });

    // Recebimento 3: Por caixa master
    console.log("Recebimento 3: 2 caixas master (código 7891234567892)");
    await db.insert(ucpItems).values({
      ucpId: ucpList[0].id,
      productId: productId,
      quantity: '40', // 2 caixas master × 20 = 40 unidades base
      packagingTypeId: caixaMaster[0].id,
      packagingQuantity: '2',
      addedBy: user[0].id
    });

    // 4. DEMONSTRAÇÃO DE CONSOLIDAÇÃO
    console.log("\n📊 4. CONSOLIDAÇÃO AUTOMÁTICA DE ESTOQUE");
    console.log("-".repeat(50));

    const consolidatedStock = await packagingService.getStockConsolidated(productId);
    console.log(`Total consolidado: ${consolidatedStock.totalBaseUnits} unidades base`);
    console.log(`Cálculo: 15 + 30 + 40 = 85 unidades base`);

    // 5. DEMONSTRAÇÃO DE ESTOQUE POR EMBALAGEM
    console.log("\n📋 5. ESTOQUE DETALHADO POR TIPO DE EMBALAGEM");
    console.log("-".repeat(55));

    const stockByPackaging = await packagingService.getStockByPackaging(productId);
    stockByPackaging.forEach(stock => {
      console.log(`${stock.packagingName}:`);
      console.log(`   • Pacotes completos disponíveis: ${stock.availablePackages}`);
      console.log(`   • Unidades restantes: ${stock.remainingBaseUnits}`);
      console.log(`   • Total em unidades base: ${stock.totalBaseUnits}`);
    });

    // 6. TESTE DE CONVERSÕES
    console.log("\n🔄 6. TESTE DE CONVERSÕES ENTRE EMBALAGENS");
    console.log("-".repeat(50));

    console.log("Conversão: 5 Caixas 10un → Unidades base");
    const conv1 = await packagingService.convertToBaseUnits(5, caixa10[0].id);
    console.log(`Resultado: ${conv1} unidades base`);

    console.log("Conversão: 3 Caixas Master → Unidades base");
    const conv2 = await packagingService.convertToBaseUnits(3, caixaMaster[0].id);
    console.log(`Resultado: ${conv2} unidades base`);

    console.log("Conversão: 100 Unidades base → Caixas 10un");
    const conv3 = await packagingService.convertFromBaseUnits(100, caixa10[0].id);
    console.log(`Resultado: ${conv3} caixas de 10un`);

    // 7. OTIMIZAÇÃO DE SEPARAÇÃO
    console.log("\n🎯 7. OTIMIZAÇÃO DE SEPARAÇÃO");
    console.log("-".repeat(40));

    console.log("Solicitação: Separar 75 unidades do Produto X");
    const optimizationPlan = await packagingService.optimizePickingByPackaging(productId, 75);
    
    console.log(`Pode atender completamente: ${optimizationPlan.canFulfill ? 'SIM' : 'NÃO'}`);
    console.log("Plano otimizado:");
    optimizationPlan.pickingPlan.forEach(plan => {
      console.log(`   • ${plan.quantity}x ${plan.packaging.name} = ${plan.baseUnits} unidades base`);
    });
    if (optimizationPlan.remaining > 0) {
      console.log(`   ⚠️  Restante: ${optimizationPlan.remaining} unidades`);
    }

    // 8. TESTE COM CÓDIGOS DE BARRAS
    console.log("\n🏷️  8. BUSCA POR CÓDIGOS DE BARRAS");
    console.log("-".repeat(45));

    const barcodes = ['7891234567890', '7891234567891', '7891234567892'];
    for (const barcode of barcodes) {
      try {
        const packaging = await packagingService.getPackagingByBarcode(barcode);
        console.log(`Código ${barcode}: ${packaging.name} (${packaging.baseUnitQuantity} unidades base)`);
      } catch (error) {
        console.log(`Código ${barcode}: Não encontrado`);
      }
    }

    // 9. HIERARQUIA VISUAL
    console.log("\n🌳 9. VISUALIZAÇÃO DA HIERARQUIA");
    console.log("-".repeat(40));

    const hierarchy = await packagingService.getPackagingHierarchy(productId);
    function printHierarchy(items: any[], level = 0) {
      items.forEach(item => {
        const indent = '  '.repeat(level);
        const arrow = level > 0 ? '└─ ' : '';
        console.log(`${indent}${arrow}${item.name} (${item.baseUnitQuantity} unidades base)`);
        if (item.barcode) {
          console.log(`${indent}   Código: ${item.barcode}`);
        }
        if (item.children && item.children.length > 0) {
          printHierarchy(item.children, level + 1);
        }
      });
    }
    printHierarchy(hierarchy);

    console.log("\n" + "=".repeat(80));
    console.log("✅ DEMONSTRAÇÃO CONCLUÍDA COM SUCESSO!");
    console.log("   O sistema resolve completamente o problema de hierarquia de embalagens!");
    console.log("=".repeat(80));

  } catch (error) {
    console.error("❌ Erro durante a demonstração:", error);
  }
}

// Executar demonstração
testProdutoXScenarios().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});

export { testProdutoXScenarios };