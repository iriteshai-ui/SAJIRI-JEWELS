import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";
import { productsTable } from "./products";

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  productName: text("product_name").notNull(),
  category: text("category").default("Jewellery"),
  metalType: text("metal_type").default("Gold"),
  purity: text("purity").default("22K 916"),
  grossWeight: numeric("gross_weight", { precision: 10, scale: 3 }).default("0.000"),
  netWeight: numeric("net_weight", { precision: 10, scale: 3 }).default("0.000"),
  metalRate: numeric("metal_rate", { precision: 10, scale: 2 }).default("0.00"),
  makingCharges: numeric("making_charges", { precision: 10, scale: 2 }).default("0.00"),
  hallmarkUid: text("hallmark_uid"),
  hsnCode: text("hsn_code").default("7113"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true, createdAt: true });
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItemsTable.$inferSelect;
