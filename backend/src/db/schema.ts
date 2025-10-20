import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  serial,
  integer,
  decimal,
  boolean,
  date,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table
export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// User storage table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  role: varchar("role", { length: 50 }).notNull().default("operator"), // admin, operator
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pallets table
export const pallets = pgTable("pallets", {
  id: serial("id").primaryKey(),
  code: varchar("code").notNull().unique(),
  type: varchar("type").notNull(), // PBR, Europeu, Chep, etc.
  material: varchar("material").notNull(), // Madeira, Plástico, Metal
  width: integer("width").notNull(), // cm
  length: integer("length").notNull(), // cm
  height: integer("height").notNull(), // cm
  maxWeight: decimal("max_weight", { precision: 10, scale: 2 }).notNull(), // kg
  status: varchar("status").notNull().default("disponivel"), // disponivel, em_uso, defeituoso, recuperacao, descarte
  photoUrl: varchar("photo_url"),
  observations: text("observations"),
  lastInspectionDate: date("last_inspection_date"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pallet structures table - defines the rack structure
export const palletStructures = pgTable("pallet_structures", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(), // Nome da estrutura (ex: "Porta-Pallet Rua 01 Lado E")
  street: varchar("street").notNull(), // 01, 02, 03...
  side: varchar("side").notNull(), // E (Esquerdo), D (Direito)
  maxPositions: integer("max_positions").notNull(), // número de posições (1-7)
  maxLevels: integer("max_levels").notNull(), // número de níveis (0-3)
  rackType: varchar("rack_type").default("conventional"), // Convencional, Drive-in, Push-back
  status: varchar("status").notNull().default("active"),
  observations: text("observations"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Rack positions table - individual storage positions
export const positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  code: varchar("code").notNull().unique(), // PP-01-01-0 formato
  structureId: integer("structure_id").references(() => palletStructures.id),
  street: varchar("street").notNull(), // 01, 02, 03...
  side: varchar("side").notNull(), // E (Esquerdo), D (Direito)
  corridor: varchar("corridor"), // Campo existente no banco
  position: integer("position").notNull(), // 1, 2, 3, 4, 5, 6, 7
  level: integer("level").notNull(), // 0, 1, 2, 3
  rackType: varchar("rack_type"), // Tipo do rack
  maxPallets: integer("max_pallets").notNull().default(1), // Máximo de pallets por posição
  restrictions: text("restrictions"), // Restrições da posição
  status: varchar("status").notNull().default("disponivel"), // disponivel, ocupada, reservada, manutencao, bloqueada
  currentPalletId: integer("current_pallet_id").references(() => pallets.id),
  observations: text("observations"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  hasDivision: boolean("has_division").default(false), // Se a posição tem divisão central
  layoutConfig: jsonb("layout_config"), // Configuração do layout visual
});

// Products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: varchar("sku").notNull().unique(),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category"),
  brand: varchar("brand"),
  ncm: varchar("ncm"),
  unit: varchar("unit").notNull(), // un, kg, l, etc.
  unitsPerPackage: decimal("units_per_package", { precision: 10, scale: 3 }).default('1'), // quantidade por unidade de embalagem
  weight: decimal("weight", { precision: 10, scale: 3 }), // kg
  dimensions: jsonb("dimensions"), // {width, length, height}
  barcode: varchar("barcode"),
  requiresLot: boolean("requires_lot").default(false),
  requiresExpiry: boolean("requires_expiry").default(false),
  minStock: integer("min_stock").default(0),
  maxStock: integer("max_stock"),
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product Photos table
export const productPhotos = pgTable("product_photos", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  filename: varchar("filename").notNull(), // Original filename
  path: varchar("path").notNull(), // Storage path
  url: varchar("url").notNull(), // Original resolution URL (base64 or file path)
  thumbnailUrl: varchar("thumbnail_url"), // Thumbnail resolution URL (base64 or file path)
  size: integer("size").notNull(), // File size in bytes
  mimeType: varchar("mime_type").notNull(), // image/jpeg, image/png, etc.
  width: integer("width"), // Image width in pixels
  height: integer("height"), // Image height in pixels
  isPrimary: boolean("is_primary").default(false), // Main product photo
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  isActive: boolean("is_active").default(true),
}, (table) => ({
  // Ensure only one primary photo per product
  uniquePrimaryPhoto: index("unique_primary_photo_per_product").on(table.productId, table.isPrimary),
}));

// Product Photo History table - Track all photo changes
export const productPhotoHistory = pgTable("product_photo_history", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  photoId: integer("photo_id").references(() => productPhotos.id), // null for deletions
  action: varchar("action").notNull(), // 'added', 'removed', 'set_primary', 'unset_primary'
  filename: varchar("filename"), // Store filename for history
  isPrimary: boolean("is_primary"), // Store if it was primary at the time
  performedBy: integer("performed_by").notNull().references(() => users.id),
  performedAt: timestamp("performed_at").defaultNow(),
  notes: text("notes"), // Optional notes about the change
});

// UCPs (Unidades de Carga Paletizada) table
export const ucps = pgTable("ucps", {
  id: serial("id").primaryKey(),
  code: varchar("code").notNull().unique(), // UCP-20250618-0001
  palletId: integer("pallet_id").references(() => pallets.id),
  positionId: integer("position_id").references(() => positions.id),
  status: varchar("status").notNull().default("active"), // active, empty, archived
  observations: text("observations"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// UCP Items table (products within UCPs)
export const ucpItems = pgTable("ucp_items", {
  id: serial("id").primaryKey(),
  ucpId: integer("ucp_id").notNull().references(() => ucps.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  lot: varchar("lot"),
  expiryDate: date("expiry_date"),
  internalCode: varchar("internal_code"), // CI - Código Interno for individual tracking
  packagingTypeId: integer("packaging_type_id").references(() => packagingTypes.id),
  packagingQuantity: decimal("packaging_quantity", { precision: 10, scale: 3 }),
  addedBy: integer("added_by").notNull().references(() => users.id),
  addedAt: timestamp("added_at").defaultNow(),
  removedBy: integer("removed_by").references(() => users.id),
  removedAt: timestamp("removed_at"),
  removalReason: text("removal_reason"), // sale, damage, transfer, etc.
  isActive: boolean("is_active").default(true),
});

// UCP History/Audit table for complete lifecycle tracking
export const ucpHistory = pgTable("ucp_history", {
  id: serial("id").primaryKey(),
  ucpId: integer("ucp_id").notNull().references(() => ucps.id),
  action: varchar("action").notNull(), // created, item_added, item_removed, moved, status_changed, dismantled
  description: text("description").notNull(),
  oldValue: jsonb("old_value"), // Previous state for tracking changes
  newValue: jsonb("new_value"), // New state after change
  itemId: integer("item_id").references(() => ucpItems.id), // If action relates to specific item
  fromPositionId: integer("from_position_id").references(() => positions.id),
  toPositionId: integer("to_position_id").references(() => positions.id),
  performedBy: integer("performed_by").notNull().references(() => users.id),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Packaging Types table - Hierarquia de embalagens
export const packagingTypes: any = pgTable("packaging_types", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  name: varchar("name", { length: 100 }).notNull(),
  barcode: varchar("barcode", { length: 255 }),
  baseUnitQuantity: decimal("base_unit_quantity", { precision: 10, scale: 3 }).notNull(),
  isBaseUnit: boolean("is_base_unit").default(false),
  parentPackagingId: integer("parent_packaging_id"),
  level: integer("level").notNull().default(1),
  dimensions: jsonb("dimensions"),
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueBaseUnitPerProduct: uniqueIndex("unique_base_unit_per_product")
    .on(table.productId).where(sql`is_base_unit = true`),
  uniqueBarcodeWhenNotNull: uniqueIndex("unique_barcode_when_not_null")
    .on(table.barcode).where(sql`barcode IS NOT NULL`),
}));

// Packaging Conversion Rules table - Regras de conversão entre embalagens
export const packagingConversionRules = pgTable("packaging_conversion_rules", {
  id: serial("id").primaryKey(),
  fromPackagingId: integer("from_packaging_id").notNull().references(() => packagingTypes.id),
  toPackagingId: integer("to_packaging_id").notNull().references(() => packagingTypes.id),
  conversionFactor: decimal("conversion_factor", { precision: 10, scale: 3 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueConversionRule: uniqueIndex("unique_conversion_rule")
    .on(table.fromPackagingId, table.toPackagingId),
}));

// Item Transfers table - Registro detalhado de transferências entre UCPs
export const itemTransfers = pgTable("item_transfers", {
  id: serial("id").primaryKey(),
  sourceUcpId: integer("source_ucp_id").notNull().references(() => ucps.id),
  targetUcpId: integer("target_ucp_id").notNull().references(() => ucps.id),
  sourceItemId: integer("source_item_id").references(() => ucpItems.id), // Item original (pode ser null se removido)
  targetItemId: integer("target_item_id").references(() => ucpItems.id), // Item criado/atualizado no destino
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  lot: varchar("lot"),
  reason: text("reason").notNull(),
  transferType: varchar("transfer_type").notNull(), // 'partial' | 'complete'
  performedBy: integer("performed_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Movement history table
export const movements = pgTable("movements", {
  id: serial("id").primaryKey(),
  type: varchar("type").notNull(), // reception, shipment, transfer, adjustment
  ucpId: integer("ucp_id").references(() => ucps.id),
  productId: integer("product_id").references(() => products.id),
  fromPositionId: integer("from_position_id").references(() => positions.id),
  toPositionId: integer("to_position_id").references(() => positions.id),
  quantity: decimal("quantity", { precision: 10, scale: 3 }),
  lot: varchar("lot"),
  reason: text("reason"),
  performedBy: integer("performed_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  createdPallets: many(pallets),
  createdPositions: many(positions),
  createdProducts: many(products),
  createdUcps: many(ucps),
  ucpItems: many(ucpItems),
  movements: many(movements),
}));

export const palletsRelations = relations(pallets, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [pallets.createdBy],
    references: [users.id],
  }),
  ucps: many(ucps),
}));

export const palletStructuresRelations = relations(palletStructures, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [palletStructures.createdBy],
    references: [users.id],
  }),
  positions: many(positions),
}));

export const positionsRelations = relations(positions, ({ one, many }) => ({
  structure: one(palletStructures, {
    fields: [positions.structureId],
    references: [palletStructures.id],
  }),
  currentPallet: one(pallets, {
    fields: [positions.currentPalletId],
    references: [pallets.id],
  }),
  ucps: many(ucps),
  movementsFrom: many(movements, { relationName: "fromPosition" }),
  movementsTo: many(movements, { relationName: "toPosition" }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [products.createdBy],
    references: [users.id],
  }),
  ucpItems: many(ucpItems),
  movements: many(movements),
  photos: many(productPhotos),
  photoHistory: many(productPhotoHistory),
  packagingTypes: many(packagingTypes),
}));

export const productPhotosRelations = relations(productPhotos, ({ one }) => ({
  product: one(products, {
    fields: [productPhotos.productId],
    references: [products.id],
  }),
  uploadedBy: one(users, {
    fields: [productPhotos.uploadedBy],
    references: [users.id],
  }),
}));

export const productPhotoHistoryRelations = relations(productPhotoHistory, ({ one }) => ({
  product: one(products, {
    fields: [productPhotoHistory.productId],
    references: [products.id],
  }),
  photo: one(productPhotos, {
    fields: [productPhotoHistory.photoId],
    references: [productPhotos.id],
  }),
  performedBy: one(users, {
    fields: [productPhotoHistory.performedBy],
    references: [users.id],
  }),
}));

export const ucpsRelations = relations(ucps, ({ one, many }) => ({
  pallet: one(pallets, {
    fields: [ucps.palletId],
    references: [pallets.id],
  }),
  position: one(positions, {
    fields: [ucps.positionId],
    references: [positions.id],
  }),
  createdBy: one(users, {
    fields: [ucps.createdBy],
    references: [users.id],
  }),
  items: many(ucpItems),
  movements: many(movements),
  history: many(ucpHistory),
}));

export const ucpItemsRelations = relations(ucpItems, ({ one, many }) => ({
  ucp: one(ucps, {
    fields: [ucpItems.ucpId],
    references: [ucps.id],
  }),
  product: one(products, {
    fields: [ucpItems.productId],
    references: [products.id],
  }),
  packagingType: one(packagingTypes, {
    fields: [ucpItems.packagingTypeId],
    references: [packagingTypes.id],
  }),
  addedByUser: one(users, {
    fields: [ucpItems.addedBy],
    references: [users.id],
  }),
  removedByUser: one(users, {
    fields: [ucpItems.removedBy],
    references: [users.id],
  }),
  historyEntries: many(ucpHistory),
}));

export const ucpHistoryRelations = relations(ucpHistory, ({ one }) => ({
  ucp: one(ucps, {
    fields: [ucpHistory.ucpId],
    references: [ucps.id],
  }),
  item: one(ucpItems, {
    fields: [ucpHistory.itemId],
    references: [ucpItems.id],
  }),
  fromPosition: one(positions, {
    fields: [ucpHistory.fromPositionId],
    references: [positions.id],
  }),
  toPosition: one(positions, {
    fields: [ucpHistory.toPositionId],
    references: [positions.id],
  }),
  performedByUser: one(users, {
    fields: [ucpHistory.performedBy],
    references: [users.id],
  }),
}));

export const packagingTypesRelations = relations(packagingTypes, ({ one, many }) => ({
  product: one(products, {
    fields: [packagingTypes.productId],
    references: [products.id],
  }),
  createdBy: one(users, {
    fields: [packagingTypes.createdBy],
    references: [users.id],
  }),
  parentPackaging: one(packagingTypes, {
    fields: [packagingTypes.parentPackagingId],
    references: [packagingTypes.id],
    relationName: "parentChild",
  }),
  childPackagings: many(packagingTypes, {
    relationName: "parentChild",
  }),
  ucpItems: many(ucpItems),
  conversionRulesFrom: many(packagingConversionRules, {
    relationName: "fromPackaging",
  }),
  conversionRulesTo: many(packagingConversionRules, {
    relationName: "toPackaging",
  }),
}));

export const packagingConversionRulesRelations = relations(packagingConversionRules, ({ one }) => ({
  fromPackaging: one(packagingTypes, {
    fields: [packagingConversionRules.fromPackagingId],
    references: [packagingTypes.id],
    relationName: "fromPackaging",
  }),
  toPackaging: one(packagingTypes, {
    fields: [packagingConversionRules.toPackagingId],
    references: [packagingTypes.id],
    relationName: "toPackaging",
  }),
}));

export const movementsRelations = relations(movements, ({ one }) => ({
  ucp: one(ucps, {
    fields: [movements.ucpId],
    references: [ucps.id],
  }),
  product: one(products, {
    fields: [movements.productId],
    references: [products.id],
  }),
  fromPosition: one(positions, {
    fields: [movements.fromPositionId],
    references: [positions.id],
    relationName: "fromPosition",
  }),
  toPosition: one(positions, {
    fields: [movements.toPositionId],
    references: [positions.id],
    relationName: "toPosition",
  }),
  performedBy: one(users, {
    fields: [movements.performedBy],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const insertPalletSchema = createInsertSchema(pallets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPalletStructureSchema = createInsertSchema(palletStructures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortaPalletSchema = createInsertSchema(palletStructures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductPhotoSchema = createInsertSchema(productPhotos).omit({
  id: true,
  uploadedAt: true,
});

export const insertProductPhotoHistorySchema = createInsertSchema(productPhotoHistory).omit({
  id: true,
  performedAt: true,
});

export const insertUcpSchema = createInsertSchema(ucps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPackagingTypeSchema = createInsertSchema(packagingTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPackagingConversionRuleSchema = createInsertSchema(packagingConversionRules).omit({
  id: true,
  createdAt: true,
});

export const insertUcpItemSchema = createInsertSchema(ucpItems).omit({
  id: true,
  addedAt: true,
  removedAt: true,
  isActive: true,
});

export const insertUcpHistorySchema = createInsertSchema(ucpHistory).omit({
  id: true,
  timestamp: true,
});

export const insertItemTransferSchema = createInsertSchema(itemTransfers).omit({
  id: true,
  createdAt: true,
});

export const insertMovementSchema = createInsertSchema(movements).omit({
  id: true,
  createdAt: true,
});

// User schemas for authentication
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export const registerSchema = insertUserSchema.extend({
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

// Vehicles table - Cadastro de Veículos da Frota
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  code: varchar("code").notNull().unique(), // Código interno do veículo
  name: varchar("name").notNull(), // Nome/apelido do veículo
  brand: varchar("brand").notNull(), // Marca do veículo (Mercedes-Benz, Volvo, etc.)
  model: varchar("model").notNull(), // Modelo do veículo (Atego 1719, FH540, etc.)
  licensePlate: varchar("license_plate").notNull(), // Placa do veículo
  type: varchar("type").notNull(), // Caminhão, Van, etc.
  weightCapacity: varchar("weight_capacity").notNull(), // Capacidade de peso (ex: "5000 kg")
  cargoAreaLength: decimal("cargo_area_length", { precision: 10, scale: 3 }).notNull(), // Comprimento em metros
  cargoAreaWidth: decimal("cargo_area_width", { precision: 10, scale: 3 }).notNull(), // Largura em metros
  cargoAreaHeight: decimal("cargo_area_height", { precision: 10, scale: 3 }).notNull(), // Altura em metros
  // Manter cubicCapacity para compatibilidade com sistema existente (calculado automaticamente)
  cubicCapacity: decimal("cubic_capacity", { precision: 10, scale: 3 }), // m³ (calculado das dimensões)
  status: varchar("status").notNull().default("disponivel"), // disponivel, em_uso, manutencao, inativo
  observations: text("observations"),
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transfer Requests table - Pedidos de Transferência
export const transferRequests = pgTable("transfer_requests", {
  id: serial("id").primaryKey(),
  code: varchar("code").notNull().unique(), // TR-20250724-0001
  type: varchar("type").notNull(), // container-arrival-plan, truck-arrival-plan, delivery-arrival-plan, transfer-plan, withdrawal-plan
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id),
  fromLocation: varchar("from_location").notNull(), // Santa Catarina
  toLocation: varchar("to_location").notNull(), // São Paulo
  status: varchar("status").notNull().default("planejamento"), // planejamento, aprovado, carregamento, transito, finalizado, cancelado
  totalCubicVolume: decimal("total_cubic_volume", { precision: 10, scale: 3 }).default("0"), // m³ calculado
  effectiveCapacity: decimal("effective_capacity", { precision: 10, scale: 3 }), // Capacidade com margem de segurança
  capacityUsagePercent: decimal("capacity_usage_percent", { precision: 5, scale: 2 }).default("0"), // % utilização
  // Operation-specific fields
  supplierName: varchar("supplier_name"), // For arrival plans (container, truck, delivery)
  transporterName: varchar("transporter_name"), // For delivery arrivals
  estimatedArrival: timestamp("estimated_arrival"), // For arrival plans
  clientInfo: jsonb("client_info"), // For withdrawal plans: {clientName, clientDocument?, contactInfo?}
  notes: text("notes"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transfer Request Items table - Itens dos Pedidos de Transferência
export const transferRequestItems = pgTable("transfer_request_items", {
  id: serial("id").primaryKey(),
  transferRequestId: integer("transfer_request_id").notNull().references(() => transferRequests.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unitCubicVolume: decimal("unit_cubic_volume", { precision: 10, scale: 6 }), // m³ por unidade
  totalCubicVolume: decimal("total_cubic_volume", { precision: 10, scale: 3 }), // m³ total do item
  notes: text("notes"),
  addedBy: integer("added_by").notNull().references(() => users.id),
  addedAt: timestamp("added_at").defaultNow(),
});

// Loading Executions table - Execuções de Carregamento
export const loadingExecutions = pgTable("loading_executions", {
  id: serial("id").primaryKey(),
  transferRequestId: integer("transfer_request_id").notNull().references(() => transferRequests.id),
  operatorId: integer("operator_id").notNull().references(() => users.id),
  status: varchar("status").notNull().default("em_andamento"), // em_andamento, finalizado, cancelado
  startedAt: timestamp("started_at").defaultNow(),
  finishedAt: timestamp("finished_at"),
  observations: text("observations"),
  
  // Operation-specific execution fields
  executionType: varchar("execution_type"), // matches the operation type from transfer_requests
  containerNumber: varchar("container_number"), // for container operations
  sealNumber: varchar("seal_number"), // for container seal/lacre
  transporterInfo: jsonb("transporter_info"), // transporter details
  driverInfo: jsonb("driver_info"), // driver info for truck operations
  vehiclePlate: varchar("vehicle_plate"), // actual vehicle plate
  deliveryReceipt: varchar("delivery_receipt"), // delivery receipt number
  clientSignatureUrl: varchar("client_signature_url"), // signature image path
  executionPhotos: jsonb("execution_photos"), // array of photo URLs with descriptions
  conditionAssessment: varchar("condition_assessment"), // good, damaged, mixed, unknown
  specialInstructions: text("special_instructions"),
  executionMetadata: jsonb("execution_metadata"), // additional operation-specific data
});

// Loading Items table - Itens Executados no Carregamento
export const loadingItems = pgTable("loading_items", {
  id: serial("id").primaryKey(),
  loadingExecutionId: integer("loading_execution_id").notNull().references(() => loadingExecutions.id),
  transferRequestItemId: integer("transfer_request_item_id").notNull().references(() => transferRequestItems.id),
  productId: integer("product_id").notNull().references(() => products.id),
  requestedQuantity: decimal("requested_quantity", { precision: 10, scale: 3 }).notNull(),
  loadedQuantity: decimal("loaded_quantity", { precision: 10, scale: 3 }).notNull().default("0"),
  notLoadedQuantity: decimal("not_loaded_quantity", { precision: 10, scale: 3 }).notNull().default("0"),
  divergenceReason: varchar("divergence_reason"), // falta_espaco, item_avariado, divergencia_estoque, item_nao_localizado
  divergenceComments: text("divergence_comments"),
  scannedAt: timestamp("scanned_at"),
  confirmedBy: integer("confirmed_by").references(() => users.id),
  confirmedAt: timestamp("confirmed_at"),
});

// Transfer Reports table - Relatórios de Transferência Gerados
export const transferReports = pgTable("transfer_reports", {
  id: serial("id").primaryKey(),
  transferRequestId: integer("transfer_request_id").notNull().references(() => transferRequests.id),
  loadingExecutionId: integer("loading_execution_id").references(() => loadingExecutions.id),
  reportType: varchar("report_type").notNull(), // summary, detailed, divergence_analysis
  reportData: jsonb("report_data").notNull(), // Dados JSON do relatório
  generatedBy: integer("generated_by").notNull().references(() => users.id),
  generatedAt: timestamp("generated_at").defaultNow(),
});

// Vehicle Relations
export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [vehicles.createdBy],
    references: [users.id],
  }),
  transferRequests: many(transferRequests),
}));

// Transfer Request Relations
export const transferRequestsRelations = relations(transferRequests, ({ one, many }) => ({
  vehicle: one(vehicles, {
    fields: [transferRequests.vehicleId],
    references: [vehicles.id],
  }),
  createdBy: one(users, {
    fields: [transferRequests.createdBy],
    references: [users.id],
  }),
  approvedBy: one(users, {
    fields: [transferRequests.approvedBy],
    references: [users.id],
  }),
  items: many(transferRequestItems),
  loadingExecution: many(loadingExecutions),
  reports: many(transferReports),
}));

// Transfer Request Items Relations
export const transferRequestItemsRelations = relations(transferRequestItems, ({ one, many }) => ({
  transferRequest: one(transferRequests, {
    fields: [transferRequestItems.transferRequestId],
    references: [transferRequests.id],
  }),
  product: one(products, {
    fields: [transferRequestItems.productId],
    references: [products.id],
  }),
  addedBy: one(users, {
    fields: [transferRequestItems.addedBy],
    references: [users.id],
  }),
  loadingItems: many(loadingItems),
}));

// Loading Executions Relations
export const loadingExecutionsRelations = relations(loadingExecutions, ({ one, many }) => ({
  transferRequest: one(transferRequests, {
    fields: [loadingExecutions.transferRequestId],
    references: [transferRequests.id],
  }),
  operator: one(users, {
    fields: [loadingExecutions.operatorId],
    references: [users.id],
  }),
  items: many(loadingItems),
  reports: many(transferReports),
}));

// Loading Items Relations
export const loadingItemsRelations = relations(loadingItems, ({ one }) => ({
  loadingExecution: one(loadingExecutions, {
    fields: [loadingItems.loadingExecutionId],
    references: [loadingExecutions.id],
  }),
  transferRequestItem: one(transferRequestItems, {
    fields: [loadingItems.transferRequestItemId],
    references: [transferRequestItems.id],
  }),
  product: one(products, {
    fields: [loadingItems.productId],
    references: [products.id],
  }),
  confirmedBy: one(users, {
    fields: [loadingItems.confirmedBy],
    references: [users.id],
  }),
}));

// Transfer Reports Relations
export const transferReportsRelations = relations(transferReports, ({ one }) => ({
  transferRequest: one(transferRequests, {
    fields: [transferReports.transferRequestId],
    references: [transferRequests.id],
  }),
  loadingExecution: one(loadingExecutions, {
    fields: [transferReports.loadingExecutionId],
    references: [loadingExecutions.id],
  }),
  generatedBy: one(users, {
    fields: [transferReports.generatedBy],
    references: [users.id],
  }),
}));

// Packaging Compositions table - Store complete composition configurations
export const packagingCompositions = pgTable("packaging_compositions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  palletId: integer("pallet_id").notNull().references(() => pallets.id),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, validated, approved, executed
  constraints: jsonb("constraints"), // Max weight, height, volume constraints
  result: jsonb("result"), // Complete composition result with layout, efficiency, etc.
  efficiency: decimal("efficiency", { precision: 5, scale: 2 }), // Overall efficiency score
  totalWeight: decimal("total_weight", { precision: 10, scale: 2 }), // Total weight in kg
  totalVolume: decimal("total_volume", { precision: 10, scale: 6 }), // Total volume in m³
  totalHeight: decimal("total_height", { precision: 8, scale: 2 }), // Total height in cm
  createdBy: integer("created_by").notNull().references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isActive: boolean("is_active").default(true)
});

// Composition Items table - Individual products within compositions
export const compositionItems = pgTable("composition_items", {
  id: serial("id").primaryKey(),
  compositionId: integer("composition_id").notNull().references(() => packagingCompositions.id),
  productId: integer("product_id").notNull().references(() => products.id),
  packagingTypeId: integer("packaging_type_id").references(() => packagingTypes.id),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  position: jsonb("position"), // 3D position {x, y, z}
  dimensions: jsonb("dimensions"), // Product dimensions {width, length, height}
  weight: decimal("weight", { precision: 10, scale: 3 }), // Individual weight
  volume: decimal("volume", { precision: 10, scale: 6 }), // Individual volume
  layer: integer("layer").default(1), // Which layer in the pallet
  sortOrder: integer("sort_order").default(0), // Order within the composition
  notes: text("notes"),
  addedBy: integer("added_by").notNull().references(() => users.id),
  addedAt: timestamp("added_at").defaultNow(),
  isActive: boolean("is_active").default(true)
});

// Composition Reports table - Generated reports and analytics
export const compositionReports = pgTable("composition_reports", {
  id: serial("id").primaryKey(),
  compositionId: integer("composition_id").notNull().references(() => packagingCompositions.id),
  reportType: varchar("report_type", { length: 50 }).notNull(), // summary, detailed, cost_analysis, optimization
  title: varchar("title", { length: 255 }).notNull(),
  reportData: jsonb("report_data").notNull(), // Complete report content
  metrics: jsonb("metrics"), // Performance metrics
  recommendations: jsonb("recommendations"), // AI-generated recommendations
  costAnalysis: jsonb("cost_analysis"), // Cost breakdown and analysis
  executiveSummary: jsonb("executive_summary"), // High-level summary
  generatedBy: integer("generated_by").notNull().references(() => users.id),
  generatedAt: timestamp("generated_at").defaultNow(),
  isActive: boolean("is_active").default(true)
});

// Packaging Compositions Relations
export const packagingCompositionsRelations = relations(packagingCompositions, ({ one, many }) => ({
  pallet: one(pallets, {
    fields: [packagingCompositions.palletId],
    references: [pallets.id],
  }),
  createdBy: one(users, {
    fields: [packagingCompositions.createdBy],
    references: [users.id],
  }),
  approvedBy: one(users, {
    fields: [packagingCompositions.approvedBy],
    references: [users.id],
  }),
  items: many(compositionItems),
  reports: many(compositionReports),
}));

// Composition Items Relations
export const compositionItemsRelations = relations(compositionItems, ({ one }) => ({
  composition: one(packagingCompositions, {
    fields: [compositionItems.compositionId],
    references: [packagingCompositions.id],
  }),
  product: one(products, {
    fields: [compositionItems.productId],
    references: [products.id],
  }),
  packagingType: one(packagingTypes, {
    fields: [compositionItems.packagingTypeId],
    references: [packagingTypes.id],
  }),
  addedBy: one(users, {
    fields: [compositionItems.addedBy],
    references: [users.id],
  }),
}));

// Composition Reports Relations
export const compositionReportsRelations = relations(compositionReports, ({ one }) => ({
  composition: one(packagingCompositions, {
    fields: [compositionReports.compositionId],
    references: [packagingCompositions.id],
  }),
  generatedBy: one(users, {
    fields: [compositionReports.generatedBy],
    references: [users.id],
  }),
}));

// Zod schemas for new tables
export const insertVehicleSchema = z.object({
  code: z.string().min(1, "Código é obrigatório"),
  name: z.string().min(1, "Nome é obrigatório"),
  brand: z.string().min(1, "Marca é obrigatória"),
  model: z.string().min(1, "Modelo é obrigatório"),
  licensePlate: z.string().min(1, "Placa é obrigatória"),
  type: z.string().min(1, "Tipo é obrigatório"),
  weightCapacity: z.string().min(1, "Capacidade de peso é obrigatória"),
  cargoAreaLength: z.number().positive("Comprimento deve ser positivo"),
  cargoAreaWidth: z.number().positive("Largura deve ser positiva"),
  cargoAreaHeight: z.number().positive("Altura deve ser positiva"),
  cubicCapacity: z.string().optional(),
  status: z.string().default("disponivel"),
  observations: z.string().optional(),
  isActive: z.boolean().default(true),
  createdBy: z.number(),
});

export const insertTransferRequestSchema = createInsertSchema(transferRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransferRequestItemSchema = createInsertSchema(transferRequestItems).omit({
  id: true,
  addedAt: true,
});

export const insertLoadingExecutionSchema = createInsertSchema(loadingExecutions).omit({
  id: true,
  startedAt: true,
});

export const insertLoadingItemSchema = createInsertSchema(loadingItems).omit({
  id: true,
});

export const insertTransferReportSchema = createInsertSchema(transferReports).omit({
  id: true,
  generatedAt: true,
});

// Types
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type TransferRequest = typeof transferRequests.$inferSelect;
export type InsertTransferRequest = z.infer<typeof insertTransferRequestSchema>;
export type TransferRequestItem = typeof transferRequestItems.$inferSelect;
export type InsertTransferRequestItem = z.infer<typeof insertTransferRequestItemSchema>;
export type LoadingExecution = typeof loadingExecutions.$inferSelect;
export type InsertLoadingExecution = z.infer<typeof insertLoadingExecutionSchema>;
export type LoadingItem = typeof loadingItems.$inferSelect;
export type InsertLoadingItem = z.infer<typeof insertLoadingItemSchema>;
export type TransferReport = typeof transferReports.$inferSelect;
export type InsertTransferReport = z.infer<typeof insertTransferReportSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type InsertPallet = z.infer<typeof insertPalletSchema>;
export type Pallet = typeof pallets.$inferSelect;
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positions.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProductPhoto = z.infer<typeof insertProductPhotoSchema>;
export type ProductPhoto = typeof productPhotos.$inferSelect;
export type InsertProductPhotoHistory = z.infer<typeof insertProductPhotoHistorySchema>;
export type ProductPhotoHistory = typeof productPhotoHistory.$inferSelect;
export type InsertUcp = z.infer<typeof insertUcpSchema>;
export type Ucp = typeof ucps.$inferSelect;
export type InsertUcpItem = z.infer<typeof insertUcpItemSchema>;
export type UcpItem = typeof ucpItems.$inferSelect;
export type InsertUcpHistory = z.infer<typeof insertUcpHistorySchema>;
export type UcpHistory = typeof ucpHistory.$inferSelect;
export type InsertItemTransfer = z.infer<typeof insertItemTransferSchema>;
export type ItemTransfer = typeof itemTransfers.$inferSelect;
export type InsertMovement = z.infer<typeof insertMovementSchema>;
export type Movement = typeof movements.$inferSelect;
export type InsertPalletStructure = z.infer<typeof insertPalletStructureSchema>;
export type PalletStructure = typeof palletStructures.$inferSelect;
export type InsertPackagingType = z.infer<typeof insertPackagingTypeSchema>;
export type PackagingType = typeof packagingTypes.$inferSelect;
export type InsertPackagingConversionRule = z.infer<typeof insertPackagingConversionRuleSchema>;
export type PackagingConversionRule = typeof packagingConversionRules.$inferSelect;

// Packaging Composition Types
export type PackagingComposition = typeof packagingCompositions.$inferSelect;
export type InsertPackagingComposition = typeof packagingCompositions.$inferInsert;
export type CompositionItem = typeof compositionItems.$inferSelect;
export type InsertCompositionItem = typeof compositionItems.$inferInsert;
export type CompositionReport = typeof compositionReports.$inferSelect;
export type InsertCompositionReport = typeof compositionReports.$inferInsert;

// Stock Alert Rules table - Configure alert thresholds and rules
export const stockAlertRules = pgTable("stock_alert_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  productId: integer("product_id").references(() => products.id), // null for global rules
  category: varchar("category"), // null for product-specific rules
  
  // Alert Thresholds
  minStockThreshold: integer("min_stock_threshold"), // Overrides product.minStock if set
  maxStockThreshold: integer("max_stock_threshold"), // Overrides product.maxStock if set
  criticalStockThreshold: integer("critical_stock_threshold"), // Ultra-low threshold
  
  // Advanced Thresholds
  velocityThreshold: decimal("velocity_threshold", { precision: 10, scale: 3 }), // Items per day
  agingThreshold: integer("aging_threshold"), // Days without movement
  seasonalMultiplier: decimal("seasonal_multiplier", { precision: 5, scale: 2 }), // Seasonal adjustment
  
  // Alert Configuration
  alertTypes: jsonb("alert_types"), // ['low_stock', 'critical_stock', 'overstock', 'no_movement', 'velocity_drop']
  severity: varchar("severity").notNull(), // low, medium, high, critical
  isActive: boolean("is_active").default(true),
  
  // Notification Settings
  notificationMethods: jsonb("notification_methods"), // ['email', 'sms', 'push', 'webhook']
  escalationLevels: jsonb("escalation_levels"), // Escalation configuration
  snoozeUntil: timestamp("snooze_until"), // Temporary snooze
  
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stock Alerts table - Generated alerts from monitoring
export const stockAlerts = pgTable("stock_alerts", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").references(() => stockAlertRules.id),
  productId: integer("product_id").notNull().references(() => products.id),
  
  // Alert Details
  alertType: varchar("alert_type").notNull(), // low_stock, critical_stock, overstock, no_movement, velocity_drop
  severity: varchar("severity").notNull(), // low, medium, high, critical
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  
  // Stock Information
  currentStock: decimal("current_stock", { precision: 10, scale: 3 }).notNull(),
  targetStock: decimal("target_stock", { precision: 10, scale: 3 }), // Expected/target level
  threshold: decimal("threshold", { precision: 10, scale: 3 }), // Threshold that triggered alert
  
  // Calculated Metrics
  daysUntilStockout: integer("days_until_stockout"), // Estimated days to zero stock
  suggestedOrderQuantity: decimal("suggested_order_quantity", { precision: 10, scale: 3 }),
  costImpact: decimal("cost_impact", { precision: 12, scale: 2 }), // Estimated cost impact
  
  // Alert Status
  status: varchar("status").notNull().default("active"), // active, acknowledged, resolved, snoozed
  priority: integer("priority").default(1), // 1=highest, 5=lowest
  acknowledgedBy: integer("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedBy: integer("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  
  // Auto-resolution
  autoResolved: boolean("auto_resolved").default(false),
  parentAlertId: integer("parent_alert_id").references(() => stockAlerts.id), // For escalated alerts
  
  // Metadata
  location: varchar("location"), // Warehouse location
  detectionData: jsonb("detection_data"), // Additional context data
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Alert Notifications table - Track all notifications sent
export const alertNotifications = pgTable("alert_notifications", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id").notNull().references(() => stockAlerts.id),
  
  // Notification Details
  method: varchar("method").notNull(), // email, sms, push, webhook, in_app
  recipient: varchar("recipient").notNull(), // email address, phone, user_id, webhook_url
  subject: varchar("subject"),
  content: text("content").notNull(),
  
  // Delivery Status
  status: varchar("status").notNull().default("pending"), // pending, sent, delivered, failed, bounced
  attemptCount: integer("attempt_count").default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  deliveredAt: timestamp("delivered_at"),
  errorMessage: text("error_message"),
  
  // Response Tracking
  opened: boolean("opened").default(false),
  openedAt: timestamp("opened_at"),
  clicked: boolean("clicked").default(false),
  clickedAt: timestamp("clicked_at"),
  
  // Metadata
  notificationData: jsonb("notification_data"), // Provider-specific data
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Auto-reorder Suggestions table - ML-powered reorder recommendations
export const autoReorderSuggestions = pgTable("auto_reorder_suggestions", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  alertId: integer("alert_id").references(() => stockAlerts.id), // Link to triggering alert
  
  // Recommendation Details
  recommendationType: varchar("recommendation_type").notNull(), // reorder, increase_min_stock, seasonal_adjustment
  suggestedQuantity: decimal("suggested_quantity", { precision: 10, scale: 3 }).notNull(),
  suggestedMinStock: integer("suggested_min_stock"),
  suggestedMaxStock: integer("suggested_max_stock"),
  
  // Analysis Data
  currentVelocity: decimal("current_velocity", { precision: 10, scale: 3 }), // Units per day
  historicalVelocity: decimal("historical_velocity", { precision: 10, scale: 3 }),
  seasonalFactor: decimal("seasonal_factor", { precision: 5, scale: 2 }),
  leadTime: integer("lead_time"), // Days
  serviceLevel: decimal("service_level", { precision: 5, scale: 2 }), // Target service level %
  
  // Cost Analysis
  estimatedCost: decimal("estimated_cost", { precision: 12, scale: 2 }),
  potentialSavings: decimal("potential_savings", { precision: 12, scale: 2 }),
  riskScore: decimal("risk_score", { precision: 5, scale: 2 }), // Risk assessment 0-100
  
  // Confidence and Validation
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }), // AI confidence 0-100
  dataQuality: varchar("data_quality"), // excellent, good, fair, poor
  validationStatus: varchar("validation_status").default("pending"), // pending, approved, rejected, implemented
  
  // Implementation
  status: varchar("status").notNull().default("pending"), // pending, approved, rejected, implemented, expired
  implementedBy: integer("implemented_by").references(() => users.id),
  implementedAt: timestamp("implemented_at"),
  rejectionReason: text("rejection_reason"),
  
  // Metadata
  algorithmVersion: varchar("algorithm_version"),
  analysisData: jsonb("analysis_data"), // Detailed analysis results
  
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Suggestion expiry
});

// Alert Escalation Rules table - Configure escalation workflows
export const alertEscalationRules = pgTable("alert_escalation_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Trigger Conditions
  severity: varchar("severity"), // null = all severities
  alertType: varchar("alert_type"), // null = all types
  productCategory: varchar("product_category"), // null = all categories
  timeUnacknowledged: integer("time_unacknowledged"), // Minutes before escalation
  
  // Escalation Actions
  escalationLevels: jsonb("escalation_levels").notNull(), // Array of escalation steps
  /*
  Example escalation_levels:
  [
    {
      "level": 1,
      "delayMinutes": 15,
      "actions": ["email_supervisor", "increase_priority"],
      "recipients": ["supervisor@company.com"]
    },
    {
      "level": 2,
      "delayMinutes": 60,
      "actions": ["email_manager", "sms_alert", "create_urgent_task"],
      "recipients": ["manager@company.com", "+1234567890"]
    }
  ]
  */
  
  // Rule Configuration
  isActive: boolean("is_active").default(true),
  maxEscalationLevel: integer("max_escalation_level").default(3),
  cooldownPeriod: integer("cooldown_period").default(240), // Minutes between same-type escalations
  
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Alert Actions Log table - Track all actions taken on alerts
export const alertActionsLog = pgTable("alert_actions_log", {
  id: serial("id").primaryKey(),
  alertId: integer("alert_id").notNull().references(() => stockAlerts.id),
  
  // Action Details
  actionType: varchar("action_type").notNull(), // acknowledged, resolved, escalated, snoozed, commented
  actionBy: integer("action_by").references(() => users.id), // null for system actions
  actionData: jsonb("action_data"), // Action-specific data
  
  // System vs Manual
  isSystemAction: boolean("is_system_action").default(false),
  automationRuleId: integer("automation_rule_id"), // ID of automation rule if system action
  
  // Result
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  
  timestamp: timestamp("timestamp").defaultNow(),
});

// Relations for Stock Alert System
export const stockAlertRulesRelations = relations(stockAlertRules, ({ one, many }) => ({
  product: one(products, {
    fields: [stockAlertRules.productId],
    references: [products.id],
  }),
  createdBy: one(users, {
    fields: [stockAlertRules.createdBy],
    references: [users.id],
  }),
  alerts: many(stockAlerts),
}));

export const stockAlertsRelations = relations(stockAlerts, ({ one, many }) => ({
  rule: one(stockAlertRules, {
    fields: [stockAlerts.ruleId],
    references: [stockAlertRules.id],
  }),
  product: one(products, {
    fields: [stockAlerts.productId],
    references: [products.id],
  }),
  acknowledgedByUser: one(users, {
    fields: [stockAlerts.acknowledgedBy],
    references: [users.id],
  }),
  resolvedByUser: one(users, {
    fields: [stockAlerts.resolvedBy],
    references: [users.id],
  }),
  parentAlert: one(stockAlerts, {
    fields: [stockAlerts.parentAlertId],
    references: [stockAlerts.id],
    relationName: "parentChild",
  }),
  childAlerts: many(stockAlerts, {
    relationName: "parentChild",
  }),
  notifications: many(alertNotifications),
  reorderSuggestions: many(autoReorderSuggestions),
  actionsLog: many(alertActionsLog),
}));

export const alertNotificationsRelations = relations(alertNotifications, ({ one }) => ({
  alert: one(stockAlerts, {
    fields: [alertNotifications.alertId],
    references: [stockAlerts.id],
  }),
}));

export const autoReorderSuggestionsRelations = relations(autoReorderSuggestions, ({ one }) => ({
  product: one(products, {
    fields: [autoReorderSuggestions.productId],
    references: [products.id],
  }),
  alert: one(stockAlerts, {
    fields: [autoReorderSuggestions.alertId],
    references: [stockAlerts.id],
  }),
  implementedByUser: one(users, {
    fields: [autoReorderSuggestions.implementedBy],
    references: [users.id],
  }),
}));

export const alertEscalationRulesRelations = relations(alertEscalationRules, ({ one }) => ({
  createdBy: one(users, {
    fields: [alertEscalationRules.createdBy],
    references: [users.id],
  }),
}));

export const alertActionsLogRelations = relations(alertActionsLog, ({ one }) => ({
  alert: one(stockAlerts, {
    fields: [alertActionsLog.alertId],
    references: [stockAlerts.id],
  }),
  actionByUser: one(users, {
    fields: [alertActionsLog.actionBy],
    references: [users.id],
  }),
}));

// Zod schemas for new composition tables
export const insertPackagingCompositionSchema = createInsertSchema(packagingCompositions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompositionItemSchema = createInsertSchema(compositionItems).omit({
  id: true,
  addedAt: true,
});

export const insertCompositionReportSchema = createInsertSchema(compositionReports).omit({
  id: true,
  generatedAt: true,
});

// Zod schemas for Stock Alert System
export const insertStockAlertRuleSchema = createInsertSchema(stockAlertRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStockAlertSchema = createInsertSchema(stockAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAlertNotificationSchema = createInsertSchema(alertNotifications).omit({
  id: true,
  createdAt: true,
});

export const insertAutoReorderSuggestionSchema = createInsertSchema(autoReorderSuggestions).omit({
  id: true,
  createdAt: true,
});

export const insertAlertEscalationRuleSchema = createInsertSchema(alertEscalationRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAlertActionLogSchema = createInsertSchema(alertActionsLog).omit({
  id: true,
  timestamp: true,
});

// Wave Planning Tables

// Orders table - Customer orders for wave planning
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number").notNull().unique(),
  customerId: varchar("customer_id"),
  customerName: varchar("customer_name").notNull(),
  priority: varchar("priority").notNull().default("normal"), // urgent, high, normal, low
  orderType: varchar("order_type").notNull(), // standard, express, bulk
  status: varchar("status").notNull().default("pending"), // pending, allocated, picked, shipped, cancelled
  requestedShipDate: date("requested_ship_date"),
  promiseDate: date("promise_date"),
  totalLines: integer("total_lines").notNull().default(0),
  totalQuantity: decimal("total_quantity", { precision: 10, scale: 3 }).notNull().default("0"),
  totalWeight: decimal("total_weight", { precision: 10, scale: 2 }), // kg
  totalVolume: decimal("total_volume", { precision: 10, scale: 6 }), // m³
  shippingAddress: jsonb("shipping_address"), // Complete address object
  specialInstructions: text("special_instructions"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order Lines table - Individual line items within orders
export const orderLines = pgTable("order_lines", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  lineNumber: integer("line_number").notNull(),
  productId: integer("product_id").notNull().references(() => products.id),
  requestedQuantity: decimal("requested_quantity", { precision: 10, scale: 3 }).notNull(),
  allocatedQuantity: decimal("allocated_quantity", { precision: 10, scale: 3 }).default("0"),
  pickedQuantity: decimal("picked_quantity", { precision: 10, scale: 3 }).default("0"),
  unitWeight: decimal("unit_weight", { precision: 10, scale: 3 }), // kg per unit
  unitVolume: decimal("unit_volume", { precision: 10, scale: 6 }), // m³ per unit
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }), // currency units
  totalLineWeight: decimal("total_line_weight", { precision: 10, scale: 2 }),
  totalLineVolume: decimal("total_line_volume", { precision: 10, scale: 6 }),
  status: varchar("status").notNull().default("pending"), // pending, allocated, picked, shorted
  lotRequirement: varchar("lot_requirement"), // specific lot number if required
  expiryRequirement: date("expiry_requirement"), // minimum expiry date
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Waves table - Wave planning master table
export const waves = pgTable("waves", {
  id: serial("id").primaryKey(),
  waveNumber: varchar("wave_number").notNull().unique(), // WAVE-20250825-001
  name: varchar("name").notNull(),
  description: text("description"),
  status: varchar("status").notNull().default("planned"), // planned, released, picking, completed, cancelled
  waveType: varchar("wave_type").notNull().default("standard"), // standard, express, bulk, replenishment
  priority: varchar("priority").notNull().default("normal"), // urgent, high, normal, low
  templateId: integer("template_id").references(() => waveTemplates.id),
  
  // Planning metrics
  totalOrders: integer("total_orders").notNull().default(0),
  totalLines: integer("total_lines").notNull().default(0),
  totalQuantity: decimal("total_quantity", { precision: 10, scale: 3 }).notNull().default("0"),
  totalWeight: decimal("total_weight", { precision: 10, scale: 2 }), // kg
  totalVolume: decimal("total_volume", { precision: 10, scale: 6 }), // m³
  
  // Optimization metrics
  pickingEfficiency: decimal("picking_efficiency", { precision: 5, scale: 2 }), // % efficiency score
  travelDistance: decimal("travel_distance", { precision: 10, scale: 2 }), // meters
  estimatedPickTime: integer("estimated_pick_time"), // minutes
  utilization: decimal("utilization", { precision: 5, scale: 2 }), // % resource utilization
  
  // Capacity allocation
  allocatedPickers: integer("allocated_pickers"),
  allocatedEquipment: jsonb("allocated_equipment"), // {forklifts: 2, carts: 5, etc}
  estimatedStartTime: timestamp("estimated_start_time"),
  estimatedEndTime: timestamp("estimated_end_time"),
  
  // Actual execution metrics
  actualStartTime: timestamp("actual_start_time"),
  actualEndTime: timestamp("actual_end_time"),
  actualPickTime: integer("actual_pick_time"), // minutes
  actualTravelDistance: decimal("actual_travel_distance", { precision: 10, scale: 2 }),
  
  // Configuration
  waveRules: jsonb("wave_rules"), // Wave configuration rules
  sortingStrategy: varchar("sorting_strategy").default("zone_product"), // zone_product, product_zone, shortest_path
  batchingStrategy: varchar("batching_strategy").default("order_based"), // order_based, zone_based, product_based
  
  createdBy: integer("created_by").notNull().references(() => users.id),
  releasedBy: integer("released_by").references(() => users.id),
  releasedAt: timestamp("released_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wave Orders table - Orders assigned to waves
export const waveOrders = pgTable("wave_orders", {
  id: serial("id").primaryKey(),
  waveId: integer("wave_id").notNull().references(() => waves.id),
  orderId: integer("order_id").notNull().references(() => orders.id),
  sequence: integer("sequence"), // Pick sequence within wave
  priority: integer("priority").default(0), // Priority within wave
  estimatedPickTime: integer("estimated_pick_time"), // minutes
  status: varchar("status").notNull().default("assigned"), // assigned, picking, picked, completed
  assignedAt: timestamp("assigned_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

// Pick Lists table - Optimized picking lists
export const pickLists = pgTable("pick_lists", {
  id: serial("id").primaryKey(),
  waveId: integer("wave_id").notNull().references(() => waves.id),
  listNumber: varchar("list_number").notNull().unique(), // PL-20250825-001
  batchId: varchar("batch_id"), // For batch picking
  pickerId: integer("picker_id").references(() => users.id),
  
  // List characteristics
  listType: varchar("list_type").notNull().default("standard"), // standard, batch, cluster, zone
  zone: varchar("zone"), // Warehouse zone if applicable
  priority: varchar("priority").notNull().default("normal"), // urgent, high, normal, low
  
  // Metrics
  totalStops: integer("total_stops").notNull().default(0),
  totalLines: integer("total_lines").notNull().default(0),
  totalQuantity: decimal("total_quantity", { precision: 10, scale: 3 }).notNull().default("0"),
  estimatedDistance: decimal("estimated_distance", { precision: 10, scale: 2 }), // meters
  estimatedTime: integer("estimated_time"), // minutes
  
  // Route optimization
  optimizedRoute: jsonb("optimized_route"), // Ordered list of positions
  routeAlgorithm: varchar("route_algorithm").default("nearest_neighbor"), // nearest_neighbor, genetic, simulated_annealing
  
  // Execution tracking
  status: varchar("status").notNull().default("created"), // created, assigned, picking, paused, completed, cancelled
  actualStartTime: timestamp("actual_start_time"),
  actualEndTime: timestamp("actual_end_time"),
  actualDistance: decimal("actual_distance", { precision: 10, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pick List Items table - Individual pick tasks
export const pickListItems = pgTable("pick_list_items", {
  id: serial("id").primaryKey(),
  pickListId: integer("pick_list_id").notNull().references(() => pickLists.id),
  orderLineId: integer("order_line_id").notNull().references(() => orderLines.id),
  productId: integer("product_id").notNull().references(() => products.id),
  positionId: integer("position_id").references(() => positions.id),
  ucpId: integer("ucp_id").references(() => ucps.id),
  
  // Pick details
  sequence: integer("sequence").notNull(), // Pick sequence within list
  requestedQuantity: decimal("requested_quantity", { precision: 10, scale: 3 }).notNull(),
  pickedQuantity: decimal("picked_quantity", { precision: 10, scale: 3 }).default("0"),
  shortQuantity: decimal("short_quantity", { precision: 10, scale: 3 }).default("0"),
  
  // Location details
  zone: varchar("zone"),
  aisle: varchar("aisle"),
  bay: varchar("bay"),
  level: varchar("level"),
  
  // Status and tracking
  status: varchar("status").notNull().default("pending"), // pending, picking, picked, shorted, skipped
  reasonCode: varchar("reason_code"), // For shorts/skips
  notes: text("notes"),
  
  // Time tracking
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Wave Templates table - Reusable wave configurations
export const waveTemplates = pgTable("wave_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  templateType: varchar("template_type").notNull().default("standard"), // standard, express, bulk, replenishment
  
  // Selection criteria
  selectionRules: jsonb("selection_rules"), // Complex rules for order selection
  maxOrders: integer("max_orders"),
  maxLines: integer("max_lines"),
  maxWeight: decimal("max_weight", { precision: 10, scale: 2 }),
  maxVolume: decimal("max_volume", { precision: 10, scale: 6 }),
  
  // Optimization settings
  sortingStrategy: varchar("sorting_strategy").default("zone_product"),
  batchingStrategy: varchar("batching_strategy").default("order_based"),
  routeOptimization: boolean("route_optimization").default(true),
  
  // Resource constraints
  maxPickers: integer("max_pickers"),
  requiredEquipment: jsonb("required_equipment"),
  
  // Timing
  cutoffTime: varchar("cutoff_time"), // Daily cutoff time
  processingWindow: jsonb("processing_window"), // Processing time windows
  
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wave Analytics table - Performance tracking and KPIs
export const waveAnalytics = pgTable("wave_analytics", {
  id: serial("id").primaryKey(),
  waveId: integer("wave_id").notNull().references(() => waves.id),
  
  // Performance metrics
  plannedVsActualTime: decimal("planned_vs_actual_time", { precision: 5, scale: 2 }), // % variance
  plannedVsActualDistance: decimal("planned_vs_actual_distance", { precision: 5, scale: 2 }), // % variance
  pickAccuracy: decimal("pick_accuracy", { precision: 5, scale: 2 }), // % accuracy
  pickProductivity: decimal("pick_productivity", { precision: 10, scale: 2 }), // picks per hour
  utilizationRate: decimal("utilization_rate", { precision: 5, scale: 2 }), // % resource utilization
  
  // Quality metrics
  errorCount: integer("error_count").default(0),
  shortCount: integer("short_count").default(0),
  damageCount: integer("damage_count").default(0),
  
  // Efficiency metrics
  totalPicks: integer("total_picks").default(0),
  totalTravelTime: integer("total_travel_time"), // minutes
  totalPickTime: integer("total_pick_time"), // minutes
  averagePickTime: decimal("average_pick_time", { precision: 5, scale: 2 }), // seconds per pick
  
  // Cost analysis
  laborCost: decimal("labor_cost", { precision: 10, scale: 2 }),
  equipmentCost: decimal("equipment_cost", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  costPerPick: decimal("cost_per_pick", { precision: 10, scale: 4 }),
  
  calculatedAt: timestamp("calculated_at").defaultNow(),
});

// Labor Schedule table - Workforce planning
export const laborSchedule = pgTable("labor_schedule", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  shiftDate: date("shift_date").notNull(),
  shiftType: varchar("shift_type").notNull(), // morning, afternoon, night
  startTime: varchar("start_time").notNull(), // HH:mm format
  endTime: varchar("end_time").notNull(), // HH:mm format
  
  // Capacity and skills
  skill: varchar("skill").notNull().default("picker"), // picker, supervisor, equipment_operator
  efficiency: decimal("efficiency", { precision: 3, scale: 2 }).default("1.00"), // Individual efficiency multiplier
  maxWaves: integer("max_waves").default(1), // Max concurrent waves
  
  // Assignment tracking
  assignedWaves: jsonb("assigned_waves"), // Array of wave IDs
  actualHours: decimal("actual_hours", { precision: 4, scale: 2 }),
  
  status: varchar("status").notNull().default("scheduled"), // scheduled, active, break, completed, absent
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Equipment Schedule table - Equipment resource planning
export const equipmentSchedule = pgTable("equipment_schedule", {
  id: serial("id").primaryKey(),
  equipmentType: varchar("equipment_type").notNull(), // forklift, cart, scanner, etc.
  equipmentId: varchar("equipment_id").notNull(), // Unique equipment identifier
  shiftDate: date("shift_date").notNull(),
  shiftType: varchar("shift_type").notNull(),
  
  // Capacity
  maxConcurrentWaves: integer("max_concurrent_waves").default(1),
  
  // Assignment tracking
  assignedWaves: jsonb("assigned_waves"),
  assignedTo: integer("assigned_to").references(() => users.id),
  
  status: varchar("status").notNull().default("available"), // available, assigned, maintenance, broken
  maintenanceWindow: jsonb("maintenance_window"), // Scheduled maintenance times
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wave Optimization Log table - Track optimization decisions
export const waveOptimizationLog = pgTable("wave_optimization_log", {
  id: serial("id").primaryKey(),
  waveId: integer("wave_id").notNull().references(() => waves.id),
  
  algorithmUsed: varchar("algorithm_used").notNull(), // genetic, simulated_annealing, nearest_neighbor, etc.
  optimizationType: varchar("optimization_type").notNull(), // route, batch, resource, hybrid
  
  // Input parameters
  inputParameters: jsonb("input_parameters"),
  constraints: jsonb("constraints"),
  
  // Results
  beforeMetrics: jsonb("before_metrics"), // Metrics before optimization
  afterMetrics: jsonb("after_metrics"), // Metrics after optimization
  improvement: decimal("improvement", { precision: 5, scale: 2 }), // % improvement
  
  // Processing details
  processingTime: integer("processing_time"), // milliseconds
  iterations: integer("iterations"),
  converged: boolean("converged").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// ================================
// QUALITY CONTROL SYSTEM TABLES
// ================================

// Suppliers table - Supplier master data
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  code: varchar("code").notNull().unique(), // SUP-001
  name: varchar("name").notNull(),
  businessName: varchar("business_name"), // Legal business name
  taxId: varchar("tax_id"), // CNPJ/CPF
  email: varchar("email"),
  phone: varchar("phone"),
  address: jsonb("address"), // {street, city, state, zipCode, country}
  contactPerson: varchar("contact_person"),
  supplierType: varchar("supplier_type").notNull(), // manufacturer, distributor, service_provider
  certifications: jsonb("certifications"), // ISO certifications, etc.
  qualityRating: decimal("quality_rating", { precision: 3, scale: 2 }).default("0"), // 0-5 scale
  status: varchar("status").notNull().default("active"), // active, inactive, suspended, blacklisted
  notes: text("notes"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Inspection Templates table - Configurable inspection checklists
export const inspectionTemplates = pgTable("inspection_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category").notNull(), // receiving, shipping, periodic, damage_assessment, supplier_audit
  applicableProducts: jsonb("applicable_products"), // Array of product IDs or categories
  applicableSuppliers: jsonb("applicable_suppliers"), // Array of supplier IDs
  checklistItems: jsonb("checklist_items").notNull(), // Array of inspection items
  requiredPhotos: integer("required_photos").default(0),
  isActive: boolean("is_active").default(true),
  version: varchar("version").default("1.0"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quality Inspections table - Individual inspection records
export const qualityInspections = pgTable("quality_inspections", {
  id: serial("id").primaryKey(),
  code: varchar("code").notNull().unique(), // QI-20250825-0001
  templateId: integer("template_id").notNull().references(() => inspectionTemplates.id),
  inspectionType: varchar("inspection_type").notNull(), // receiving, shipping, periodic, damage_assessment, supplier_audit
  relatedEntityType: varchar("related_entity_type"), // ucp, product, supplier, vehicle, position
  relatedEntityId: integer("related_entity_id"), // Reference to the entity being inspected
  supplierId: integer("supplier_id").references(() => suppliers.id),
  productId: integer("product_id").references(() => products.id),
  ucpId: integer("ucp_id").references(() => ucps.id),
  vehicleId: integer("vehicle_id").references(() => vehicles.id),
  positionId: integer("position_id").references(() => positions.id),
  inspectorId: integer("inspector_id").notNull().references(() => users.id),
  status: varchar("status").notNull().default("in_progress"), // in_progress, completed, failed, cancelled
  overallResult: varchar("overall_result"), // pass, fail, conditional_pass, needs_review
  score: decimal("score", { precision: 5, scale: 2 }), // Overall score (0-100)
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  scheduledDate: date("scheduled_date"),
  location: varchar("location"), // Where inspection was performed
  environmentalConditions: jsonb("environmental_conditions"), // Temperature, humidity, etc.
  inspectionData: jsonb("inspection_data").notNull(), // Detailed inspection results
  findings: jsonb("findings"), // Issues found during inspection
  recommendations: jsonb("recommendations"), // Inspector recommendations
  photosRequired: integer("photos_required").default(0),
  photosUploaded: integer("photos_uploaded").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Inspection Photos table - Photos associated with inspections
export const inspectionPhotos = pgTable("inspection_photos", {
  id: serial("id").primaryKey(),
  inspectionId: integer("inspection_id").notNull().references(() => qualityInspections.id),
  filename: varchar("filename").notNull(),
  originalName: varchar("original_name").notNull(),
  path: varchar("path").notNull(),
  url: varchar("url").notNull(),
  thumbnailUrl: varchar("thumbnail_url"),
  size: integer("size").notNull(),
  mimeType: varchar("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  photoType: varchar("photo_type").notNull(), // general, damage, before, after, compliance
  description: text("description"),
  metadata: jsonb("metadata"), // EXIF data, geolocation, etc.
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

// Damage Reports table - Damage and non-conformance reports
export const damageReports = pgTable("damage_reports", {
  id: serial("id").primaryKey(),
  code: varchar("code").notNull().unique(), // DR-20250825-0001
  inspectionId: integer("inspection_id").references(() => qualityInspections.id),
  reportType: varchar("report_type").notNull(), // damage, non_conformance, quality_issue, contamination
  severity: varchar("severity").notNull(), // low, medium, high, critical
  category: varchar("category").notNull(), // physical_damage, contamination, labeling, packaging, documentation
  relatedEntityType: varchar("related_entity_type").notNull(), // ucp, product, supplier, vehicle, position
  relatedEntityId: integer("related_entity_id").notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  productId: integer("product_id").references(() => products.id),
  ucpId: integer("ucp_id").references(() => ucps.id),
  quantity: decimal("quantity", { precision: 10, scale: 3 }), // Quantity affected
  estimatedValue: decimal("estimated_value", { precision: 12, scale: 2 }), // Financial impact
  currency: varchar("currency").default("USD"),
  description: text("description").notNull(),
  rootCause: text("root_cause"),
  immediateActions: text("immediate_actions"),
  preventiveActions: text("preventive_actions"),
  isInsuranceClaim: boolean("is_insurance_claim").default(false),
  insuranceClaimNumber: varchar("insurance_claim_number"),
  responsibleParty: varchar("responsible_party"), // supplier, carrier, warehouse, customer, unknown
  status: varchar("status").notNull().default("reported"), // reported, investigating, resolved, closed, disputed
  reportedBy: integer("reported_by").notNull().references(() => users.id),
  assignedTo: integer("assigned_to").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  reportedAt: timestamp("reported_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: date("follow_up_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Corrective Actions table - Actions to address quality issues
export const correctiveActions = pgTable("corrective_actions", {
  id: serial("id").primaryKey(),
  code: varchar("code").notNull().unique(), // CA-20250825-0001
  damageReportId: integer("damage_report_id").references(() => damageReports.id),
  inspectionId: integer("inspection_id").references(() => qualityInspections.id),
  actionType: varchar("action_type").notNull(), // corrective, preventive, containment
  priority: varchar("priority").notNull().default("medium"), // low, medium, high, urgent
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  rootCauseAnalysis: text("root_cause_analysis"),
  plannedActions: jsonb("planned_actions").notNull(), // Array of action items
  responsible: integer("responsible").notNull().references(() => users.id),
  assignedTeam: jsonb("assigned_team"), // Array of user IDs
  dueDate: date("due_date").notNull(),
  estimatedCost: decimal("estimated_cost", { precision: 12, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 12, scale: 2 }),
  status: varchar("status").notNull().default("open"), // open, in_progress, completed, verified, closed, cancelled
  effectiveness: varchar("effectiveness"), // effective, partially_effective, ineffective, pending_verification
  progress: decimal("progress", { precision: 5, scale: 2 }).default("0"), // 0-100%
  implementationNotes: text("implementation_notes"),
  verificationCriteria: text("verification_criteria"),
  verifiedBy: integer("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Supplier Scorecards table - Supplier performance tracking
export const supplierScorecards = pgTable("supplier_scorecards", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull().references(() => suppliers.id),
  evaluationPeriod: varchar("evaluation_period").notNull(), // monthly, quarterly, yearly
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }), // 0-100
  deliveryScore: decimal("delivery_score", { precision: 5, scale: 2 }), // 0-100
  serviceScore: decimal("service_score", { precision: 5, scale: 2 }), // 0-100
  complianceScore: decimal("compliance_score", { precision: 5, scale: 2 }), // 0-100
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }), // 0-100
  overallRating: varchar("overall_rating"), // excellent, good, satisfactory, needs_improvement, poor
  metrics: jsonb("metrics").notNull(), // Detailed performance metrics
  kpis: jsonb("kpis"), // Key performance indicators
  strengths: jsonb("strengths"), // Areas of good performance
  weaknesses: jsonb("weaknesses"), // Areas needing improvement
  recommendations: jsonb("recommendations"), // Improvement suggestions
  actionItems: jsonb("action_items"), // Required actions
  totalInspections: integer("total_inspections").default(0),
  passedInspections: integer("passed_inspections").default(0),
  failedInspections: integer("failed_inspections").default(0),
  passRate: decimal("pass_rate", { precision: 5, scale: 2 }), // 0-100%
  totalDamageReports: integer("total_damage_reports").default(0),
  totalDamageValue: decimal("total_damage_value", { precision: 12, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  evaluatedBy: integer("evaluated_by").notNull().references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  evaluatedAt: timestamp("evaluated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniquePeriodPerSupplier: uniqueIndex("unique_period_per_supplier")
    .on(table.supplierId, table.evaluationPeriod, table.periodStart, table.periodEnd),
}));

// Quality Metrics table - System-wide quality KPIs
export const qualityMetrics = pgTable("quality_metrics", {
  id: serial("id").primaryKey(),
  metricDate: date("metric_date").notNull(),
  metricType: varchar("metric_type").notNull(), // daily, weekly, monthly, quarterly, yearly
  totalInspections: integer("total_inspections").default(0),
  passedInspections: integer("passed_inspections").default(0),
  failedInspections: integer("failed_inspections").default(0),
  passRate: decimal("pass_rate", { precision: 5, scale: 2 }), // 0-100%
  totalDamageReports: integer("total_damage_reports").default(0),
  totalDamageValue: decimal("total_damage_value", { precision: 12, scale: 2 }).default("0"),
  averageInspectionScore: decimal("average_inspection_score", { precision: 5, scale: 2 }),
  totalCorrectiveActions: integer("total_corrective_actions").default(0),
  openCorrectiveActions: integer("open_corrective_actions").default(0),
  overdueCorrectiveActions: integer("overdue_corrective_actions").default(0),
  correctiveActionEffectiveness: decimal("corrective_action_effectiveness", { precision: 5, scale: 2 }),
  supplierPerformance: jsonb("supplier_performance"), // Top/bottom performing suppliers
  productQualityTrends: jsonb("product_quality_trends"), // Product-specific quality trends
  nonConformanceRate: decimal("nonconformance_rate", { precision: 5, scale: 2 }),
  firstTimeRightRate: decimal("first_time_right_rate", { precision: 5, scale: 2 }),
  customerComplaints: integer("customer_complaints").default(0),
  customerSatisfactionScore: decimal("customer_satisfaction_score", { precision: 5, scale: 2 }),
  qualityTrends: jsonb("quality_trends"), // Historical trend analysis
  benchmarkData: jsonb("benchmark_data"), // Industry benchmark comparisons
  calculatedBy: integer("calculated_by").references(() => users.id),
  calculatedAt: timestamp("calculated_at").defaultNow(),
  isActive: boolean("is_active").default(true),
}, (table) => ({
  uniqueDateAndType: uniqueIndex("unique_date_and_type")
    .on(table.metricDate, table.metricType),
}));

// Quality Gates table - Quality checkpoints in processes
export const qualityGates = pgTable("quality_gates", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  processType: varchar("process_type").notNull(), // receiving, shipping, storage, transfer, production
  gateType: varchar("gate_type").notNull(), // mandatory, optional, conditional
  triggerConditions: jsonb("trigger_conditions").notNull(), // Conditions that trigger the gate
  passingCriteria: jsonb("passing_criteria").notNull(), // Criteria for passing the gate
  requiredInspections: jsonb("required_inspections"), // Required inspection templates
  blocksProcess: boolean("blocks_process").default(true), // Whether failure blocks the process
  allowOverride: boolean("allow_override").default(false),
  overrideRequiredRole: varchar("override_required_role"), // Role required for override
  escalationRules: jsonb("escalation_rules"), // Escalation procedures for failures
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by").notNull().references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quality Gate Executions table - Individual gate execution records
export const qualityGateExecutions = pgTable("quality_gate_executions", {
  id: serial("id").primaryKey(),
  qualityGateId: integer("quality_gate_id").notNull().references(() => qualityGates.id),
  relatedEntityType: varchar("related_entity_type").notNull(), // ucp, transfer_request, loading_execution
  relatedEntityId: integer("related_entity_id").notNull(),
  executorId: integer("executor_id").notNull().references(() => users.id),
  result: varchar("result").notNull(), // pass, fail, override, skip
  score: decimal("score", { precision: 5, scale: 2 }),
  criteriaMet: jsonb("criteria_met"), // Which criteria were met/failed
  inspectionResults: jsonb("inspection_results"), // Results from required inspections
  overrideReason: text("override_reason"),
  overriddenBy: integer("overridden_by").references(() => users.id),
  overriddenAt: timestamp("overridden_at"),
  executionTime: integer("execution_time"), // Time taken in seconds
  notes: text("notes"),
  executedAt: timestamp("executed_at").defaultNow(),
});

// Compliance Audit Trails table - Comprehensive audit logging
export const complianceAuditTrails = pgTable("compliance_audit_trails", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type").notNull(), // inspection, damage_report, corrective_action, etc.
  entityId: integer("entity_id").notNull(),
  action: varchar("action").notNull(), // created, updated, deleted, approved, rejected, escalated
  oldValues: jsonb("old_values"), // Previous values for updates
  newValues: jsonb("new_values"), // New values for updates
  changedFields: jsonb("changed_fields"), // Specific fields changed
  reason: text("reason"), // Reason for change
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  sessionId: varchar("session_id"),
  correlationId: varchar("correlation_id"), // For tracking related actions
  regulatoryCompliance: jsonb("regulatory_compliance"), // Compliance tags/notes
  performedBy: integer("performed_by").notNull().references(() => users.id),
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata"), // Additional audit metadata
}, (table) => ({
  entityIndex: index("audit_entity_index").on(table.entityType, table.entityId),
  timestampIndex: index("audit_timestamp_index").on(table.timestamp),
  performedByIndex: index("audit_performed_by_index").on(table.performedBy),
}));
