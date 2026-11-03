import { pgTable, text, serial, integer, numeric, timestamp, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  compareAtPrice: numeric("compare_at_price", { precision: 12, scale: 2 }).notNull().default("0.00"),
  availableQuantity: integer("available_quantity").notNull().default(0),
  sku: text("sku").default(""),
  categoryId: integer("category_id").references(() => categoriesTable.id),
  category: text("category").notNull().default("Jewellery"),
  subcategory: text("subcategory").default(""),
  metalType: text("metal_type").notNull().default("Gold Plated"), // Gold, Silver, Stainless Steel, Brass, Diamond, etc.
  purity: text("purity").notNull().default("Anti-Tarnish"),
  material: text("material").default("Anti-Tarnish Premium Alloy"),
  color: text("color").default("Gold"),
  style: text("style").default("Contemporary"),
  design: text("design").default("Modern"),
  images: json("images").$type<string[]>().default([]).notNull(),
  grossWeight: numeric("gross_weight", { precision: 10, scale: 3 }).notNull().default("0.000"),
  netWeight: numeric("net_weight", { precision: 10, scale: 3 }).notNull().default("0.000"),
  stoneWeight: numeric("stone_weight", { precision: 10, scale: 3 }).notNull().default("0.000"),
  makingChargesType: text("making_charges_type").notNull().default("per_gram"),
  makingChargesValue: numeric("making_charges_value", { precision: 10, scale: 2 }).notNull().default("0.00"),
  hallmarkUid: text("hallmark_uid"),
  hsnCode: text("hsn_code").notNull().default("7113"),
  isFeatured: boolean("is_featured").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),

  // Internal / Supplier Tracking (Strictly Admin-Only - NEVER returned on customer APIs)
  supplierCost: numeric("supplier_cost", { precision: 12, scale: 2 }).default("0.00"),
  supplierSource: text("supplier_source").default(""),
  supplierProductId: text("supplier_product_id").default(""),
  supplierSku: text("supplier_sku").default(""),

  // Supplier Verification & Audit Tracking
  isVerified: boolean("is_verified").default(false).notNull(),
  sourceUrl: text("source_url").default(""),
  verificationStatus: text("verification_status").default("unverified").notNull(),
  verificationNotes: text("verification_notes").default(""),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
