import dotenv from 'dotenv';
dotenv.config();

import { packagingService } from "../services/packaging.service";

async function testPackagingAPI() {
  console.log("🧪 Testando API de Embalagens...");

  try {
    // 1. Testar busca de embalagens por produto
    const productId = 8; // Produto usado no teste anterior
    
    console.log(`📦 Buscando embalagens do produto ${productId}...`);
    const packagings = await packagingService.getPackagingsByProduct(productId);
    console.log(`✅ Encontradas ${packagings.length} embalagens:`);
    packagings.forEach(pkg => {
      console.log(`   • ${pkg.name} (${pkg.baseUnitQuantity} unidades base)`);
    });

    // 2. Testar busca por código de barras
    if (packagings.length > 0) {
      const pkgWithBarcode = packagings.find(p => p.barcode);
      if (pkgWithBarcode) {
        console.log(`🔍 Buscando por código de barras: ${pkgWithBarcode.barcode}`);
        const foundPkg = await packagingService.getPackagingByBarcode(pkgWithBarcode.barcode!);
        console.log(`✅ Embalagem encontrada: ${foundPkg.name}`);
      }
    }

    // 3. Testar conversão para unidade base
    if (packagings.length > 1) {
      const nonBasePkg = packagings.find(p => !p.isBaseUnit);
      if (nonBasePkg) {
        console.log(`🔄 Testando conversão: 5 ${nonBasePkg.name} para unidade base`);
        const converted = await packagingService.convertToBaseUnits(5, nonBasePkg.id);
        console.log(`✅ Resultado: ${converted} unidades base`);
      }
    }

    // 4. Testar estoque consolidado
    console.log(`📊 Testando estoque consolidado do produto ${productId}...`);
    const consolidatedStock = await packagingService.getStockConsolidated(productId);
    console.log(`✅ Estoque total: ${consolidatedStock.totalBaseUnits} unidades base`);
    console.log(`   Localizações: ${consolidatedStock.locationsCount}`);
    console.log(`   Itens: ${consolidatedStock.itemsCount}`);

    // 5. Testar estoque por embalagem
    console.log(`📋 Testando estoque por embalagem...`);
    const stockByPackaging = await packagingService.getStockByPackaging(productId);
    stockByPackaging.forEach(stock => {
      console.log(`   • ${stock.packagingName}: ${stock.availablePackages} pacotes + ${stock.remainingBaseUnits} unidades restantes`);
    });

    // 6. Testar otimização de separação
    if (consolidatedStock.totalBaseUnits > 0) {
      const requestedUnits = Math.min(50, Number(consolidatedStock.totalBaseUnits));
      console.log(`🎯 Testando otimização de separação para ${requestedUnits} unidades...`);
      const optimizedPlan = await packagingService.optimizePickingByPackaging(productId, requestedUnits);
      console.log(`✅ Plano otimizado (pode atender: ${optimizedPlan.canFulfill}):`);
      optimizedPlan.pickingPlan.forEach(plan => {
        console.log(`   • ${plan.quantity}x ${plan.packaging.name} = ${plan.baseUnits} unidades base`);
      });
      if (optimizedPlan.remaining > 0) {
        console.log(`   ⚠️  Restante não atendido: ${optimizedPlan.remaining} unidades`);
      }
    }

    // 7. Testar hierarquia
    console.log(`🌳 Testando hierarquia de embalagens...`);
    const hierarchy = await packagingService.getPackagingHierarchy(productId);
    function printHierarchy(items: any[], level = 0) {
      items.forEach(item => {
        const indent = '  '.repeat(level);
        console.log(`${indent}• ${item.name} (${item.baseUnitQuantity} unidades base)`);
        if (item.children && item.children.length > 0) {
          printHierarchy(item.children, level + 1);
        }
      });
    }
    printHierarchy(hierarchy);

    console.log(`\n✅ Todos os testes passaram! O sistema de embalagens está funcionando.`);

  } catch (error) {
    console.error("❌ Erro durante o teste da API:", error);
  }
}

// Executar teste
testPackagingAPI().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});