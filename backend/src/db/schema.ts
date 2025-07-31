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
  unit: varchar("unit").notNull(), // un, kg, l, etc.
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
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id),
  fromLocation: varchar("from_location").notNull(), // Santa Catarina
  toLocation: varchar("to_location").notNull(), // São Paulo
  status: varchar("status").notNull().default("planejamento"), // planejamento, aprovado, carregamento, transito, finalizado, cancelado
  totalCubicVolume: decimal("total_cubic_volume", { precision: 10, scale: 3 }).default("0"), // m³ calculado
  effectiveCapacity: decimal("effective_capacity", { precision: 10, scale: 3 }), // Capacidade com margem de segurança
  capacityUsagePercent: decimal("capacity_usage_percent", { precision: 5, scale: 2 }).default("0"), // % utilização
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
