import { Request, Response } from 'express';
import { db } from '../db';
import { pallets, positions, ucps, products } from '../db/schema';
import { ilike, or, eq } from 'drizzle-orm';

// Assuming these types are defined elsewhere in your backend, e.g., in a shared types file
interface Pallet {
  id: string;
  code: string;
  type: string;
  material: string;
  width: number;
  length: number;
  height: number;
  maxWeight: number;
  status: string;
  observations?: string;
}

interface Position {
  id: string;
  code: string;
  street: string;
  side: string;
  corridor: string;
  level: string;
  maxPallets: number;
  status: string;
  observations?: string;
}

interface Ucp {
  id: string;
  code: string;
  pallet?: { code: string };
  position?: { code: string };
  items?: any[];
  status: string;
  observations?: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  brand?: string;
  unit: string;
  status: string;
  observations?: string;
}

// This interface should match the frontend's ScanResultItem
interface ScanResultItem {
  type: 'pallet' | 'position' | 'ucp' | 'product';
  code: string;
  data: Pallet | Position | Ucp | Product;
}

export const unifiedSearch = async (req: Request, res: Response) => {
  const { query } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ message: 'Query parameter is required and must be a string.' });
  }

  let raw = query.trim();
  let parsedType: string | null = null;
  let parsedCode: string | null = null;

  // Try to parse JSON payloads coming from QR codes like {"type":"PALLET","code":"PLT0002"}
  try {
    if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('"{') && raw.endsWith('}"'))) {
      const json = JSON.parse(raw.replace(/^"|"$/g, ''));
      if (json && typeof json === 'object') {
        if (typeof json.code === 'string') parsedCode = String(json.code).trim();
        if (typeof json.type === 'string') parsedType = String(json.type).trim().toLowerCase();
      }
    }
  } catch {
    // ignore parse error and fall back to raw
  }

  const normalized = (parsedCode || raw).trim();
  const searchTerm = normalized.toLowerCase();
  const results: ScanResultItem[] = [];

  try {
    // Determine which entities to search based on parsedType (if provided)
    const wantPallet = !parsedType || parsedType === 'pallet' || parsedType === 'layers' || parsedType === 'plt' || /^plt/i.test(normalized);
    const wantPosition = !parsedType || parsedType === 'position' || /^rua|^pp-|^pos/i.test(normalized);
    const wantUcp = !parsedType || parsedType === 'ucp';
    const wantProduct = !parsedType || parsedType === 'product' || parsedType === 'sku';

    // --- Pallet Search (prefer exact, then ilike) ---
    if (wantPallet) {
      let foundPallets = await db.select().from(pallets).where(eq(pallets.code, normalized));
      if (!foundPallets.length) {
        foundPallets = await db.select().from(pallets).where(ilike(pallets.code, `%${searchTerm}%`));
      }
      foundPallets.forEach(pallet => {
        results.push({ type: 'pallet', code: pallet.code, data: pallet as Pallet });
      });
    }

    // --- Position Search ---
    if (wantPosition) {
      let foundPositions = await db.select().from(positions).where(eq(positions.code, normalized));
      if (!foundPositions.length) {
        foundPositions = await db.select().from(positions).where(ilike(positions.code, `%${searchTerm}%`));
      }
      foundPositions.forEach(position => {
        results.push({ type: 'position', code: position.code, data: position as Position });
      });
    }

    // --- UCP Search ---
    if (wantUcp) {
      let foundUcps = await db.select().from(ucps).where(eq(ucps.code, normalized));
      if (!foundUcps.length) {
        foundUcps = await db.select().from(ucps).where(ilike(ucps.code, `%${searchTerm}%`));
      }
      foundUcps.forEach(ucp => {
        results.push({ type: 'ucp', code: ucp.code, data: ucp as Ucp });
      });
    }

    // --- Product Search ---
    if (wantProduct) {
      let foundProducts = await db.select().from(products).where(eq(products.sku, normalized));
      if (!foundProducts.length) {
        foundProducts = await db.select().from(products).where(or(ilike(products.sku, `%${searchTerm}%`), ilike(products.name, `%${searchTerm}%`)));
      }
      foundProducts.forEach(product => {
        results.push({ type: 'product', code: product.sku, data: product as Product });
      });
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error('Error during unified search:', error);
    return res.status(500).json({ message: 'Internal server error during search.' });
  }
};