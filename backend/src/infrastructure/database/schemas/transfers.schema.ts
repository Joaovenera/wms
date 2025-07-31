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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth.schema";
import { products } from "./products.schema";

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
  loadingExecutions: many(loadingExecutions),
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

// Zod schemas for validation
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