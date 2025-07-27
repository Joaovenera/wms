import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  serial,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth.schema";
import { pallets, palletStructures } from "./pallets.schema";

// Positions table - individual storage positions
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

// Positions relations
export const positionsRelations = relations(positions, ({ one, many }) => ({
  structure: one(palletStructures, {
    fields: [positions.structureId],
    references: [palletStructures.id],
  }),
  currentPallet: one(pallets, {
    fields: [positions.currentPalletId],
    references: [pallets.id],
  }),
  createdBy: one(users, {
    fields: [positions.createdBy],
    references: [users.id],
  }),
  // ucps, movementsFrom, movementsTo relations will be added in main schema
}));

// Zod schemas for validation
export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Position = typeof positions.$inferSelect;
export type InsertPosition = z.infer<typeof insertPositionSchema>;