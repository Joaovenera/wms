import {
  pgTable,
  text,
  varchar,
  timestamp,
  serial,
  integer,
  decimal,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth.schema";

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

// Pallet relations
export const palletsRelations = relations(pallets, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [pallets.createdBy],
    references: [users.id],
  }),
  // ucps and other relations will be added in the main schema
}));

export const palletStructuresRelations = relations(palletStructures, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [palletStructures.createdBy],
    references: [users.id],
  }),
  // positions relation will be added in positions schema
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

// Types
export type Pallet = typeof pallets.$inferSelect;
export type InsertPallet = z.infer<typeof insertPalletSchema>;
export type PalletStructure = typeof palletStructures.$inferSelect;
export type InsertPalletStructure = z.infer<typeof insertPalletStructureSchema>;