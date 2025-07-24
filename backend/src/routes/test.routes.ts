import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";

const router = Router();

// TEST ENDPOINT - Criar dados de teste para UCP 7
router.post('/create-ucp-items', isAuthenticated, async (req: any, res) => {
  try {
    console.log('Creating test data for UCP items...');
    
    // Verificar se a UCP 7 existe
    const ucp = await storage.getUcp(7);
    if (!ucp) {
      return res.status(404).json({ message: "UCP 7 not found" });
    }
    
    // Buscar produtos existentes
    const products = await storage.getProducts();
    if (products.length === 0) {
      return res.status(400).json({ message: "No products found. Create products first." });
    }
    
    // Adicionar 3 itens de teste à UCP 7
    const testItems = [];
    for (let i = 0; i < Math.min(3, products.length); i++) {
      const product = products[i];
      const itemData = {
        ucpId: 7,
        productId: product.id,
        quantity: (Math.floor(Math.random() * 10) + 1).toString(),
        lot: `LOTE${Date.now()}${i}`,
        internalCode: `CI${Date.now()}${i}`,
        addedBy: req.user.id
      };
      
      try {
        const item = await storage.addUcpItem(itemData, req.user.id);
        testItems.push(item);
        console.log(`Test item added: ${product.name} (${product.sku})`);
      } catch (error) {
        console.error(`Error adding item ${product.name}:`, error);
      }
    }
    
    res.json({ 
      message: `${testItems.length} test items added to UCP 7`,
      items: testItems 
    });
    
  } catch (error) {
    console.error("Error creating test UCP items:", error);
    res.status(500).json({ message: "Failed to create test data" });
  }
});

export default router;
