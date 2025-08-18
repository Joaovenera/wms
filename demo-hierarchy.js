/**
 * Demonstração da Hierarquia de Embalagens
 * Cenário: 1 unidade → 2 unidades → 10 unidades
 */

// Simulação das funcionalidades implementadas
class PackagingHierarchyDemo {
  constructor() {
    this.packagings = [];
    this.validationEnabled = true;
  }

  // Simula a criação da hierarquia de exemplo
  createExampleHierarchy(productId, createdBy) {
    console.log('🎯 Criando Hierarquia de Exemplo para o Produto', productId);
    console.log('─'.repeat(60));

    // Nível 3: Embalagem Master (container principal - maior)
    const level3 = {
      id: 3,
      productId,
      name: 'Embalagem Master (10 Unidades)',
      baseUnitQuantity: '10',
      isBaseUnit: false,
      parentPackagingId: null, // Sem pai - container principal
      level: 3,
      dimensions: { length: 30, width: 25, height: 18, weight: 0.2 },
      createdBy
    };

    // Nível 2: Caixa 2 Unidades (container médio)
    const level2 = {
      id: 2,
      productId,
      name: 'Caixa 2 Unidades',
      baseUnitQuantity: '2',
      isBaseUnit: false,
      parentPackagingId: 3, // Pai é a embalagem master
      level: 2,
      dimensions: { length: 12, width: 10, height: 8, weight: 0.05 },
      createdBy
    };

    // Nível 1: Unidade Individual (produto básico - menor)
    const baseUnit = {
      id: 1,
      productId,
      name: 'Unidade Individual',
      baseUnitQuantity: '1',
      isBaseUnit: true,
      parentPackagingId: 2, // Pai é a caixa de 2 unidades
      level: 1,
      dimensions: { length: 5, width: 4, height: 3, weight: 0.1 },
      createdBy
    };

    this.packagings = [baseUnit, level2, level3];

    console.log('✅ Nível 1 (Base):', baseUnit.name);
    console.log('   • Quantidade:', baseUnit.baseUnitQuantity, 'unidade');
    console.log('   • Dimensões:', `${baseUnit.dimensions.length}×${baseUnit.dimensions.width}×${baseUnit.dimensions.height}cm`);
    console.log('   • Peso:', baseUnit.dimensions.weight, 'kg');
    console.log();

    console.log('✅ Nível 2:', level2.name);
    console.log('   • Quantidade:', level2.baseUnitQuantity, 'unidades base');
    console.log('   • Pai:', baseUnit.name);
    console.log('   • Dimensões:', `${level2.dimensions.length}×${level2.dimensions.width}×${level2.dimensions.height}cm`);
    console.log('   • Peso:', level2.dimensions.weight, 'kg');
    console.log();

    console.log('✅ Nível 3:', level3.name);
    console.log('   • Quantidade:', level3.baseUnitQuantity, 'unidades base');
    console.log('   • Pai:', level2.name);
    console.log('   • Dimensões:', `${level3.dimensions.length}×${level3.dimensions.width}×${level3.dimensions.height}cm`);
    console.log('   • Peso:', level3.dimensions.weight, 'kg');
    console.log();

    return { baseUnit, level2, level3 };
  }

  // Simula validação de hierarquia
  validateHierarchyIntegrity() {
    console.log('🔍 Validando Integridade da Hierarquia');
    console.log('─'.repeat(60));

    const errors = [];
    const warnings = [];

    // Verificar unidade base única
    const baseUnits = this.packagings.filter(p => p.isBaseUnit);
    if (baseUnits.length !== 1) {
      errors.push('Deve haver exatamente uma unidade base');
    }

    // Verificar níveis consistentes
    for (const pkg of this.packagings) {
      if (pkg.parentPackagingId) {
        const parent = this.packagings.find(p => p.id === pkg.parentPackagingId);
        if (!parent) {
          errors.push(`${pkg.name} referencia pai inexistente`);
        } else if (pkg.level >= parent.level) {
          errors.push(`${pkg.name} tem nível inconsistente (filho deve ter nível menor que pai)`);
        } else if (Number(pkg.baseUnitQuantity) >= Number(parent.baseUnitQuantity)) {
          errors.push(`${pkg.name} deve ter quantidade menor que o container pai`);
        }
      }
    }

    // Verificar dimensões
    for (const pkg of this.packagings) {
      if (pkg.parentPackagingId) {
        const parent = this.packagings.find(p => p.id === pkg.parentPackagingId);
        if (parent && parent.dimensions && pkg.dimensions) {
          if (pkg.dimensions.length > parent.dimensions.length ||
              pkg.dimensions.width > parent.dimensions.width ||
              pkg.dimensions.height > parent.dimensions.height) {
            warnings.push(`${pkg.name}: dimensões não cabem no pai`);
          }
        }
      }
    }

    const isValid = errors.length === 0;
    
    if (isValid) {
      console.log('✅ Hierarquia VÁLIDA');
    } else {
      console.log('❌ Hierarquia INVÁLIDA');
    }

    if (errors.length > 0) {
      console.log('\n🚨 Erros encontrados:');
      errors.forEach(error => console.log('  •', error));
    }

    if (warnings.length > 0) {
      console.log('\n⚠️ Avisos:');
      warnings.forEach(warning => console.log('  •', warning));
    }

    console.log();
    return { isValid, errors, warnings };
  }

  // Simula conversões entre embalagens
  convertBetweenPackagings(fromId, toId, quantity) {
    const fromPkg = this.packagings.find(p => p.id === fromId);
    const toPkg = this.packagings.find(p => p.id === toId);

    if (!fromPkg || !toPkg) {
      throw new Error('Embalagem não encontrada');
    }

    const fromBaseQty = Number(fromPkg.baseUnitQuantity);
    const toBaseQty = Number(toPkg.baseUnitQuantity);

    const baseUnits = quantity * fromBaseQty;
    const convertedQuantity = baseUnits / toBaseQty;
    const isExact = convertedQuantity === Math.floor(convertedQuantity);

    return {
      convertedQuantity: isExact ? convertedQuantity : Math.floor(convertedQuantity),
      baseUnits,
      isExact,
      fromPkg: fromPkg.name,
      toPkg: toPkg.name
    };
  }

  // Demonstra conversões
  demonstrateConversions() {
    console.log('🔄 Demonstração de Conversões');
    console.log('─'.repeat(60));

    // 1 caixa nível 2 → unidades base
    const conv1 = this.convertBetweenPackagings(2, 1, 1);
    console.log(`1 ${conv1.fromPkg} = ${conv1.convertedQuantity} ${conv1.toPkg}(s)`);

    // 1 embalagem nível 3 → unidades base
    const conv2 = this.convertBetweenPackagings(3, 1, 1);
    console.log(`1 ${conv2.fromPkg} = ${conv2.convertedQuantity} ${conv2.toPkg}(s)`);

    // 1 embalagem nível 3 → caixas nível 2
    const conv3 = this.convertBetweenPackagings(3, 2, 1);
    console.log(`1 ${conv3.fromPkg} = ${conv3.convertedQuantity} ${conv3.toPkg}(s)`);

    // Cenário real: 25 unidades solicitadas
    console.log('\n📦 Cenário: Cliente solicita 25 unidades');
    console.log('Estratégia otimizada:');
    
    let remaining = 25;
    const plan = [];

    // Usar embalagens nível 3 primeiro (10 unidades cada)
    const pkg3Count = Math.floor(remaining / 10);
    if (pkg3Count > 0) {
      plan.push(`${pkg3Count}x Embalagem Nível 3 = ${pkg3Count * 10} unidades`);
      remaining -= pkg3Count * 10;
    }

    // Usar caixas nível 2 (2 unidades cada)
    const pkg2Count = Math.floor(remaining / 2);
    if (pkg2Count > 0) {
      plan.push(`${pkg2Count}x Caixa Nível 2 = ${pkg2Count * 2} unidades`);
      remaining -= pkg2Count * 2;
    }

    // Usar unidades individuais
    if (remaining > 0) {
      plan.push(`${remaining}x Unidade Individual = ${remaining} unidades`);
    }

    plan.forEach(item => console.log('  •', item));
    console.log(`  Total: ${25 - remaining} unidades de 25 solicitadas`);
    console.log();
  }

  // Demonstra estrutura hierárquica
  displayHierarchy() {
    console.log('🌳 Estrutura Hierárquica');
    console.log('─'.repeat(60));

    const buildTree = (parentId = null, depth = 0) => {
      const children = this.packagings.filter(p => p.parentPackagingId === parentId);
      
      // Ordenar por nível para mostrar a hierarquia corretamente
      children.sort((a, b) => b.level - a.level);
      
      children.forEach((child, index) => {
        const isLast = index === children.length - 1;
        const prefix = '  '.repeat(depth) + (isLast ? '└─ ' : '├─ ');
        
        console.log(`${prefix}📦 ${child.name}`);
        console.log(`${' '.repeat(depth * 2 + 3)}• Nível: ${child.level}`);
        console.log(`${' '.repeat(depth * 2 + 3)}• Quantidade: ${child.baseUnitQuantity} un. base`);
        console.log(`${' '.repeat(depth * 2 + 3)}• Dimensões: ${child.dimensions.length}×${child.dimensions.width}×${child.dimensions.height}cm`);
        
        buildTree(child.id, depth + 1);
      });
    };

    buildTree();
    console.log();
  }
}

// Executar demonstração
function runDemo() {
  console.log('🚀 DEMONSTRAÇÃO: Sistema de Hierarquia de Embalagens');
  console.log('🎯 Cenário: 1 unidade → 2 unidades → 10 unidades');
  console.log('═'.repeat(60));
  console.log();

  const demo = new PackagingHierarchyDemo();
  
  // 1. Criar hierarquia
  demo.createExampleHierarchy(123, 1);
  
  // 2. Validar integridade
  demo.validateHierarchyIntegrity();
  
  // 3. Mostrar estrutura
  demo.displayHierarchy();
  
  // 4. Demonstrar conversões
  demo.demonstrateConversions();
  
  console.log('✨ Demonstração concluída com sucesso!');
  console.log('═'.repeat(60));
}

// Executar se chamado diretamente
if (typeof module !== 'undefined' && require.main === module) {
  runDemo();
}

module.exports = { PackagingHierarchyDemo, runDemo };