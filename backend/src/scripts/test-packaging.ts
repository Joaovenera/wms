import dotenv from 'dotenv';
dotenv.config();

import { db } from "../db";
import { 
  packagingTypes, 
  products, 
  users,
  PackagingType 
} from "../db/schema";
import { eq, and } from "drizzle-orm";

async function testPackaging() {
  console.log("🚀 Testando sistema de embalagens...");

  try {
    // 1. Verificar se as tabelas existem
    console.log("📊 Verificando estrutura das tabelas...");
    
    // Buscar um produto existente
    const existingProduct = await db.select().from(products).limit(1);
    if (!existingProduct.length) {
      console.log("❌ Nenhum produto encontrado no banco");
      return;
    }

    const product = existingProduct[0];
    console.log(`✅ Produto encontrado: ${product.name} (ID: ${product.id})`);

    // 2. Verificar se existe embalagem base
    const existingPackaging = await db.select()
      .from(packagingTypes)
      .where(and(
        eq(packagingTypes.productId, product.id),
        eq(packagingTypes.isBaseUnit, true)
      ))
      .limit(1);

    let basePackaging: PackagingType;

    if (!existingPackaging.length) {
      console.log("📦 Criando embalagem base...");
      
      // Criar embalagem base
      const newBasePackaging = await db.insert(packagingTypes).values({
        productId: product.id,
        name: product.unit || 'Unidade',
        baseUnitQuantity: '1',
        isBaseUnit: true,
        level: 1,
        createdBy: product.createdBy
      }).returning();

      basePackaging = newBasePackaging[0];
      console.log(`✅ Embalagem base criada: ${basePackaging.name}`);
    } else {
      basePackaging = existingPackaging[0];
      console.log(`✅ Embalagem base já existe: ${basePackaging.name}`);
    }

    // 3. Criar embalagens de exemplo se não existirem
    const caixaExists = await db.select()
      .from(packagingTypes)
      .where(and(
        eq(packagingTypes.productId, product.id),
        eq(packagingTypes.name, 'Caixa 10un')
      ))
      .limit(1);

    if (!caixaExists.length) {
      console.log("📦 Criando embalagem Caixa 10un...");
      
      await db.insert(packagingTypes).values({
        productId: product.id,
        name: 'Caixa 10un',
        barcode: `${product.sku}-CX10`,
        baseUnitQuantity: '10',
        isBaseUnit: false,
        parentPackagingId: basePackaging.id,
        level: 2,
        createdBy: product.createdBy
      });

      console.log("✅ Caixa 10un criada");
    }

    const masterExists = await db.select()
      .from(packagingTypes)
      .where(and(
        eq(packagingTypes.productId, product.id),
        eq(packagingTypes.name, 'Caixa Master')
      ))
      .limit(1);

    if (!masterExists.length) {
      console.log("📦 Criando embalagem Caixa Master...");
      
      await db.insert(packagingTypes).values({
        productId: product.id,
        name: 'Caixa Master',
        barcode: `${product.sku}-MASTER`,
        baseUnitQuantity: '100',
        isBaseUnit: false,
        parentPackagingId: basePackaging.id,
        level: 3,
        createdBy: product.createdBy
      });

      console.log("✅ Caixa Master criada");
    }

    // 4. Listar todas as embalagens do produto
    const allPackagings = await db.select()
      .from(packagingTypes)
      .where(and(
        eq(packagingTypes.productId, product.id),
        eq(packagingTypes.isActive, true)
      ))
      .orderBy(packagingTypes.level);

    console.log("\n📋 Embalagens cadastradas:");
    allPackagings.forEach(pkg => {
      console.log(`  • ${pkg.name} - ${pkg.baseUnitQuantity} unidades base - Nível ${pkg.level}`);
      if (pkg.barcode) {
        console.log(`    Código: ${pkg.barcode}`);
      }
    });

    console.log("\n✅ Teste concluído com sucesso!");

  } catch (error) {
    console.error("❌ Erro durante o teste:", error);
  }
}

// Executar teste diretamente
testPackaging().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});

export { testPackaging };