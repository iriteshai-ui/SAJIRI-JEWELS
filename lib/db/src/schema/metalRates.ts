import { pgTable, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const metalRatesTable = pgTable("metal_rates", {
  id: serial("id").primaryKey(),
  gold24k: numeric("gold_24k", { precision: 10, scale: 2 }).notNull().default("7650.00"), // ₹ per gram
  gold22k: numeric("gold_22k", { precision: 10, scale: 2 }).notNull().default("7010.00"),
  gold18k: numeric("gold_18k", { precision: 10, scale: 2 }).notNull().default("5740.00"),
  silver: numeric("silver", { precision: 10, scale: 2 }).notNull().default("92.50"),
  platinum: numeric("platinum", { precision: 10, scale: 2 }).notNull().default("3200.00"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  updatedById: integer("updated_by_id").references(() => usersTable.id),
});

export const insertMetalRatesSchema = createInsertSchema(metalRatesTable).omit({ id: true, updatedAt: true });
export type InsertMetalRates = z.infer<typeof insertMetalRatesSchema>;
export type MetalRates = typeof metalRatesTable.$inferSelect;
