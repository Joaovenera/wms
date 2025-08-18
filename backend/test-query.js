import { db } from './src/db.js';
import { sql } from 'drizzle-orm';

async function testQuery() {
  try {
    console.log('Testing database connection...');
    
    // Test 1: Check if products table has data
    const productsResult = await db.execute(sql`SELECT COUNT(*) as count FROM products WHERE is_active = true`);
    console.log('Products count:', productsResult.rows[0].count);
    
    // Test 2: Check if ucp_items table has data
    const ucpItemsResult = await db.execute(sql`SELECT COUNT(*) as count FROM ucp_items WHERE is_active = true`);
    console.log('UCP Items count:', ucpItemsResult.rows[0].count);
    
    // Test 3: Check if there are any products with stock
    const stockResult = await db.execute(sql`
      SELECT 
        p.id,
        p.name,
        p.sku,
        COALESCE(SUM(ui.quantity)::decimal, 0) as total_stock
      FROM products p
      LEFT JOIN ucp_items ui ON p.id = ui.product_id AND ui.is_active = true
      WHERE p.is_active = true
      GROUP BY p.id, p.name, p.sku
      HAVING COALESCE(SUM(ui.quantity)::decimal, 0) > 0
      ORDER BY total_stock DESC
      LIMIT 5
    `);
    
    console.log('Products with stock:', stockResult.rows);
    
    // Test 4: Check the full query that's used in getProductsWithStock
    const fullResult = await db.execute(sql`
      SELECT 
        p.*,
        COALESCE(SUM(ui.quantity)::decimal, 0) as total_stock,
        jsonb_agg(
          DISTINCT 
          CASE 
            WHEN ui.id IS NOT NULL THEN 
              jsonb_build_object(
                'ucp_id', u.id,
                'ucp_code', u.code,
                'ucp_type', COALESCE(pal.type, 'N/A'),
                'position_code', pos.code,
                'quantity', ui.quantity,
                'lot', ui.lot,
                'expiry_date', ui.expiry_date,
                'internal_code', ui.internal_code
              )
            ELSE NULL
          END
        ) FILTER (WHERE ui.id IS NOT NULL) as ucp_stock
      FROM products p
      LEFT JOIN ucp_items ui ON p.id = ui.product_id AND ui.is_active = true
      LEFT JOIN ucps u ON ui.ucp_id = u.id
      LEFT JOIN pallets pal ON u.pallet_id = pal.id
      LEFT JOIN positions pos ON u.position_id = pos.id
      WHERE p.is_active = true
      GROUP BY p.id, p.sku, p.name, p.description, p.category, p.brand, p.unit, p.weight, 
               p.dimensions, p.barcode, p.requires_lot, p.requires_expiry, p.min_stock, 
               p.max_stock, p.is_active, p.created_by, p.created_at, p.updated_at
      ORDER BY p.name
      LIMIT 5
    `);
    
    console.log('Full query result count:', fullResult.rows.length);
    console.log('Sample result:', fullResult.rows[0]);
    
  } catch (error) {
    console.error('Error testing query:', error);
  } finally {
    process.exit(0);
  }
}

testQuery();
