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
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth.schema";

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

// Packaging Types table - Hierarquia de embalagens
export const packagingTypes: any = pgTable("packaging_types", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  name: varchar("name", { length: 100 }).notNull(),
  barcode: varchar("barcode", { length: 255 }),
  baseUnitQuantity: decimal("base_unit_quantity", { precision: 10, scale: 3 }).notNull(),
  isBaseUnit: boolean("is_base_unit").default(false),
  parentPackagingId: integer("parent_packaging_id").references(() => (packagingTypes as any).id),
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

// Product relations
export const productsRelations = relations(products, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [products.createdBy],
    references: [users.id],
  }),
  photos: many(productPhotos),
  photoHistory: many(productPhotoHistory),
  packagingTypes: many(packagingTypes),
  // ucpItems and movements relations will be added in main schema
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

// Zod schemas for validation
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

export const insertPackagingTypeSchema = createInsertSchema(packagingTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPackagingConversionRuleSchema = createInsertSchema(packagingConversionRules).omit({
  id: true,
  createdAt: true,
});

// Types
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductPhoto = typeof productPhotos.$inferSelect;
export type InsertProductPhoto = z.infer<typeof insertProductPhotoSchema>;
export type ProductPhotoHistory = typeof productPhotoHistory.$inferSelect;
export type InsertProductPhotoHistory = z.infer<typeof insertProductPhotoHistorySchema>;
export type PackagingType = typeof packagingTypes.$inferSelect;
export type InsertPackagingType = z.infer<typeof insertPackagingTypeSchema>;
export type PackagingConversionRule = typeof packagingConversionRules.$inferSelect;
export type InsertPackagingConversionRule = z.infer<typeof insertPackagingConversionRuleSchema>;