-- ============================================================================
-- Migration 002: Add categories table & fashion jewellery attributes to products
-- ============================================================================

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS "categories" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "parent_id" INTEGER REFERENCES "categories"("id") ON DELETE SET NULL,
  "description" TEXT DEFAULT '',
  "icon" TEXT DEFAULT 'Sparkles',
  "display_order" INTEGER DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Alter Products Table to include fashion jewellery columns
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sku" TEXT DEFAULT '';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category_id" INTEGER REFERENCES "categories"("id") ON DELETE SET NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "subcategory" TEXT DEFAULT '';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "material" TEXT DEFAULT 'Anti-Tarnish Premium Alloy';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "color" TEXT DEFAULT 'Gold';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "style" TEXT DEFAULT 'Contemporary';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "design" TEXT DEFAULT 'Modern';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "images" JSON NOT NULL DEFAULT '[]'::json;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "compare_at_price" NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

-- Supplier columns (Admin-only)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "supplier_cost" NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "supplier_source" TEXT DEFAULT '';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "supplier_product_id" TEXT DEFAULT '';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "supplier_sku" TEXT DEFAULT '';

-- Seed initial 13 standard categories
INSERT INTO "categories" ("name", "slug", "icon", "display_order") VALUES
  ('Earrings', 'earrings', 'Sparkles', 1),
  ('Necklace Sets', 'necklace-sets', 'Gem', 2),
  ('Necklaces', 'necklaces', 'CircleDot', 3),
  ('Mangalsutra', 'mangalsutra', 'Heart', 4),
  ('Bangles', 'bangles', 'Circle', 5),
  ('Bracelets', 'bracelets', 'Watch', 6),
  ('Rings', 'rings', 'Fingerprint', 7),
  ('Pendants', 'pendants', 'ShieldAlert', 8),
  ('Anklets', 'anklets', 'Footprints', 9),
  ('Maang Tikka', 'maang-tikka', 'Crown', 10),
  ('Hair Accessories', 'hair-accessories', 'Scissors', 11),
  ('Jewellery Sets', 'jewellery-sets', 'Layers', 12),
  ('Other Fashion Accessories', 'other-accessories', 'Package', 13)
ON CONFLICT ("slug") DO NOTHING;
