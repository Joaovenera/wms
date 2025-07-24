// Schemas de validação Zod - substituindo @shared/schema
import { z } from 'zod';

// User schemas
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.string().default("operator"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

export const insertUserSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.string().default("operator"),
});

// Pallet schemas
export const insertPalletSchema = z.object({
  code: z.string().min(1, "Código é obrigatório"),
  type: z.string().min(1, "Tipo é obrigatório"),
  material: z.string().min(1, "Material é obrigatório"),
  width: z.number().positive("Largura deve ser positiva"),
  length: z.number().positive("Comprimento deve ser positivo"),
  height: z.number().positive("Altura deve ser positiva"),
  maxWeight: z.string().min(1, "Peso máximo é obrigatório"),
  status: z.string().default("disponivel"),
  photoUrl: z.string().optional(),
  observations: z.string().optional(),
  lastInspectionDate: z.string().optional(),
  createdBy: z.number(),
});

// Position schemas
export const insertPositionSchema = z.object({
  code: z.string().min(1, "Código é obrigatório"),
  structureId: z.number().optional(),
  street: z.string().min(1, "Rua é obrigatória"),
  side: z.string().min(1, "Lado é obrigatório"),
  corridor: z.string().optional(),
  position: z.number().positive("Posição deve ser positiva"),
  level: z.number().min(0, "Nível deve ser 0 ou maior"),
  rackType: z.string().optional(),
  maxPallets: z.number().positive("Máximo de pallets deve ser positivo").default(1),
  restrictions: z.string().optional(),
  status: z.string().default("disponivel"),
  currentPalletId: z.number().optional(),
  observations: z.string().optional(),
  createdBy: z.number().optional(),
  hasDivision: z.boolean().default(false),
  layoutConfig: z.any().optional(),
});

// Pallet Structure schemas
export const insertPalletStructureSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  street: z.string().min(1, "Rua é obrigatória"),
  side: z.string().min(1, "Lado é obrigatório"),
  maxPositions: z.number().positive("Máximo de posições deve ser positivo"),
  maxLevels: z.number().min(0, "Máximo de níveis deve ser 0 ou maior"),
  rackType: z.string().default("conventional"),
  status: z.string().default("active"),
  observations: z.string().optional(),
  createdBy: z.number(),
});

export const insertPortaPalletSchema = insertPalletStructureSchema;

// Product schemas
export const insertProductSchema = z.object({
  sku: z.string().min(1, "SKU é obrigatório"),
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  unit: z.string().min(1, "Unidade é obrigatória"),
  weight: z.string().optional(),
  dimensions: z.any().optional(),
  barcode: z.string().optional(),
  requiresLot: z.boolean().default(false),
  requiresExpiry: z.boolean().default(false),
  minStock: z.number().min(0, "Estoque mínimo deve ser 0 ou maior").default(0),
  maxStock: z.number().optional(),
  isActive: z.boolean().default(true),
  createdBy: z.number(),
});

// UCP schemas
export const insertUcpSchema = z.object({
  code: z.string().min(1, "Código é obrigatório"),
  palletId: z.number().optional(),
  positionId: z.number().optional(),
  status: z.string().default("active"),
  observations: z.string().optional(),
  createdBy: z.number(),
});

// Packaging schemas
export const insertPackagingTypeSchema = z.object({
  productId: z.number(),
  name: z.string().min(1, "Nome é obrigatório"),
  barcode: z.string().optional(),
  baseUnitQuantity: z.string().min(1, "Quantidade da unidade base é obrigatória"),
  isBaseUnit: z.boolean().default(false),
  parentPackagingId: z.number().optional(),
  level: z.number().min(1, "Nível deve ser 1 ou maior").default(1),
  dimensions: z.any().optional(),
  isActive: z.boolean().default(true),
  createdBy: z.number(),
});

export const scanBarcodeSchema = z.object({
  barcode: z.string().min(1, 'Código de barras é obrigatório')
});

export const optimizePickingSchema = z.object({
  productId: z.number().int().positive('ID do produto deve ser um número positivo'),
  requestedBaseUnits: z.number().positive('Quantidade solicitada deve ser positiva')
});

export const convertQuantitySchema = z.object({
  quantity: z.number().positive('Quantidade deve ser positiva'),
  fromPackagingId: z.number().int().positive('ID da embalagem de origem obrigatório'),
  toPackagingId: z.number().int().positive('ID da embalagem de destino obrigatório')
});

// UCP Item schemas
export const insertUcpItemSchema = z.object({
  ucpId: z.number(),
  productId: z.number(),
  quantity: z.string().min(1, "Quantidade é obrigatória"),
  lot: z.string().optional(),
  expiryDate: z.string().optional(),
  internalCode: z.string().optional(),
  packagingTypeId: z.number().optional(),
  packagingQuantity: z.string().optional(),
  addedBy: z.number(),
  removedBy: z.number().optional(),
  removalReason: z.string().optional(),
});

// UCP History schemas
export const insertUcpHistorySchema = z.object({
  ucpId: z.number(),
  action: z.string().min(1, "Ação é obrigatória"),
  description: z.string().min(1, "Descrição é obrigatória"),
  oldValue: z.any().optional(),
  newValue: z.any().optional(),
  itemId: z.number().optional(),
  fromPositionId: z.number().optional(),
  toPositionId: z.number().optional(),
  performedBy: z.number(),
});

// Movement schemas
export const insertMovementSchema = z.object({
  type: z.string().min(1, "Tipo é obrigatório"),
  ucpId: z.number().optional(),
  productId: z.number().optional(),
  fromPositionId: z.number().optional(),
  toPositionId: z.number().optional(),
  quantity: z.string().optional(),
  lot: z.string().optional(),
  reason: z.string().optional(),
  performedBy: z.string().min(1, "Responsável é obrigatório"),
});

// Vehicle schemas
export const insertVehicleSchema = z.object({
  code: z.string().min(1, "Código é obrigatório"),
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.string().min(1, "Tipo é obrigatório"),
  cubicCapacity: z.string().min(1, "Capacidade cúbica é obrigatória"),
  weightCapacity: z.string().optional(),
  status: z.string().default("disponivel"),
  observations: z.string().optional(),
  isActive: z.boolean().default(true),
  createdBy: z.number(),
});

// Transfer Request schemas
export const insertTransferRequestSchema = z.object({
  code: z.string().min(1, "Código é obrigatório"),
  vehicleId: z.number().min(1, "Veículo é obrigatório"),
  fromLocation: z.string().min(1, "Local de origem é obrigatório"),
  toLocation: z.string().min(1, "Local de destino é obrigatório"),
  notes: z.string().optional(),
  createdBy: z.number(),
});

export const insertTransferRequestItemSchema = z.object({
  transferRequestId: z.number(),
  productId: z.number().min(1, "Produto é obrigatório"),
  quantity: z.string().min(1, "Quantidade é obrigatória"),
  notes: z.string().optional(),
  addedBy: z.number(),
});

// Loading Execution schemas
export const insertLoadingExecutionSchema = z.object({
  transferRequestId: z.number().min(1, "Pedido de transferência é obrigatório"),
  operatorId: z.number(),
  observations: z.string().optional(),
});

export const scanItemSchema = z.object({
  productId: z.number().min(1, "Produto é obrigatório"),
  quantity: z.string().min(1, "Quantidade é obrigatória"),
  scannedCode: z.string().optional(),
});

export const registerDivergenceSchema = z.object({
  divergenceReason: z.enum([
    'falta_espaco', 
    'item_avariado', 
    'divergencia_estoque', 
    'item_nao_localizado'
  ], { errorMap: () => ({ message: "Motivo de divergência inválido" }) }),
  divergenceComments: z.string().optional(),
});

export const updateTransferStatusSchema = z.object({
  status: z.enum([
    'planejamento',
    'aprovado', 
    'carregamento', 
    'transito', 
    'finalizado', 
    'cancelado'
  ], { errorMap: () => ({ message: "Status inválido" }) }),
  notes: z.string().optional(),
}); 