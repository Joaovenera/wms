import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  serial,
  integer,
  decimal,
  boolean,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth.schema";
import { pallets } from "./pallets.schema";
import { positions } from "./positions.schema";
import { products, packagingTypes } from "./products.schema";

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

// UCP relations
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
  history: many(ucpHistory),
  movements: many(movements),
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

export const itemTransfersRelations = relations(itemTransfers, ({ one }) => ({
  sourceUcp: one(ucps, {
    fields: [itemTransfers.sourceUcpId],
    references: [ucps.id],
  }),
  targetUcp: one(ucps, {
    fields: [itemTransfers.targetUcpId],
    references: [ucps.id],
  }),
  sourceItem: one(ucpItems, {
    fields: [itemTransfers.sourceItemId],
    references: [ucpItems.id],
  }),
  targetItem: one(ucpItems, {
    fields: [itemTransfers.targetItemId],
    references: [ucpItems.id],
  }),
  product: one(products, {
    fields: [itemTransfers.productId],
    references: [products.id],
  }),
  performedBy: one(users, {
    fields: [itemTransfers.performedBy],
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
export const insertUcpSchema = createInsertSchema(ucps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

// Types
export type Ucp = typeof ucps.$inferSelect;
export type InsertUcp = z.infer<typeof insertUcpSchema>;
export type UcpItem = typeof ucpItems.$inferSelect;
export type InsertUcpItem = z.infer<typeof insertUcpItemSchema>;
export type UcpHistory = typeof ucpHistory.$inferSelect;
export type InsertUcpHistory = z.infer<typeof insertUcpHistorySchema>;
export type ItemTransfer = typeof itemTransfers.$inferSelect;
export type InsertItemTransfer = z.infer<typeof insertItemTransferSchema>;
export type Movement = typeof movements.$inferSelect;
export type InsertMovement = z.infer<typeof insertMovementSchema>;