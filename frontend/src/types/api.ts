export interface TransferRequest {
  id: number;
  code: string;
  status: string;
  type: string;
  fromLocation: string;
  toLocation: string;
  vehicleName?: string;
  vehicleCode?: string;
  supplierName?: string;
  clientInfo?: {
    clientName: string;
    clientDocument?: string;
    contactInfo?: string;
  };
  transporterName?: string;
  estimatedArrival?: string;
  createdAt: string;
  createdByName: string;
  notes?: string;
}

export interface LoadingExecution {
  id: number;
  status: string;
  startedAt: string;
  finishedAt?: string;
  transferRequestId: number;
  transferRequestCode: string;
  operatorName: string;
}

export interface LoadingItem {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  requestedQuantity: string;
  loadedQuantity: string;
  notLoadedQuantity: string;
  confirmedAt?: string;
  scannedAt?: string;
  divergenceReason?: string;
  divergenceComments?: string;
  transferRequestItemId: number;
}

// Product types used across desktop and mobile products pages
export interface ProductDimensions {
  length: number;
  width: number;
  height: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  ncm?: string;
  unit: string;
  unitsPerPackage?: string;
  weight?: number;
  dimensions?: ProductDimensions;
  barcode?: string;
  requiresLot?: boolean;
  requiresExpiry?: boolean;
  minStock?: number;
  maxStock?: number;
  isActive?: boolean;
  totalStock?: number;
  // Flexible extra fields returned by some endpoints
  [key: string]: unknown;
}

export type InsertProduct = Omit<Product, 'id' | 'totalStock'> & {
  createdBy?: number;
};

// Pallet types used across pallets pages
export interface Pallet {
  id: number;
  code: string;
  type: string;
  material: string;
  width: number; // cm
  length: number; // cm
  height: number; // cm
  maxWeight: number; // kg
  status: string;
  photoUrl?: string;
  observations?: string;
  lastInspectionDate?: string;
  createdBy: number;
  createdAt?: string;
  updatedAt?: string;
}

export type InsertPallet = Omit<Pallet, 'id' | 'createdAt' | 'updatedAt' | 'maxWeight'> & {
  // In forms we send maxWeight as string to preserve decimals compatible with backend decimal
  maxWeight: string;
};

// Storage Position types used across porta-paletes and positions pages
export interface Position {
  id: number;
  code: string;
  structureId?: number;
  street: string;
  side: string;
  corridor?: string;
  position: number;
  level: number; // 0 = térreo
  rackType?: string;
  maxPallets: number;
  restrictions?: string;
  status: string; // disponivel | ocupada | reservada | manutencao | bloqueada
  currentPalletId?: number;
  observations?: string;
  createdBy?: number;
  hasDivision?: boolean;
  layoutConfig?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export type InsertPosition = Omit<Position, 'id' | 'createdAt' | 'updatedAt' | 'currentPalletId'>;

// Pallet Structure types used across porta-paletes page
export interface PalletStructure {
  id: number;
  name: string;
  street: string;
  side: string; // E | D
  maxPositions: number;
  maxLevels: number; // where 0 is ground level
  rackType?: string;
  status?: string;
  observations?: string;
  createdBy?: number;
  createdAt?: string;
  updatedAt?: string;
}