-- Migration: Create all tables for SAJIRI JEWELS Billing & Inventory System
-- Safe to re-run: uses IF NOT EXISTS throughout.
-- ============================================================================

-- 1. Users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "username" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'user',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Metal Rates table (Live / Daily Gold, Silver, Platinum rates)
CREATE TABLE IF NOT EXISTS "metal_rates" (
  "id" SERIAL PRIMARY KEY,
  "gold_24k" NUMERIC(10, 2) NOT NULL DEFAULT 7650.00,
  "gold_22k" NUMERIC(10, 2) NOT NULL DEFAULT 7010.00,
  "gold_18k" NUMERIC(10, 2) NOT NULL DEFAULT 5740.00,
  "silver" NUMERIC(10, 2) NOT NULL DEFAULT 92.50,
  "platinum" NUMERIC(10, 2) NOT NULL DEFAULT 3200.00,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_by_id" INTEGER REFERENCES "users"("id")
);

-- 3. Products table (Jewellery Items)
CREATE TABLE IF NOT EXISTS "products" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "price" NUMERIC(12, 2) NOT NULL,
  "available_quantity" INTEGER NOT NULL DEFAULT 0,
  "category" TEXT NOT NULL DEFAULT 'Jewellery',
  "metal_type" TEXT NOT NULL DEFAULT 'Gold',
  "purity" TEXT NOT NULL DEFAULT '22K 916',
  "gross_weight" NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
  "net_weight" NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
  "stone_weight" NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
  "making_charges_type" TEXT NOT NULL DEFAULT 'per_gram',
  "making_charges_value" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  "hallmark_uid" TEXT,
  "hsn_code" TEXT NOT NULL DEFAULT '7113',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Orders table (Jewellery Invoices)
CREATE TABLE IF NOT EXISTS "orders" (
  "id" SERIAL PRIMARY KEY,
  "invoice_number" TEXT NOT NULL UNIQUE,
  "customer_name" TEXT NOT NULL,
  "customer_mobile" TEXT NOT NULL,
  "customer_email" TEXT,
  "customer_address" TEXT,
  "customer_pan" TEXT,
  "subtotal" NUMERIC(12, 2) NOT NULL,
  "gst_percentage" NUMERIC(5, 2) NOT NULL DEFAULT 3.00,
  "gst_amount" NUMERIC(12, 2) NOT NULL,
  "referral_charges" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "discount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "old_gold_weight" NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
  "old_gold_rate" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  "old_gold_amount" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  "old_gold_notes" TEXT,
  "grand_total" NUMERIC(12, 2) NOT NULL,
  "paid_amount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "pending_amount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "payment_method" TEXT NOT NULL DEFAULT 'Cash',
  "status" TEXT NOT NULL DEFAULT 'completed',
  "created_by_id" INTEGER REFERENCES "users"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Order items table (with jewellery breakdown)
CREATE TABLE IF NOT EXISTS "order_items" (
  "id" SERIAL PRIMARY KEY,
  "order_id" INTEGER NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "product_id" INTEGER NOT NULL REFERENCES "products"("id"),
  "product_name" TEXT NOT NULL,
  "category" TEXT DEFAULT 'Jewellery',
  "metal_type" TEXT DEFAULT 'Gold',
  "purity" TEXT DEFAULT '22K 916',
  "gross_weight" NUMERIC(10, 3) DEFAULT 0.000,
  "net_weight" NUMERIC(10, 3) DEFAULT 0.000,
  "metal_rate" NUMERIC(10, 2) DEFAULT 0.00,
  "making_charges" NUMERIC(10, 2) DEFAULT 0.00,
  "hallmark_uid" TEXT,
  "hsn_code" TEXT DEFAULT '7113',
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit_price" NUMERIC(12, 2) NOT NULL,
  "total" NUMERIC(12, 2) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Order payments table
CREATE TABLE IF NOT EXISTS "order_payments" (
  "id" SERIAL PRIMARY KEY,
  "order_id" INTEGER NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "amount" NUMERIC(12, 2) NOT NULL,
  "payment_method" TEXT NOT NULL DEFAULT 'Cash',
  "remarks" TEXT NOT NULL,
  "created_by_id" INTEGER REFERENCES "users"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Inventory transactions table
CREATE TABLE IF NOT EXISTS "inventory_transactions" (
  "id" SERIAL PRIMARY KEY,
  "product_id" INTEGER NOT NULL REFERENCES "products"("id"),
  "product_name" TEXT NOT NULL,
  "previous_quantity" INTEGER NOT NULL,
  "quantity_added" INTEGER,
  "quantity_reduced" INTEGER,
  "current_quantity" INTEGER NOT NULL,
  "action_type" TEXT NOT NULL,
  "updated_by_id" INTEGER REFERENCES "users"("id"),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Session table
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL PRIMARY KEY,
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
