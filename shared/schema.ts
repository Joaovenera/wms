import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
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
  status: varchar("status").notNull().default("available"), // available, in_use, defective, maintenance, discard
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
  code: varchar("code").notNull().unique(), // [1,0], [1,1], [1,2], [1,3] formato
  structureId: integer("structure_id").references(() => palletStructures.id),
  street: varchar("street").notNull(), // 01, 02, 03...
  side: varchar("side").notNull(), // E (Esquerdo), D (Direito)
  position: integer("position").notNull(), // 1, 2, 3, 4, 5, 6, 7
  level: integer("level").notNull(), // 0, 1, 2, 3
  status: varchar("status").notNull().default("available"), // available, occupied, reserved, maintenance, blocked
  currentPalletId: integer("current_pallet_id").references(() => pallets.id),
  observations: text("observations"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  addedBy: varchar("added_by").notNull().references(() => users.id),
  addedAt: timestamp("added_at").defaultNow(),
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
  performedBy: varchar("performed_by").notNull().references(() => users.id),
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
}));

export const ucpItemsRelations = relations(ucpItems, ({ one }) => ({
  ucp: one(ucps, {
    fields: [ucpItems.ucpId],
    references: [ucps.id],
  }),
  product: one(products, {
    fields: [ucpItems.productId],
    references: [products.id],
  }),
  addedBy: one(users, {
    fields: [ucpItems.addedBy],
    references: [users.id],
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

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUcpSchema = createInsertSchema(ucps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUcpItemSchema = createInsertSchema(ucpItems).omit({
  id: true,
  addedAt: true,
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

// Types
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
export type InsertUcp = z.infer<typeof insertUcpSchema>;
export type Ucp = typeof ucps.$inferSelect;
export type InsertUcpItem = z.infer<typeof insertUcpItemSchema>;
export type UcpItem = typeof ucpItems.$inferSelect;
export type InsertMovement = z.infer<typeof insertMovementSchema>;
export type Movement = typeof movements.$inferSelect;
export type InsertPalletStructure = z.infer<typeof insertPalletStructureSchema>;
export type PalletStructure = typeof palletStructures.$inferSelect;
